/**
 * Verification and Index Tools
 *
 * Backup verification and index statistics.
 */

import fs from "node:fs";
import nodePath from "node:path";
import type { SqliteAdapter } from "../../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatError } from "../../../../utils/errors.js";
import { isSpatialiteSystemIndex } from "../core.js";
import {
  VerifyBackupOutputSchema,
  IndexStatsOutputSchema,
} from "../../output-schemas/index.js";
import {
  VerifyBackupSchema,
  IndexStatsSchema,
} from "./helpers.js";

export function createVerifyBackupTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_verify_backup",
    description: "Verify a backup file's integrity without restoring it.",
    group: "admin",
    inputSchema: VerifyBackupSchema,
    outputSchema: VerifyBackupOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Verify Backup"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VerifyBackupSchema.parse(params);
        // WASM mode: backup/restore/verify are not available since file system
        // ATTACH succeeds silently in WASM (creates empty DB), giving false positives.
        if (!adapter.isNativeBackend()) {
          return {
            success: false,
            message:
              "Verify backup not available: file system access is not supported in WASM mode.",
            wasmLimitation: true,
            backupPath: input.backupPath,
          };
        }

        // Pre-validate file exists (ATTACH silently creates empty DB for nonexistent files)
        // Resolve to absolute path to avoid CWD-relative false positives
        const resolvedPath = nodePath.resolve(input.backupPath);
        if (!fs.existsSync(resolvedPath)) {
          return {
            success: false,
            message: `Backup file not found: ${input.backupPath}`,
            backupPath: input.backupPath,
          };
        }

        const escapedPath = resolvedPath.replace(/'/g, "''");

        // Attach backup database temporarily
        try {
          await adapter.executeQuery(
            `ATTACH DATABASE '${escapedPath}' AS backup_verify`,
          );
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : String(error),
            backupPath: input.backupPath,
          };
        }

        try {
          // Get page info
          const pageCountResult = await adapter.executeReadQuery(
            "PRAGMA backup_verify.page_count",
          );
          const pageSizeResult = await adapter.executeReadQuery(
            "PRAGMA backup_verify.page_size",
          );

          const pageCount =
            (pageCountResult.rows?.[0]?.["page_count"] as number) ?? 0;
          const pageSize =
            (pageSizeResult.rows?.[0]?.["page_size"] as number) ?? 0;

          // Run integrity check on backup
          const integrityResult = await adapter.executeReadQuery(
            "PRAGMA backup_verify.integrity_check(10)",
          );

          const messages = (integrityResult.rows ?? []).map(
            (r) => r["integrity_check"],
          ) as string[];
          const isOk = messages.length === 1 && messages[0] === "ok";

          return {
            success: true,
            valid: isOk,
            pageCount,
            pageSize,
            integrity: isOk ? "ok" : "errors_found",
            messages: isOk ? undefined : messages,
          };
        } finally {
          // Always detach
          await adapter.executeQuery("DETACH DATABASE backup_verify");
        }
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Get index statistics
 */
export function createIndexStatsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_index_stats",
    description: "Get detailed statistics for database indexes.",
    group: "admin",
    inputSchema: IndexStatsSchema,
    outputSchema: IndexStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Index Statistics"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = IndexStatsSchema.parse(params);

      // Query for indexes
      let sql = `
        SELECT name, tbl_name as "table", sql
        FROM sqlite_master
        WHERE type = 'index' AND sql IS NOT NULL
      `;
      if (input.table) {
        // Validate table name using centralized utility
        sanitizeIdentifier(input.table);
        sql += ` AND tbl_name = '${input.table}'`;
      }
      sql += " ORDER BY tbl_name, name";

      const result = await adapter.executeReadQuery(sql);

      const indexes: {
        name: string;
        table: string;
        unique: boolean;
        partial: boolean;
        columns: { name: string; seqno: number }[];
      }[] = [];

      for (const row of result.rows ?? []) {
        const indexName = row["name"] as string;
        const tableName = row["table"] as string;
        const sqlDef = (row["sql"] as string) ?? "";

        // Filter out SpatiaLite system indexes if requested (default: true)
        if (input.excludeSystemIndexes) {
          if (isSpatialiteSystemIndex(indexName)) {
            continue;
          }
        }

        // Check if unique from CREATE statement
        const unique = sqlDef.toUpperCase().includes("UNIQUE");
        const partial = sqlDef.toUpperCase().includes("WHERE");

        // Get column info
        const indexInfoResult = await adapter.executeReadQuery(
          `PRAGMA index_info("${indexName}")`,
        );
        const columns = (indexInfoResult.rows ?? []).map((col) => ({
          name: col["name"] as string,
          seqno: col["seqno"] as number,
        }));

        indexes.push({
          name: indexName,
          table: tableName,
          unique,
          partial,
          columns,
        });
      }

      return {
        success: true,
        indexes,
      };
    },
  };
}