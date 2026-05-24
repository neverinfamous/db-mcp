import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DatabaseAdapter } from "../../adapters/database-adapter.js";
import type { BackupManager } from "../../audit/backup-manager.js";
import type { AuditLogger } from "../../audit/logger.js";
import { logger } from "../../utils/logger/index.js";
import { z } from "zod";

/**
 * Force redaction of SQL string literals to prevent secret exposure
 * in audit logs and backups, regardless of operator configuration.
 */
function redactSqlLiterals(text: string): string {
  return text.replace(/'([^']*)'/g, "'***'");
}

/**
 * Register the sqlite://audit resource for agent access to audit log.
 */
export function registerAuditResource(
  server: McpServer,
  auditLogger: AuditLogger | null,
  backupManager: BackupManager | null
): void {

    if (!auditLogger) return;

    server.registerResource(
      "sqlite_audit",
      "sqlite://audit",
      {
        description:
          "Recent audit log entries and backup statistics. Shows the last 50 tool invocations with timing, outcomes, and token estimates.",
        mimeType: "application/json",
      },
      async () => {
        const recent = await auditLogger.recent(50);
        const backupStats = backupManager
          ? await backupManager.getStats()
          : undefined;

        const payload = {
          entries: recent,
          stats: {
            totalEntries: recent.length,
            ...(backupStats && { backups: backupStats }),
          },
        };

        const payloadStr = JSON.stringify(payload, null, 2);

        return {
          contents: [
            {
              uri: "sqlite://audit",
              mimeType: "application/json",
              text: redactSqlLiterals(payloadStr),
            },
          ],
        };
      },
    );
  
}

/**
 * Register audit backup tools for snapshot management.
 */
export function registerAuditBackupTools(
  server: McpServer,
  backupManager: BackupManager | null,
  adaptersMap: Map<string, DatabaseAdapter>
): void {

    if (!backupManager) return;

    // sqlite_audit_list_backups
    server.registerTool(
      "sqlite_audit_list_backups",
      {
        title: "List Audit Backups",
        description:
          "List pre-mutation DDL snapshots captured before destructive operations. Returns metadata for each snapshot including timestamp, tool, target, and size.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async () => {
        const snapshots = await backupManager.listSnapshots();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  snapshots,
                  count: snapshots.length,
                  _meta: {
                    tokenEstimate: Math.ceil(
                      Buffer.byteLength(JSON.stringify(snapshots), "utf8") / 4,
                    ),
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // sqlite_audit_get_backup
    server.registerTool(
      "sqlite_audit_get_backup",
      {
        title: "Get Audit Backup",
        description:
          "Retrieve a specific pre-mutation DDL snapshot by filename. Returns the full snapshot content including DDL and optional data.",
        inputSchema: z.object({
          filename: z
            .string()
            .describe(
              "Snapshot filename from sqlite_audit_list_backups results",
            ),
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (args: unknown) => {
        const { filename } = z.object({ filename: z.string() }).parse(args);
        const snapshot = await backupManager.getSnapshot(filename);
        if (!snapshot) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Snapshot not found: ${filename}`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
        const snapshotStr = JSON.stringify(snapshot, null, 2);
        return {
          content: [
            {
              type: "text" as const,
              text: redactSqlLiterals(snapshotStr),
            },
          ],
        };
      },
    );

    // sqlite_audit_cleanup
    server.registerTool(
      "sqlite_audit_cleanup",
      {
        title: "Cleanup Audit Backups",
        description:
          "Apply retention policy to audit backup snapshots. Deletes snapshots exceeding age or count limits.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async () => {
        const deleted = await backupManager.cleanup();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  deletedCount: deleted,
                  message:
                    deleted > 0
                      ? `Cleaned up ${String(deleted)} snapshot(s)`
                      : "No snapshots to clean up",
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // sqlite_audit_diff_backup
    server.registerTool(
      "sqlite_audit_diff_backup",
      {
        title: "Diff Audit Backup",
        description:
          "Compare a pre-mutation DDL snapshot against the live database schema. Shows objects that have been added, removed, or modified since the snapshot was taken.",
        inputSchema: z.object({
          filename: z
            .string()
            .describe(
              "Snapshot filename to compare against the live database schema",
            ),
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (args: unknown) => {
        const { filename } = z.object({ filename: z.string() }).parse(args);
        const snapshot = await backupManager.getSnapshot(filename);
        if (!snapshot) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { success: false, error: `Snapshot not found: ${filename}` },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        // Get the first connected adapter to query live schema
        const adapter = [...adaptersMap.values()][0];
        if (!adapter) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { success: false, error: "No connected adapter available" },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        try {
          // Get live schema objects
          const liveResult = await adapter.executeReadQuery(
            "SELECT name, type, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name",
          );
          const liveObjects = new Map<
            string,
            { type: string; sql: string }
          >();
          for (const row of liveResult.rows ?? []) {
            liveObjects.set(row["name"] as string, {
              type: row["type"] as string,
              sql: row["sql"] as string,
            });
          }

          // Parse snapshot DDL entries
          const snapshotDdl = (snapshot as { ddl?: string }).ddl ?? "";
          const snapshotObjects = new Map<
            string,
            { type: string; sql: string }
          >();
          // Each statement in the snapshot DDL should be a CREATE statement
          const statements = snapshotDdl
            .split(";")
            .map((s: string) => s.trim())
            .filter(Boolean);
          for (const stmt of statements) {
            // Parse CREATE TABLE/INDEX/VIEW/TRIGGER name from DDL
            const match =
              /CREATE\s+(?:VIRTUAL\s+)?(?:TEMP(?:ORARY)?\s+)?(TABLE|INDEX|VIEW|TRIGGER)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|(\S+))/i.exec(
                stmt,
              );
            if (match) {
              const type = (match[1] ?? "").toLowerCase();
              const name = match[2] ?? match[3] ?? "";
              snapshotObjects.set(name, { type, sql: stmt });
            }
          }

          // Compute diffs
          const diffs: {
            object: string;
            type: string;
            status: "added" | "removed" | "modified";
            liveDefinition?: string;
            snapshotDefinition?: string;
          }[] = [];

          // Objects in live but not in snapshot → added
          for (const [name, live] of liveObjects) {
            if (!snapshotObjects.has(name)) {
              diffs.push({
                object: name,
                type: live.type,
                status: "added",
                liveDefinition: live.sql,
              });
            }
          }

          // Objects in snapshot but not in live → removed
          for (const [name, snap] of snapshotObjects) {
            if (!liveObjects.has(name)) {
              diffs.push({
                object: name,
                type: snap.type,
                status: "removed",
                snapshotDefinition: snap.sql,
              });
            }
          }

          // Objects in both but with different DDL → modified
          for (const [name, snap] of snapshotObjects) {
            const live = liveObjects.get(name);
            if (live && live.sql !== snap.sql) {
              diffs.push({
                object: name,
                type: live.type,
                status: "modified",
                liveDefinition: live.sql,
                snapshotDefinition: snap.sql,
              });
            }
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    diffs,
                    snapshotTimestamp:
                      (snapshot as { timestamp?: string }).timestamp ?? "",
                    snapshotTarget:
                      (snapshot as { target?: string }).target ?? "",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );

    // sqlite_audit_restore_backup
    server.registerTool(
      "sqlite_audit_restore_backup",
      {
        title: "Restore Audit Backup",
        description:
          "Restore a pre-mutation DDL snapshot by executing its DDL statements against the live database. Use dryRun=true to preview the DDL without applying changes.",
        inputSchema: z.object({
          filename: z
            .string()
            .describe("Snapshot filename to restore from"),
          dryRun: z
            .boolean()
            .optional()
            .default(false)
            .describe(
              "If true, returns the DDL without executing it",
            ),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async (args: unknown) => {
        const { filename, dryRun } = z.object({ filename: z.string(), dryRun: z.boolean().optional().default(false) }).parse(args);
        const snapshot = await backupManager.getSnapshot(filename);
        if (!snapshot) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { success: false, error: `Snapshot not found: ${filename}` },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        const ddl = (snapshot as { ddl?: string }).ddl ?? "";
        if (!ddl.trim()) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Snapshot contains no DDL statements",
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        if (dryRun) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    message: "Dry run — DDL not executed",
                    ddl,
                    dryRun: true,
                    changesApplied: 0,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Get the first connected adapter to execute DDL
        const adapter = [...adaptersMap.values()][0];
        if (!adapter) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { success: false, error: "No connected adapter available" },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        try {
          const statements = ddl
            .split(";")
            .map((s: string) => s.trim())
            .filter(Boolean);

          let changesApplied = 0;
          for (const stmt of statements) {
            await adapter.executeQuery(`${stmt};`);
            changesApplied++;
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    message: `Restored ${String(changesApplied)} DDL statement(s) from snapshot`,
                    changesApplied,
                    dryRun: false,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );

    logger.info(
      "Registered audit backup tools: sqlite_audit_list_backups, sqlite_audit_get_backup, sqlite_audit_cleanup, sqlite_audit_diff_backup, sqlite_audit_restore_backup",
      { module: "AUDIT" },
    );
  
}