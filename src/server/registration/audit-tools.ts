import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DatabaseAdapter } from "../../adapters/database-adapter.js";
import type { BackupManager } from "../../audit/backup-manager.js";
import type { AuditLogger } from "../../audit/logger.js";
import { logger } from "../../utils/logger/index.js";
import { formatHandlerError } from "../../utils/errors/index.js";
import {
  registerToolScopes,
  scopesGrantToolAccess,
} from "../../auth/scopes/enforcement.js";
import { getAuthContext } from "../../auth/auth-context.js";
import { InsufficientScopeError } from "../../auth/errors.js";
import { z } from "zod";
import { metrics } from "../../observability/metrics.js";
import {
  AuditListBackupsSchema,
  AuditListBackupsOutputSchema,
  AuditGetBackupOutputSchema,
  AuditCleanupOutputSchema,
  AuditDiffBackupOutputSchema,
  AuditRestoreBackupOutputSchema,
  AuditSearchSchema,
  AuditSearchOutputSchema,
} from "../../adapters/sqlite/schemas/admin.js";

/**
 * Force redaction of SQL string literals to prevent secret exposure
 * in audit logs and backups, regardless of operator configuration.
 */
function redactSqlLiterals(text: string): string {
  return text.replace(/'(?:''|[^'])*'/g, "'***'");
}

/**
 * Validate DDL to prevent execution of unauthorized or destructive statements
 * during restore operations from tampered backups.
 */
function validateDdl(sql: string): void {
  const cleanSql = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
  const upperSql = cleanSql.toUpperCase();
  // Reject potentially destructive or unauthorized statements
  if (
    upperSql.includes("ATTACH ") ||
    upperSql.includes("DETACH ") ||
    upperSql.includes("PRAGMA ") ||
    upperSql.includes("LOAD_EXTENSION(")
  ) {
    throw new Error(
      `DDL validation failed: unauthorized command or function call`,
    );
  }

  // Ensure triggers do not attempt to target other databases explicitly
  if (upperSql.includes(" ON MAIN.") || upperSql.includes(" ON TEMP.")) {
    throw new Error(
      `DDL validation failed: trigger attempts to target a specific database`,
    );
  }
}

/**
 * Register the sqlite://audit resource for agent access to audit log.
 */
export function registerAuditResource(
  server: McpServer,
  auditLogger: AuditLogger | null,
  backupManager: BackupManager | null,
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
      metrics.recordResourceRead("sqlite://audit");
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
  adaptersMap: Map<string, DatabaseAdapter>,
): void {
  if (!backupManager) return;

  // sqlite_audit_list_backups
  server.registerTool(
    "sqlite_audit_list_backups",
    {
      title: "List Audit Backups",
      description:
        "List pre-mutation DDL snapshots captured before destructive operations. Returns metadata for each snapshot including timestamp, tool, target, and size.",
      inputSchema: AuditListBackupsSchema,
      outputSchema: AuditListBackupsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: unknown) => {
      const authCtx = getAuthContext();
      if (
        authCtx &&
        !scopesGrantToolAccess(authCtx.scopes, "sqlite_audit_list_backups")
      ) {
        throw new InsufficientScopeError(["admin", "full"], authCtx.scopes);
      }
      let parsed;
      try {
        parsed = AuditListBackupsSchema.parse(args ?? {});
      } catch (error: unknown) {
        const structured = formatHandlerError(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          isError: true,
          structuredContent: structured as unknown as Record<string, unknown>,
        };
      }

      const limit = parsed.limit ?? 10;
      const offset = parsed.offset ?? 0;
      const { snapshots, total } = await backupManager.listSnapshots(
        limit,
        offset,
      );
      const result = {
        success: true,
        snapshots,
        count: snapshots.length,
        totalCount: total,
      };
      const tokenEstimate = Math.ceil(
        Buffer.byteLength(JSON.stringify(result), "utf8") / 4,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { ...result, _meta: { tokenEstimate } },
              null,
              2,
            ),
          },
        ],
        structuredContent: result,
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
          .default("")
          .describe("Snapshot filename from sqlite_audit_list_backups results"),
      }),
      outputSchema: AuditGetBackupOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: unknown) => {
      const authCtx = getAuthContext();
      if (
        authCtx &&
        !scopesGrantToolAccess(authCtx.scopes, "sqlite_audit_get_backup")
      ) {
        throw new InsufficientScopeError(["admin", "full"], authCtx.scopes);
      }
      let filename;
      try {
        const parsed = z
          .object({ filename: z.string().min(1, "filename is required") })
          .parse(args);
        filename = parsed.filename;
      } catch (error: unknown) {
        const structured = formatHandlerError(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          isError: true,
          structuredContent: structured as unknown as Record<string, unknown>,
        };
      }
      const snapshot = await backupManager.getSnapshot(filename);
      if (!snapshot) {
        const errRes = {
          success: false,
          error: `Snapshot not found: ${filename}`,
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errRes, null, 2),
            },
          ],
          isError: true,
          structuredContent: errRes as unknown as Record<string, unknown>,
        };
      }
      const result = { success: true, ...snapshot };
      const snapshotStr = JSON.stringify(result, null, 2);
      return {
        content: [
          {
            type: "text" as const,
            text: redactSqlLiterals(snapshotStr),
          },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
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
      outputSchema: AuditCleanupOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const authCtx = getAuthContext();
      if (
        authCtx &&
        !scopesGrantToolAccess(authCtx.scopes, "sqlite_audit_cleanup")
      ) {
        throw new InsufficientScopeError(["admin", "full"], authCtx.scopes);
      }
      const deleted = await backupManager.cleanup();
      const result = {
        success: true,
        deletedCount: deleted,
        message:
          deleted > 0
            ? `Cleaned up ${String(deleted)} snapshot(s)`
            : "No snapshots to clean up",
      };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
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
          .default("")
          .describe(
            "Snapshot filename to compare against the live database schema",
          ),
      }),
      outputSchema: AuditDiffBackupOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: unknown) => {
      const authCtx = getAuthContext();
      if (
        authCtx &&
        !scopesGrantToolAccess(authCtx.scopes, "sqlite_audit_diff_backup")
      ) {
        throw new InsufficientScopeError(["admin", "full"], authCtx.scopes);
      }
      let filename;
      try {
        const parsed = z
          .object({ filename: z.string().min(1, "filename is required") })
          .parse(args);
        filename = parsed.filename;
      } catch (error: unknown) {
        const structured = formatHandlerError(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          isError: true,
          structuredContent: structured as unknown as Record<string, unknown>,
        };
      }
      const snapshot = await backupManager.getSnapshot(filename);
      if (!snapshot) {
        const errRes = {
          success: false,
          error: `Snapshot not found: ${filename}`,
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errRes, null, 2),
            },
          ],
          isError: true,
          structuredContent: errRes as unknown as Record<string, unknown>,
        };
      }

      const adapter = [...adaptersMap.values()][0];
      if (!adapter) {
        const errRes = {
          success: false,
          error: "No connected adapter available",
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errRes, null, 2),
            },
          ],
          isError: true,
          structuredContent: errRes as unknown as Record<string, unknown>,
        };
      }

      try {
        // Get live schema objects
        const liveResult = await adapter.executeReadQuery(
          "SELECT name, type, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name",
        );
        const liveObjects = new Map<string, { type: string; sql: string }>();
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

        const snapshotTarget = (snapshot as { metadata?: { target?: string } })
          .metadata?.target;

        // Objects in live but not in snapshot → added
        // We only consider the targeted object(s) since pre-mutation snapshots are object-scoped
        for (const [name, live] of liveObjects) {
          if (name === snapshotTarget || snapshotObjects.has(name)) {
            if (!snapshotObjects.has(name)) {
              diffs.push({
                object: name,
                type: live.type,
                status: "added",
                liveDefinition: live.sql,
              });
            }
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

        const result = {
          success: true,
          diffs,
          snapshotTimestamp:
            (snapshot as { metadata?: { timestamp?: string } }).metadata
              ?.timestamp ?? "",
          snapshotTarget:
            (snapshot as { metadata?: { target?: string } }).metadata?.target ??
            "",
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (error: unknown) {
        const errRes = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errRes, null, 2),
            },
          ],
          isError: true,
          structuredContent: errRes as unknown as Record<string, unknown>,
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
          .default("")
          .describe("Snapshot filename to restore from"),
        dryRun: z
          .unknown()
          .optional()
          .describe("If true, returns the DDL without executing it (boolean)"),
      }),
      outputSchema: AuditRestoreBackupOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args: unknown) => {
      const authCtx = getAuthContext();
      if (
        authCtx &&
        !scopesGrantToolAccess(authCtx.scopes, "sqlite_audit_restore_backup")
      ) {
        throw new InsufficientScopeError(["admin", "full"], authCtx.scopes);
      }
      let filename;
      let dryRun;
      try {
        const parsed = z
          .object({
            filename: z.string().min(1, "filename is required"),
            dryRun: z.boolean().optional().default(false),
          })
          .parse(args);
        filename = parsed.filename;
        dryRun = parsed.dryRun;
      } catch (error: unknown) {
        const structured = formatHandlerError(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          isError: true,
          structuredContent: structured as unknown as Record<string, unknown>,
        };
      }
      const snapshot = await backupManager.getSnapshot(filename);
      if (!snapshot) {
        const errRes = {
          success: false,
          error: `Snapshot not found: ${filename}`,
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errRes, null, 2),
            },
          ],
          isError: true,
          structuredContent: errRes as unknown as Record<string, unknown>,
        };
      }

      const ddl = (snapshot as { ddl?: string }).ddl ?? "";
      if (!ddl.trim()) {
        const errRes = {
          success: false,
          error: "Snapshot contains no DDL statements",
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errRes, null, 2),
            },
          ],
          isError: true,
          structuredContent: errRes as unknown as Record<string, unknown>,
        };
      }

      const adapter = [...adaptersMap.values()][0];
      if (!adapter) {
        const errRes = {
          success: false,
          error: "No connected adapter available",
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errRes, null, 2),
            },
          ],
          isError: true,
          structuredContent: errRes as unknown as Record<string, unknown>,
        };
      }

      if (dryRun) {
        const result = {
          success: true,
          message: "Dry run: no changes applied",
          dryRun: true,
          ddl: redactSqlLiterals(ddl),
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result,
        };
      }

      try {
        const statements = ddl
          .split(";")
          .map((s: string) => s.trim())
          .filter((s: string) => {
            const cleanSql = s
              .replace(/\/\*[\s\S]*?\*\//g, "")
              .replace(/--.*$/gm, "")
              .trim();
            return cleanSql.length > 0;
          });

        if (statements.length === 0) {
          const result = {
            success: true,
            message:
              "No executable statements found in snapshot (only comments)",
            changesApplied: 0,
          };
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
            structuredContent: result,
          };
        }

        await adapter.executeQuery("BEGIN TRANSACTION;");
        try {
          for (const stmt of statements) {
            validateDdl(stmt);
            await adapter.executeQuery(`${stmt};`);
          }
          await adapter.executeQuery("COMMIT;");
        } catch (e) {
          await adapter.executeQuery("ROLLBACK;");
          throw e;
        }

        const result = {
          success: true,
          message: `Successfully executed ${statements.length} statement(s) from snapshot`,
          changesApplied: statements.length,
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result,
        };
      } catch (error: unknown) {
        const errRes = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errRes, null, 2),
            },
          ],
          isError: true,
          structuredContent: errRes as unknown as Record<string, unknown>,
        };
      }
    },
  );

  registerToolScopes(
    new Map([
      ["sqlite_audit_list_backups", ["admin", "full"]],
      ["sqlite_audit_get_backup", ["admin", "full"]],
      ["sqlite_audit_cleanup", ["admin", "full"]],
      ["sqlite_audit_diff_backup", ["admin", "full"]],
      ["sqlite_audit_restore_backup", ["admin", "full"]],
    ]),
  );

  logger.info(
    "Registered audit backup tools: sqlite_audit_list_backups, sqlite_audit_get_backup, sqlite_audit_cleanup, sqlite_audit_diff_backup, sqlite_audit_restore_backup",
    { module: "AUDIT" },
  );
}

/**
 * Register the sqlite_audit_search tool.
 */
export function registerAuditSearchTool(
  server: McpServer,
  auditLogger: AuditLogger | null,
): void {
  if (!auditLogger) return;

  server.registerTool(
    "sqlite_audit_search",
    {
      title: "Search Audit Log",
      description:
        "Search and filter structured audit logs from the System Database. Returns recent tool invocations, outcomes, token estimates, and parameters.",
      inputSchema: AuditSearchSchema,
      outputSchema: AuditSearchOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: unknown) => {
      const authCtx = getAuthContext();
      if (
        authCtx &&
        !scopesGrantToolAccess(authCtx.scopes, "sqlite_audit_search")
      ) {
        throw new InsufficientScopeError(["admin", "full"], authCtx.scopes);
      }

      let parsed;
      try {
        parsed = AuditSearchSchema.parse(args ?? {});
      } catch (error: unknown) {
        const structured = formatHandlerError(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          isError: true,
          structuredContent: structured as unknown as Record<string, unknown>,
        };
      }

      const { entries, totalCount } = await auditLogger.search(parsed);

      const result = {
        success: true,
        entries,
        count: entries.length,
        totalCount,
      };

      const tokenEstimate = Math.ceil(
        Buffer.byteLength(JSON.stringify(result), "utf8") / 4,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { ...result, _meta: { tokenEstimate } },
              null,
              2,
            ),
          },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  registerToolScopes(new Map([["sqlite_audit_search", ["admin", "full"]]]));

  logger.info("Registered audit search tool: sqlite_audit_search", {
    module: "AUDIT",
  });
}
