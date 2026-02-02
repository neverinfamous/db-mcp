/**
 * SQLite Core Database Tools
 *
 * Fundamental database operations: read, write, table management, indexes.
 * 8 tools total with OAuth scope enforcement.
 */

import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import {
  readOnly,
  write,
  idempotent,
  destructive,
} from "../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../utils/index.js";
import {
  ReadQuerySchema,
  WriteQuerySchema,
  CreateTableSchema,
  ListTablesSchema,
  DescribeTableSchema,
  DropTableSchema,
  CreateIndexSchema,
  GetIndexesSchema,
} from "../types.js";
import {
  ReadQueryOutputSchema,
  WriteQueryOutputSchema,
  CreateTableOutputSchema,
  ListTablesOutputSchema,
  DescribeTableOutputSchema,
  DropTableOutputSchema,
  GetIndexesOutputSchema,
  CreateIndexOutputSchema,
} from "../output-schemas.js";

/**
 * Get all core database tools
 */
export function getCoreTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createReadQueryTool(adapter),
    createWriteQueryTool(adapter),
    createCreateTableTool(adapter),
    createListTablesTool(adapter),
    createDescribeTableTool(adapter),
    createDropTableTool(adapter),
    createGetIndexesTool(adapter),
    createCreateIndexTool(adapter),
  ];
}

/**
 * Execute a read-only SQL query
 */
function createReadQueryTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_read_query",
    description:
      "Execute a SELECT query on the SQLite database. Returns rows as JSON. Use parameter binding for safety.",
    group: "core",
    inputSchema: ReadQuerySchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Read Query"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = ReadQuerySchema.parse(params);

      const result = await adapter.executeReadQuery(input.query, input.params);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        rows: result.rows,
        executionTimeMs: result.executionTimeMs,
      };
    },
  };
}

/**
 * Execute a write SQL query (INSERT, UPDATE, DELETE)
 */
function createWriteQueryTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_write_query",
    description:
      "Execute an INSERT, UPDATE, or DELETE query. Returns affected row count. Use parameter binding for safety.",
    group: "core",
    inputSchema: WriteQuerySchema,
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Write Query"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = WriteQuerySchema.parse(params);

      const result = await adapter.executeWriteQuery(input.query, input.params);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
        executionTimeMs: result.executionTimeMs,
      };
    },
  };
}

/**
 * Create a new table
 */
function createCreateTableTool(adapter: SqliteAdapter): ToolDefinition {
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
function isSpatialiteSystemIndex(name: string): boolean {
  return SPATIALITE_SYSTEM_INDEX_PREFIXES.some(
    (prefix) => name === prefix || name.startsWith(prefix),
  );
}

/**
 * Check if a table name is a SpatiaLite system table
 */
function isSpatialiteSystemTable(name: string): boolean {
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

/**
 * List all tables in the database
 */
function createListTablesTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_list_tables",
    description:
      "List all tables and views in the database with their row counts.",
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
function createDescribeTableTool(adapter: SqliteAdapter): ToolDefinition {
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

      const tableInfo = await adapter.describeTable(input.tableName);

      return {
        success: true,
        table: tableInfo.name,
        rowCount: tableInfo.rowCount,
        columns: tableInfo.columns,
      };
    },
  };
}

/**
 * Drop a table
 */
function createDropTableTool(adapter: SqliteAdapter): ToolDefinition {
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
      sanitizeIdentifier(input.tableName);

      const ifExists = input.ifExists ? "IF EXISTS " : "";
      const sql = `DROP TABLE ${ifExists}"${input.tableName}"`;

      await adapter.executeQuery(sql);

      return {
        success: true,
        message: `Table '${input.tableName}' dropped successfully`,
      };
    },
  };
}

/**
 * Get indexes
 */
function createGetIndexesTool(adapter: SqliteAdapter): ToolDefinition {
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
        sanitizeIdentifier(input.tableName);
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
function createCreateIndexTool(adapter: SqliteAdapter): ToolDefinition {
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
      sanitizeIdentifier(input.indexName);
      sanitizeIdentifier(input.tableName);
      for (const col of input.columns) {
        sanitizeIdentifier(col);
      }

      const unique = input.unique ? "UNIQUE " : "";
      const ifNotExists = input.ifNotExists ? "IF NOT EXISTS " : "";
      const columns = input.columns.map((c) => `"${c}"`).join(", ");

      const sql = `CREATE ${unique}INDEX ${ifNotExists}"${input.indexName}" ON "${input.tableName}" (${columns})`;

      await adapter.executeQuery(sql);

      return {
        success: true,
        message: `Index '${input.indexName}' created on ${input.tableName}(${input.columns.join(", ")})`,
        sql,
      };
    },
  };
}
