import fs from "node:fs";
import nodePath from "node:path";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { admin } from "../../../../../utils/annotations.js";
import { formatHandlerError, ValidationError } from "../../../../../utils/errors/index.js";
import { buildProgressContext, sendProgress } from "../../../../../utils/progress-utils.js";
import { RestoreOutputSchema } from "../../../output-schemas/index.js";
import { RestoreSchema } from "../helpers.js";

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
        return { ...formatHandlerError(error), sourcePath: "" };
      }
      const progress = buildProgressContext(context);
      const start = Date.now();

      await sendProgress(progress, 1, 5, "Preparing restore...");

      if (!adapter.isNativeBackend()) {
        return {
          ...formatHandlerError(
            new ValidationError(
              "Restore not available: file system access is not supported in WASM mode.",
            ),
          ),
          wasmLimitation: true,
          sourcePath: input.sourcePath,
        };
      }

      const resolvedPath = nodePath.resolve(input.sourcePath);
      if (!fs.existsSync(resolvedPath)) {
        return {
          ...formatHandlerError(
            new ValidationError(`Source file not found: ${input.sourcePath}`),
          ),
          sourcePath: input.sourcePath,
        };
      }

      const escapedPath = resolvedPath.replace(/'/g, "''");

      await adapter.executeReadQuery("PRAGMA integrity_check(1)");

      await sendProgress(progress, 2, 5, "Attaching backup database...");

      try {
        await adapter.executeWriteQuery(
          `ATTACH DATABASE '${escapedPath}' AS backup_source`,
          undefined,
          true,
        );
      } catch (error) {
        return { ...formatHandlerError(error), sourcePath: input.sourcePath };
      }

      try {
        await sendProgress(progress, 3, 5, "Cleaning up virtual tables...");

        try {
          const virtualTablesResult = await adapter.executeReadQuery(
            `SELECT name FROM sqlite_master
             WHERE type='table'
             AND sql LIKE 'CREATE VIRTUAL TABLE%'
             AND name NOT LIKE 'sqlite_%'`,
          );

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
                // Ignore errors
              });
          }
        } catch {
          // Ignore
        }

        await sendProgress(progress, 4, 5, "Restoring tables from backup...");

        await adapter.executeWriteQuery(
          "PRAGMA foreign_keys = OFF",
          undefined,
          true,
        );

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

        const backupVirtualTables = await adapter.executeReadQuery(
          `SELECT name, sql FROM backup_source.sqlite_master
           WHERE type='table'
           AND sql LIKE 'CREATE VIRTUAL TABLE%'
           AND name NOT LIKE 'sqlite_%'`,
        );

        const skippedTables: string[] = [];

        if (adapter.isNativeBackend()) {
          for (const row of backupVirtualTables.rows ?? []) {
            const tableName = row["name"] as string;
            const createSql = row["sql"] as string;
            const quotedName = `"${tableName.replace(/"/g, '""')}"`;

            try {
              await adapter
                .executeWriteQuery(
                  `DROP TABLE IF EXISTS main.${quotedName}`,
                  undefined,
                  true,
                )
                .catch(() => {
                  /* ignore */
                });

              await adapter.executeWriteQuery(createSql, undefined, true);
            } catch (error) {
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
          for (const row of backupVirtualTables.rows ?? []) {
            const tableName = row["name"] as string;
            const createSql = row["sql"] as string;
            const moduleMatch = /USING\s+(\w+)/i.exec(createSql);
            const moduleName = moduleMatch?.[1] ?? "unknown";
            skippedTables.push(
              `${tableName} (${moduleName} module unavailable in WASM)`,
            );
          }
        }

        for (const row of tablesResult.rows ?? []) {
          const tableName = row["name"] as string;
          const createSql = row["sql"] as string;
          const quotedName = `"${tableName.replace(/"/g, '""')}"`;

          if (!createSql) continue;

          await adapter.executeWriteQuery(
            `DROP TABLE IF EXISTS main.${quotedName}`,
            undefined,
            true,
          );

          await adapter.executeWriteQuery(createSql, undefined, true);

          await adapter.executeWriteQuery(
            `INSERT INTO main.${quotedName} SELECT * FROM backup_source.${quotedName}`,
            undefined,
            true,
          );
        }

        // Restore user-created indexes
        const indexesResult = await adapter.executeReadQuery(
          `SELECT name, sql FROM backup_source.sqlite_master
           WHERE type='index'
           AND sql IS NOT NULL
           AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        );

        for (const row of indexesResult.rows ?? []) {
          const createSql = row["sql"] as string;
          if (!createSql) continue;
          try {
            await adapter.executeWriteQuery(createSql, undefined, true);
          } catch {
            // Index may already exist or reference missing table — skip
          }
        }

        // Restore views
        const viewsResult = await adapter.executeReadQuery(
          `SELECT name, sql FROM backup_source.sqlite_master
           WHERE type='view'
           AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        );

        for (const row of viewsResult.rows ?? []) {
          const viewName = row["name"] as string;
          const createSql = row["sql"] as string;
          if (!createSql) continue;
          const quotedViewName = `"${viewName.replace(/"/g, '""')}"`;
          try {
            await adapter
              .executeWriteQuery(
                `DROP VIEW IF EXISTS main.${quotedViewName}`,
                undefined,
                true,
              )
              .catch(() => {
                /* ignore */
              });
            await adapter.executeWriteQuery(createSql, undefined, true);
          } catch {
            // View may reference missing tables — skip
          }
        }

        // Restore triggers
        const triggersResult = await adapter.executeReadQuery(
          `SELECT name, sql FROM backup_source.sqlite_master
           WHERE type='trigger'
           AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        );

        for (const row of triggersResult.rows ?? []) {
          const createSql = row["sql"] as string;
          if (!createSql) continue;
          try {
            await adapter.executeWriteQuery(createSql, undefined, true);
          } catch {
            // Trigger may reference missing tables — skip
          }
        }

        await adapter.executeWriteQuery(
          "PRAGMA foreign_keys = ON",
          undefined,
          true,
        );

        const duration = Date.now() - start;

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
        await adapter
          .executeWriteQuery("PRAGMA foreign_keys = ON", undefined, true)
          .catch(() => {
            /* ignore */
          });
        await adapter
          .executeWriteQuery("DETACH DATABASE backup_source", undefined, true)
          .catch(() => {
            /* ignore */
          });
      }
    },
  };
}
