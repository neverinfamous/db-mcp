/**
 * WAL Management Tool
 *
 * Manages SQLite Write-Ahead Logging (WAL) mode:
 * check status, enable/disable WAL, and checkpoint.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { admin } from "../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import {
  WalSchema,
  WalOutputSchema,
} from "../../schemas/admin.js";

export function createWalTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_wal",
    description:
      "Manage SQLite Write-Ahead Logging (WAL) mode. WAL improves concurrent read/write performance and is recommended for production databases. Actions: 'status' = check current journal mode, 'enable' = switch to WAL mode, 'disable' = switch back to DELETE (default) mode, 'checkpoint' = force a WAL checkpoint to sync WAL file to database.",
    group: "admin",
    inputSchema: WalSchema,
    outputSchema: WalOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("WAL Management"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = WalSchema.parse(params);

        switch (input.action) {
          case "status": {
            const result = await adapter.executeReadQuery(
              "PRAGMA journal_mode",
            );
            const journalMode =
              (result.rows?.[0]?.["journal_mode"] as string) ?? "unknown";

            return {
              success: true,
              message: `Current journal mode: ${journalMode}`,
              journalMode,
            };
          }

          case "enable": {
            // Get current mode first
            const currentResult = await adapter.executeReadQuery(
              "PRAGMA journal_mode",
            );
            const previousMode =
              (currentResult.rows?.[0]?.["journal_mode"] as string) ??
              "unknown";

            if (previousMode === "wal") {
              return {
                success: true,
                message: "WAL mode is already enabled",
                journalMode: "wal",
                previousMode: "wal",
              };
            }

            // Enable WAL
            const enableResult = await adapter.executeQuery(
              "PRAGMA journal_mode=WAL",
            );
            const newMode =
              (enableResult.rows?.[0]?.["journal_mode"] as string) ?? "wal";

            return {
              success: true,
              message: `Journal mode changed from '${previousMode}' to '${newMode}'`,
              journalMode: newMode,
              previousMode,
            };
          }

          case "disable": {
            // Get current mode first
            const currentResult = await adapter.executeReadQuery(
              "PRAGMA journal_mode",
            );
            const previousMode =
              (currentResult.rows?.[0]?.["journal_mode"] as string) ??
              "unknown";

            if (previousMode === "delete") {
              return {
                success: true,
                message: "Already using default journal mode (DELETE)",
                journalMode: "delete",
                previousMode: "delete",
              };
            }

            // Switch to DELETE mode
            const disableResult = await adapter.executeQuery(
              "PRAGMA journal_mode=DELETE",
            );
            const newMode =
              (disableResult.rows?.[0]?.["journal_mode"] as string) ??
              "delete";

            return {
              success: true,
              message: `Journal mode changed from '${previousMode}' to '${newMode}'`,
              journalMode: newMode,
              previousMode,
            };
          }

          case "checkpoint": {
            // Get current journal mode first
            const modeResult = await adapter.executeReadQuery(
              "PRAGMA journal_mode",
            );
            const currentMode =
              (modeResult.rows?.[0]?.["journal_mode"] as string) ?? "unknown";

            if (currentMode !== "wal") {
              return {
                success: false,
                error: `Cannot checkpoint: database is not in WAL mode (current mode: ${currentMode})`,
                code: "VALIDATION_ERROR",
                journalMode: currentMode,
              };
            }

            // Run checkpoint with specified mode
            const checkpointResult = await adapter.executeQuery(
              `PRAGMA wal_checkpoint(${input.checkpointMode})`,
            );

            // PRAGMA wal_checkpoint returns: busy, log, checkpointed
            const row = checkpointResult.rows?.[0];
            const walPages = (row?.["log"] as number) ?? 0;
            const checkpointedPages = (row?.["checkpointed"] as number) ?? 0;

            return {
              success: true,
              message: `WAL checkpoint completed (${input.checkpointMode}): ${checkpointedPages}/${walPages} pages checkpointed`,
              journalMode: "wal",
              walPages,
              checkpointedPages,
            };
          }
        }
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
