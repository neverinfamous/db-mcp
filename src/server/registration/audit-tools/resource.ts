import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BackupManager } from "../../../audit/backup-manager.js";
import type { AuditLogger } from "../../../audit/logger.js";
import { metrics } from "../../../observability/metrics.js";
import { redactSqlLiterals } from "./helpers.js";

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

