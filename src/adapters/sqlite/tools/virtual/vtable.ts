/**
 * Virtual Table Management Tools
 *
 * Manage virtual tables: list, info, drop, CSV import, schema analysis.
 */

import * as path from "node:path";
import { z } from "zod";
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
import { isModuleAvailable, isCsvModuleAvailable } from "./analysis.js";

import { ErrorResponseFields } from "../../../../utils/errors/error-response-fields.js";
import { ErrorResponseFields } from "../../../../utils/errors/error-response-fields.js";
  ListVirtualTablesSchema,
  VirtualTableInfoSchema,
  DropVirtualTableSchema,
  CreateCsvTableSchema,
  AnalyzeCsvSchemaSchema,
} from "./helpers.js";

export function createListVirtualTablesTool(
  adapter: SqliteAdapter,
): ToolDefinition {
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
    }).extend(ErrorResponseFields.shape),
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
export function createVirtualTableInfoTool(
  adapter: SqliteAdapter,
): ToolDefinition {
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
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["read"],
    annotations: readOnly("Virtual Table Info"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VirtualTableInfoSchema.parse(params);

        // Validate table name (we need raw name for queries)
        sanitizeIdentifier(input.tableName);

        // Get the CREATE statement
        const sqlResult = await adapter.executeReadQuery(
          `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${input.tableName.replace(/'/g, "''")}' AND sql LIKE 'CREATE VIRTUAL TABLE%'`,
        );

        if (!sqlResult.rows || sqlResult.rows.length === 0) {
          return {
            success: false,
            name: input.tableName,
            module: "unknown",
            sql: "",
            error: `Virtual table '${input.tableName}' not found`,
          };
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
      } catch (error) {
        return {
          success: false,
          name: "",
          module: "unknown",
          sql: "",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Drop virtual table
 */
export function createDropVirtualTableTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_drop_virtual_table",
    description: "Drop a virtual table.",
    group: "admin",
    inputSchema: DropVirtualTableSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["write"],
    annotations: destructive("Drop Virtual Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
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
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Create CSV virtual table
 */
export function createCsvTableTool(adapter: SqliteAdapter): ToolDefinition {
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
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["write"],
    annotations: idempotent("Create CSV Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
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
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
          sql: "",
          columns: [],
        };
      }
    },
  };
}

/**
 * Analyze CSV schema
 */
export function createAnalyzeCsvSchemaTool(
  adapter: SqliteAdapter,
): ToolDefinition {
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
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["read"],
    annotations: readOnly("Analyze CSV Schema"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = AnalyzeCsvSchemaSchema.parse(params);
      } catch (error) {
        return {
          success: false,
          hasHeader: false,
          rowCount: 0,
          columns: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }

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
