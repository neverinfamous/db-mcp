/**
 * Core Table Management Tools
 *
 * Create, list, describe, and drop tables.
 * Includes SpatiaLite system table/view/index filtering.
 */

import type { SqliteAdapter } from "../../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly, idempotent, destructive } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatError } from "../../../../utils/errors.js";
import {
  CreateTableSchema,
  ListTablesSchema,
  DescribeTableSchema,
  DropTableSchema,
} from "../../types.js";
import {
  CreateTableOutputSchema,
  ListTablesOutputSchema,
  DescribeTableOutputSchema,
  DropTableOutputSchema,
} from "../../output-schemas/index.js";

// =============================================================================
// SpatiaLite System Filters
// =============================================================================

/**
 * SpatiaLite system table prefixes to exclude when filtering
 */
const SPATIALITE_SYSTEM_PREFIXES = [
  "geometry_columns",
  "spatial_ref_sys",
  "spatialite_history",
  "sql_statements_log",
  "views_geometry_columns",
  "virts_geometry_columns",
  "vector_layers",
  "data_licenses",
  "geom_cols_ref_sys",
  "ElementaryGeometries",
  "SpatialIndex",
  "KNN",
  "KNN2",
];

/**
 * SpatiaLite system index prefixes to exclude when filtering
 */
const SPATIALITE_SYSTEM_INDEX_PREFIXES = [
  "idx_spatial_ref_sys",
  "idx_srid_geocols",
  "idx_viewsjoin",
  "idx_virtssrid",
  "idx_vector_layers",
  "idx_geometry_columns",
  "sqlite_autoindex_",
];

/**
 * Check if an index name is a SpatiaLite system index
 */
export function isSpatialiteSystemIndex(name: string): boolean {
  return SPATIALITE_SYSTEM_INDEX_PREFIXES.some(
    (prefix) => name === prefix || name.startsWith(prefix),
  );
}

/**
 * Check if a table name is a SpatiaLite system table
 */
export function isSpatialiteSystemTable(name: string): boolean {
  return SPATIALITE_SYSTEM_PREFIXES.some(
    (prefix) => name === prefix || name.startsWith(`${prefix}_`),
  );
}

/**
 * SpatiaLite system views to exclude when filtering
 */
const SPATIALITE_SYSTEM_VIEWS = [
  "geom_cols_ref_sys",
  "spatial_ref_sys_all",
  "vector_layers",
  "vector_layers_auth",
  "vector_layers_field_infos",
  "vector_layers_statistics",
];

/**
 * Check if a view name is a SpatiaLite system view
 */
export function isSpatialiteSystemView(name: string): boolean {
  return SPATIALITE_SYSTEM_VIEWS.includes(name);
}

// =============================================================================
// Tool Creators
// =============================================================================

/**
 * Create a new table
 */
export function createCreateTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_table",
    description:
      "Create a new table in the database with specified columns and constraints.",
    group: "core",
    inputSchema: CreateTableSchema,
    outputSchema: CreateTableOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CreateTableSchema.parse(params);

      // Validate table name
      try {
        sanitizeIdentifier(input.tableName);
      } catch {
        return {
          success: false,
          message: `Invalid table name '${input.tableName}': must be a non-empty string starting with a letter or underscore`,
          sql: "",
        };
      }

      // Validate columns
      if (input.columns.length === 0) {
        return {
          success: false,
          message: "At least one column definition is required",
          sql: "",
        };
      }

      // Check if table already exists (when using IF NOT EXISTS)
      let tableExisted = false;
      if (input.ifNotExists) {
        const checkResult = await adapter.executeReadQuery(
          `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`,
          [input.tableName],
        );
        tableExisted = (checkResult.rows?.length ?? 0) > 0;
      }

      // Build column definitions
      const columnDefs = input.columns.map((col) => {
        const parts = [`"${col.name}" ${col.type}`];
        if (col.primaryKey) parts.push("PRIMARY KEY");
        if (col.unique && !col.primaryKey) parts.push("UNIQUE");
        if (!col.nullable) parts.push("NOT NULL");
        if (col.defaultValue !== undefined) {
          let defaultVal: string;
          if (typeof col.defaultValue === "string") {
            // Check if it's a SQL expression (contains function call or keywords)
            // Expressions like datetime('now'), CURRENT_TIMESTAMP, etc.
            const isSqlExpression =
              /^[a-zA-Z_]+\s*\(/.test(col.defaultValue) || // function call: datetime(...)
              /^(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|NULL)$/i.test(
                col.defaultValue,
              );
            if (isSqlExpression) {
              // Wrap SQL expressions in parentheses
              defaultVal = `(${col.defaultValue})`;
            } else {
              // Literal string value - quote it
              defaultVal = `'${col.defaultValue.replace(/'/g, "''")}'`;
            }
          } else if (
            typeof col.defaultValue === "number" ||
            typeof col.defaultValue === "boolean"
          ) {
            defaultVal = String(col.defaultValue);
          } else if (col.defaultValue === null) {
            defaultVal = "NULL";
          } else {
            // For objects and other types, use JSON
            defaultVal = `'${JSON.stringify(col.defaultValue).replace(/'/g, "''")}'`;
          }
          parts.push(`DEFAULT ${defaultVal}`);
        }
        return parts.join(" ");
      });

      const ifNotExists = input.ifNotExists ? "IF NOT EXISTS " : "";
      const sql = `CREATE TABLE ${ifNotExists}"${input.tableName}" (${columnDefs.join(", ")})`;

      await adapter.executeQuery(sql);

      return {
        success: true,
        message: tableExisted
          ? `Table '${input.tableName}' already exists (no changes made)`
          : `Table '${input.tableName}' created successfully`,
        sql,
      };
    },
  };
}

/**
 * List all tables in the database
 */
export function createListTablesTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_list_tables",
    description:
      "List all tables and views in the database with their column counts.",
    group: "core",
    inputSchema: ListTablesSchema,
    outputSchema: ListTablesOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("List Tables"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = ListTablesSchema.parse(params);
      let tables = await adapter.listTables();

      // Filter out SpatiaLite system tables if requested
      if (input.excludeSystemTables) {
        tables = tables.filter((t) => !isSpatialiteSystemTable(t.name));
      }

      return {
        success: true,
        count: tables.length,
        tables: tables.map((t) => ({
          name: t.name,
          type: t.type,
          rowCount: t.rowCount,
          columnCount: t.columns?.length ?? 0,
        })),
      };
    },
  };
}

/**
 * Describe a table's structure
 */
export function createDescribeTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_describe_table",
    description:
      "Get detailed schema information for a table including columns, types, and constraints.",
    group: "core",
    inputSchema: DescribeTableSchema,
    outputSchema: DescribeTableOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Describe Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DescribeTableSchema.parse(params);

      // Check table existence first for a specific error code
      const checkResult = await adapter.executeReadQuery(
        `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name=?`,
        [input.tableName],
      );
      if ((checkResult.rows?.length ?? 0) === 0) {
        return {
          success: false,
          table: input.tableName,
          columns: [],
          error: `Table '${input.tableName}' does not exist`,
          code: "TABLE_NOT_FOUND",
          suggestion:
            "Table not found. Run sqlite_list_tables to see available tables.",
        };
      }

      try {
        const tableInfo = await adapter.describeTable(input.tableName);

        return {
          success: true,
          table: tableInfo.name,
          rowCount: tableInfo.rowCount,
          columns: tableInfo.columns,
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          table: input.tableName,
          columns: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Drop a table
 */
export function createDropTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_drop_table",
    description:
      "Drop (delete) a table from the database. This is irreversible!",
    group: "core",
    inputSchema: DropTableSchema,
    outputSchema: DropTableOutputSchema,
    requiredScopes: ["admin"],
    annotations: destructive("Drop Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DropTableSchema.parse(params);

      // Validate table name
      try {
        sanitizeIdentifier(input.tableName);
      } catch {
        return {
          success: false,
          message: `Invalid table name '${input.tableName}': must be a non-empty string starting with a letter or underscore`,
        };
      }

      // Check if table exists before dropping
      const checkResult = await adapter.executeReadQuery(
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`,
        [input.tableName],
      );
      const tableExists = (checkResult.rows?.length ?? 0) > 0;

      if (!tableExists) {
        if (input.ifExists) {
          return {
            success: true,
            message: `Table '${input.tableName}' does not exist (no changes made)`,
          };
        }
        return {
          success: false,
          message: `Table '${input.tableName}' does not exist`,
        };
      }

      try {
        const sql = `DROP TABLE "${input.tableName}"`;
        await adapter.executeQuery(sql);

        return {
          success: true,
          message: `Table '${input.tableName}' dropped successfully`,
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
