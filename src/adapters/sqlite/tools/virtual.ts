/**
 * SQLite Virtual Table Tools
 *
 * Create and manage virtual tables for CSV, R-Tree, generation, etc.
 * 13 tools total.
 */

import * as path from "node:path";
import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import {
  readOnly,
  idempotent,
  destructive,
  admin,
} from "../../../utils/annotations.js";
import {
  buildProgressContext,
  sendProgress,
} from "../../../utils/progress-utils.js";
import { sanitizeIdentifier } from "../../../utils/index.js";
import {
  GenerateSeriesOutputSchema,
  CreateTableOutputSchema,
  ListViewsOutputSchema,
  DropTableOutputSchema,
  VacuumOutputSchema,
} from "../output-schemas.js";
import {
  isSpatialiteSystemView,
  isSpatialiteSystemTable,
  isSpatialiteSystemIndex,
} from "./core.js";

// Virtual table schemas
const GenerateSeriesSchema = z.object({
  start: z.number().describe("Start value"),
  stop: z.number().describe("Stop value"),
  step: z.number().optional().default(1).describe("Step value"),
});

const CreateViewSchema = z.object({
  viewName: z.string().describe("Name of the view"),
  selectQuery: z.string().describe("SELECT query for view definition"),
  replace: z.boolean().optional().default(false),
});

const ListViewsSchema = z.object({
  pattern: z
    .string()
    .optional()
    .describe("Optional LIKE pattern to filter views"),
  excludeSystemViews: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Exclude SpatiaLite system views (default: true). Set to false to include all views.",
    ),
});

const DropViewSchema = z.object({
  viewName: z.string().describe("Name of the view to drop"),
  ifExists: z.boolean().optional().default(true),
});

const DbStatSchema = z.object({
  table: z.string().optional().describe("Optional table name to filter"),
  summarize: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "If true, return aggregated per-table stats instead of raw page-level data",
    ),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe("Maximum number of tables/pages to return (default: 100)"),
  excludeSystemTables: z
    .boolean()
    .optional()
    .default(false)
    .describe("Exclude SpatiaLite system tables from results (default: false)"),
});

const VacuumSchema = z.object({
  into: z.string().optional().describe("Optional file path to vacuum into"),
});

// New virtual table schemas
const ListVirtualTablesSchema = z.object({
  pattern: z.string().optional().describe("Optional LIKE pattern to filter"),
});

const VirtualTableInfoSchema = z.object({
  tableName: z.string().describe("Name of the virtual table"),
});

const DropVirtualTableSchema = z.object({
  tableName: z.string().describe("Name of the virtual table to drop"),
  ifExists: z.boolean().optional().default(true),
});

const CreateCsvTableSchema = z.object({
  tableName: z.string().describe("Name for the virtual table"),
  filePath: z.string().describe("Path to the CSV file"),
  header: z.boolean().optional().default(true).describe("First row is header"),
  delimiter: z.string().optional().default(",").describe("Column delimiter"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Manual column names if no header"),
});

const AnalyzeCsvSchemaSchema = z.object({
  filePath: z.string().describe("Path to the CSV file"),
  sampleRows: z.number().optional().default(100).describe("Rows to sample"),
  delimiter: z.string().optional().default(",").describe("Column delimiter"),
});

const CreateRtreeTableSchema = z.object({
  tableName: z.string().describe("Name for the R-Tree table"),
  dimensions: z
    .number()
    .min(2)
    .max(5)
    .optional()
    .default(2)
    .describe("Number of dimensions (2-5)"),
  idColumn: z.string().optional().default("id").describe("ID column name"),
});

const CreateSeriesTableSchema = z.object({
  tableName: z.string().describe("Name for the series table"),
  start: z.number().describe("Start value"),
  stop: z.number().describe("Stop value"),
  step: z.number().optional().default(1).describe("Step value"),
  columnName: z.string().optional().default("value").describe("Column name"),
});

/**
 * Get all virtual table tools
 */
export function getVirtualTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createGenerateSeriesTool(adapter),
    createCreateViewTool(adapter),
    createListViewsTool(adapter),
    createDropViewTool(adapter),
    createDbStatTool(adapter),
    createVacuumTool(adapter),
    // New virtual table tools
    createListVirtualTablesTool(adapter),
    createVirtualTableInfoTool(adapter),
    createDropVirtualTableTool(adapter),
    createCsvTableTool(adapter),
    createAnalyzeCsvSchemaTool(adapter),
    createRtreeTableTool(adapter),
    createSeriesTableTool(adapter),
  ];
}

/**
 * Generate series of numbers
 * Note: Uses pure JS implementation since better-sqlite3's bundled SQLite
 * is not compiled with SQLITE_ENABLE_SERIES (required for native generate_series).
 */
function createGenerateSeriesTool(_adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_generate_series",
    description:
      "Generate a series of numbers using generate_series() virtual table.",
    group: "admin",
    inputSchema: GenerateSeriesSchema,
    outputSchema: GenerateSeriesOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Generate Series"),
    handler: (params: unknown, _context: RequestContext) => {
      const input = GenerateSeriesSchema.parse(params);

      // Generate in JS - better-sqlite3 doesn't include SQLITE_ENABLE_SERIES
      const values: number[] = [];
      for (
        let i = input.start;
        input.step > 0 ? i <= input.stop : i >= input.stop;
        i += input.step
      ) {
        values.push(i);
        if (values.length > 10000) break; // Safety limit
      }

      return Promise.resolve({
        success: true,
        count: values.length,
        values,
      });
    },
  };
}

/**
 * Create a view
 */
function createCreateViewTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_view",
    description: "Create a view based on a SELECT query.",
    group: "admin",
    inputSchema: CreateViewSchema,
    outputSchema: CreateTableOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create View"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CreateViewSchema.parse(params);

      // Validate and quote view name
      const viewName = sanitizeIdentifier(input.viewName);

      // Basic validation that it's a SELECT
      if (!input.selectQuery.trim().toUpperCase().startsWith("SELECT")) {
        throw new Error("View definition must be a SELECT query");
      }

      // SQLite doesn't support CREATE OR REPLACE VIEW
      // Use DROP IF EXISTS + CREATE VIEW pattern instead
      if (input.replace) {
        await adapter.executeQuery(`DROP VIEW IF EXISTS ${viewName}`);
      }
      const sql = `CREATE VIEW ${viewName} AS ${input.selectQuery}`;

      await adapter.executeQuery(sql);

      return {
        success: true,
        message: `View '${input.viewName}' created`,
        sql,
      };
    },
  };
}

/**
 * List views
 */
function createListViewsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_list_views",
    description: "List all views in the database.",
    group: "admin",
    inputSchema: ListViewsSchema,
    outputSchema: ListViewsOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("List Views"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = ListViewsSchema.parse(params);

      let sql = `SELECT name, sql FROM sqlite_master WHERE type = 'view'`;
      if (input.pattern) {
        const escapedPattern = input.pattern.replace(/'/g, "''");
        sql += ` AND name LIKE '${escapedPattern}'`;
      }
      sql += ` ORDER BY name`;

      const result = await adapter.executeReadQuery(sql);

      let views = (result.rows ?? []).map((row) => ({
        name: typeof row["name"] === "string" ? row["name"] : "",
        sql: typeof row["sql"] === "string" ? row["sql"] : null,
      }));

      // Filter out SpatiaLite system views if requested (default: true)
      if (input.excludeSystemViews) {
        views = views.filter((v) => !isSpatialiteSystemView(v.name));
      }

      return {
        success: true,
        count: views.length,
        views,
      };
    },
  };
}

/**
 * Drop a view
 */
function createDropViewTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_drop_view",
    description: "Drop (delete) a view from the database.",
    group: "admin",
    inputSchema: DropViewSchema,
    outputSchema: DropTableOutputSchema,
    requiredScopes: ["admin"],
    annotations: destructive("Drop View"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DropViewSchema.parse(params);

      // Validate and quote view name
      const viewName = sanitizeIdentifier(input.viewName);

      const ifExists = input.ifExists ? "IF EXISTS " : "";
      const sql = `DROP VIEW ${ifExists}${viewName}`;

      await adapter.executeQuery(sql);

      return {
        success: true,
        message: `View '${input.viewName}' dropped`,
      };
    },
  };
}

/**
 * Database statistics via dbstat
 */
function createDbStatTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_dbstat",
    description: "Get database storage statistics using dbstat virtual table.",
    group: "admin",
    inputSchema: DbStatSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Database Stats"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DbStatSchema.parse(params);

      try {
        // Summarize mode: aggregate per-table stats
        if (input.summarize) {
          let sql = `SELECT 
              name,
              COUNT(*) as page_count,
              SUM(payload) as total_payload,
              SUM(unused) as total_unused,
              SUM(ncell) as total_cells,
              MAX(mx_payload) as max_payload
            FROM dbstat`;

          if (input.table) {
            sanitizeIdentifier(input.table);
            sql += ` WHERE name = '${input.table.replace(/'/g, "''")}'`;
          }

          sql += ` GROUP BY name ORDER BY name LIMIT ${input.limit}`;

          const result = await adapter.executeReadQuery(sql);

          // Filter out SpatiaLite system tables if requested
          let tables = (result.rows ?? []).map((row) => ({
            name: row["name"] as string,
            pageCount: row["page_count"] as number,
            totalPayload: row["total_payload"] as number,
            totalUnused: row["total_unused"] as number,
            totalCells: row["total_cells"] as number,
            maxPayload: row["max_payload"] as number,
          }));

          if (input.excludeSystemTables) {
            tables = tables.filter(
              (t) =>
                !isSpatialiteSystemTable(t.name) &&
                !isSpatialiteSystemIndex(t.name),
            );
          }

          return {
            success: true,
            summarized: true,
            tableCount: tables.length,
            tables,
          };
        }

        // Default mode: raw page-level stats
        let sql = `SELECT name, path, pageno, pagetype, ncell, payload, unused, mx_payload 
                    FROM dbstat`;

        if (input.table) {
          // Validate table name
          sanitizeIdentifier(input.table);
          // For WHERE clause, we need raw table name without quotes for string comparison
          sql += ` WHERE name = '${input.table.replace(/'/g, "''")}'`;
        }

        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        // Filter out SpatiaLite system tables/indexes if requested
        let stats = result.rows ?? [];
        if (input.excludeSystemTables) {
          stats = stats.filter(
            (row) =>
              !isSpatialiteSystemTable(row["name"] as string) &&
              !isSpatialiteSystemIndex(row["name"] as string),
          );
        }

        return {
          success: true,
          rowCount: stats.length,
          stats,
        };
      } catch {
        // dbstat may not be available
        // Fallback to basic stats with optional table-specific estimates
        const pageCountResult =
          await adapter.executeReadQuery("PRAGMA page_count");
        const totalPageCount =
          pageCountResult.rows?.[0]?.["page_count"] ??
          pageCountResult.rows?.[0]?.[0];
        const totalPages =
          typeof totalPageCount === "number"
            ? totalPageCount
            : Number(totalPageCount);

        // If a specific table is requested, provide table-specific estimate
        if (input.table) {
          sanitizeIdentifier(input.table);
          const escapedTable = input.table.replace(/'/g, "''");

          // Check if table exists
          const tableCheck = await adapter.executeReadQuery(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='${escapedTable}'`,
          );
          if (!tableCheck.rows || tableCheck.rows.length === 0) {
            return {
              success: false,
              message: `Table '${input.table}' not found`,
            };
          }

          // Get row count for the specific table
          const countResult = await adapter.executeReadQuery(
            `SELECT COUNT(*) as count FROM "${input.table}"`,
          );
          const rowCount = Number(countResult.rows?.[0]?.["count"] ?? 0);

          // Estimate pages: ~100 rows per page for typical data
          const estimatedPages = Math.max(1, Math.ceil(rowCount / 100));

          return {
            success: true,
            table: input.table,
            rowCount,
            estimatedPages,
            totalDatabasePages: totalPages,
            note: "dbstat virtual table not available; page count is estimated from row count (~100 rows/page)",
          };
        }

        // Get table count for additional context
        const tableCountResult = await adapter.executeReadQuery(
          `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
        );
        const tableCount = Number(tableCountResult.rows?.[0]?.["cnt"] ?? 0);

        return {
          success: true,
          pageCount: totalPages,
          tableCount,
          note: "dbstat virtual table not available, showing basic stats",
        };
      }
    },
  };
}

/**
 * Vacuum database
 */
function createVacuumTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vacuum",
    description:
      "Rebuild the database to reclaim space and optimize structure.",
    group: "admin",
    inputSchema: VacuumSchema,
    outputSchema: VacuumOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Vacuum Database"),
    handler: async (params: unknown, context: RequestContext) => {
      const input = VacuumSchema.parse(params);
      const progress = buildProgressContext(context);

      // Phase 1: Starting vacuum
      await sendProgress(progress, 1, 2, "Starting vacuum operation...");

      let sql = "VACUUM";
      if (input.into) {
        // VACUUM INTO creates a compacted copy
        const escapedPath = input.into.replace(/'/g, "''");
        sql = `VACUUM INTO '${escapedPath}'`;
      }

      const start = Date.now();
      await adapter.executeQuery(sql);
      const duration = Date.now() - start;

      // Phase 2: Complete
      await sendProgress(progress, 2, 2, "Vacuum complete");

      return {
        success: true,
        message: input.into
          ? `Database vacuumed into '${input.into}'`
          : "Database vacuumed",
        durationMs: duration,
      };
    },
  };
}

// =============================================================================
// New Virtual Table Tools
// =============================================================================

/**
 * Check if a module is available
 */
async function isModuleAvailable(
  adapter: SqliteAdapter,
  moduleName: string,
): Promise<boolean> {
  try {
    const result = await adapter.executeReadQuery(
      `SELECT name FROM pragma_module_list WHERE name = '${moduleName}'`,
    );
    return (result.rows?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Check if any CSV module is available (standard csv or sqlite-xsv variant)
 */
async function isCsvModuleAvailable(
  adapter: SqliteAdapter,
): Promise<{ available: boolean; variant: "csv" | "xsv" | null }> {
  // Check for standard csv module
  if (await isModuleAvailable(adapter, "csv")) {
    return { available: true, variant: "csv" };
  }
  // Check for sqlite-xsv module (registers as xsv_reader)
  if (await isModuleAvailable(adapter, "xsv_reader")) {
    return { available: true, variant: "xsv" };
  }
  // Check for xsv (alternative name)
  if (await isModuleAvailable(adapter, "xsv")) {
    return { available: true, variant: "xsv" };
  }
  return { available: false, variant: null };
}

/**
 * List all virtual tables
 */
function createListVirtualTablesTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_list_virtual_tables",
    description: "List all virtual tables in the database.",
    group: "admin",
    inputSchema: ListVirtualTablesSchema,
    outputSchema: z.object({
      success: z.boolean(),
      count: z.number(),
      virtualTables: z.array(
        z.object({
          name: z.string(),
          module: z.string(),
          sql: z.string(),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("List Virtual Tables"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = ListVirtualTablesSchema.parse(params);

      let sql = `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql LIKE 'CREATE VIRTUAL TABLE%'`;
      if (input.pattern) {
        sql += ` AND name LIKE '${input.pattern.replace(/'/g, "''")}'`;
      }

      const result = await adapter.executeReadQuery(sql);

      const virtualTables = (result.rows ?? []).map((row) => {
        const sqlStr = typeof row["sql"] === "string" ? row["sql"] : "";
        // Extract module name from SQL: CREATE VIRTUAL TABLE x USING module(...)
        const match = /USING\s+(\w+)/i.exec(sqlStr);
        return {
          name: typeof row["name"] === "string" ? row["name"] : "",
          module: match?.[1] ?? "unknown",
          sql: sqlStr,
        };
      });

      return {
        success: true,
        count: virtualTables.length,
        virtualTables,
      };
    },
  };
}

/**
 * Get virtual table info
 */
function createVirtualTableInfoTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_virtual_table_info",
    description: "Get metadata about a specific virtual table.",
    group: "admin",
    inputSchema: VirtualTableInfoSchema,
    outputSchema: z.object({
      success: z.boolean(),
      name: z.string(),
      module: z.string(),
      moduleAvailable: z.boolean().optional(),
      columns: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
          }),
        )
        .optional(),
      sql: z.string(),
      note: z.string().optional(),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Virtual Table Info"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = VirtualTableInfoSchema.parse(params);

      // Validate table name (we need raw name for queries)
      sanitizeIdentifier(input.tableName);

      // Get the CREATE statement
      const sqlResult = await adapter.executeReadQuery(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${input.tableName.replace(/'/g, "''")}' AND sql LIKE 'CREATE VIRTUAL TABLE%'`,
      );

      if (!sqlResult.rows || sqlResult.rows.length === 0) {
        throw new Error(`Virtual table '${input.tableName}' not found`);
      }

      const sqlStr =
        typeof sqlResult.rows[0]?.["sql"] === "string"
          ? sqlResult.rows[0]["sql"]
          : "";
      const match = /USING\s+(\w+)/i.exec(sqlStr);
      const moduleName = match?.[1] ?? "unknown";

      // Get column info - may fail if module is unavailable (e.g., FTS5 in WASM)
      try {
        const colResult = await adapter.executeReadQuery(
          `PRAGMA table_info("${input.tableName}")`,
        );

        const columns = (colResult.rows ?? []).map((row) => ({
          name: typeof row["name"] === "string" ? row["name"] : "",
          type: typeof row["type"] === "string" ? row["type"] : "TEXT",
        }));

        return {
          success: true,
          name: input.tableName,
          module: moduleName,
          moduleAvailable: true,
          columns,
          sql: sqlStr,
        };
      } catch (error) {
        // Module unavailable (e.g., FTS5 in WASM) - return partial info
        const errMsg = error instanceof Error ? error.message : String(error);
        const isModuleError =
          errMsg.includes("no such module") ||
          errMsg.includes("unknown module");

        if (isModuleError) {
          return {
            success: true,
            name: input.tableName,
            module: moduleName,
            moduleAvailable: false,
            sql: sqlStr,
            note: `Module '${moduleName}' not available in this environment. Column info cannot be retrieved.`,
          };
        }
        // Re-throw unexpected errors
        throw error;
      }
    },
  };
}

/**
 * Drop virtual table
 */
function createDropVirtualTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_drop_virtual_table",
    description: "Drop a virtual table.",
    group: "admin",
    inputSchema: DropVirtualTableSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    requiredScopes: ["write"],
    annotations: destructive("Drop Virtual Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DropVirtualTableSchema.parse(params);

      // Validate and quote table name
      const tableName = sanitizeIdentifier(input.tableName);

      // Check if the table exists and is a virtual table
      const escapedName = input.tableName.replace(/'/g, "''");
      const existsResult = await adapter.executeReadQuery(
        `SELECT name, sql FROM sqlite_master WHERE type='table' AND name='${escapedName}'`,
      );
      const tableExists =
        existsResult.rows !== undefined && existsResult.rows.length > 0;
      const sqlValue = existsResult.rows?.[0]?.["sql"];
      const isVirtualTable =
        tableExists &&
        typeof sqlValue === "string" &&
        sqlValue.toUpperCase().includes("CREATE VIRTUAL TABLE");

      // Validate that it's actually a virtual table if it exists
      if (tableExists && !isVirtualTable) {
        return {
          success: false,
          message: `'${input.tableName}' is a regular table, not a virtual table. Use sqlite_drop_table instead.`,
        };
      }

      const sql = input.ifExists
        ? `DROP TABLE IF EXISTS ${tableName}`
        : `DROP TABLE ${tableName}`;

      await adapter.executeWriteQuery(sql);

      // Return accurate message based on whether table existed
      if (tableExists) {
        return {
          success: true,
          message: `Dropped virtual table '${input.tableName}'`,
        };
      } else if (input.ifExists) {
        return {
          success: true,
          message: `Virtual table '${input.tableName}' did not exist (no action taken)`,
        };
      } else {
        // This shouldn't be reached as DROP TABLE without IF EXISTS would throw
        return {
          success: true,
          message: `Dropped virtual table '${input.tableName}'`,
        };
      }
    },
  };
}

/**
 * Create CSV virtual table
 */
function createCsvTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_csv_table",
    description:
      "Create a virtual table from a CSV file. Requires the csv extension.",
    group: "admin",
    inputSchema: CreateCsvTableSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      sql: z.string(),
      columns: z.array(z.string()),
    }),
    requiredScopes: ["write"],
    annotations: idempotent("Create CSV Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CreateCsvTableSchema.parse(params);

      // Validate table name (we'll use it with double quotes in SQL)
      sanitizeIdentifier(input.tableName);

      // Validate that the file path is absolute (required by SQLite CSV extension)
      if (!path.isAbsolute(input.filePath)) {
        return {
          success: false,
          message: `Relative path not supported. Please use an absolute path. Example: ${path.resolve(input.filePath)}`,
          sql: "",
          columns: [],
        };
      }

      // Check if csv module is available (supports standard csv and sqlite-xsv)
      const { available: csvAvailable } = await isCsvModuleAvailable(adapter);
      if (!csvAvailable) {
        // Check if we're in WASM mode by testing for a WASM-specific limitation
        const isWasm = !(await isModuleAvailable(adapter, "rtree"));
        return {
          success: false,
          message: isWasm
            ? "CSV extension not available in WASM mode. Use native SQLite with the csv extension."
            : "CSV extension not available. Load the csv/xsv extension using --csv flag or set CSV_EXTENSION_PATH.",
          sql: "",
          columns: [],
          wasmLimitation: isWasm,
        };
      }

      // Build CREATE VIRTUAL TABLE statement
      const options: string[] = [
        `filename='${input.filePath.replace(/'/g, "''")}'`,
      ];
      if (!input.header) {
        options.push("header=false");
      }
      if (input.delimiter !== ",") {
        options.push(`delimiter='${input.delimiter}'`);
      }
      if (input.columns && input.columns.length > 0) {
        options.push(`columns=${String(input.columns.length)}`);
      }

      const sql = `CREATE VIRTUAL TABLE "${input.tableName}" USING csv(${options.join(", ")})`;
      await adapter.executeWriteQuery(sql);

      // Get column names
      const colResult = await adapter.executeReadQuery(
        `PRAGMA table_info("${input.tableName}")`,
      );
      const columns = (colResult.rows ?? []).map((row) =>
        typeof row["name"] === "string" ? row["name"] : "",
      );

      return {
        success: true,
        message: `Created CSV virtual table '${input.tableName}'`,
        sql,
        columns,
      };
    },
  };
}

/**
 * Analyze CSV schema
 */
function createAnalyzeCsvSchemaTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_analyze_csv_schema",
    description:
      "Analyze a CSV file structure and infer column types. Uses a temporary virtual table.",
    group: "admin",
    inputSchema: AnalyzeCsvSchemaSchema,
    outputSchema: z.object({
      success: z.boolean(),
      hasHeader: z.boolean(),
      rowCount: z.number(),
      columns: z.array(
        z.object({
          name: z.string(),
          inferredType: z.string(),
          nullCount: z.number(),
          sampleValues: z.array(z.string()),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Analyze CSV Schema"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = AnalyzeCsvSchemaSchema.parse(params);

      // Validate that the file path is absolute (required by SQLite CSV extension)
      if (!path.isAbsolute(input.filePath)) {
        return {
          success: false,
          message: `Relative path not supported. Please use an absolute path. Example: ${path.resolve(input.filePath)}`,
          hasHeader: false,
          rowCount: 0,
          columns: [],
        };
      }

      // Check if csv module is available (supports standard csv and sqlite-xsv)
      const { available: csvAvailable } = await isCsvModuleAvailable(adapter);
      if (!csvAvailable) {
        // Check if we're in WASM mode by testing for a WASM-specific limitation
        const isWasm = !(await isModuleAvailable(adapter, "rtree"));
        return {
          success: false,
          message: isWasm
            ? "CSV extension not available in WASM mode. Use native SQLite with the csv extension."
            : "CSV extension not available. Load the csv/xsv extension using --csv flag or set CSV_EXTENSION_PATH.",
          hasHeader: false,
          rowCount: 0,
          columns: [],
          wasmLimitation: isWasm,
        };
      }

      // Create temporary table name
      const tempName = `_csv_analyze_${Date.now()}`;

      try {
        // Create temp virtual table
        const options = [`filename='${input.filePath.replace(/'/g, "''")}'`];
        if (input.delimiter !== ",") {
          options.push(`delimiter='${input.delimiter}'`);
        }

        await adapter.executeWriteQuery(
          `CREATE VIRTUAL TABLE "${tempName}" USING csv(${options.join(", ")})`,
        );

        // Get columns
        const colResult = await adapter.executeReadQuery(
          `PRAGMA table_info("${tempName}")`,
        );
        const columnNames = (colResult.rows ?? []).map((row) => {
          const name = row["name"];
          const cid = row["cid"];
          if (typeof name === "string") return name;
          return `col${typeof cid === "number" ? cid : 0}`;
        });

        // Sample data
        const sampleResult = await adapter.executeReadQuery(
          `SELECT * FROM "${tempName}" LIMIT ${input.sampleRows}`,
        );

        // Analyze each column
        const columns = columnNames.map((name) => {
          let nullCount = 0;
          let intCount = 0;
          let floatCount = 0;
          const samples: string[] = [];

          for (const row of sampleResult.rows ?? []) {
            const val = row[name];
            const strVal =
              typeof val === "string" ? val : JSON.stringify(val ?? "");

            if (val === null || strVal === "") {
              nullCount++;
            } else {
              if (samples.length < 3) samples.push(strVal);
              if (/^-?\d+$/.test(strVal)) intCount++;
              else if (/^-?\d+\.\d+$/.test(strVal)) floatCount++;
            }
          }

          const total = (sampleResult.rows?.length ?? 0) - nullCount;
          let inferredType = "TEXT";
          if (total > 0) {
            if (intCount === total) inferredType = "INTEGER";
            else if (floatCount === total || intCount + floatCount === total)
              inferredType = "REAL";
          }

          return { name, inferredType, nullCount, sampleValues: samples };
        });

        // Count total rows
        const countResult = await adapter.executeReadQuery(
          `SELECT COUNT(*) as cnt FROM "${tempName}"`,
        );
        const rowCount =
          typeof countResult.rows?.[0]?.["cnt"] === "number"
            ? countResult.rows[0]["cnt"]
            : 0;

        return {
          success: true,
          hasHeader: true, // CSV module assumes header
          rowCount,
          columns,
        };
      } finally {
        // Clean up temp table
        await adapter
          .executeWriteQuery(`DROP TABLE IF EXISTS "${tempName}"`)
          .catch(() => {
            // Ignore cleanup errors
          });
      }
    },
  };
}

/**
 * Create R-Tree virtual table
 */
function createRtreeTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_rtree_table",
    description:
      "Create an R-Tree virtual table for spatial indexing. Supports 2-5 dimensions.",
    group: "admin",
    inputSchema: CreateRtreeTableSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      sql: z.string(),
      columns: z.array(z.string()),
    }),
    requiredScopes: ["write"],
    annotations: idempotent("Create R-Tree Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CreateRtreeTableSchema.parse(params);

      // Validate table name
      sanitizeIdentifier(input.tableName);

      // Check if rtree module is available
      const rtreeAvailable = await isModuleAvailable(adapter, "rtree");
      if (!rtreeAvailable) {
        return {
          success: false,
          message:
            "R-Tree extension not available. Use a SQLite build with rtree support.",
          sql: "",
          columns: [],
          wasmLimitation: true,
        };
      }

      // Build column list based on dimensions
      const columns = [input.idColumn];
      const dimNames = ["X", "Y", "Z", "W", "V"];
      for (let i = 0; i < input.dimensions; i++) {
        const dim = dimNames[i] ?? `D${i}`;
        columns.push(`min${dim}`, `max${dim}`);
      }

      const sql = `CREATE VIRTUAL TABLE "${input.tableName}" USING rtree(${columns.join(", ")})`;
      await adapter.executeWriteQuery(sql);

      return {
        success: true,
        message: `Created R-Tree table '${input.tableName}' with ${input.dimensions} dimensions`,
        sql,
        columns,
      };
    },
  };
}

/**
 * Create persistent series table
 */
function createSeriesTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_series_table",
    description:
      "Create a table populated with a series of numbers. Unlike generate_series, this creates a persistent table.",
    group: "admin",
    inputSchema: CreateSeriesTableSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      rowCount: z.number(),
    }),
    requiredScopes: ["write"],
    annotations: idempotent("Create Series Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CreateSeriesTableSchema.parse(params);

      // Validate and quote identifiers
      const tableName = sanitizeIdentifier(input.tableName);
      const columnName = sanitizeIdentifier(input.columnName);

      // Create table
      await adapter.executeWriteQuery(
        `CREATE TABLE IF NOT EXISTS ${tableName} (${columnName} INTEGER PRIMARY KEY)`,
      );

      // Insert series using generate_series if available, otherwise loop
      try {
        await adapter.executeWriteQuery(
          `INSERT OR IGNORE INTO ${tableName} (${columnName}) SELECT value FROM generate_series(${input.start}, ${input.stop}, ${input.step})`,
        );
      } catch {
        // Fallback: insert values manually
        const values: number[] = [];
        for (let v = input.start; v <= input.stop; v += input.step) {
          values.push(v);
        }
        if (values.length > 0) {
          const insertValues = values.map((v) => `(${v})`).join(",");
          await adapter.executeWriteQuery(
            `INSERT OR IGNORE INTO ${tableName} (${columnName}) VALUES ${insertValues}`,
          );
        }
      }

      // Count rows
      const countResult = await adapter.executeReadQuery(
        `SELECT COUNT(*) as cnt FROM ${tableName}`,
      );
      const rowCount =
        typeof countResult.rows?.[0]?.["cnt"] === "number"
          ? countResult.rows[0]["cnt"]
          : 0;

      return {
        success: true,
        message: `Created series table '${input.tableName}' with ${rowCount} rows`,
        rowCount,
      };
    },
  };
}
