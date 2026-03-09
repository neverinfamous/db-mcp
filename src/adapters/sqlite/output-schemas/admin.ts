/**
 * Admin Tool Output Schemas
 */

import { z } from "zod";

/**
 * sqlite_vacuum output
 */
export const VacuumOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sizeChange: z
    .object({
      before: z.number(),
      after: z.number(),
      saved: z.number(),
    })
    .optional(),
});

/**
 * sqlite_backup output
 */
export const BackupOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  path: z.string(),
  sizeBytes: z.number().optional(),
  durationMs: z.number().optional(),
  wasmLimitation: z.boolean().optional(),
  note: z.string().optional(),
});

/**
 * sqlite_analyze output
 */
export const AnalyzeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  tablesAnalyzed: z.number().optional(),
  durationMs: z.number().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  category: z.string().optional(),
  suggestion: z.string().optional(),
});

/**
 * sqlite_optimize output
 */
export const OptimizeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  operations: z.array(z.string()).optional(),
});

/**
 * sqlite_integrity_check output
 */
export const IntegrityCheckOutputSchema = z.object({
  success: z.boolean(),
  integrity: z.enum(["ok", "errors_found"]),
  errorCount: z.number(),
  messages: z.array(z.string()).optional(),
});

/**
 * sqlite_restore output
 */
export const RestoreOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  sourcePath: z.string().optional(),
  durationMs: z.number().optional(),
  wasmLimitation: z.boolean().optional(),
  skippedTables: z.array(z.string()).optional(),
  note: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  category: z.string().optional(),
  suggestion: z.string().optional(),
});

/**
 * sqlite_verify_backup output
 */
export const VerifyBackupOutputSchema = z.object({
  success: z.boolean(),
  valid: z.boolean().optional(),
  pageCount: z.number().optional(),
  pageSize: z.number().optional(),
  integrity: z.enum(["ok", "errors_found"]).optional(),
  messages: z.array(z.string()).optional(),
  message: z.string().optional(),
  wasmLimitation: z.boolean().optional(),
  backupPath: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  category: z.string().optional(),
  suggestion: z.string().optional(),
});

/**
 * Index column info
 */
const IndexColumnSchema = z.object({
  name: z.string(),
  seqno: z.number(),
});

/**
 * Index stats entry
 */
const IndexStatsEntrySchema = z.object({
  name: z.string(),
  table: z.string(),
  unique: z.boolean(),
  partial: z.boolean(),
  columns: z.array(IndexColumnSchema),
});

/**
 * sqlite_index_stats output
 */
export const IndexStatsOutputSchema = z.object({
  success: z.boolean(),
  indexes: z.array(IndexStatsEntrySchema),
});

/**
 * sqlite_pragma_compile_options output
 */
export const PragmaCompileOptionsOutputSchema = z.object({
  success: z.boolean(),
  options: z.array(z.string()),
});

/**
 * Database entry for database_list
 */
const DatabaseListEntrySchema = z.object({
  seq: z.number(),
  name: z.string(),
  file: z.string(),
});

/**
 * sqlite_pragma_database_list output
 */
export const PragmaDatabaseListOutputSchema = z.object({
  success: z.boolean(),
  databases: z.array(DatabaseListEntrySchema),
  configuredPath: z.string().optional(),
  note: z.string().optional(),
});

/**
 * sqlite_pragma_optimize output
 */
export const PragmaOptimizeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  durationMs: z.number(),
});

/**
 * sqlite_pragma_settings output
 */
export const PragmaSettingsOutputSchema = z.object({
  success: z.boolean(),
  pragma: z.string().optional(),
  value: z.unknown().optional(),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  category: z.string().optional(),
  suggestion: z.string().optional(),
});

/**
 * Column info for pragma_table_info
 */
const PragmaTableInfoColumnSchema = z.object({
  cid: z.number(),
  name: z.string(),
  type: z.string(),
  notNull: z.boolean(),
  defaultValue: z.unknown().nullable(),
  pk: z.number(),
});

/**
 * sqlite_pragma_table_info output
 */
export const PragmaTableInfoOutputSchema = z.object({
  success: z.boolean(),
  table: z.string(),
  columns: z.array(PragmaTableInfoColumnSchema),
});
