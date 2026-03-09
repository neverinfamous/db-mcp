/**
 * Core Index Management Tools
 *
 * Get, create, and drop indexes.
 */

import type { SqliteAdapter } from "../../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly, idempotent, destructive } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatError } from "../../../../utils/errors.js";
import { GetIndexesSchema, CreateIndexSchema, DropIndexSchema } from "../../types.js";
import {
  GetIndexesOutputSchema,
  CreateIndexOutputSchema,
  DropIndexOutputSchema,
} from "../../output-schemas/index.js";
import { isSpatialiteSystemIndex } from "./tables.js";

/**
 * Get indexes
 */
export function createGetIndexesTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_get_indexes",
    description:
      "List all indexes in the database, optionally filtered by table.",
    group: "core",
    inputSchema: GetIndexesSchema,
    outputSchema: GetIndexesOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Get Indexes"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = GetIndexesSchema.parse(params);

      let sql = `SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL`;

      if (input.tableName) {
        // Validate table name
        try {
          sanitizeIdentifier(input.tableName);
        } catch {
          return {
            success: false,
            count: 0,
            indexes: [],
            error: `Invalid table name '${input.tableName}': must be a non-empty string starting with a letter or underscore`,
          };
        }

        // Check table existence when a specific table is requested
        const checkResult = await adapter.executeReadQuery(
          `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name=?`,
          [input.tableName],
        );
        if ((checkResult.rows?.length ?? 0) === 0) {
          return {
            success: false,
            count: 0,
            indexes: [],
            error: `Table '${input.tableName}' does not exist`,
            code: "TABLE_NOT_FOUND",
            suggestion:
              "Table not found. Run sqlite_list_tables to see available tables.",
          };
        }

        sql += ` AND tbl_name = '${input.tableName}'`;
      }

      const result = await adapter.executeReadQuery(sql);

      let indexes = (result.rows ?? []).map((row) => ({
        name: row["name"] as string,
        table: row["tbl_name"] as string,
        unique: (row["sql"] as string)?.includes("UNIQUE") ?? false,
        sql: row["sql"] as string,
      }));

      // Filter out SpatiaLite system indexes if requested
      if (input.excludeSystemIndexes) {
        indexes = indexes.filter((idx) => !isSpatialiteSystemIndex(idx.name));
      }

      return {
        success: true,
        count: indexes.length,
        indexes,
      };
    },
  };
}

/**
 * Create an index
 */
export function createCreateIndexTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_index",
    description:
      "Create an index on one or more columns to improve query performance.",
    group: "core",
    inputSchema: CreateIndexSchema,
    outputSchema: CreateIndexOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create Index"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CreateIndexSchema.parse(params);

      // Validate names
      try {
        sanitizeIdentifier(input.indexName);
        sanitizeIdentifier(input.tableName);
        for (const col of input.columns) {
          sanitizeIdentifier(col);
        }
      } catch {
        return {
          success: false,
          message: `Invalid identifier: index, table, and column names must be non-empty strings starting with a letter or underscore`,
          sql: "",
        };
      }

      // Validate table existence
      const tableCheck = await adapter.executeReadQuery(
        `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name=?`,
        [input.tableName],
      );
      if ((tableCheck.rows?.length ?? 0) === 0) {
        return {
          success: false,
          message: `Table '${input.tableName}' does not exist`,
          code: "TABLE_NOT_FOUND",
          suggestion:
            "Table not found. Run sqlite_list_tables to see available tables.",
          sql: "",
        };
      }

      const unique = input.unique ? "UNIQUE " : "";
      const ifNotExists = input.ifNotExists ? "IF NOT EXISTS " : "";
      const columns = input.columns.map((c) => `"${c}"`).join(", ");

      // Check if index already exists (when using IF NOT EXISTS)
      let indexExisted = false;
      if (input.ifNotExists) {
        const checkResult = await adapter.executeReadQuery(
          `SELECT 1 FROM sqlite_master WHERE type='index' AND name=?`,
          [input.indexName],
        );
        indexExisted = (checkResult.rows?.length ?? 0) > 0;
      }

      const sql = `CREATE ${unique}INDEX ${ifNotExists}"${input.indexName}" ON "${input.tableName}" (${columns})`;

      try {
        await adapter.executeQuery(sql);

        return {
          success: true,
          message: indexExisted
            ? `Index '${input.indexName}' already exists (no changes made)`
            : `Index '${input.indexName}' created on ${input.tableName}(${input.columns.join(", ")})`,
          sql,
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          message: structured.error,
          sql,
        };
      }
    },
  };
}

/**
 * Drop an index
 */
export function createDropIndexTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_drop_index",
    description: "Drop (delete) an index from the database.",
    group: "core",
    inputSchema: DropIndexSchema,
    outputSchema: DropIndexOutputSchema,
    requiredScopes: ["admin"],
    annotations: destructive("Drop Index"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DropIndexSchema.parse(params);

      // Validate index name
      try {
        sanitizeIdentifier(input.indexName);
      } catch {
        return {
          success: false,
          message: `Invalid index name '${input.indexName}': must be a non-empty string starting with a letter or underscore`,
        };
      }

      // Check if index exists before dropping
      const checkResult = await adapter.executeReadQuery(
        `SELECT 1 FROM sqlite_master WHERE type='index' AND name=?`,
        [input.indexName],
      );
      const indexExists = (checkResult.rows?.length ?? 0) > 0;

      if (!indexExists) {
        if (input.ifExists) {
          return {
            success: true,
            message: `Index '${input.indexName}' does not exist (no changes made)`,
          };
        }
        return {
          success: false,
          message: `Index '${input.indexName}' does not exist`,
        };
      }

      try {
        const sql = `DROP INDEX "${input.indexName}"`;
        await adapter.executeQuery(sql);

        return {
          success: true,
          message: `Index '${input.indexName}' dropped successfully`,
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          message: structured.error,
        };
      }
    },
  };
}
