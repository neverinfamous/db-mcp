import { buildWhereClause } from "../../../../utils/where-clause.js";
import {
  JsonSecurityScanOutputSchema,
  JsonSecurityScanSchema,
} from "../../schemas/json.js";
/**
 * JSON Security Scan Tool
 *
 * Scans JSON column data for security issues: PII/sensitive keys,
 * SQL injection patterns, and XSS patterns. Ported from postgres-mcp's
 * pg_jsonb_security_scan with JS-side scanning to work within SQLite's
 * function set (SQLite lacks jsonb_each_text and POSIX regex operators).
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";

// ---------------------------------------------------------------------------
// Detection patterns (ported from postgres-mcp for cross-server parity)
// ---------------------------------------------------------------------------

/**
 * Sensitive key names that may indicate PII or credential storage.
 * Matched case-insensitively against JSON object keys.
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "api_key",
  "apikey",
  "auth",
  "credential",
  "ssn",
  "credit_card",
  "cvv",
]);

/**
 * SQL injection patterns — matches common attack vectors in string values.
 * Equivalent to the postgres-mcp `~*` regex, translated to JS RegExp.
 */
const SQL_INJECTION_PATTERN =
  /\bSELECT\s+.+\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+.+\bSET\b|\bDELETE\s+FROM\b|\bDROP\s+(?:TABLE|DATABASE|INDEX)\b|\bUNION\s+(?:ALL\s+)?SELECT\b|--\s*$|;\s*(?:SELECT|INSERT|UPDATE|DELETE)\b|'\s*OR\s+\d+\s*=\s*\d+/i;

/**
 * XSS patterns — matches common cross-site scripting attack vectors.
 * Equivalent to the postgres-mcp `~*` regex, translated to JS RegExp.
 */
const XSS_PATTERN =
  /<script|javascript:|on(?:click|load|error|mouseover)\s*=|<iframe|<object|<embed|<svg[^>]+on|<img[^>]+onerror/i;

/**
 * Command injection patterns — matches common shell/template injection vectors.
 */
const CMD_INJECTION_PATTERN = /\$\{.*?\}/;

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

/**
 * Create the sqlite_json_security_scan tool.
 *
 * Scans a JSON column for sensitive keys, SQL injection patterns, and XSS
 * patterns. Uses JS-side regex scanning on sampled rows (SQLite lacks
 * jsonb_each_text and POSIX regex operators).
 */
export function createJsonSecurityScanTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_json_security_scan",
    description:
      "Scan a JSON column for security issues (sensitive keys, SQL injection, XSS patterns). Use larger sampleSize for thorough scans.",
    group: "json",
    inputSchema: JsonSecurityScanSchema,
    outputSchema: JsonSecurityScanOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Security Scan"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      
      try {
        input = JsonSecurityScanSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        // Build query — wrap column with json() to handle both text and JSONB
        const queryParams: unknown[] = [];
        let sql = `SELECT json(${column}) as json_data FROM ${table}`;
        if (input.conditions || input.whereClause) {
            const { sql: whereSql, params: whereParams } = buildWhereClause(input.conditions, input.whereClause);
            if (whereSql !== "") {
              sql += ` WHERE ${whereSql}`;
              queryParams.push(...whereParams);
            }
          }
        sql += ` LIMIT ${input.sampleSize}`;

        const result = await adapter.executeReadQuery(sql, queryParams);
        const rows = result.rows ?? [];

        // Accumulate issues per (type, key) pair
        const issueMap = new Map<
          string,
          { type: string; key: string; count: number }
        >();

        for (let i = 0; i < rows.length; i++) {
          // Yield to event loop every 500 rows for large scans
          if (i > 0 && i % 500 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          const row = rows[i];
          if (!row) continue;
          const jsonData = row["json_data"];
          if (jsonData === null || jsonData === undefined) continue;

          let parsed: unknown;
          try {
            parsed =
              typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
          } catch {
            // Skip unparseable rows
            continue;
          }

          // Only scan objects (not arrays or primitives)
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            continue;
          }

          for (const [key, value] of Object.entries(
            parsed as Record<string, unknown>,
          )) {
            // 1. Sensitive key detection
            if (SENSITIVE_KEYS.has(key.toLowerCase())) {
              const mapKey = `sensitive_key:${key}`;
              const existing = issueMap.get(mapKey);
              if (existing) {
                existing.count++;
              } else {
                issueMap.set(mapKey, {
                  type: "sensitive_key",
                  key,
                  count: 1,
                });
              }
            }

            // Only test string values for injection/XSS patterns
            if (typeof value !== "string") continue;

            // 2. SQL injection pattern detection
            if (SQL_INJECTION_PATTERN.test(value)) {
              const mapKey = `sql_injection_pattern:${key}`;
              const existing = issueMap.get(mapKey);
              if (existing) {
                existing.count++;
              } else {
                issueMap.set(mapKey, {
                  type: "sql_injection_pattern",
                  key,
                  count: 1,
                });
              }
            }

            // 3. XSS pattern detection
            if (XSS_PATTERN.test(value)) {
              const mapKey = `xss_pattern:${key}`;
              const existing = issueMap.get(mapKey);
              if (existing) {
                existing.count++;
              } else {
                issueMap.set(mapKey, {
                  type: "xss_pattern",
                  key,
                  count: 1,
                });
              }
            }

            // 4. Command injection pattern detection
            if (CMD_INJECTION_PATTERN.test(value)) {
              const mapKey = `cmd_injection_pattern:${key}`;
              const existing = issueMap.get(mapKey);
              if (existing) {
                existing.count++;
              } else {
                issueMap.set(mapKey, {
                  type: "cmd_injection_pattern",
                  key,
                  count: 1,
                });
              }
            }
          }
        }

        const issues = [...issueMap.values()];

        const response: {
          success: boolean;
          scannedRows: number;
          issues?: { type: string; key: string; count: number }[];
          riskLevel: "low" | "medium" | "high";
        } = {
          success: true,
          scannedRows: rows.length,
          riskLevel:
            issues.length === 0 ? "low" : issues.length < 3 ? "medium" : "high",
        };
        if (issues.length > 0) response.issues = issues;

        return response;
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}


