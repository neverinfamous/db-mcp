import {
  CreateTableSchema,
  ListTablesSchema,
  DescribeTableSchema,
  DropTableSchema,
} from "../../schemas/core.js";
import { logger } from "../../../../utils/logger/index.js";
/**
 * Core Table Management Tools
 *
 * Create, list, describe, and drop tables.
 * Includes SpatiaLite system table/view/index filtering.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  readOnly,
  idempotent,
  destructive,
} from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../utils/errors/index.js";
import { resolveAliases } from "../../types.js";
import {
  CreateTableOutputSchema,
  ListTablesOutputSchema,
  DescribeTableOutputSchema,
  DropTableOutputSchema,
} from "../../schemas/core.js";
import { validateQuery } from "../../../query-validation.js";

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
  "idx",
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
      "Create a new table in the database with specified columns and constraints. Idempotent if ifNotExists is set to true.",
    group: "core",
    inputSchema: CreateTableSchema,
    outputSchema: CreateTableOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = CreateTableSchema.parse(
          resolveAliases(params, { tableName: "table" }),
        );
      } catch (error: unknown) {
        return { ...formatHandlerError(error), sql: "" };
      }

      // Validate table name
      let safeTable: string;
      try {
        safeTable = sanitizeIdentifier(input.table);
      } catch {
        return {
          ...formatHandlerError(
            new ValidationError(
              `Invalid table name '${input.table}': must be a non-empty string starting with a letter or underscore`,
            ),
          ),
          sql: "",
        };
      }

      // Validate columns
      if (input.columns.length === 0) {
        return {
          ...formatHandlerError(
            new ValidationError("At least one column definition is required"),
          ),
          sql: "",
        };
      }

      // Check if table already exists (when using IF NOT EXISTS)
      let tableExisted = false;
      if (input.ifNotExists) {
        const checkResult = await adapter.executeReadQuery(
          `SELECT 1 FROM sqlite_master WHERE type='table' AND name=? UNION ALL SELECT 1 FROM sqlite_temp_master WHERE type='table' AND name=?`,
          [input.table, input.table],
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

      // Build table-level constraints
      const tableConstraints: string[] = [];
      
      if (input.foreignKeys && input.foreignKeys.length > 0) {
        for (const fk of input.foreignKeys) {
          const safeColumn = fk.column.replace(/"/g, '""');
          const safeTargetTable = fk.targetTable.replace(/"/g, '""');
          let fkStr = `FOREIGN KEY ("${safeColumn}") REFERENCES "${safeTargetTable}"`;
          if (fk.targetColumn) {
            const safeTargetColumn = fk.targetColumn.replace(/"/g, '""');
            fkStr += `("${safeTargetColumn}")`;
          }
          if (fk.onDelete) fkStr += ` ON DELETE ${fk.onDelete}`;
          if (fk.onUpdate) fkStr += ` ON UPDATE ${fk.onUpdate}`;
          tableConstraints.push(fkStr);
        }
      }

      if (input.checkConstraints && input.checkConstraints.length > 0) {
        for (const chk of input.checkConstraints) {
          try {
            validateQuery(`SELECT 1 WHERE ${chk}`, true);
          } catch (error: unknown) {
             return {
              ...formatHandlerError(new ValidationError(`Invalid CHECK constraint '${chk}': ${error instanceof Error ? error.message : String(error)}`)),
              sql: "",
            };
          }
          tableConstraints.push(`CHECK (${chk})`);
        }
      }

      const allDefs = [...columnDefs, ...tableConstraints];
      const ifNotExists = input.ifNotExists ? "IF NOT EXISTS " : "";
      const strictSuffix = input.strict ? " STRICT" : "";
      const sql = `CREATE TABLE ${ifNotExists}${safeTable} (${allDefs.join(", ")})${strictSuffix}`;

      try {
        await adapter.executeQuery(sql);

        return {
          success: true,
          message: tableExisted
            ? `Table '${input.table}' already exists (no changes made)`
            : `Table '${input.table}' created successfully`,
          sql,
        };
      } catch (error: unknown) {
        return { ...formatHandlerError(error), sql };
      }
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
      let input;
      try {
        input = ListTablesSchema.parse(params);
      } catch (error: unknown) {
        return {
          ...formatHandlerError(error),
          count: 0,
          tables: [],
        };
      }

      let tables = await adapter.listTables();

      // Filter out SpatiaLite system tables and internal db-mcp tables
      if (input.excludeSystemTables) {
        tables = tables.filter(
          (t) =>
            !isSpatialiteSystemTable(t.name) && !t.name.startsWith("_mcp_"),
        );
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
export function createDescribeTableTool(
  adapter: SqliteAdapter,
): ToolDefinition {
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
      let input;
      try {
        input = DescribeTableSchema.parse(
          resolveAliases(params, { tableName: "table" }),
        );
      } catch (error: unknown) {
        return {
          ...formatHandlerError(error),
          table: "",
          columns: [],
        };
      }

      // Check table existence first for a specific error code
      const checkResult = await adapter.executeReadQuery(
        `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name=? UNION ALL SELECT 1 FROM sqlite_temp_master WHERE type IN ('table', 'view') AND name=?`,
        [input.table, input.table],
      );
      if ((checkResult.rows?.length ?? 0) === 0) {
        return {
          ...formatHandlerError(
            new ValidationError(
              `Table '${input.table}' does not exist`,
              "TABLE_NOT_FOUND",
              {
                suggestion:
                  "Table not found. Run sqlite_list_tables to see available tables.",
              },
            ),
          ),
          table: input.table,
          columns: [],
        };
      }

      try {
        const tableInfo = await adapter.describeTable(input.table);
        const rawColumns = tableInfo.columns ?? [];

        // Build enriched column list with optional generated column info
        // Using a typed enriched structure to avoid unsafe Record casts
        interface EnrichedColumn {
          name: string;
          type: string;
          nullable?: boolean | undefined;
          primaryKey?: boolean | undefined;
          defaultValue?: unknown;
          isGenerated?: boolean | undefined;
          generatedExpression?: string | undefined;
          generatedType?: "VIRTUAL" | "STORED" | undefined;
        }

        let enrichedColumns: EnrichedColumn[] = rawColumns.map((c) => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
          primaryKey: c.primaryKey,
          defaultValue: c.defaultValue,
        }));

        // Enrich with generated column info from PRAGMA table_xinfo
        // table_xinfo returns 'hidden' field: 0=normal, 2=virtual generated, 3=stored generated
        try {
          const quotedTable = sanitizeIdentifier(input.table);
          const xinfoResult = await adapter.executeReadQuery(
            `PRAGMA table_xinfo(${quotedTable})`,
          );

          if (xinfoResult.rows && xinfoResult.rows.length > 0) {
            const xinfoMap = new Map<string, number>();
            for (const row of xinfoResult.rows) {
              xinfoMap.set(row["name"] as string, row["hidden"] as number);
            }

            // Check if there are any generated columns
            const hasGenerated = [...xinfoMap.values()].some(
              (v) => v === 2 || v === 3,
            );

            if (hasGenerated) {
              // Parse DDL to extract generated column expressions
              const ddlResult = await adapter.executeReadQuery(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
                [input.table],
              );
              const ddl = (ddlResult.rows?.[0]?.["sql"] as string) ?? "";

              enrichedColumns = enrichedColumns.map((col) => {
                const hidden = xinfoMap.get(col.name);
                if (hidden !== 2 && hidden !== 3) return col;

                const enriched: EnrichedColumn = {
                  ...col,
                  isGenerated: true,
                  generatedType: hidden === 3 ? "STORED" : "VIRTUAL",
                };

                // Extract expression from DDL using column name
                const escapedName = col.name.replace(
                  /[.*+?^${}()|[\]\\]/g,
                  "\\$&",
                );
                const exprPattern = new RegExp(
                  `"?${escapedName}"?\\s+\\w+[^,]*GENERATED\\s+ALWAYS\\s+AS\\s*\\(([^)]+)\\)`,
                  "i",
                );
                const match = exprPattern.exec(ddl);
                if (match?.[1]) {
                  enriched.generatedExpression = match[1].trim();
                }

                return enriched;
              });
            }
          }
        } catch {
          // table_xinfo may not be available in older SQLite — silently skip enrichment
        }

        return {
          success: true,
          table: tableInfo.name,
          strict: tableInfo.strict,
          rowCount: tableInfo.rowCount,
          columns: enrichedColumns,
        };
      } catch (error: unknown) {
        return {
          ...formatHandlerError(error),
          table: input.table,
          columns: [],
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
      let input;
      try {
        input = DropTableSchema.parse(
          resolveAliases(params, { tableName: "table" }),
        );
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      // Validate table name
      let safeTable: string;
      try {
        safeTable = sanitizeIdentifier(input.table);
      } catch {
        return formatHandlerError(
          new ValidationError(
            `Invalid table name '${input.table}': must be a non-empty string starting with a letter or underscore`,
          ),
        );
      }

      // Check if table exists before dropping
      const checkResult = await adapter.executeReadQuery(
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name=? UNION ALL SELECT 1 FROM sqlite_temp_master WHERE type='table' AND name=?`,
        [input.table, input.table],
      );
      const tableExists = (checkResult.rows?.length ?? 0) > 0;

      if (!tableExists) {
        if (input.ifExists) {
          return {
            success: true,
            message: `Table '${input.table}' does not exist (no changes made)`,
          };
        }
        return formatHandlerError(
          new ValidationError(`Table '${input.table}' does not exist`),
        );
      }

      try {
        // Attempt to clean up orphaned FTS5 sync triggers on source tables
        // These triggers are named {tableName}_ai, {tableName}_ad, {tableName}_au
        const triggerNames = [
          `${input.table}_ai`,
          `${input.table}_ad`,
          `${input.table}_au`,
        ];

        try {
          const triggersResult = await adapter.executeReadQuery(
            `SELECT name, sql FROM sqlite_master WHERE type='trigger' AND name IN (?, ?, ?)`,
            triggerNames,
          );

          if (triggersResult.rows && triggersResult.rows.length > 0) {
            for (const row of triggersResult.rows) {
              const rawSql = row["sql"];
              const sql = typeof rawSql === "string" ? rawSql : "";
              const triggerName = row["name"];

              if (typeof triggerName !== "string") continue;

              // Verify the trigger was created for this FTS table by checking if it inserts into it
              if (
                sql.includes(`INTO "${input.table}"`) ||
                sql.includes(`INTO ${input.table}`)
              ) {
                await adapter.executeQuery(
                  `DROP TRIGGER IF EXISTS "${triggerName}"`,
                );
              }
            }
          }
        } catch (err) {
          // Ignore cleanup errors to ensure the primary DROP TABLE operation proceeds
          logger.warning(
            `Failed to clean up FTS triggers for ${input.table}`,
            { code: "FTS_CLEANUP_FAILED", error: err instanceof Error ? err : new Error(String(err)) }
          );
        }

        const sql = `DROP TABLE ${safeTable}`;
        await adapter.executeQuery(sql);

        return {
          success: true,
          message: `Table '${input.table}' dropped successfully`,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}
