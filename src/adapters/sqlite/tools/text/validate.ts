/**
 * Text Validation & Normalization Tools
 *
 * Unicode normalization and pattern-based text validation tools.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatHandlerError, ValidationError } from "../../../../utils/errors/index.js";
import { stripAccents, VALIDATION_PATTERNS } from "./formatting.js";
import {
import { ErrorResponseFields } from "../../../../utils/errors/error-response-fields.js";
  TextNormalizeSchema,
  TextValidateSchema,
  validateColumnExists,
} from "./helpers.js";

/**
 * Normalize text (Unicode normalization or accent stripping)
 */
export function createTextNormalizeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_normalize",
    description:
      "Normalize text using Unicode normalization (NFC, NFD, NFKC, NFKD) or strip accents.",
    group: "text",
    inputSchema: TextNormalizeSchema,
    outputSchema: z.object({
      success: z.boolean(),
      rowCount: z.number(),
      rows: z.array(
        z.object({
          original: z.string(),
          normalized: z.string(),
        }),
      ),
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["read"],
    annotations: readOnly("Text Normalize"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextNormalizeSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        let sql = `SELECT ${column} as original FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const rows = (result.rows ?? []).map((row) => {
          const rawOriginal = row["original"];
          const original =
            typeof rawOriginal === "string"
              ? rawOriginal
              : JSON.stringify(rawOriginal ?? "");
          let normalized: string;

          if (input.mode === "strip_accents") {
            normalized = stripAccents(original);
          } else {
            normalized = original.normalize(
              input.mode.toUpperCase() as "NFC" | "NFD" | "NFKC" | "NFKD",
            );
          }

          return { original, normalized };
        });

        return {
          success: true,
          rowCount: rows.length,
          rows,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Validate text against common patterns
 */
export function createTextValidateTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_validate",
    description:
      "Validate text values against patterns: email, phone, URL, UUID, IPv4, or custom regex.",
    group: "text",
    inputSchema: TextValidateSchema,
    outputSchema: z.object({
      success: z.boolean(),
      totalRows: z.number(),
      validCount: z.number(),
      invalidCount: z.number(),
      invalidRows: z.array(
        z.object({
          value: z.string().nullable(),
          rowid: z.number().optional(),
        }),
      ),
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["read"],
    annotations: readOnly("Text Validate"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextValidateSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        // Get validation pattern
        let pattern: RegExp;
        if (input.pattern === "custom") {
          if (!input.customPattern) {
            throw new ValidationError("customPattern is required when pattern='custom'");
          }
          // Normalize pattern: handle common JSON double-escaping issues
          // e.g., "\." in JSON becomes "\." in JavaScript string, but some clients
          // may send "\\\." which becomes "\\" - normalize excessive backslashes
          const normalizedPattern = input.customPattern.replace(/\\\\/g, "\\");
          try {
            pattern = new RegExp(normalizedPattern);
          } catch {
            throw new ValidationError(
              `Invalid regex pattern: ${input.customPattern} (normalized to: ${normalizedPattern})`
            );
          }
        } else {
          const foundPattern = VALIDATION_PATTERNS[input.pattern];
          if (!foundPattern) {
            throw new ValidationError(`Unknown pattern: ${input.pattern}`);
          }
          pattern = foundPattern;
        }

        let sql = `SELECT rowid, ${column} as value FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const invalidRows: { value: string | null; rowid?: number }[] = [];
        let validCount = 0;

        for (const row of result.rows ?? []) {
          const rawValue = row["value"];
          // Handle null/empty values with user-friendly display
          const value =
            rawValue === null || rawValue === undefined
              ? ""
              : typeof rawValue === "string"
                ? rawValue
                : JSON.stringify(rawValue);
          // Display actual value: null for null/undefined, otherwise the value (truncated if long)
          const displayValue =
            rawValue === null || rawValue === undefined
              ? null
              : value.length > 100
                ? value.slice(0, 100) + "..."
                : value;
          if (pattern.test(value)) {
            validCount++;
          } else {
            const rowid = row["rowid"];
            if (typeof rowid === "number") {
              invalidRows.push({ value: displayValue, rowid });
            } else {
              invalidRows.push({ value: displayValue });
            }
          }
        }

        const totalInvalid = invalidRows.length;
        const maxInvalid = input.maxInvalid;
        const truncated = totalInvalid > maxInvalid;

        return {
          success: true,
          totalRows: result.rows?.length ?? 0,
          validCount,
          invalidCount: totalInvalid,
          invalidRows: truncated
            ? invalidRows.slice(0, maxInvalid)
            : invalidRows,
          ...(truncated ? { truncated: true } : {}),
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
