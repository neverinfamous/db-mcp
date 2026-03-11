/**
 * JSON Write Tools
 *
 * Mutating JSON operations: insert, update, merge, create collection.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { write } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatError } from "../../../../utils/errors.js";
import {
  JsonInsertSchema,
  JsonUpdateSchema,
  JsonMergeSchema,
  CreateJsonCollectionSchema,
} from "../../types.js";
import {
  JsonInsertOutputSchema,
  JsonUpdateOutputSchema,
  JsonMergeOutputSchema,
  CreateJsonCollectionOutputSchema,
} from "../../output-schemas/index.js";
import { normalizeJson } from "../../json-utils.js";

/**
 * Insert JSON data with auto-normalization
 */
export function createJsonInsertTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_insert",
    description:
      "Insert a row with JSON data. Automatically normalizes JSON for consistent storage.",
    group: "json",
    inputSchema: JsonInsertSchema,
    outputSchema: JsonInsertOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Insert"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonInsertSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowsAffected: 0,
          error: structured.error,
        };
      }

      try {
        // Normalize JSON data for consistent storage
        const rawJson =
          typeof input.data === "string"
            ? input.data
            : JSON.stringify(input.data);

        const { normalized: jsonStr } = normalizeJson(rawJson);

        // Build column list
        const columns = [input.column];
        const placeholders = ["?"];
        const values: unknown[] = [jsonStr];

        if (input.additionalColumns) {
          for (const [col, val] of Object.entries(input.additionalColumns)) {
            // Validate column name
            sanitizeIdentifier(col);
            columns.push(col);
            placeholders.push("?");
            values.push(typeof val === "object" ? JSON.stringify(val) : val);
          }
        }

        // Validate table name
        sanitizeIdentifier(input.table);

        const sql = `INSERT INTO "${input.table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders.join(", ")})`;

        const result = await adapter.executeWriteQuery(sql, values);

        return {
          success: true,
          message: `Inserted row into ${input.table}`,
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
 * Update JSON value at a specific path
 */
export function createJsonUpdateTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_update",
    description: "Update a value at a specific JSON path using json_set().",
    group: "json",
    inputSchema: JsonUpdateSchema,
    outputSchema: JsonUpdateOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Update"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonUpdateSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowsAffected: 0,
          error: structured.error,
        };
      }

      try {
        // Validate table and column names
        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.column);

        // Validate JSON path format
        if (!input.path.startsWith("$")) {
          return {
            success: false,
            rowsAffected: 0,
            error: "JSON path must start with $",
          };
        }

        // String values must be JSON-stringified to produce valid JSON
        // e.g., "New Title" -> '"New Title"' (with JSON quotes inside SQL quotes)
        const valueStr =
          typeof input.value === "string"
            ? `'${JSON.stringify(input.value).replace(/'/g, "''")}'`
            : JSON.stringify(input.value);

        const sql = `UPDATE "${input.table}" SET "${input.column}" = json_set("${input.column}", '${input.path}', json(${valueStr})) WHERE ${input.whereClause}`;

        const result = await adapter.executeWriteQuery(sql);

        const response: Record<string, unknown> = {
          success: true,
          message: `Updated ${input.path} in ${input.table}.${input.column}`,
          rowsAffected: result.rowsAffected,
        };

        if (result.rowsAffected === 0) {
          response["warning"] =
            "No rows matched the WHERE clause — nothing was updated";
        }

        return response;
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
 * Merge JSON objects
 */
export function createJsonMergeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_merge",
    description:
      "Merge JSON object into existing JSON column using json_patch().",
    group: "json",
    inputSchema: JsonMergeSchema,
    outputSchema: JsonMergeOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Merge"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonMergeSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowsAffected: 0,
          error: structured.error,
        };
      }

      try {
        // Validate names
        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.column);

        const mergeJson = JSON.stringify(input.mergeData);

        // Use json_patch for merging (shallow merge)
        const sql = `UPDATE "${input.table}" SET "${input.column}" = json_patch("${input.column}", '${mergeJson.replace(/'/g, "''")}') WHERE ${input.whereClause}`;

        const result = await adapter.executeWriteQuery(sql);

        const response: Record<string, unknown> = {
          success: true,
          message: `Merged JSON into ${input.table}.${input.column}`,
          rowsAffected: result.rowsAffected,
        };

        if (result.rowsAffected === 0) {
          response["warning"] =
            "No rows matched the WHERE clause — nothing was merged";
        }

        return response;
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
 * Create a JSON document collection table
 */
export function createJsonCollectionTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_json_collection",
    description:
      "Create an optimized JSON document collection table with ID, data column, optional timestamps, and JSON path indexes.",
    group: "json",
    inputSchema: CreateJsonCollectionSchema,
    outputSchema: CreateJsonCollectionOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Create JSON Collection"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = CreateJsonCollectionSchema.parse(params);
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          error: structured.error,
        };
      }

      try {
        // Validate table name
        sanitizeIdentifier(input.tableName);

        const idCol = input.idColumn ?? "id";
        const dataCol = input.dataColumn ?? "data";
        const sqls: string[] = [];

        // Validate all index paths upfront before creating anything
        if (input.indexes) {
          for (const idx of input.indexes) {
            if (!idx.path.startsWith("$")) {
              return {
                success: false,
                error: `JSON path must start with $: ${idx.path}`,
              };
            }
          }
        }

        // Build CREATE TABLE
        const columns = [
          `"${idCol}" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))`,
          // Use json_type() IS NOT NULL instead of json_valid() to support both text JSON and JSONB
          `"${dataCol}" TEXT NOT NULL CHECK(json_type("${dataCol}") IS NOT NULL)`,
        ];

        if (input.timestamps) {
          columns.push(`created_at TEXT DEFAULT (datetime('now'))`);
          columns.push(`updated_at TEXT DEFAULT (datetime('now'))`);
        }

        const createSql = `CREATE TABLE IF NOT EXISTS "${input.tableName}" (\n  ${columns.join(",\n  ")}\n)`;
        sqls.push(createSql);

        // Execute CREATE TABLE
        await adapter.executeWriteQuery(createSql);

        // Create indexes (all paths already validated above)
        let indexCount = 0;
        if (input.indexes) {
          for (const idx of input.indexes) {
            const indexName =
              idx.name ??
              `idx_${input.tableName}_${idx.path.replace(/[$.[\\]]/g, "_")}`;
            const indexSql = `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${input.tableName}"(json_extract("${dataCol}", '${idx.path}'))`;
            sqls.push(indexSql);
            await adapter.executeWriteQuery(indexSql);
            indexCount++;
          }
        }

        return {
          success: true,
          message: `Created collection '${input.tableName}'${indexCount > 0 ? ` with ${indexCount} index(es)` : ""}`,
          sql: sqls,
          indexCount,
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
