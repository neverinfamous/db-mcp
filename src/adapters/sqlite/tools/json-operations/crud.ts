import { buildWhereClause } from "../../../../utils/where-clause.js";
import { parseJsonValue } from "../../json-utils.js";
import {
  JsonSetOutputSchema,
  JsonRemoveOutputSchema,
  ValidateJsonSchema,
  JsonExtractSchema,
  JsonSetSchema,
  JsonRemoveSchema,
} from "../../schemas/json.js";
/**
 * JSON CRUD Tools
 *
 * Basic JSON operations: validate, extract, set, remove, type, array-length.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly, write } from "../../../../utils/annotations.js";
import {
  sanitizeIdentifier,
  validateJsonPath,
} from "../../../../utils/index.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../utils/errors/index.js";
import {
  JsonValidOutputSchema,
  JsonExtractOutputSchema,
  JsonTypeOutputSchema,
  JsonArrayLengthOutputSchema,
} from "../../schemas/json.js";
import {
  JsonTypeSchema,
  JsonArrayLengthSchema,
  JsonArrayAppendSchema,
} from "../../schemas/json.js";

/**
 * Validate JSON string
 */
export function createValidateJsonTool(): ToolDefinition {
  return {
    name: "sqlite_json_valid",
    description: "Check if a string is valid JSON.",
    group: "json",
    inputSchema: ValidateJsonSchema,
    outputSchema: JsonValidOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Validate JSON"),
    handler: (params: unknown, _context: RequestContext) => {
      let input;

      try {
        input = ValidateJsonSchema.parse(params);
      } catch (error: unknown) {
        return Promise.resolve(formatHandlerError(error));
      }

      try {
        JSON.parse(input.json);
        return Promise.resolve({
          success: true,
          valid: true,
          message: "Valid JSON",
        });
      } catch (error: unknown) {
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
export function createJsonExtractTool(adapter: SqliteAdapter): ToolDefinition {
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
      const queryParams: unknown[] = [];
      let input;
      try {
        input = JsonExtractSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        validateJsonPath(input.path);

        let sql = `SELECT json_extract(${column}, '${input.path}') as value FROM ${table}`;
        if (input.conditions || input.whereClause) {
          const { sql: whereSql, params: whereParams } = buildWhereClause(
            input.conditions,
            input.whereClause,
          );
          if (whereSql !== "") {
            sql += ` WHERE ${whereSql}`;
            queryParams.push(...whereParams);
          }
        }

        const result = await adapter.executeReadQuery(sql, queryParams);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          values: result.rows?.map((r) => parseJsonValue(r["value"])),
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Set value in JSON
 */
export function createJsonSetTool(adapter: SqliteAdapter): ToolDefinition {
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
      const queryParams: unknown[] = [];
      let input;
      try {
        input = JsonSetSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        validateJsonPath(input.path);

        if (input.value === undefined) {
          throw new ValidationError(
            "Missing required parameter: value",
            "VALIDATION_ERROR",
            {
              suggestion: "Provide a value to set.",
            },
          );
        }

        const valueJson = JSON.stringify(input.value);
        // validateWhereClause() removed
        const { sql: whereSql, params: whereParams } = buildWhereClause(
          input.conditions,
          input.whereClause,
        );
        const sql = `UPDATE ${table} SET ${column} = json_set(${column}, '${input.path}', json('${valueJson.replace(/'/g, "''")}'))${whereSql ? " WHERE " + whereSql : ""}`;
        queryParams.push(...whereParams);

        const result = await adapter.executeWriteQuery(sql, queryParams);

        return {
          success: true,
          message: `Set value at ${input.path} in ${table}.${column}`,
          rowsAffected: result.rowsAffected,
          ...(result.rowsAffected === 0
            ? {
                warning:
                  "No rows matched the WHERE clause — no changes were made",
              }
            : {}),
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Remove value from JSON
 */
export function createJsonRemoveTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_remove",
    description: "Remove a value at a JSON path using json_remove().",
    group: "json",
    inputSchema: JsonRemoveSchema,
    outputSchema: JsonRemoveOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Remove"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input;
      try {
        input = JsonRemoveSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        validateJsonPath(input.path);

        // validateWhereClause() removed
        const { sql: whereSql, params: whereParams } = buildWhereClause(
          input.conditions,
          input.whereClause,
        );
        const sql = `UPDATE ${table} SET ${column} = json_remove(${column}, '${input.path}')${whereSql ? " WHERE " + whereSql : ""}`;
        queryParams.push(...whereParams);

        const result = await adapter.executeWriteQuery(sql, queryParams);

        return {
          success: true,
          message: `Removed value at ${input.path} from ${table}.${column}`,
          rowsAffected: result.rowsAffected,
          ...(result.rowsAffected === 0
            ? {
                warning:
                  "No rows matched the WHERE clause — no changes were made",
              }
            : {}),
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Get JSON value type
 */
export function createJsonTypeTool(adapter: SqliteAdapter): ToolDefinition {
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
      const queryParams: unknown[] = [];
      let input;
      try {
        input = JsonTypeSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        const path = input.path ?? "$";
        validateJsonPath(path);

        let sql = `SELECT json_type(${column}, '${path}') as type FROM ${table}`;
        if (input.conditions || input.whereClause) {
          const { sql: whereSql, params: whereParams } = buildWhereClause(
            input.conditions,
            input.whereClause,
          );
          if (whereSql !== "") {
            sql += ` WHERE ${whereSql}`;
            queryParams.push(...whereParams);
          }
        }

        const result = await adapter.executeReadQuery(sql, queryParams);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          types: result.rows?.map((r) => r["type"]),
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Get JSON array length
 */
export function createJsonArrayLengthTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_json_array_length",
    description: "Get the length of a JSON array at the specified path.",
    group: "json",
    inputSchema: JsonArrayLengthSchema,
    outputSchema: JsonArrayLengthOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Array Length"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input;
      try {
        input = JsonArrayLengthSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        const path = input.path ?? "$";
        validateJsonPath(path);

        let sql = `SELECT json_array_length(${column}, '${path}') as length FROM ${table}`;
        if (input.conditions || input.whereClause) {
          const { sql: whereSql, params: whereParams } = buildWhereClause(
            input.conditions,
            input.whereClause,
          );
          if (whereSql !== "") {
            sql += ` WHERE ${whereSql}`;
            queryParams.push(...whereParams);
          }
        }

        const result = await adapter.executeReadQuery(sql, queryParams);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          lengths: result.rows?.map((r) => r["length"]),
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Append to JSON array
 */
export function createJsonArrayAppendTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_json_array_append",
    description: "Append a value to a JSON array using json_insert().",
    group: "json",
    inputSchema: JsonArrayAppendSchema,
    outputSchema: JsonSetOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Array Append"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input;
      try {
        input = JsonArrayAppendSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        validateJsonPath(input.path);

        if (input.value === undefined) {
          throw new ValidationError(
            "Missing required parameter: value",
            "VALIDATION_ERROR",
            {
              suggestion: "Provide a value to append.",
            },
          );
        }

        const valueJson = JSON.stringify(input.value);
        // validateWhereClause() removed
        // Append by using [#] which means "end of array"
        const appendPath = input.path.endsWith("]")
          ? input.path.replace(/\]$/, "#]")
          : `${input.path}[#]`;

        const { sql: whereSql, params: whereParams } = buildWhereClause(
          input.conditions,
          input.whereClause,
        );
        const sql = `UPDATE ${table} SET ${column} = json_insert(${column}, '${appendPath}', json('${valueJson.replace(/'/g, "''")}'))${whereSql ? " WHERE " + whereSql : ""}`;
        queryParams.push(...whereParams);

        const result = await adapter.executeWriteQuery(sql, queryParams);

        return {
          success: true,
          message: `Appended to ${input.path} in ${table}.${column}`,
          rowsAffected: result.rowsAffected,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Get JSON object keys
 */
