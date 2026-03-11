/**
 * JSON Query and Aggregation Tools
 *
 * Array append, keys, each/tree, group-array, group-object.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { sanitizeIdentifier, validateWhereClause } from "../../../../utils/index.js";
import { formatError } from "../../../../utils/errors/index.js";
import {
  JsonKeysOutputSchema,
  JsonEachOutputSchema,
  JsonGroupArrayOutputSchema,
  JsonGroupObjectOutputSchema,
} from "../../output-schemas/index.js";
import {
  JsonKeysSchema,
  JsonEachSchema,
  JsonGroupArraySchema,
  JsonGroupObjectSchema,
} from "./helpers.js";

export function createJsonKeysTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_keys",
    description:
      "Get the distinct keys of JSON objects at the specified path (returns unique keys across all matching rows).",
    group: "json",
    inputSchema: JsonKeysSchema,
    outputSchema: JsonKeysOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Keys"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonKeysSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowCount: 0,
          keys: [],
          error: structured.error,
        };
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        const path = input.path ?? "$";
        if (!path.startsWith("$")) {
          return {
            success: false,
            rowCount: 0,
            keys: [],
            error: "JSON path must start with $",
          };
        }

        // Use subquery to avoid ambiguous column when table has a 'key' or 'id' column
        // json_each returns: key, value, type, atom, id, parent, fullkey, path
        let sql: string;
        if (input.whereClause) {
          // With WHERE clause, use subquery to isolate table columns from json_each columns
          // This avoids ambiguity between e.g. table.id and json_each.id
          validateWhereClause(input.whereClause);
          sql = `SELECT DISTINCT json_each.key
                      FROM json_each(
                          (SELECT ${column} FROM ${table} WHERE ${input.whereClause} LIMIT 1),
                          '${path}'
                      )`;
        } else {
          // Without WHERE, simpler subquery avoids 'key' column ambiguity
          sql = `SELECT DISTINCT json_each.key FROM ${table} AS t, json_each(t.${column}, '${path}')`;
        }

        const result = await adapter.executeReadQuery(sql);

        const keys = result.rows?.map((r) => r["key"]) ?? [];

        return {
          success: true,
          rowCount: keys.length,
          keys: keys,
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowCount: 0,
          keys: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Expand JSON to rows
 */
export function createJsonEachTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_each",
    description: "Expand a JSON array or object into rows using json_each().",
    group: "json",
    inputSchema: JsonEachSchema,
    outputSchema: JsonEachOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Each"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonEachSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowCount: 0,
          elements: [],
          error: structured.error,
        };
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        const path = input.path ?? "$";
        if (!path.startsWith("$")) {
          return {
            success: false,
            rowCount: 0,
            elements: [],
            error: "JSON path must start with $",
          };
        }

        // Use table alias and CROSS JOIN to avoid ambiguity with json_each() output columns
        // json_each() returns: key, value, type, atom, id, parent, fullkey, path
        // If the source table has any of these columns (e.g., 'id'), they must be qualified
        let sql = `SELECT t.rowid as row_id, je.key, je.value, je.type FROM ${table} AS t CROSS JOIN json_each(t.${column}, '${path}') AS je`;
        if (input.whereClause) {
          // Qualify unqualified 'id' column references with table alias 't.'
          // This handles: id = X, id IN (...), id BETWEEN, id IS NULL, etc.
          // Won't match already-qualified refs like 't.id' or 'je.id'
          validateWhereClause(input.whereClause);
          const qualifiedWhere = input.whereClause.replace(
            /(?<![.\w])id(?=\s*[=<>!]|\s+(?:IN|BETWEEN|IS|LIKE)\b)/gi,
            "t.id",
          );
          sql += ` WHERE ${qualifiedWhere}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          elements: result.rows,
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowCount: 0,
          elements: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Aggregate values into JSON array
 */
export function createJsonGroupArrayTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_json_group_array",
    description:
      "Aggregate column values into a JSON array using json_group_array().",
    group: "json",
    inputSchema: JsonGroupArraySchema,
    outputSchema: JsonGroupArrayOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Group Array"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonGroupArraySchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowCount: 0,
          rows: [],
          error: structured.error,
        };
      }

      try {
        // Validate table name (always required)
        const table = sanitizeIdentifier(input.table);

        // Allow raw SQL expressions when allowExpressions is true
        // This enables use cases like: json_extract(data, '$.name')
        let valueColumn: string;
        if (input.allowExpressions) {
          // Use expression directly (user takes responsibility for SQL safety)
          valueColumn = input.valueColumn;
        } else {
          // Validate as identifier (default, safe behavior)
          valueColumn = sanitizeIdentifier(input.valueColumn);
        }

        let selectClause = `json_group_array(${valueColumn}) as array_result`;
        let groupByClause = "";

        if (input.groupByColumn) {
          // Apply allowExpressions to groupByColumn as well
          const groupByCol = input.allowExpressions
            ? input.groupByColumn
            : sanitizeIdentifier(input.groupByColumn);
          // Use alias for clean output; for expressions use 'group_key' alias
          const groupAlias = input.allowExpressions
            ? "group_key"
            : input.groupByColumn;
          selectClause = `${groupByCol} AS ${groupAlias}, ${selectClause}`;
          groupByClause = ` GROUP BY ${groupByCol}`;
        }

        let sql = `SELECT ${selectClause} FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += groupByClause;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows ?? [],
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowCount: 0,
          rows: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Aggregate key-value pairs into JSON object
 */
export function createJsonGroupObjectTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_json_group_object",
    description:
      "Aggregate key-value pairs into a JSON object using json_group_object().",
    group: "json",
    inputSchema: JsonGroupObjectSchema,
    outputSchema: JsonGroupObjectOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Group Object"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonGroupObjectSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowCount: 0,
          rows: [],
          error: structured.error,
        };
      }

      try {
        // Validate table name (always required)
        const table = sanitizeIdentifier(input.table);

        // Handle aggregate function mode - uses subquery pattern
        // This enables COUNT(*), SUM(x), AVG(x), etc. as values
        if (input.aggregateFunction) {
          // Build the key column expression
          const keyCol = input.allowExpressions
            ? input.keyColumn
            : sanitizeIdentifier(input.keyColumn);

          // Build subquery that computes the aggregate grouped by key
          let subquery = `SELECT ${keyCol} as agg_key, ${input.aggregateFunction} as agg_value FROM ${table}`;
          if (input.whereClause) {
            validateWhereClause(input.whereClause);
            subquery += ` WHERE ${input.whereClause}`;
          }
          subquery += ` GROUP BY ${keyCol}`;

          // Outer query wraps the aggregates into a JSON object
          const outerSelect = `json_group_object(agg_key, agg_value) as object_result`;
          const outerGroupBy = "";

          if (input.groupByColumn) {
            // For nested grouping, we need a more complex approach with window functions or correlated subqueries
            // For now, outer grouping with aggregates is not supported - return error with guidance
            return {
              success: false,
              error:
                "groupByColumn is not supported when using aggregateFunction. Use a separate query for each group.",
              rowCount: 0,
              rows: [],
            };
          }

          const sql = `SELECT ${outerSelect} FROM (${subquery})${outerGroupBy}`;
          const result = await adapter.executeReadQuery(sql);

          return {
            success: true,
            rowCount: result.rows?.length ?? 0,
            rows: result.rows ?? [],
          };
        }

        // Standard mode: valueColumn is required when not using aggregateFunction
        if (!input.valueColumn) {
          return {
            success: false,
            error:
              "valueColumn is required unless using aggregateFunction parameter",
            rowCount: 0,
            rows: [],
          };
        }

        // Warn when allowExpressions is used without groupByColumn - can produce duplicate keys
        // Each row creates a key-value pair; if multiple rows have the same key, duplicates result
        const duplicateKeyWarning =
          input.allowExpressions && !input.groupByColumn
            ? "Warning: Using allowExpressions without groupByColumn may produce duplicate keys if key values aren't unique. Consider using groupByColumn, aggregateFunction, or ensuring key uniqueness."
            : undefined;

        // Allow raw SQL expressions when allowExpressions is true
        // This enables use cases like: json_extract(data, '$.name')
        let keyColumn: string;
        let valueColumn: string;
        if (input.allowExpressions) {
          // Use expressions directly (user takes responsibility for SQL safety)
          keyColumn = input.keyColumn;
          valueColumn = input.valueColumn;
        } else {
          // Validate as identifiers (default, safe behavior)
          keyColumn = sanitizeIdentifier(input.keyColumn);
          valueColumn = sanitizeIdentifier(input.valueColumn);
        }

        let selectClause = `json_group_object(${keyColumn}, ${valueColumn}) as object_result`;
        let groupByClause = "";

        if (input.groupByColumn) {
          // Apply allowExpressions to groupByColumn as well
          const groupByCol = input.allowExpressions
            ? input.groupByColumn
            : sanitizeIdentifier(input.groupByColumn);
          // Use alias for clean output; for expressions use 'group_key' alias
          const groupAlias = input.allowExpressions
            ? "group_key"
            : input.groupByColumn;
          selectClause = `${groupByCol} AS ${groupAlias}, ${selectClause}`;
          groupByClause = ` GROUP BY ${groupByCol}`;
        }

        let sql = `SELECT ${selectClause} FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += groupByClause;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows ?? [],
          ...(duplicateKeyWarning && { hint: duplicateKeyWarning }),
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowCount: 0,
          rows: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Pretty print and compact JSON
 */
