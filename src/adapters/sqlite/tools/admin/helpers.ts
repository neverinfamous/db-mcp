/**
 * Admin Tool Helpers
 *
 * Shared schemas and imports for admin tools.
 */

/**
 * SQLite Admin Tools
 *
 * Database administration operations:
 * backup, restore, analyze, optimize, integrity check, PRAGMA operations.
 * 13 tools total.
 */

import { z } from "zod";

/**
 * Coerce string values to numbers for MCP parameter safety.
 * Returns undefined for unparseable values so `.default()` kicks in.
 */
const coerceNumber = (val: unknown): unknown =>
  typeof val === "string"
    ? Number.isNaN(Number(val))
      ? undefined
      : Number(val)
    : val;

// Admin schemas
export const BackupSchema = z.object({
  targetPath: z.string().describe("Path for backup file"),
});

export const AnalyzeSchema = z.object({
  table: z
    .string()
    .optional()
    .describe("Specific table to analyze (default: all)"),
});

export const IntegrityCheckSchema = z.object({
  maxErrors: z.preprocess(
    coerceNumber,
    z.number().optional().default(100).describe("Maximum errors to report"),
  ),
});

export const OptimizeSchema = z.object({
  table: z.string().optional().describe("Specific table to optimize"),
  reindex: z.boolean().optional().default(false),
  analyze: z.boolean().optional().default(true),
});

export const RestoreSchema = z.object({
  sourcePath: z.string().describe("Path to backup file to restore from"),
});

export const VerifyBackupSchema = z.object({
  backupPath: z.string().describe("Path to backup file to verify"),
});

export const IndexStatsSchema = z.object({
  table: z
    .string()
    .optional()
    .describe("Filter indexes by table name (default: all tables)"),
  excludeSystemIndexes: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Exclude SpatiaLite system indexes (default: true). Set to false to include all indexes.",
    ),
});

export const PragmaOptimizeSchema = z.object({
  mask: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Optional optimization mask (default: 0xfffe)"),
  ),
});

export const PragmaSettingsSchema = z.object({
  pragma: z
    .string()
    .describe("PRAGMA name (e.g., 'cache_size', 'journal_mode')"),
  value: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Value to set (omit to only read)"),
});

export const PragmaTableInfoSchema = z.object({
  table: z.string().describe("Table name to get column information for"),
});

// Pragma compile options schema
export const PragmaCompileOptionsSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe(
      "Optional filter pattern (case-insensitive substring match) to limit returned options",
    ),
});

// Append insight schemas
export const AppendInsightSchema = z.object({
  insight: z
    .string()
    .describe("Business insight discovered from data analysis"),
});
