/**
 * JSON Transform Tools
 *
 * Pretty print, JSONB conversion, storage analysis, column normalization.
 */

import type { SqliteAdapter } from "../../SqliteAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly, write } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatError } from "../../../../utils/errors.js";
import {
  normalizeJson,
  isJsonbSupported,
  detectJsonStorageFormat,
} from "../../json-utils.js";
import {
  JsonPrettyOutputSchema,
  JsonbConvertOutputSchema,
  JsonStorageInfoOutputSchema,
  JsonNormalizeColumnOutputSchema,
} from "../../output-schemas/index.js";
import {
  JsonPrettySchema,
  JsonbConvertSchema,
  JsonStorageInfoSchema,
  JsonNormalizeColumnSchema,
} from "./helpers.js";

export function createJsonPrettyTool(): ToolDefinition {
  return {
    name: "sqlite_json_pretty",
    description: "Format JSON string with indentation for readability.",
    group: "json",
    inputSchema: JsonPrettySchema,
    outputSchema: JsonPrettyOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Pretty"),
    handler: (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonPrettySchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return Promise.resolve({
          success: false,
          error: structured.error,
        });
      }

      try {
        const parsed: unknown = JSON.parse(input.json);
        const pretty = JSON.stringify(parsed, null, 2);
        return Promise.resolve({
          success: true,
          formatted: pretty,
        });
      } catch (error) {
        return Promise.resolve({
          success: false,
          error: error instanceof Error ? error.message : "Invalid JSON",
        });
      }
    },
  };
}

// =============================================================================
// JSONB Tools
// =============================================================================

/**
 * Convert text JSON column to JSONB binary format
 */
export function createJsonbConvertTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_jsonb_convert",
    description:
      "Convert a text JSON column to JSONB binary format for faster processing. Requires SQLite 3.45+.",
    group: "json",
    inputSchema: JsonbConvertSchema,
    outputSchema: JsonbConvertOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSONB Convert"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonbConvertSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowsAffected: 0,
          error: structured.error,
        };
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        // Check JSONB support
        if (!isJsonbSupported()) {
          return {
            success: false,
            error: "JSONB not supported (requires SQLite 3.45+)",
            hint: "Current SQLite version does not support JSONB. Data remains as text JSON.",
          };
        }

        let sql = `UPDATE ${table} SET ${column} = jsonb(${column})`;
        if (input.whereClause) {
          sql += ` WHERE ${input.whereClause}`;
        }

        const result = await adapter.executeWriteQuery(sql);

        return {
          success: true,
          message: `Converted ${result.rowsAffected} rows to JSONB format`,
          rowsAffected: result.rowsAffected,
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowsAffected: 0,
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Get storage format info for a JSON column
 */
export function createJsonStorageInfoTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_json_storage_info",
    description:
      "Analyze storage format of a JSON column (text vs JSONB) and report statistics.",
    group: "json",
    inputSchema: JsonStorageInfoSchema,
    outputSchema: JsonStorageInfoOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Storage Info"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonStorageInfoSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          error: structured.error,
        };
      }

      try {
        // Validate identifiers
        const table = sanitizeIdentifier(input.table);

        // Sample rows to detect format
        const sql = `SELECT ${sanitizeIdentifier(input.column)} FROM ${table} LIMIT ${input.sampleSize}`;
        const result = await adapter.executeReadQuery(sql);

        let textCount = 0;
        let jsonbCount = 0;
        let nullCount = 0;
        let unknownCount = 0;

        for (const row of result.rows ?? []) {
          const value = row[input.column];
          if (value === null || value === undefined) {
            nullCount++;
          } else {
            const format = detectJsonStorageFormat(value);
            if (format === "text") textCount++;
            else if (format === "jsonb") jsonbCount++;
            else unknownCount++;
          }
        }

        const total = result.rows?.length ?? 0;

        return {
          success: true,
          jsonbSupported: isJsonbSupported(),
          sampleSize: total,
          formats: {
            text: textCount,
            jsonb: jsonbCount,
            null: nullCount,
            unknown: unknownCount,
          },
          recommendation:
            // Mixed format: both text and JSONB rows exist
            textCount > 0 && jsonbCount > 0
              ? `Column has mixed formats (${textCount} text, ${jsonbCount} JSONB). Run sqlite_jsonb_convert to unify.`
              : // All text, JSONB supported: recommend conversion
                jsonbCount === 0 && textCount > 0 && isJsonbSupported()
                ? "Column uses text JSON. Consider converting to JSONB for better performance."
                : // All JSONB: already optimal
                  jsonbCount > 0
                  ? "Column already uses JSONB format."
                  : // No JSON data found
                    "No JSON data found in sample.",
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Normalize JSON data in a column for consistent storage
 *
 * Handles both text JSON and JSONB binary format by using SQL's json()
 * function to read the data as text before JavaScript processing.
 */
export function createJsonNormalizeColumnTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_json_normalize_column",
    description:
      "Normalize JSON data in a column (sort keys, compact format) for consistent storage and comparison.",
    group: "json",
    inputSchema: JsonNormalizeColumnSchema,
    outputSchema: JsonNormalizeColumnOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Normalize JSON Column"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonNormalizeColumnSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          error: structured.error,
        };
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        // Select both the raw column value (to detect JSONB format) and the text
        // representation via json(). This allows us to:
        // 1. Detect if original storage is JSONB (binary blob)
        // 2. Get text JSON for normalization processing
        let selectSql = `SELECT _rowid_ AS _rid_, ${column} as raw_data, json(${column}) as json_data FROM ${table}`;
        if (input.whereClause) {
          selectSql += ` WHERE ${input.whereClause}`;
        }

        const selectResult = await adapter.executeReadQuery(selectSql);
        let normalizedCount = 0;
        let unchangedCount = 0;
        let errorCount = 0;
        let firstError: string | undefined;

        // Normalize each row
        for (const row of selectResult.rows ?? []) {
          const rowid = row["_rid_"];
          const rawData = row["raw_data"];
          const jsonData = row["json_data"];

          if (jsonData === null || jsonData === undefined) {
            unchangedCount++;
            continue;
          }

          try {
            const { normalized, wasModified } = normalizeJson(jsonData);

            // Detect if original was stored as JSONB (binary blob)
            // If rawData is not a string, it's likely JSONB binary data
            // better-sqlite3 returns JSONB blobs as Buffer objects
            const wasJsonb =
              rawData !== null &&
              rawData !== undefined &&
              typeof rawData !== "string";

            // Determine target format based on outputFormat parameter
            const targetFormat = input.outputFormat ?? "preserve";
            const shouldOutputJsonb =
              targetFormat === "jsonb" ||
              (targetFormat === "preserve" && wasJsonb);

            // Determine if update is needed:
            // - Content was modified (keys reordered, normalized)
            // - Converting from JSONB to text (when outputFormat is 'text')
            // - Converting from text to JSONB (when outputFormat is 'jsonb')
            const needsFormatChange =
              (wasJsonb && targetFormat === "text") ||
              (!wasJsonb && targetFormat === "jsonb");

            if (wasModified || needsFormatChange) {
              // Use jsonb() wrapper if target is JSONB, otherwise plain text
              const updateSql = shouldOutputJsonb
                ? `UPDATE ${table} SET ${column} = jsonb(?) WHERE rowid = ?`
                : `UPDATE ${table} SET ${column} = ? WHERE rowid = ?`;
              await adapter.executeWriteQuery(updateSql, [normalized, rowid]);
              normalizedCount++;
            } else {
              unchangedCount++;
            }
          } catch (rowError) {
            errorCount++;
            if (errorCount === 1) {
              firstError =
                rowError instanceof Error
                  ? rowError.message
                  : String(rowError);
            }
          }
        }

        const result: Record<string, unknown> = {
          success: true,
          message: `Normalized ${normalizedCount} rows`,
          normalized: normalizedCount,
          unchanged: unchangedCount,
          errors: errorCount,
          total: selectResult.rows?.length ?? 0,
          outputFormat: input.outputFormat ?? "preserve",
        };
        if (firstError) {
          result["firstErrorDetail"] = firstError;
        }
        return result;
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}
