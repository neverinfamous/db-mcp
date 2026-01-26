/**
 * SQLite JSON Helper Tools
 *
 * High-level JSON operations for common patterns:
 * insert, update, select, query, validate path, merge.
 * 6 tools total.
 */

import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { readOnly, write } from "../../../utils/annotations.js";
import {
  JsonInsertSchema,
  JsonUpdateSchema,
  JsonSelectSchema,
  JsonQuerySchema,
  JsonValidatePathSchema,
  JsonMergeSchema,
} from "../types.js";

/**
 * Get all JSON helper tools
 */
export function getJsonHelperTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createJsonInsertTool(adapter),
    createJsonUpdateTool(adapter),
    createJsonSelectTool(adapter),
    createJsonQueryTool(adapter),
    createJsonValidatePathTool(),
    createJsonMergeTool(adapter),
  ];
}

/**
 * Insert JSON data with auto-normalization
 */
function createJsonInsertTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_insert",
    description:
      "Insert a row with JSON data. Automatically normalizes JSON for consistent storage.",
    group: "json",
    inputSchema: JsonInsertSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Insert"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonInsertSchema.parse(params);

      // Normalize JSON data - only stringify if it's an object
      // If data is already a string, assume it's valid JSON
      const jsonStr =
        typeof input.data === "string"
          ? input.data
          : JSON.stringify(input.data);

      // Build column list
      const columns = [input.column];
      const placeholders = ["?"];
      const values: unknown[] = [jsonStr];

      if (input.additionalColumns) {
        for (const [col, val] of Object.entries(input.additionalColumns)) {
          // Validate column name
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
            throw new Error(`Invalid column name: ${col}`);
          }
          columns.push(col);
          placeholders.push("?");
          values.push(typeof val === "object" ? JSON.stringify(val) : val);
        }
      }

      // Validate table name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }

      const sql = `INSERT INTO "${input.table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders.join(", ")})`;

      const result = await adapter.executeWriteQuery(sql, values);

      return {
        success: true,
        message: `Inserted row into ${input.table}`,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}

/**
 * Update JSON value at a specific path
 */
function createJsonUpdateTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_update",
    description: "Update a value at a specific JSON path using json_set().",
    group: "json",
    inputSchema: JsonUpdateSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Update"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonUpdateSchema.parse(params);

      // Validate table and column names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      // Validate JSON path format
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      const valueStr =
        typeof input.value === "string"
          ? `'${input.value.replace(/'/g, "''")}'`
          : JSON.stringify(input.value);

      const sql = `UPDATE "${input.table}" SET "${input.column}" = json_set("${input.column}", '${input.path}', json(${valueStr})) WHERE ${input.whereClause}`;

      const result = await adapter.executeWriteQuery(sql);

      return {
        success: true,
        message: `Updated ${input.path} in ${input.table}.${input.column}`,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}

/**
 * Select and extract JSON data
 */
function createJsonSelectTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_select",
    description: "Select rows and optionally extract specific JSON paths.",
    group: "json",
    inputSchema: JsonSelectSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Select"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonSelectSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      let selectClause: string;
      if (input.paths && input.paths.length > 0) {
        // Extract specific paths
        const extracts = input.paths.map((path, i) => {
          if (!path.startsWith("$")) {
            throw new Error(`JSON path must start with $: ${path}`);
          }
          return `json_extract("${input.column}", '${path}') as path_${i}`;
        });
        selectClause = extracts.join(", ");
      } else {
        selectClause = `"${input.column}"`;
      }

      let sql = `SELECT ${selectClause} FROM "${input.table}"`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
      }

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        rows: result.rows,
      };
    },
  };
}

/**
 * Query JSON with path-based filtering
 */
function createJsonQueryTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_query",
    description: "Query JSON data with path-based filters and projections.",
    group: "json",
    inputSchema: JsonQuerySchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Query"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonQuerySchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      // Build select clause
      let selectClause: string;
      if (input.selectPaths && input.selectPaths.length > 0) {
        const extracts = input.selectPaths.map((path, i) => {
          if (!path.startsWith("$")) {
            throw new Error(`JSON path must start with $: ${path}`);
          }
          return `json_extract("${input.column}", '${path}') as result_${i}`;
        });
        selectClause = extracts.join(", ");
      } else {
        selectClause = `"${input.column}"`;
      }

      // Build where clause from filters
      const conditions: string[] = [];
      if (input.filterPaths) {
        for (const [path, value] of Object.entries(input.filterPaths)) {
          if (!path.startsWith("$")) {
            throw new Error(`JSON path must start with $: ${path}`);
          }
          const valueStr =
            typeof value === "string"
              ? `'${value.replace(/'/g, "''")}'`
              : JSON.stringify(value);
          conditions.push(
            `json_extract("${input.column}", '${path}') = ${valueStr}`,
          );
        }
      }

      let sql = `SELECT ${selectClause} FROM "${input.table}"`;
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }
      sql += ` LIMIT ${input.limit ?? 100}`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        rows: result.rows,
      };
    },
  };
}

/**
 * Validate a JSON path syntax
 */
function createJsonValidatePathTool(): ToolDefinition {
  return {
    name: "sqlite_json_validate_path",
    description: "Validate a JSON path syntax without executing a query.",
    group: "json",
    inputSchema: JsonValidatePathSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Validate JSON Path"),
    handler: (params: unknown, _context: RequestContext) => {
      const input = JsonValidatePathSchema.parse(params);

      const path = input.path;
      const issues: string[] = [];

      // Basic validation rules
      if (!path.startsWith("$")) {
        issues.push("Path must start with $");
      }

      // Check for valid path syntax
      const validPattern = /^\$(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\]|\[\*\])*$/;
      if (!validPattern.test(path)) {
        issues.push("Invalid path syntax. Use $.key, $[0], or $[*] patterns");
      }

      return Promise.resolve({
        success: issues.length === 0,
        path,
        valid: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined,
      });
    },
  };
}

/**
 * Merge JSON objects
 */
function createJsonMergeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_merge",
    description:
      "Merge JSON object into existing JSON column using json_patch().",
    group: "json",
    inputSchema: JsonMergeSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Merge"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonMergeSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      const mergeJson = JSON.stringify(input.mergeData);

      // Use json_patch for merging (shallow merge)
      const sql = `UPDATE "${input.table}" SET "${input.column}" = json_patch("${input.column}", '${mergeJson.replace(/'/g, "''")}') WHERE ${input.whereClause}`;

      const result = await adapter.executeWriteQuery(sql);

      return {
        success: true,
        message: `Merged JSON into ${input.table}.${input.column}`,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}
