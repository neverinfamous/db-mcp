import fs from "node:fs";

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
import nodePath from "node:path";
import {
  validateSameDirPath,
  assertSafeIoPath,
} from "../../../../../utils/index.js";
import { SqlDumpSchema, SqlDumpOutputSchema } from "../../../schemas/admin.js";
import {
  sendProgress,
  buildProgressContext,
} from "../../../../../utils/progress-utils.js";

function escapeString(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

/**
 * Dump database to SQL text file
 */
export function createDumpTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_dump",
    description: "Export the database schema and data as a SQL text dump",
    group: "admin",
    inputSchema: SqlDumpSchema,
    outputSchema: SqlDumpOutputSchema,
    requiredScopes: ["admin"],
    annotations: adminFs("Dump Database to SQL Text"),
    handler: async (params: unknown, context: RequestContext) => {
      let input;
      try {
        input = SqlDumpSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      if (!adapter.isNativeBackend()) {
        return {
          ...formatHandlerError(
            new ValidationError(
              "SQL Dump is not available in WASM mode (no file system access).",
            ),
          ),
          success: false,
          wasmLimitation: true,
          path: input.outputPath,
        };
      }

      if (!input.outputPath?.trim()) {
        return {
          ...formatHandlerError(new ValidationError("outputPath is required")),
        };
      }

      let resolvedPath: string;
      const allowedIoRoots = adapter.getAllowedIoRoots();

      if (allowedIoRoots !== undefined) {
        try {
          assertSafeIoPath(input.outputPath, allowedIoRoots);
          resolvedPath = nodePath.resolve(input.outputPath);
        } catch (error: unknown) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Security error",
            code: "SECURITY_ERROR",
            path: input.outputPath,
          };
        }
      } else {
        // Security: validate outputPath is within the same directory as the primary DB
        const pathCheck = validateSameDirPath(
          input.outputPath,
          adapter.getConfiguredPath(),
        );

        // Hard reject any path traversal attempts (F04 defense in depth)
        if (input.outputPath.includes("..") || !pathCheck.valid) {
          return {
            success: false,
            error: !pathCheck.valid
              ? pathCheck.error
              : "Invalid path: must not contain '..'",
            code: "SECURITY_ERROR",
            path: input.outputPath,
          };
        }
        resolvedPath = pathCheck.resolvedPath;
      }

      const progress = buildProgressContext(context);
      const start = Date.now();

      await sendProgress(progress, 1, 4, "Preparing dump file...");

      const stream = fs.createWriteStream(resolvedPath, { encoding: "utf8" });

      try {
        stream.write("PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n");

        await sendProgress(progress, 2, 4, "Exporting schema...");

        const order = ["table", "index", "view", "trigger"];
        const tables: string[] = [];

        for (const type of order) {
          const schemaResult = await adapter.executeReadQuery(
            `SELECT name, sql FROM sqlite_master WHERE type='${type}' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name`,
          );

          for (const row of schemaResult.rows ?? []) {
            stream.write(`${String(row["sql"])};\n`);
            if (
              type === "table" &&
              !String(row["sql"]).includes("VIRTUAL TABLE")
            ) {
              tables.push(row["name"] as string);
            }
          }
        }

        await sendProgress(progress, 3, 4, "Exporting data...");

        for (const table of tables) {
          const quotedTable = `"${table.replace(/"/g, '""')}"`;
          const tableResult = await adapter.executeReadQuery(
            `SELECT * FROM ${quotedTable}`,
          );

          if (!tableResult.rows || tableResult.rows.length === 0) continue;

          for (const row of tableResult.rows) {
            const keys = Object.keys(row);
            const values = keys.map((k) => {
              const val = row[k];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "number" || typeof val === "bigint")
                return val.toString();
              if (typeof val === "boolean") return val ? "1" : "0";
              if (typeof val === "string") return escapeString(val);
              if (typeof val === "object") {
                if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
                  return `x'${Buffer.from(val).toString("hex")}'`;
                }
                return escapeString(JSON.stringify(val));
              }
              return escapeString("");
            });

            const quotedKeys = keys.map((k) => `"${k.replace(/"/g, '""')}"`);
            stream.write(
              `INSERT INTO ${quotedTable} (${quotedKeys.join(", ")}) VALUES (${values.join(", ")});\n`,
            );
          }
        }

        stream.write("COMMIT;\n");

        await new Promise<void>((resolve, reject) => {
          stream.end((err: Error | null | undefined) =>
            err ? reject(err) : resolve(),
          );
        });
      } catch (err) {
        stream.end();
        const error = err instanceof Error ? err : new Error(String(err));
        return {
          ...formatHandlerError(error),
          path: input.outputPath,
        };
      }

      await sendProgress(progress, 4, 4, "Dump complete");

      return {
        success: true,
        message: `Database successfully dumped to ${input.outputPath}`,
        path: input.outputPath,
        durationMs: Date.now() - start,
      };
    },
  };
}
