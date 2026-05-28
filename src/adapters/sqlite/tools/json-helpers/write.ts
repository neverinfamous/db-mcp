import { buildWhereClause } from "../../../../utils/where-clause.js";
import {
  JsonInsertOutputSchema,
  JsonUpdateOutputSchema,
  JsonMergeOutputSchema,
  CreateJsonCollectionOutputSchema,
  JsonInsertSchema,
  JsonUpdateSchema,
  JsonMergeSchema,
  CreateJsonCollectionSchema,
  type JsonInsertInput,
  type JsonUpdateInput,
  type JsonMergeInput,
  type CreateJsonCollectionInput,
} from "../../schemas/json.js";
/**
 * JSON Write Tools
 *
 * Mutating JSON operations: insert, update, merge, create collection.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { write } from "../../../../utils/annotations.js";
import {
  sanitizeIdentifier,
  validateJsonPath,
} from "../../../../utils/index.js";
import {
  formatHandlerError,
  ValidationError,
  QueryError,
} from "../../../../utils/errors/index.js";

/**
 * Insert JSON data as a new row
 */
export function createJsonInsertTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_insert",
    description:
      "Insert a new row with JSON data into a JSON column. Note: This creates a new table row, rather than modifying an existing JSON object.",
    group: "json",
    inputSchema: JsonInsertSchema,
    outputSchema: JsonInsertOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Insert"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input: JsonInsertInput;
      
      try {
        input = JsonInsertSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate table and column names
        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.column);

        if (input.data === undefined) {
          throw new ValidationError(
            "Missing required parameter: data",
            "VALIDATION_ERROR",
            {
              suggestion: "Provide JSON data to insert.",
            },
          );
        }

        const valueJson = JSON.stringify(input.data);
        const sql = `INSERT INTO "${input.table}" ("${input.column}") VALUES (json('${valueJson.replace(/'/g, "''")}'))`;

        const result = await adapter.executeWriteQuery(sql, queryParams);

        const response: Record<string, unknown> = {
          success: true,
          message: `Inserted new row into ${input.table}.${input.column}`,
          rowsAffected: result.rowsAffected,
        };

        if (result.lastInsertId !== undefined) {
          response["lastInsertRowid"] = Number(result.lastInsertId);
        } else if ("lastInsertRowid" in result) {
          const res = result as Record<string, unknown>;
          if (res["lastInsertRowid"] !== undefined) {
            response["lastInsertRowid"] = Number(res["lastInsertRowid"]);
          }
        }

        return response;
      } catch (error: unknown) {
        return formatHandlerError(error);
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
    description:
      "Update a value at a specific JSON path using json_replace(). Only updates if the key already exists.",
    group: "json",
    inputSchema: JsonUpdateSchema,
    outputSchema: JsonUpdateOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Update"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input: JsonUpdateInput;
      try {
        input = JsonUpdateSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate table and column names
        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.column);

        // Validate JSON path format
        validateJsonPath(input.path);

        if (input.value === undefined) {
          throw new ValidationError(
            "Missing required parameter: value",
            "VALIDATION_ERROR",
            {
              suggestion: "Provide a value to update.",
            },
          );
        }

        const valueJson = JSON.stringify(input.value);
        // validateWhereClause() removed
        const { sql: whereSql, params: whereParams } = buildWhereClause(input.conditions, input.whereClause);
        let sql = `UPDATE "${input.table}" SET "${input.column}" = json_replace("${input.column}", '${input.path}', json('${valueJson.replace(/'/g, "''")}'))`;
        if (whereSql) {
          sql += ` WHERE ${whereSql}`;
        }
        queryParams.push(...whereParams);

        const result = await adapter.executeWriteQuery(sql, queryParams);

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
      } catch (error: unknown) {
        return formatHandlerError(error);
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
      const queryParams: unknown[] = [];
      let input: JsonMergeInput;
      try {
        input = JsonMergeSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate names
        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.column);

        if (input.mergeData === undefined) {
          throw new ValidationError(
            "Missing required parameter: mergeData",
            "VALIDATION_ERROR",
            {
              suggestion: "Provide JSON data to merge.",
            },
          );
        }

        const mergeJson = JSON.stringify(input.mergeData);

        // validateWhereClause() removed
        // Use json_patch for merging (shallow merge)
        const { sql: whereSql, params: whereParams } = buildWhereClause(input.conditions, input.whereClause);
        let sql = `UPDATE "${input.table}" SET "${input.column}" = json_patch("${input.column}", '${mergeJson.replace(/'/g, "''")}')`;
        if (whereSql) {
          sql += ` WHERE ${whereSql}`;
        }
        queryParams.push(...whereParams);

        const result = await adapter.executeWriteQuery(sql, queryParams);

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
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Create a JSON document collection table
 */
export function createJsonCollectionTool(
  adapter: SqliteAdapter,
): ToolDefinition {
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
      const queryParams: unknown[] = [];
      let input: CreateJsonCollectionInput;
      try {
        input = CreateJsonCollectionSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      try {
        // Validate table name
        sanitizeIdentifier(input.tableName);

        const idCol = input.idColumn ?? "id";
        const dataCol = input.dataColumn ?? "data";
        const sqls: string[] = [];

        // Check if table already exists
        const checkSql = "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name=?";
        const checkResult = await adapter.executeReadQuery(checkSql, [input.tableName]);
        const tableCount = checkResult.rows?.[0] ? Number(checkResult.rows[0]["count"]) : 0;
        if (tableCount > 0) {
          throw new QueryError(
            `Table '${input.tableName}' already exists`,
            "TABLE_EXISTS",
            {
              suggestion: "Use a different table name or drop the existing table first.",
              details: { resourceType: "table", resourceName: input.tableName }
            }
          );
        }

        // Validate all index paths upfront before creating anything
        if (input.indexes) {
          for (const idx of input.indexes) {
            validateJsonPath(idx.path);
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
        await adapter.executeWriteQuery(createSql, queryParams);

        // Create indexes (all paths already validated above)
        let indexCount = 0;
        if (input.indexes) {
          for (const idx of input.indexes) {
            const indexName =
              idx.name ??
              `idx_${input.tableName}_${idx.path.replace(/[$.[\\]]/g, "_")}`;
            const indexSql = `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${input.tableName}"(json_extract("${dataCol}", '${idx.path}'))`;
            sqls.push(indexSql);
            await adapter.executeWriteQuery(indexSql, queryParams);
            indexCount++;
          }
        }

        return {
          success: true,
          message: `Created collection '${input.tableName}'${indexCount > 0 ? ` with ${indexCount} index(es)` : ""}`,
          sql: sqls,
          indexCount,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

