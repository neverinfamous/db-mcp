import nodePath from "node:path";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { adminFs } from "../../../../../utils/annotations.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../../utils/errors/index.js";
import { validateSameDirPath } from "../../../../../utils/index.js";
import { BackupOutputSchema } from "../../../schemas/admin.js";
import { BackupSchema, VacuumIntoCopySchema } from "../../../schemas/admin.js";
import { VacuumIntoCopyOutputSchema } from "../../../schemas/admin.js";
import {
  sendProgress,
  buildProgressContext,
} from "../../../../../utils/progress-utils.js";

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
    annotations: adminFs("Database Backup"),
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

      // Security: validate targetPath is within the same directory as the primary DB
      const pathCheck = validateSameDirPath(
        input.targetPath,
        adapter.getConfiguredPath(),
      );
      // Hard reject any path traversal attempts (F04 defense in depth)
      if (input.targetPath.includes("..") || !pathCheck.valid) {
        return {
          success: false,
          error: !pathCheck.valid ? pathCheck.error : "Invalid path: must not contain '..'",
          code: "SECURITY_ERROR",
          path: input.targetPath,
        };
      }

      const resolvedPath = nodePath.resolve(input.targetPath);
      const escapedPath = resolvedPath.replace(/'/g, "''");
      const sql = `VACUUM INTO '${escapedPath}'`;

      const start = Date.now();
      try {
        const progress = buildProgressContext(_context);
        await sendProgress(
          progress,
          1,
          2,
          `Creating backup at ${nodePath.basename(resolvedPath)}...`,
        );
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

/**
 * VACUUM INTO — create a compacted copy of the database
 */
export function createVacuumIntoTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vacuum_into",
    description:
      "Create a compacted, defragmented copy of the database at the specified path using VACUUM INTO. Does not modify the original database. The output path must be within the same directory as the primary database.",
    group: "admin",
    inputSchema: VacuumIntoCopySchema,
    outputSchema: VacuumIntoCopyOutputSchema,
    requiredScopes: ["admin"],
    annotations: adminFs("VACUUM INTO"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = VacuumIntoCopySchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      if (!adapter.isNativeBackend()) {
        return {
          ...formatHandlerError(
            new ValidationError(
              "VACUUM INTO is not available in WASM mode (no file system access).",
            ),
          ),
          success: false,
          wasmLimitation: true,
          outputPath: input.outputPath,
        };
      }

      if (!input.outputPath?.trim()) {
        return {
          ...formatHandlerError(
            new ValidationError("outputPath is required"),
          ),
        };
      }

      // Security: validate outputPath is within the same directory as the primary DB
      const pathCheck = validateSameDirPath(
        input.outputPath,
        adapter.getConfiguredPath(),
      );
      // Hard reject any path traversal attempts (F04 defense in depth)
      if (input.outputPath.includes("..") || !pathCheck.valid) {
        return {
          success: false,
          error: !pathCheck.valid ? pathCheck.error : "Invalid path: must not contain '..'",
          code: "SECURITY_ERROR",
        };
      }

      const resolvedPath = nodePath.resolve(input.outputPath);
      const escapedPath = resolvedPath.replace(/'/g, "''");
      const sql = `VACUUM INTO '${escapedPath}'`;

      const start = Date.now();
      try {
        await adapter.executeQuery(sql);
        const duration = Date.now() - start;

        // Try to get file size
        let sizeBytes: number | undefined;
        try {
          const { stat } = await import("node:fs/promises");
          const stats = await stat(resolvedPath);
          sizeBytes = stats.size;
        } catch {
          // File size retrieval is best-effort
        }

        return {
          success: true,
          message: `Database compacted to '${input.outputPath}'`,
          outputPath: input.outputPath,
          sizeBytes,
          durationMs: duration,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
