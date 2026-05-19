import nodePath from "node:path";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { admin } from "../../../../../utils/annotations.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../../utils/errors/index.js";
import { BackupOutputSchema } from "../../../schemas/admin.js";
import { BackupSchema } from "../../../schemas/admin.js";
import { sendProgress, buildProgressContext } from "../../../../../utils/progress-utils.js";

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
        return { ...formatHandlerError(error), path: "" };
      }

      if (!adapter.isNativeBackend()) {
        return {
          ...formatHandlerError(
            new ValidationError(
              "Backup not available: file system access is not supported in WASM mode.",
            ),
          ),
          wasmLimitation: true,
          path: input.targetPath,
        };
      }

      if (!input.targetPath?.trim()) {
        return {
          ...formatHandlerError(new ValidationError("targetPath is required")),
          path: "",
        };
      }

      const resolvedPath = nodePath.resolve(input.targetPath);
      const escapedPath = resolvedPath.replace(/'/g, "''");
      const sql = `VACUUM INTO '${escapedPath}'`;

      const start = Date.now();
      try {
        const progress = buildProgressContext(_context);
        await sendProgress(progress, 1, 2, `Creating backup at ${resolvedPath}...`);
        await adapter.executeQuery(sql);
        await sendProgress(progress, 2, 2, "Backup complete");
        const duration = Date.now() - start;

        return {
          success: true,
          message: `Database backed up to '${input.targetPath}'`,
          path: input.targetPath,
          durationMs: duration,
        };
      } catch (error) {
        return { ...formatHandlerError(error), path: input.targetPath };
      }
    },
  };
}
