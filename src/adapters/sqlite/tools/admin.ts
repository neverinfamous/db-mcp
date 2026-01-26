/**
 * SQLite Admin Tools
 *
 * Database administration operations:
 * backup, restore, analyze, optimize, integrity check, PRAGMA operations.
 * 12 tools total.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { admin, readOnly } from "../../../utils/annotations.js";
import {
  BackupOutputSchema,
  AnalyzeOutputSchema,
  OptimizeOutputSchema,
  IntegrityCheckOutputSchema,
  RestoreOutputSchema,
  VerifyBackupOutputSchema,
  IndexStatsOutputSchema,
  PragmaCompileOptionsOutputSchema,
  PragmaDatabaseListOutputSchema,
  PragmaOptimizeOutputSchema,
  PragmaSettingsOutputSchema,
  PragmaTableInfoOutputSchema,
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

const RestoreSchema = z.object({
  sourcePath: z.string().describe("Path to backup file to restore from"),
});

const VerifyBackupSchema = z.object({
  backupPath: z.string().describe("Path to backup file to verify"),
});

const IndexStatsSchema = z.object({
  table: z
    .string()
    .optional()
    .describe("Filter indexes by table name (default: all tables)"),
});

const PragmaOptimizeSchema = z.object({
  mask: z
    .number()
    .optional()
    .describe("Optional optimization mask (default: 0xfffe)"),
});

const PragmaSettingsSchema = z.object({
  pragma: z
    .string()
    .describe("PRAGMA name (e.g., 'cache_size', 'journal_mode')"),
  value: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Value to set (omit to only read)"),
});

const PragmaTableInfoSchema = z.object({
  table: z.string().describe("Table name to get column information for"),
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
    createRestoreTool(adapter),
    createVerifyBackupTool(adapter),
    createIndexStatsTool(adapter),
    createPragmaCompileOptionsTool(adapter),
    createPragmaDatabaseListTool(adapter),
    createPragmaOptimizeTool(adapter),
    createPragmaSettingsTool(adapter),
    createPragmaTableInfoTool(adapter),
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
    outputSchema: IntegrityCheckOutputSchema,
    requiredScopes: ["admin"],
    annotations: readOnly("Integrity Check"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = IntegrityCheckSchema.parse(params);

      const sql = `PRAGMA integrity_check(${input.maxErrors})`;
      const result = await adapter.executeReadQuery(sql);

      const messages = (result.rows ?? []).map(
        (r) => r["integrity_check"],
      ) as string[];
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

/**
 * Restore database from backup
 */
function createRestoreTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_restore",
    description:
      "Restore database from a backup file. WARNING: This replaces the current database.",
    group: "admin",
    inputSchema: RestoreSchema,
    outputSchema: RestoreOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Restore Database"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = RestoreSchema.parse(params);
      const start = Date.now();

      // Attach the backup, copy data, detach
      const escapedPath = input.sourcePath.replace(/'/g, "''");

      // Verify current database is valid before overwriting
      await adapter.executeReadQuery(
        `SELECT * FROM pragma_integrity_check((SELECT 1)) LIMIT 1`,
      );

      // Use VACUUM FROM to restore (reverse of VACUUM INTO)
      // Note: This approach requires SQLite 3.27.0+
      await adapter.executeQuery(`VACUUM main FROM '${escapedPath}'`);

      const duration = Date.now() - start;

      return {
        success: true,
        message: `Database restored from '${input.sourcePath}'`,
        sourcePath: input.sourcePath,
        durationMs: duration,
      };
    },
  };
}

/**
 * Verify backup file integrity
 */
function createVerifyBackupTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_verify_backup",
    description: "Verify a backup file's integrity without restoring it.",
    group: "admin",
    inputSchema: VerifyBackupSchema,
    outputSchema: VerifyBackupOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Verify Backup"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = VerifyBackupSchema.parse(params);
      const escapedPath = input.backupPath.replace(/'/g, "''");

      // Attach backup database temporarily
      await adapter.executeQuery(
        `ATTACH DATABASE '${escapedPath}' AS backup_verify`,
      );

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
    },
  };
}

/**
 * Get index statistics
 */
function createIndexStatsTool(adapter: SqliteAdapter): ToolDefinition {
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
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
          throw new Error("Invalid table name");
        }
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

/**
 * Get SQLite compile options
 */
function createPragmaCompileOptionsTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_pragma_compile_options",
    description: "Get the compile-time options used to build SQLite.",
    group: "admin",
    inputSchema: z.object({}),
    outputSchema: PragmaCompileOptionsOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Compile Options"),
    handler: async (_params: unknown, _context: RequestContext) => {
      const result = await adapter.executeReadQuery("PRAGMA compile_options");
      const options = (result.rows ?? []).map(
        (r) => r["compile_options"] as string,
      );

      return {
        success: true,
        options,
      };
    },
  };
}

/**
 * List attached databases
 */
function createPragmaDatabaseListTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_pragma_database_list",
    description: "List all attached databases.",
    group: "admin",
    inputSchema: z.object({}),
    outputSchema: PragmaDatabaseListOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Database List"),
    handler: async (_params: unknown, _context: RequestContext) => {
      const result = await adapter.executeReadQuery("PRAGMA database_list");
      const databases = (result.rows ?? []).map((r) => ({
        seq: r["seq"] as number,
        name: r["name"] as string,
        file: r["file"] as string,
      }));

      return {
        success: true,
        databases,
      };
    },
  };
}

/**
 * Run PRAGMA optimize
 */
function createPragmaOptimizeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_pragma_optimize",
    description:
      "Run PRAGMA optimize to improve query performance based on usage patterns.",
    group: "admin",
    inputSchema: PragmaOptimizeSchema,
    outputSchema: PragmaOptimizeOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("PRAGMA Optimize"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = PragmaOptimizeSchema.parse(params);
      const start = Date.now();

      const sql =
        input.mask !== undefined
          ? `PRAGMA optimize(${input.mask})`
          : "PRAGMA optimize";
      await adapter.executeQuery(sql);

      const duration = Date.now() - start;

      return {
        success: true,
        message: "Database optimized",
        durationMs: duration,
      };
    },
  };
}

/**
 * Get or set PRAGMA values
 */
function createPragmaSettingsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_pragma_settings",
    description: "Get or set a PRAGMA value.",
    group: "admin",
    inputSchema: PragmaSettingsSchema,
    outputSchema: PragmaSettingsOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("PRAGMA Settings"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = PragmaSettingsSchema.parse(params);

      // Validate pragma name (alphanumeric + underscore only)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.pragma)) {
        throw new Error("Invalid PRAGMA name");
      }

      if (input.value !== undefined) {
        // Get old value first
        const oldResult = await adapter.executeReadQuery(
          `PRAGMA ${input.pragma}`,
        );
        const oldValue = oldResult.rows?.[0]?.[input.pragma];

        // Set new value
        await adapter.executeQuery(`PRAGMA ${input.pragma} = ${input.value}`);

        // Verify new value
        const newResult = await adapter.executeReadQuery(
          `PRAGMA ${input.pragma}`,
        );
        const newValue = newResult.rows?.[0]?.[input.pragma];

        return {
          success: true,
          pragma: input.pragma,
          value: newValue,
          oldValue,
          newValue,
        };
      } else {
        // Just read value
        const result = await adapter.executeReadQuery(`PRAGMA ${input.pragma}`);
        const value = result.rows?.[0]?.[input.pragma];

        return {
          success: true,
          pragma: input.pragma,
          value,
        };
      }
    },
  };
}

/**
 * Get table column information
 */
function createPragmaTableInfoTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_pragma_table_info",
    description: "Get detailed column information for a table.",
    group: "admin",
    inputSchema: PragmaTableInfoSchema,
    outputSchema: PragmaTableInfoOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Table Info"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = PragmaTableInfoSchema.parse(params);

      // Validate table name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }

      const result = await adapter.executeReadQuery(
        `PRAGMA table_info("${input.table}")`,
      );

      const columns = (result.rows ?? []).map((r) => ({
        cid: r["cid"] as number,
        name: r["name"] as string,
        type: r["type"] as string,
        notNull: (r["notnull"] as number) === 1,
        defaultValue: r["dflt_value"],
        pk: r["pk"] as number,
      }));

      return {
        success: true,
        table: input.table,
        columns,
      };
    },
  };
}
