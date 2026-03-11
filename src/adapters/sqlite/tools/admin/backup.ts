/**
 * Backup and Maintenance Tools
 *
 * Database backup, analysis, integrity check, optimization, and restore.
 */

import fs from "node:fs";
import nodePath from "node:path";
import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { admin, readOnly } from "../../../../utils/annotations.js";
import { formatError } from "../../../../utils/errors.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import {
  buildProgressContext,
  sendProgress,
} from "../../../../utils/progress-utils.js";
import {
  BackupOutputSchema,
  AnalyzeOutputSchema,
  IntegrityCheckOutputSchema,
  OptimizeOutputSchema,
  RestoreOutputSchema,
} from "../../output-schemas/index.js";
import {
  BackupSchema,
  AnalyzeSchema,
  IntegrityCheckSchema,
  OptimizeSchema,
  RestoreSchema,
} from "./helpers.js";

/**
 * Backup database
 */
export function createBackupTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_backup",
    description: "Create a backup of the database to a file.",
    group: "admin",
    inputSchema: BackupSchema,
    outputSchema: BackupOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Database Backup"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = BackupSchema.parse(params);
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
          path: "",
        };
      }

      // WASM mode: backup is not available since file system access is limited
      // Return early to avoid inconsistent VACUUM INTO behavior across WASM VFS implementations
      if (!adapter.isNativeBackend()) {
        return {
          success: false,
          message:
            "Backup not available: file system access is not supported in WASM mode.",
          wasmLimitation: true,
          path: input.targetPath,
        };
      }

      // Resolve to absolute path to avoid CWD-relative issues
      const resolvedPath = nodePath.resolve(input.targetPath);

      // Use VACUUM INTO to create backup
      const escapedPath = resolvedPath.replace(/'/g, "''");
      const sql = `VACUUM INTO '${escapedPath}'`;

      const start = Date.now();
      try {
        await adapter.executeQuery(sql);
        const duration = Date.now() - start;

        return {
          success: true,
          message: `Database backed up to '${input.targetPath}'`,
          path: input.targetPath,
          durationMs: duration,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
          path: input.targetPath,
        };
      }
    },
  };
}

/**
 * Analyze tables for query optimization
 */
export function createAnalyzeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_analyze",
    description: "Analyze table statistics to improve query performance.",
    group: "admin",
    inputSchema: AnalyzeSchema,
    outputSchema: AnalyzeOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Analyze Tables"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = AnalyzeSchema.parse(params);

        let sql: string;
        if (input.table) {
          const table = sanitizeIdentifier(input.table);
          sql = `ANALYZE ${table}`;
        } else {
          sql = "ANALYZE";
        }

        const start = Date.now();
        await adapter.executeQuery(sql);
        const duration = Date.now() - start;

        return {
          success: true,
          message: input.table
            ? `Table '${input.table}' analyzed`
            : "All tables analyzed",
          durationMs: duration,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Check database integrity
 */
export function createIntegrityCheckTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_integrity_check",
    description: "Check database integrity for corruption or errors.",
    group: "admin",
    inputSchema: IntegrityCheckSchema,
    outputSchema: IntegrityCheckOutputSchema,
    requiredScopes: ["admin"],
    annotations: readOnly("Integrity Check"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = IntegrityCheckSchema.parse(params);

      const sql = `PRAGMA integrity_check(${input.maxErrors})`;
      const result = await adapter.executeReadQuery(sql);

      const messages = (result.rows ?? []).map(
        (r) => r["integrity_check"],
      ) as string[];
      const isOk = messages.length === 1 && messages[0] === "ok";

      return {
        success: true,
        integrity: isOk ? "ok" : "errors_found",
        errorCount: isOk ? 0 : messages.length,
        messages: isOk ? undefined : messages,
      };
    },
  };
}

/**
 * Optimize database
 */
export function createOptimizeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_optimize",
    description: "Optimize database by reindexing and/or analyzing.",
    group: "admin",
    inputSchema: OptimizeSchema,
    outputSchema: OptimizeOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Optimize Database"),
    handler: async (params: unknown, context: RequestContext) => {
      const input = OptimizeSchema.parse(params);
      const progress = buildProgressContext(context);

      // Calculate total steps for progress tracking
      const totalSteps =
        1 + (input.reindex ? 1 : 0) + (input.analyze ? 1 : 0) + 1; // start + ops + complete
      let step = 0;

      const operations: string[] = [];
      const start = Date.now();

      // Phase 1: Starting
      await sendProgress(
        progress,
        ++step,
        totalSteps,
        "Starting optimization...",
      );

      // Reindex if requested
      if (input.reindex) {
        await sendProgress(progress, ++step, totalSteps, "Reindexing...");
        if (input.table) {
          const table = sanitizeIdentifier(input.table);
          await adapter.executeQuery(`REINDEX ${table}`);
          operations.push(`reindexed ${input.table}`);
        } else {
          await adapter.executeQuery("REINDEX");
          operations.push("reindexed all");
        }
      }

      // Analyze if requested
      if (input.analyze) {
        await sendProgress(progress, step + 1, totalSteps, "Analyzing...");
        if (input.table) {
          const table = sanitizeIdentifier(input.table);
          await adapter.executeQuery(`ANALYZE ${table}`);
          operations.push(`analyzed ${input.table}`);
        } else {
          await adapter.executeQuery("ANALYZE");
          operations.push("analyzed all");
        }
      }

      const duration = Date.now() - start;

      // Phase N: Complete
      await sendProgress(
        progress,
        totalSteps,
        totalSteps,
        "Optimization complete",
      );

      return {
        success: true,
        message: `Optimization complete: ${operations.length > 0 ? operations.join(", ") : "no operations performed"}`,
        operations,
        durationMs: duration,
      };
    },
  };
}

/**
 * Restore database from backup
 */
export function createRestoreTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_restore",
    description:
      "Restore database from a backup file. WARNING: This replaces the current database.",
    group: "admin",
    inputSchema: RestoreSchema,
    outputSchema: RestoreOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Restore Database"),
    handler: async (params: unknown, context: RequestContext) => {
      let input;
      try {
        input = RestoreSchema.parse(params);
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
          sourcePath: "",
        };
      }
      const progress = buildProgressContext(context);
      const start = Date.now();

      // Phase 1: Preparing restore
      await sendProgress(progress, 1, 5, "Preparing restore...");

      // WASM mode: backup/restore are not available since file system
      // ATTACH succeeds silently in WASM (creates empty DB), giving false positives.
      if (!adapter.isNativeBackend()) {
        return {
          success: false,
          message:
            "Restore not available: file system access is not supported in WASM mode.",
          wasmLimitation: true,
          sourcePath: input.sourcePath,
        };
      }

      // Pre-validate file exists (ATTACH silently creates empty DB for nonexistent files)
      // Resolve to absolute path to avoid CWD-relative false positives
      const resolvedPath = nodePath.resolve(input.sourcePath);
      if (!fs.existsSync(resolvedPath)) {
        return {
          success: false,
          message: `Source file not found: ${input.sourcePath}`,
          sourcePath: input.sourcePath,
        };
      }

      const escapedPath = resolvedPath.replace(/'/g, "''");

      // Verify current database is valid before overwriting
      await adapter.executeReadQuery("PRAGMA integrity_check(1)");

      // Phase 2: Attach backup database
      await sendProgress(progress, 2, 5, "Attaching backup database...");

      try {
        await adapter.executeWriteQuery(
          `ATTACH DATABASE '${escapedPath}' AS backup_source`,
          undefined,
          true,
        );
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
          sourcePath: input.sourcePath,
        };
      }

      try {
        // Phase 3: Drop virtual tables first (prevents shadow table errors)
        await sendProgress(progress, 3, 5, "Cleaning up virtual tables...");

        // Get list of virtual tables in main database
        // Note: In WASM mode, this query may fail if the database contains
        // virtual tables using unavailable modules (FTS5, R-Tree, etc.)
        try {
          const virtualTablesResult = await adapter.executeReadQuery(
            `SELECT name FROM sqlite_master
             WHERE type='table'
             AND sql LIKE 'CREATE VIRTUAL TABLE%'
             AND name NOT LIKE 'sqlite_%'`,
          );

          // Drop virtual tables first - this also drops their shadow tables
          for (const row of virtualTablesResult.rows ?? []) {
            const tableName = row["name"] as string;
            const quotedName = `"${tableName.replace(/"/g, '""')}"`;
            await adapter
              .executeWriteQuery(
                `DROP TABLE IF EXISTS main.${quotedName}`,
                undefined,
                true,
              )
              .catch(() => {
                // Ignore errors - table may already be gone or module unavailable
              });
          }
        } catch {
          // WASM mode may fail to query/drop virtual tables due to missing modules
          // Continue with restore - virtual tables will remain as-is
        }

        // Phase 4: Copy tables from backup
        await sendProgress(progress, 4, 5, "Restoring tables from backup...");

        await adapter.executeWriteQuery(
          "PRAGMA foreign_keys = OFF",
          undefined,
          true,
        );

        // Get list of regular tables from backup (excluding shadow tables and virtual tables)
        // FTS5 shadow tables: _data, _idx, _content, _docsize, _config
        // R-Tree shadow tables: _node, _rowid, _parent
        const tablesResult = await adapter.executeReadQuery(
          `SELECT name, sql FROM backup_source.sqlite_master
           WHERE type='table'
           AND name NOT LIKE 'sqlite_%'
           AND sql NOT LIKE 'CREATE VIRTUAL TABLE%'
           AND name NOT LIKE '%_data'
           AND name NOT LIKE '%_idx'
           AND name NOT LIKE '%_content'
           AND name NOT LIKE '%_docsize'
           AND name NOT LIKE '%_config'
           AND name NOT LIKE '%_node'
           AND name NOT LIKE '%_rowid'
           AND name NOT LIKE '%_parent'
           ORDER BY name`,
        );

        // Get list of virtual tables that will be skipped
        const backupVirtualTables = await adapter.executeReadQuery(
          `SELECT name, sql FROM backup_source.sqlite_master
           WHERE type='table'
           AND sql LIKE 'CREATE VIRTUAL TABLE%'
           AND name NOT LIKE 'sqlite_%'`,
        );

        // Track skipped virtual tables upfront
        const skippedTables: string[] = [];

        // In Native mode, attempt to recreate virtual tables
        // In WASM mode, skip them since modules like FTS5/R-Tree aren't available
        if (adapter.isNativeBackend()) {
          // Native mode: try to recreate virtual tables
          for (const row of backupVirtualTables.rows ?? []) {
            const tableName = row["name"] as string;
            const createSql = row["sql"] as string;
            const quotedName = `"${tableName.replace(/"/g, '""')}"`;

            try {
              // Drop existing virtual table first
              await adapter
                .executeWriteQuery(
                  `DROP TABLE IF EXISTS main.${quotedName}`,
                  undefined,
                  true,
                )
                .catch(() => {
                  // Ignore drop errors - table may already exist or not
                });

              // Recreate the virtual table
              await adapter.executeWriteQuery(createSql, undefined, true);
            } catch (error) {
              // If recreation fails, add to skipped list
              const moduleMatch = /USING\s+(\w+)/i.exec(createSql);
              const moduleName = moduleMatch?.[1] ?? "unknown";
              const errMsg =
                error instanceof Error ? error.message : String(error);
              skippedTables.push(
                `${tableName} (${moduleName}: ${errMsg.substring(0, 50)})`,
              );
            }
          }
        } else {
          // WASM mode: skip all virtual tables
          for (const row of backupVirtualTables.rows ?? []) {
            const tableName = row["name"] as string;
            const createSql = row["sql"] as string;
            // Extract module name for better error message
            const moduleMatch = /USING\s+(\w+)/i.exec(createSql);
            const moduleName = moduleMatch?.[1] ?? "unknown";
            skippedTables.push(
              `${tableName} (${moduleName} module unavailable in WASM)`,
            );
          }
        }

        // Drop existing tables and copy from backup
        for (const row of tablesResult.rows ?? []) {
          const tableName = row["name"] as string;
          const createSql = row["sql"] as string;
          const quotedName = `"${tableName.replace(/"/g, '""')}"`;

          // Skip if no CREATE statement (shouldn't happen for regular tables)
          if (!createSql) continue;

          // Drop existing table
          await adapter.executeWriteQuery(
            `DROP TABLE IF EXISTS main.${quotedName}`,
            undefined,
            true,
          );

          // Create the table in main
          await adapter.executeWriteQuery(createSql, undefined, true);

          // Copy data
          await adapter.executeWriteQuery(
            `INSERT INTO main.${quotedName} SELECT * FROM backup_source.${quotedName}`,
            undefined,
            true,
          );
        }

        // Re-enable foreign key constraints
        await adapter.executeWriteQuery(
          "PRAGMA foreign_keys = ON",
          undefined,
          true,
        );

        const duration = Date.now() - start;

        // Phase 5: Complete
        await sendProgress(progress, 5, 5, "Restore complete");

        return {
          success: true,
          message:
            skippedTables.length > 0
              ? `Database restored from '${input.sourcePath}' with ${skippedTables.length} virtual table(s) skipped`
              : `Database restored from '${input.sourcePath}'`,
          sourcePath: input.sourcePath,
          durationMs: duration,
          skippedTables: skippedTables.length > 0 ? skippedTables : undefined,
          note:
            skippedTables.length > 0
              ? "Some virtual tables could not be restored because their modules are not available in this environment (e.g., FTS5, R-Tree in WASM mode)."
              : undefined,
        };
      } finally {
        // Always detach backup and re-enable FK constraints
        await adapter
          .executeWriteQuery("PRAGMA foreign_keys = ON", undefined, true)
          .catch(() => {
            // Ignore errors
          });
        await adapter
          .executeWriteQuery("DETACH DATABASE backup_source", undefined, true)
          .catch(() => {
            // Ignore detach errors - backup may not have been attached
          });
      }
    },
  };
}

/**
 * Verify backup file integrity
 */
