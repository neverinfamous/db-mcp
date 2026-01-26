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
import {
  ValidateJsonSchema,
  JsonExtractSchema,
  JsonSetSchema,
  JsonRemoveSchema,
} from "../types.js";

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
  valueColumn: z.string().describe("Column to aggregate"),
  groupByColumn: z.string().optional().describe("Column to group by"),
  whereClause: z.string().optional(),
});

const JsonGroupObjectSchema = z.object({
  table: z.string().describe("Table name"),
  keyColumn: z.string().describe("Column for object keys"),
  valueColumn: z.string().describe("Column for object values"),
  groupByColumn: z.string().optional().describe("Column to group by"),
  whereClause: z.string().optional(),
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
    requiredScopes: ["read"],
    annotations: readOnly("JSON Extract"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonExtractSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      let sql = `SELECT json_extract("${input.column}", '${input.path}') as value FROM "${input.table}"`;
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
    requiredScopes: ["write"],
    annotations: write("JSON Set"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonSetSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      const valueJson = JSON.stringify(input.value);
      const sql = `UPDATE "${input.table}" SET "${input.column}" = json_set("${input.column}", '${input.path}', json('${valueJson.replace(/'/g, "''")}')) WHERE ${input.whereClause}`;

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
    requiredScopes: ["write"],
    annotations: write("JSON Remove"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonRemoveSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      const sql = `UPDATE "${input.table}" SET "${input.column}" = json_remove("${input.column}", '${input.path}') WHERE ${input.whereClause}`;

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
    requiredScopes: ["read"],
    annotations: readOnly("JSON Type"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonTypeSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      const path = input.path ?? "$";
      if (!path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      let sql = `SELECT json_type("${input.column}", '${path}') as type FROM "${input.table}"`;
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
    requiredScopes: ["read"],
    annotations: readOnly("Array Length"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonArrayLengthSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      const path = input.path ?? "$";
      if (!path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      let sql = `SELECT json_array_length("${input.column}", '${path}') as length FROM "${input.table}"`;
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
    requiredScopes: ["write"],
    annotations: write("Array Append"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonArrayAppendSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      const valueJson = JSON.stringify(input.value);
      // Append by using [#] which means "end of array"
      const appendPath = input.path.endsWith("]")
        ? input.path.replace(/\]$/, "#]")
        : `${input.path}[#]`;

      const sql = `UPDATE "${input.table}" SET "${input.column}" = json_insert("${input.column}", '${appendPath}', json('${valueJson.replace(/'/g, "''")}')) WHERE ${input.whereClause}`;

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
    requiredScopes: ["read"],
    annotations: readOnly("JSON Keys"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonKeysSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

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
                        (SELECT "${input.column}" FROM "${input.table}" WHERE ${input.whereClause} LIMIT 1),
                        '${path}'
                    )`;
      } else {
        // Without WHERE, simpler subquery avoids 'key' column ambiguity
        sql = `SELECT DISTINCT json_each.key FROM "${input.table}" AS t, json_each(t."${input.column}", '${path}')`;
      }

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        keys: result.rows?.map((r) => r["key"]) ?? [],
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
    requiredScopes: ["read"],
    annotations: readOnly("JSON Each"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonEachSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      const path = input.path ?? "$";
      if (!path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      let sql = `SELECT je.key, je.value, je.type FROM "${input.table}", json_each("${input.column}", '${path}') as je`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
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
    requiredScopes: ["read"],
    annotations: readOnly("Group Array"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonGroupArraySchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.valueColumn)) {
        throw new Error("Invalid value column name");
      }

      let selectClause = `json_group_array("${input.valueColumn}") as array_result`;
      let groupByClause = "";

      if (input.groupByColumn) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.groupByColumn)) {
          throw new Error("Invalid group by column name");
        }
        selectClause = `"${input.groupByColumn}", ${selectClause}`;
        groupByClause = ` GROUP BY "${input.groupByColumn}"`;
      }

      let sql = `SELECT ${selectClause} FROM "${input.table}"`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += groupByClause;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        results: result.rows,
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
    requiredScopes: ["read"],
    annotations: readOnly("Group Object"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonGroupObjectSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.keyColumn)) {
        throw new Error("Invalid key column name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.valueColumn)) {
        throw new Error("Invalid value column name");
      }

      let selectClause = `json_group_object("${input.keyColumn}", "${input.valueColumn}") as object_result`;
      let groupByClause = "";

      if (input.groupByColumn) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.groupByColumn)) {
          throw new Error("Invalid group by column name");
        }
        selectClause = `"${input.groupByColumn}", ${selectClause}`;
        groupByClause = ` GROUP BY "${input.groupByColumn}"`;
      }

      let sql = `SELECT ${selectClause} FROM "${input.table}"`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += groupByClause;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        results: result.rows,
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
