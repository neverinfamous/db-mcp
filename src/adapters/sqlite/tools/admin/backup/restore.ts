import fs from "node:fs";
import nodePath from "node:path";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";

import {
  formatHandlerError,
  ValidationError,
} from "../../../../../utils/errors/index.js";
import { validateSameDirPath } from "../../../../../utils/index.js";
import {
  buildProgressContext,
  sendProgress,
} from "../../../../../utils/progress-utils.js";
import { RestoreOutputSchema } from "../../../schemas/admin.js";
import { RestoreSchema } from "../../../schemas/admin.js";

/**
 * Validate DDL to prevent execution of unauthorized or destructive statements
 * during restore operations.
 */
function validateDdl(sql: string, type: string, name: string, allowTriggers = false): void {
  const cleanSql = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
  const upperSql = cleanSql.toUpperCase();
  // Reject potentially destructive or unauthorized statements
  if (
    /\bLOAD_EXTENSION\s*\(/i.test(cleanSql) ||
    /\bATTACH\b/i.test(cleanSql) ||
    /\bDETACH\b/i.test(cleanSql) ||
    /\bPRAGMA\b/i.test(cleanSql) ||
    /\bRAISE\s*\(/i.test(cleanSql) ||
    /\b(?:BEGIN|COMMIT|ROLLBACK)(?:\s+TRANSACTION)?\b/i.test(cleanSql) ||
    /\b(?:writefile|readfile)\s*\(/i.test(cleanSql) ||
    /\bsqlite_exec\s*\(/i.test(cleanSql)
  ) {
    throw new ValidationError(
      `DDL validation failed: unauthorized command or function call in ${type} '${name}'`,
    );
  }

  if (type === "trigger") {
    if (!allowTriggers) {
      throw new ValidationError(
        `DDL validation failed: trigger restoration is disabled for security reasons. Pass allowTriggers=true if you trust the backup file.`,
      );
    }
    // Ensure triggers do not attempt to target other databases explicitly
    if (upperSql.includes(" ON MAIN.") || upperSql.includes(" ON TEMP.")) {
      throw new ValidationError(
        `DDL validation failed: trigger '${name}' attempts to target a specific database`,
      );
    }
  }
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
    annotations: {
      title: "Restore Backup",
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
      sensitiveHint: true,
    },
    handler: async (params: unknown, context: RequestContext) => {
      let input;
      
      try {
        input = RestoreSchema.parse(params);
      } catch (error: unknown) {
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

      if (!input.sourcePath?.trim()) {
        return {
          ...formatHandlerError(new ValidationError("sourcePath is required")),
          sourcePath: "",
        };
      }

      const resolvedPath = nodePath.resolve(input.sourcePath);

      // Security: validate sourcePath is within the same directory as the primary DB
      const pathCheck = validateSameDirPath(
        input.sourcePath,
        adapter.getConfiguredPath(),
      );
      if (!pathCheck.valid) {
        return {
          ...formatHandlerError(
            new ValidationError(pathCheck.error),
          ),
          sourcePath: input.sourcePath,
        };
      }

      if (!fs.existsSync(resolvedPath)) {
        return {
          ...formatHandlerError(
            new ValidationError(`Source file not found: ${input.sourcePath}`),
          ),
          sourcePath: input.sourcePath,
        };
      }

      const escapedPath = pathCheck.resolvedPath.replace(/'/g, "''");

      await adapter.executeReadQuery("PRAGMA integrity_check(1)");

      await sendProgress(progress, 2, 5, "Attaching backup database...");

      try {
        await adapter.rawQuery(
          `ATTACH DATABASE '${escapedPath}' AS backup_source`,
          undefined,
        );
      } catch (error: unknown) {
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
              .rawQuery(
                `DROP TABLE IF EXISTS main.${quotedName}`,
                undefined,
              )
              .catch(() => {
                // Ignore errors
              });
          }
        } catch {
          // Ignore
        }

        await sendProgress(progress, 4, 5, "Restoring tables from backup...");

        await adapter.rawQuery(
          "PRAGMA foreign_keys = OFF",
          undefined,
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
              validateDdl(createSql, "table", tableName);
              await adapter
                .rawQuery(
                  `DROP TABLE IF EXISTS main.${quotedName}`,
                  undefined,
                )
                .catch(() => {
                  /* ignore */
                });

              await adapter.rawQuery(createSql, undefined);
            } catch (error: unknown) {
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

          try {
            validateDdl(createSql, "table", tableName);
          } catch (error: unknown) {
            skippedTables.push(`${tableName} (DDL Validation: ${error instanceof Error ? error.message : String(error)})`);
            continue;
          }

          await adapter.rawQuery(
            `DROP TABLE IF EXISTS main.${quotedName}`,
            undefined,
          );

          await adapter.rawQuery(createSql, undefined);

          await adapter.rawQuery(
            `INSERT INTO main.${quotedName} SELECT * FROM backup_source.${quotedName}`,
            undefined,
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
          const name = row["name"] as string;
          if (!createSql) continue;
          try {
            validateDdl(createSql, "index", name);
            await adapter.rawQuery(createSql, undefined);
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
            validateDdl(createSql, "view", viewName);
            await adapter
              .rawQuery(
                `DROP VIEW IF EXISTS main.${quotedViewName}`,
                undefined,
              )
              .catch(() => {
                /* ignore */
              });
            await adapter.rawQuery(createSql, undefined);
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
          const name = row["name"] as string;
          if (!createSql) continue;
          try {
            validateDdl(createSql, "trigger", name, input.allowTriggers);
            await adapter.rawQuery(createSql, undefined);
          } catch {
            // Trigger may reference missing tables — skip
          }
        }

        await adapter.rawQuery(
          "PRAGMA foreign_keys = ON",
          undefined,
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
          .rawQuery("PRAGMA foreign_keys = ON", undefined)
          .catch(() => {
            /* ignore */
          });
        await adapter
          .rawQuery("DETACH DATABASE backup_source", undefined)
          .catch(() => {
            /* ignore */
          });
      }
    },
  };
}
