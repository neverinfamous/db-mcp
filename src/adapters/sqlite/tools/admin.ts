/**
 * SQLite Admin Tools
 *
 * Database administration operations:
 * backup, restore, analyze, optimize, integrity check.
 * 4 tools total.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { admin, readOnly } from "../../../utils/annotations.js";
import {
  BackupOutputSchema,
  AnalyzeOutputSchema,
  OptimizeOutputSchema,
} from "../output-schemas.js";

// Admin schemas
const BackupSchema = z.object({
  targetPath: z.string().describe("Path for backup file"),
});

const AnalyzeSchema = z.object({
  table: z
    .string()
    .optional()
    .describe("Specific table to analyze (default: all)"),
});

const IntegrityCheckSchema = z.object({
  maxErrors: z
    .number()
    .optional()
    .default(100)
    .describe("Maximum errors to report"),
});

const OptimizeSchema = z.object({
  table: z.string().optional().describe("Specific table to optimize"),
  reindex: z.boolean().optional().default(false),
  analyze: z.boolean().optional().default(true),
});

/**
 * Get all admin tools
 */
export function getAdminTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createBackupTool(adapter),
    createAnalyzeTool(adapter),
    createIntegrityCheckTool(adapter),
    createOptimizeTool(adapter),
  ];
}

/**
 * Backup database
 */
function createBackupTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_backup",
    description: "Create a backup of the database to a file.",
    group: "admin",
    inputSchema: BackupSchema,
    outputSchema: BackupOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Database Backup"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = BackupSchema.parse(params);

      // Use VACUUM INTO to create backup
      const escapedPath = input.targetPath.replace(/'/g, "''");
      const sql = `VACUUM INTO '${escapedPath}'`;

      const start = Date.now();
      await adapter.executeQuery(sql);
      const duration = Date.now() - start;

      return {
        success: true,
        message: `Database backed up to '${input.targetPath}'`,
        path: input.targetPath,
        durationMs: duration,
      };
    },
  };
}

/**
 * Analyze tables for query optimization
 */
function createAnalyzeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_analyze",
    description: "Analyze table statistics to improve query performance.",
    group: "admin",
    inputSchema: AnalyzeSchema,
    outputSchema: AnalyzeOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Analyze Tables"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = AnalyzeSchema.parse(params);

      let sql: string;
      if (input.table) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
          throw new Error("Invalid table name");
        }
        sql = `ANALYZE "${input.table}"`;
      } else {
        sql = "ANALYZE";
      }

      const start = Date.now();
      await adapter.executeQuery(sql);
      const duration = Date.now() - start;

      return {
        success: true,
        message: input.table
          ? `Table '${input.table}' analyzed`
          : "All tables analyzed",
        durationMs: duration,
      };
    },
  };
}

/**
 * Check database integrity
 */
function createIntegrityCheckTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_integrity_check",
    description: "Check database integrity for corruption or errors.",
    group: "admin",
    inputSchema: IntegrityCheckSchema,
    requiredScopes: ["admin"],
    annotations: readOnly("Integrity Check"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = IntegrityCheckSchema.parse(params);

      const sql = `PRAGMA integrity_check(${input.maxErrors})`;
      const result = await adapter.executeReadQuery(sql);

      const messages = (result.rows ?? []).map((r) => r["integrity_check"]);
      const isOk = messages.length === 1 && messages[0] === "ok";

      return {
        success: true,
        integrity: isOk ? "ok" : "errors_found",
        errorCount: isOk ? 0 : messages.length,
        messages: isOk ? undefined : messages,
      };
    },
  };
}

/**
 * Optimize database
 */
function createOptimizeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_optimize",
    description: "Optimize database by reindexing and/or analyzing.",
    group: "admin",
    inputSchema: OptimizeSchema,
    outputSchema: OptimizeOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Optimize Database"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = OptimizeSchema.parse(params);

      const operations: string[] = [];
      const start = Date.now();

      // Reindex if requested
      if (input.reindex) {
        if (input.table) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
            throw new Error("Invalid table name");
          }
          await adapter.executeQuery(`REINDEX "${input.table}"`);
          operations.push(`reindexed ${input.table}`);
        } else {
          await adapter.executeQuery("REINDEX");
          operations.push("reindexed all");
        }
      }

      // Analyze if requested
      if (input.analyze) {
        if (input.table) {
          await adapter.executeQuery(`ANALYZE "${input.table}"`);
          operations.push(`analyzed ${input.table}`);
        } else {
          await adapter.executeQuery("ANALYZE");
          operations.push("analyzed all");
        }
      }

      const duration = Date.now() - start;

      return {
        success: true,
        operations,
        durationMs: duration,
      };
    },
  };
}
