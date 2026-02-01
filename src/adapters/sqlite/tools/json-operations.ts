/**
 * SQLite JSON Operation Tools
 *
 * Low-level JSON functions wrapping SQLite's JSON1 extension:
 * validate, extract, set, remove, type, array/object operations, etc.
 * 12 tools total.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { readOnly, write } from "../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../utils/index.js";
import {
  ValidateJsonSchema,
  JsonExtractSchema,
  JsonSetSchema,
  JsonRemoveSchema,
} from "../types.js";
import {
  JsonValidOutputSchema,
  JsonExtractOutputSchema,
  JsonSetOutputSchema,
  JsonRemoveOutputSchema,
  JsonTypeOutputSchema,
  JsonArrayLengthOutputSchema,
  JsonKeysOutputSchema,
  JsonEachOutputSchema,
  JsonGroupArrayOutputSchema,
  JsonGroupObjectOutputSchema,
  JsonPrettyOutputSchema,
  JsonbConvertOutputSchema,
  JsonStorageInfoOutputSchema,
  JsonNormalizeColumnOutputSchema,
} from "../output-schemas.js";

import {
  normalizeJson,
  isJsonbSupported,
  detectJsonStorageFormat,
} from "../json-utils.js";

// Additional schemas for JSON operations
const JsonTypeSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("JSON path (defaults to $)"),
  whereClause: z.string().optional(),
});

const JsonArrayLengthSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Path to array (defaults to $)"),
  whereClause: z.string().optional(),
});

const JsonArrayAppendSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("Path to array"),
  value: z.unknown().describe("Value to append"),
  whereClause: z.string().describe("WHERE clause"),
});

const JsonKeysSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Path to object (defaults to $)"),
  whereClause: z.string().optional(),
});

const JsonEachSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Path to expand (defaults to $)"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const JsonGroupArraySchema = z.object({
  table: z.string().describe("Table name"),
  valueColumn: z
    .string()
    .describe(
      "Column to aggregate (or SQL expression if allowExpressions is true)",
    ),
  groupByColumn: z
    .string()
    .optional()
    .describe(
      "Column to group by. For JSON collection tables, use allowExpressions with json_extract(data, '$.field') instead.",
    ),
  whereClause: z.string().optional(),
  allowExpressions: z
    .boolean()
    .optional()
    .describe(
      "Allow SQL expressions like json_extract() instead of plain column names",
    ),
});

const JsonGroupObjectSchema = z.object({
  table: z.string().describe("Table name"),
  keyColumn: z
    .string()
    .describe(
      "Column for object keys (or SQL expression if allowExpressions is true)",
    ),
  valueColumn: z
    .string()
    .optional()
    .describe(
      "Column for object values (or SQL expression if allowExpressions is true). For aggregates like COUNT(*), use aggregateFunction instead.",
    ),
  groupByColumn: z
    .string()
    .optional()
    .describe(
      "Column to group by. For JSON collection tables, use allowExpressions with json_extract(data, '$.field') instead.",
    ),
  whereClause: z.string().optional(),
  allowExpressions: z
    .boolean()
    .optional()
    .describe(
      "Allow SQL expressions like json_extract() instead of plain column names. NOTE: Does NOT support aggregate functions - use aggregateFunction parameter instead.",
    ),
  aggregateFunction: z
    .string()
    .optional()
    .describe(
      "Aggregate function to use for values (e.g., 'COUNT(*)', 'SUM(amount)', 'AVG(price)'). When provided, builds object from pre-aggregated subquery results.",
    ),
});

const JsonPrettySchema = z.object({
  json: z.string().describe("JSON string to pretty print"),
});

/**
 * Get all JSON operation tools
 */
export function getJsonOperationTools(
  adapter: SqliteAdapter,
): ToolDefinition[] {
  return [
    createValidateJsonTool(),
    createJsonExtractTool(adapter),
    createJsonSetTool(adapter),
    createJsonRemoveTool(adapter),
    createJsonTypeTool(adapter),
    createJsonArrayLengthTool(adapter),
    createJsonArrayAppendTool(adapter),
    createJsonKeysTool(adapter),
    createJsonEachTool(adapter),
    createJsonGroupArrayTool(adapter),
    createJsonGroupObjectTool(adapter),
    createJsonPrettyTool(),
    // JSONB tools
    createJsonbConvertTool(adapter),
    createJsonStorageInfoTool(adapter),
    createJsonNormalizeColumnTool(adapter),
  ];
}

/**
 * Validate JSON string
 */
function createValidateJsonTool(): ToolDefinition {
  return {
    name: "sqlite_json_valid",
    description: "Check if a string is valid JSON.",
    group: "json",
    inputSchema: ValidateJsonSchema,
    outputSchema: JsonValidOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Validate JSON"),
    handler: (params: unknown, _context: RequestContext) => {
      const input = ValidateJsonSchema.parse(params);

      try {
        JSON.parse(input.json);
        return Promise.resolve({
          success: true,
          valid: true,
          message: "Valid JSON",
        });
      } catch (error) {
        return Promise.resolve({
          success: true,
          valid: false,
          message: error instanceof Error ? error.message : "Invalid JSON",
        });
      }
    },
  };
}

/**
 * Extract value from JSON
 */
function createJsonExtractTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_extract",
    description:
      "Extract a value from a JSON column at the specified path using json_extract().",
    group: "json",
    inputSchema: JsonExtractSchema,
    outputSchema: JsonExtractOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Extract"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonExtractSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      let sql = `SELECT json_extract(${column}, '${input.path}') as value FROM ${table}`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
      }

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        values: result.rows?.map((r) => r["value"]),
      };
    },
  };
}

/**
 * Set value in JSON
 */
function createJsonSetTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_set",
    description:
      "Set a value at a JSON path using json_set(). Creates path if it does not exist.",
    group: "json",
    inputSchema: JsonSetSchema,
    outputSchema: JsonSetOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Set"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonSetSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      const valueJson = JSON.stringify(input.value);
      const sql = `UPDATE ${table} SET ${column} = json_set(${column}, '${input.path}', json('${valueJson.replace(/'/g, "''")}')) WHERE ${input.whereClause}`;

      const result = await adapter.executeWriteQuery(sql);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}

/**
 * Remove value from JSON
 */
function createJsonRemoveTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_remove",
    description: "Remove a value at a JSON path using json_remove().",
    group: "json",
    inputSchema: JsonRemoveSchema,
    outputSchema: JsonRemoveOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Remove"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonRemoveSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      const sql = `UPDATE ${table} SET ${column} = json_remove(${column}, '${input.path}') WHERE ${input.whereClause}`;

      const result = await adapter.executeWriteQuery(sql);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}

/**
 * Get JSON value type
 */
function createJsonTypeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_type",
    description:
      "Get the JSON type (null, true, false, integer, real, text, array, object) at a path.",
    group: "json",
    inputSchema: JsonTypeSchema,
    outputSchema: JsonTypeOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Type"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonTypeSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      const path = input.path ?? "$";
      if (!path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      let sql = `SELECT json_type(${column}, '${path}') as type FROM ${table}`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
      }

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        types: result.rows?.map((r) => r["type"]),
      };
    },
  };
}

/**
 * Get JSON array length
 */
function createJsonArrayLengthTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_array_length",
    description: "Get the length of a JSON array at the specified path.",
    group: "json",
    inputSchema: JsonArrayLengthSchema,
    outputSchema: JsonArrayLengthOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Array Length"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonArrayLengthSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      const path = input.path ?? "$";
      if (!path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      let sql = `SELECT json_array_length(${column}, '${path}') as length FROM ${table}`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
      }

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        lengths: result.rows?.map((r) => r["length"]),
      };
    },
  };
}

/**
 * Append to JSON array
 */
function createJsonArrayAppendTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_array_append",
    description: "Append a value to a JSON array using json_insert().",
    group: "json",
    inputSchema: JsonArrayAppendSchema,
    outputSchema: JsonSetOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Array Append"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonArrayAppendSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      const valueJson = JSON.stringify(input.value);
      // Append by using [#] which means "end of array"
      const appendPath = input.path.endsWith("]")
        ? input.path.replace(/\]$/, "#]")
        : `${input.path}[#]`;

      const sql = `UPDATE ${table} SET ${column} = json_insert(${column}, '${appendPath}', json('${valueJson.replace(/'/g, "''")}')) WHERE ${input.whereClause}`;

      const result = await adapter.executeWriteQuery(sql);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}

/**
 * Get JSON object keys
 */
function createJsonKeysTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_keys",
    description: "Get the keys of a JSON object at the specified path.",
    group: "json",
    inputSchema: JsonKeysSchema,
    outputSchema: JsonKeysOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Keys"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonKeysSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      const path = input.path ?? "$";
      if (!path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      // Use subquery to avoid ambiguous column when table has a 'key' or 'id' column
      // json_each returns: key, value, type, atom, id, parent, fullkey, path
      let sql: string;
      if (input.whereClause) {
        // With WHERE clause, use subquery to isolate table columns from json_each columns
        // This avoids ambiguity between e.g. table.id and json_each.id
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
    },
  };
}

/**
 * Expand JSON to rows
 */
function createJsonEachTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_each",
    description: "Expand a JSON array or object into rows using json_each().",
    group: "json",
    inputSchema: JsonEachSchema,
    outputSchema: JsonEachOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Each"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonEachSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      const path = input.path ?? "$";
      if (!path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      // Use table alias and CROSS JOIN to avoid ambiguity with json_each() output columns
      // json_each() returns: key, value, type, atom, id, parent, fullkey, path
      // If the source table has any of these columns (e.g., 'id'), they must be qualified
      let sql = `SELECT t.rowid as row_id, je.key, je.value, je.type FROM ${table} AS t CROSS JOIN json_each(t.${column}, '${path}') AS je`;
      if (input.whereClause) {
        // Qualify unqualified 'id' column references with table alias 't.'
        // This handles: id = X, id IN (...), id BETWEEN, id IS NULL, etc.
        // Won't match already-qualified refs like 't.id' or 'je.id'
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
    },
  };
}

/**
 * Aggregate values into JSON array
 */
function createJsonGroupArrayTool(adapter: SqliteAdapter): ToolDefinition {
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
      const input = JsonGroupArraySchema.parse(params);

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
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += groupByClause;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        rows: result.rows ?? [],
      };
    },
  };
}

/**
 * Aggregate key-value pairs into JSON object
 */
function createJsonGroupObjectTool(adapter: SqliteAdapter): ToolDefinition {
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
      const input = JsonGroupObjectSchema.parse(params);

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
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += groupByClause;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        rows: result.rows ?? [],
      };
    },
  };
}

/**
 * Pretty print and compact JSON
 */
function createJsonPrettyTool(): ToolDefinition {
  return {
    name: "sqlite_json_pretty",
    description: "Format JSON string with indentation for readability.",
    group: "json",
    inputSchema: JsonPrettySchema,
    outputSchema: JsonPrettyOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Pretty"),
    handler: (params: unknown, _context: RequestContext) => {
      const input = JsonPrettySchema.parse(params);

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

// Schema for JSONB convert tool
const JsonbConvertSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to convert"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
});

// Schema for storage info tool
const JsonStorageInfoSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to analyze"),
  sampleSize: z
    .number()
    .optional()
    .default(100)
    .describe("Number of rows to sample"),
});

// Schema for normalize column tool
const JsonNormalizeColumnSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to normalize"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
});

/**
 * Convert text JSON column to JSONB format
 */
function createJsonbConvertTool(adapter: SqliteAdapter): ToolDefinition {
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
      const input = JsonbConvertSchema.parse(params);

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
    },
  };
}

/**
 * Get storage format info for a JSON column
 */
function createJsonStorageInfoTool(adapter: SqliteAdapter): ToolDefinition {
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
      const input = JsonStorageInfoSchema.parse(params);

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
          jsonbCount === 0 && textCount > 0 && isJsonbSupported()
            ? "Column uses text JSON. Consider converting to JSONB for better performance."
            : jsonbCount > 0
              ? "Column already uses JSONB format."
              : "No JSON data found in sample.",
      };
    },
  };
}

/**
 * Normalize JSON data in a column for consistent storage
 *
 * Handles both text JSON and JSONB binary format by using SQL's json()
 * function to read the data as text before JavaScript processing.
 */
function createJsonNormalizeColumnTool(adapter: SqliteAdapter): ToolDefinition {
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
      const input = JsonNormalizeColumnSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      // Use SQLite's json() function to ensure we get text output regardless
      // of whether the column contains text JSON or JSONB binary format.
      // This prevents corruption when JSONB blobs are read and re-processed.
      let selectSql = `SELECT rowid, json(${column}) as json_data FROM ${table}`;
      if (input.whereClause) {
        selectSql += ` WHERE ${input.whereClause}`;
      }

      const selectResult = await adapter.executeReadQuery(selectSql);
      let normalizedCount = 0;
      let unchangedCount = 0;
      let errorCount = 0;

      // Normalize each row
      for (const row of selectResult.rows ?? []) {
        const rowid = row["rowid"];
        const jsonData = row["json_data"];

        if (jsonData === null || jsonData === undefined) {
          unchangedCount++;
          continue;
        }

        try {
          const { normalized, wasModified } = normalizeJson(jsonData);

          if (wasModified) {
            const updateSql = `UPDATE ${table} SET ${column} = ? WHERE rowid = ?`;
            await adapter.executeWriteQuery(updateSql, [normalized, rowid]);
            normalizedCount++;
          } else {
            unchangedCount++;
          }
        } catch {
          errorCount++;
        }
      }

      return {
        success: true,
        message: `Normalized ${normalizedCount} rows`,
        normalized: normalizedCount,
        unchanged: unchangedCount,
        errors: errorCount,
        total: selectResult.rows?.length ?? 0,
      };
    },
  };
}
