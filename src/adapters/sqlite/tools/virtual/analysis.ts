/**
 * Database Analysis Tools
 *
 * Database statistics and maintenance: dbstat, vacuum.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly, admin } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import {
  DbstatOutputSchema,
  VacuumOutputSchema,
} from "../../output-schemas/index.js";
import {
  buildProgressContext,
  sendProgress,
} from "../../../../utils/progress-utils.js";
import {
  isSpatialiteSystemTable,
  isSpatialiteSystemIndex,
} from "../core/index.js";
import { DbStatSchema, VacuumSchema } from "./helpers.js";

export function createDbStatTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_dbstat",
    description: "Get database storage statistics using dbstat virtual table.",
    group: "admin",
    inputSchema: DbStatSchema,
    outputSchema: DbstatOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Database Stats"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = DbStatSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

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
                !isSpatialiteSystemIndex(t.name) &&
                // Also filter FTS5 shadow tables (e.g., articles_fts_config, articles_fts_data)
                !t.name.includes("_fts_"),
            );
          }

          return {
            success: true,
            summarized: true,
            objectCount: tables.length,
            objects: tables,
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
              !isSpatialiteSystemIndex(row["name"] as string) &&
              // Also filter FTS5 shadow tables (e.g., articles_fts_config, articles_fts_data)
              !(row["name"] as string).includes("_fts_"),
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
export function createVacuumTool(adapter: SqliteAdapter): ToolDefinition {
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
      let input;
      try {
        input = VacuumSchema.parse(params);
      } catch (error) {
        return {
          ...formatHandlerError(error),
          message: "",
          durationMs: 0,
        };
      }
      const progress = buildProgressContext(context);

      // VACUUM INTO requires file system access — not available in WASM
      if (input.into && !adapter.isNativeBackend()) {
        return {
          success: false,
          error:
            "VACUUM INTO not available: file system access is not supported in WASM mode.",
          code: "VALIDATION_ERROR" as const,
          category: "validation" as const,
          recoverable: false,
          wasmLimitation: true,
          message: "",
          durationMs: 0,
        };
      }

      // Phase 1: Starting vacuum
      await sendProgress(progress, 1, 2, "Starting vacuum operation...");

      let sql = "VACUUM";
      if (input.into) {
        // VACUUM INTO creates a compacted copy
        const escapedPath = input.into.replace(/'/g, "''");
        sql = `VACUUM INTO '${escapedPath}'`;
      }

      try {
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
      } catch (error) {
        return {
          ...formatHandlerError(error),
          message: "",
          durationMs: 0,
        };
      }
    },
  };
}

// =============================================================================
// New Virtual Table Tools
// =============================================================================

/**
 * Check if a module is available
 */
export async function isModuleAvailable(
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
export async function isCsvModuleAvailable(
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
