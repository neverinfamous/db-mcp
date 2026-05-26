import { buildWhereClause } from "../../../../utils/where-clause.js";
/**
 * JSON Diff Tool
 *
 * Compares two JSON paths within the same row to identify differences.
 * Useful for before/after comparisons, schema change tracking, and
 * data validation across nested JSON structures.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../utils/errors/index.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";

import { JsonDiffSchema, JsonDiffOutputSchema } from "../../schemas/json.js";

/** Hard cap to prevent OOM on large tables */
const MAX_LIMIT = 100;

export function createJsonDiffTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_diff",
    description:
      "Compare two JSON paths within the same row to find differences. Returns each row's values at both paths and whether they are identical. Useful for before/after comparisons in JSON columns.",
    group: "json",
    inputSchema: JsonDiffSchema,
    outputSchema: JsonDiffOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Diff"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = JsonDiffSchema.parse(params);

        // Enforce hard cap on limit
        const effectiveLimit = Math.min(input.limit, MAX_LIMIT);
        if (effectiveLimit < 1) {
          throw new ValidationError(
            "limit must be at least 1",
            "INVALID_INPUT",
          );
        }

        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        // Build query comparing two JSON paths within each row
        let sql = `SELECT rowid,
          json_extract(${column}, ?) as path1_value,
          json_extract(${column}, ?) as path2_value,
          json_extract(${column}, ?) = json_extract(${column}, ?) as identical
        FROM ${table}`;

        const queryParams: unknown[] = [
          input.path1,
          input.path2,
          input.path1,
          input.path2,
        ];

        if (input.conditions || input.whereClause) {
            const { sql: whereSql, params: whereParams } = buildWhereClause(input.conditions, input.whereClause);
            if (whereSql !== "") {
              sql += ` WHERE ${whereSql}`;
              queryParams.push(...whereParams);
            }
          }

        sql += ` LIMIT ${effectiveLimit}`;

        const result = await adapter.executeReadQuery(sql, queryParams);

        const diffs = (result.rows ?? []).map((row) => ({
          rowid:
            typeof row["rowid"] === "number" ? row["rowid"] : undefined,
          path1Value: row["path1_value"],
          path2Value: row["path2_value"],
          identical: row["identical"] === 1,
        }));

        return {
          success: true,
          rowCount: diffs.length,
          diffs,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}


