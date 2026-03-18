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
  validateWhereClause,
} from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import {
  JsonValidOutputSchema,
  JsonExtractOutputSchema,
  JsonSetOutputSchema,
  JsonRemoveOutputSchema,
  JsonTypeOutputSchema,
  JsonArrayLengthOutputSchema,
} from "../../output-schemas/index.js";
import {
  ValidateJsonSchema,
  JsonExtractSchema,
  JsonSetSchema,
  JsonRemoveSchema,
} from "../../types.js";
import {
  JsonTypeSchema,
  JsonArrayLengthSchema,
  JsonArrayAppendSchema,
} from "./helpers.js";

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
      } catch (error) {
        return Promise.resolve(formatHandlerError(error));
      }

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
      let input;
      try {
        input = JsonExtractSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        if (!input.path.startsWith("$")) {
          return {
            success: false,
            rowCount: 0,
            values: [],
            error: "JSON path must start with $",
          };
        }

        let sql = `SELECT json_extract(${column}, '${input.path}') as value FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          values: result.rows?.map((r) => r["value"]),
        };
      } catch (error) {
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
      let input;
      try {
        input = JsonSetSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        if (!input.path.startsWith("$")) {
          return {
            success: false,
            rowsAffected: 0,
            error: "JSON path must start with $",
          };
        }

        if (input.value === undefined) {
          return {
            success: false,
            rowsAffected: 0,
            error: "Missing required parameter: value",
          };
        }

        const valueJson = JSON.stringify(input.value);
        validateWhereClause(input.whereClause);
        const sql = `UPDATE ${table} SET ${column} = json_set(${column}, '${input.path}', json('${valueJson.replace(/'/g, "''")}')) WHERE ${input.whereClause}`;

        const result = await adapter.executeWriteQuery(sql);

        return {
          success: true,
          rowsAffected: result.rowsAffected,
          ...(result.rowsAffected === 0
            ? {
                warning:
                  "No rows matched the WHERE clause — no changes were made",
              }
            : {}),
        };
      } catch (error) {
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
      let input;
      try {
        input = JsonRemoveSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        if (!input.path.startsWith("$")) {
          return {
            success: false,
            rowsAffected: 0,
            error: "JSON path must start with $",
          };
        }

        validateWhereClause(input.whereClause);
        const sql = `UPDATE ${table} SET ${column} = json_remove(${column}, '${input.path}') WHERE ${input.whereClause}`;

        const result = await adapter.executeWriteQuery(sql);

        return {
          success: true,
          rowsAffected: result.rowsAffected,
          ...(result.rowsAffected === 0
            ? {
                warning:
                  "No rows matched the WHERE clause — no changes were made",
              }
            : {}),
        };
      } catch (error) {
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
      let input;
      try {
        input = JsonTypeSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
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
            types: [],
            error: "JSON path must start with $",
          };
        }

        let sql = `SELECT json_type(${column}, '${path}') as type FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          types: result.rows?.map((r) => r["type"]),
        };
      } catch (error) {
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
      let input;
      try {
        input = JsonArrayLengthSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
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
            lengths: [],
            error: "JSON path must start with $",
          };
        }

        let sql = `SELECT json_array_length(${column}, '${path}') as length FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          lengths: result.rows?.map((r) => r["length"]),
        };
      } catch (error) {
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
      let input;
      try {
        input = JsonArrayAppendSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      try {
        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        if (!input.path.startsWith("$")) {
          return {
            success: false,
            rowsAffected: 0,
            error: "JSON path must start with $",
          };
        }

        if (input.value === undefined) {
          return {
            success: false,
            rowsAffected: 0,
            error: "Missing required parameter: value",
          };
        }

        const valueJson = JSON.stringify(input.value);
        validateWhereClause(input.whereClause);
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
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Get JSON object keys
 */
