/**
 * Admin Tool Schemas
 *
 * Input and output schemas for database administration operations:
 * backup, restore, analyze, optimize, integrity check, PRAGMA operations.
 */

import { z } from "zod";
import { ErrorResponseFields } from "../../../utils/errors/error-response-fields.js";

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

// =============================================================================
// Input Schemas
// =============================================================================

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
    z
      .number()
      .optional()
      .describe("Optional optimization mask (default: 0xfffe)"),
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

export const PragmaCompileOptionsSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe(
      "Optional filter pattern (case-insensitive substring match) to limit returned options",
    ),
});

export const PragmaDatabaseListSchema = z.object({});

export const AppendInsightSchema = z.object({
  insight: z
    .string()
    .describe("Business insight discovered from data analysis"),
});

export const VacuumSchema = z.object({
  analyze: z
    .boolean()
    .optional()
    .default(true)
    .describe("Run ANALYZE after VACUUM"),
});

// =============================================================================
// Output Schemas
// =============================================================================

export const VacuumOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    durationMs: z.number().optional(),
    wasmLimitation: z.boolean().optional(),
    sizeChange: z
      .object({
        before: z.number(),
        after: z.number(),
        saved: z.number(),
      })
      .optional(),
  })
  .extend(ErrorResponseFields.shape);

export const BackupOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    path: z.string().optional(),
    sizeBytes: z.number().optional(),
    durationMs: z.number().optional(),
    wasmLimitation: z.boolean().optional(),
    note: z.string().optional(),
  })
  .extend(ErrorResponseFields.shape);

export const AnalyzeOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    tablesAnalyzed: z.number().optional(),
    durationMs: z.number().optional(),
  })
  .extend(ErrorResponseFields.shape);

export const OptimizeOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    operations: z.array(z.string()).optional(),
    durationMs: z.number().optional(),
  })
  .extend(ErrorResponseFields.shape);

export const IntegrityCheckOutputSchema = z
  .object({
    success: z.boolean(),
    integrity: z.enum(["ok", "errors_found"]).optional(),
    errorCount: z.number().optional(),
    messages: z.array(z.string()).optional(),
  })
  .extend(ErrorResponseFields.shape);

export const RestoreOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sourcePath: z.string().optional(),
    durationMs: z.number().optional(),
    wasmLimitation: z.boolean().optional(),
    skippedTables: z.array(z.string()).optional(),
    note: z.string().optional(),
  })
  .extend(ErrorResponseFields.shape);

export const VerifyBackupOutputSchema = z
  .object({
    success: z.boolean(),
    valid: z.boolean().optional(),
    pageCount: z.number().optional(),
    pageSize: z.number().optional(),
    integrity: z.enum(["ok", "errors_found"]).optional(),
    messages: z.array(z.string()).optional(),
    message: z.string().optional(),
    wasmLimitation: z.boolean().optional(),
    backupPath: z.string().optional(),
  })
  .extend(ErrorResponseFields.shape);

const IndexColumnSchema = z.object({
  name: z.string(),
  seqno: z.number(),
});

const IndexStatsEntrySchema = z.object({
  name: z.string(),
  table: z.string(),
  unique: z.boolean(),
  partial: z.boolean(),
  columns: z.array(IndexColumnSchema),
});

export const IndexStatsOutputSchema = z
  .object({
    success: z.boolean(),
    indexes: z.array(IndexStatsEntrySchema).optional(),
  })
  .extend(ErrorResponseFields.shape);

export const PragmaCompileOptionsOutputSchema = z
  .object({
    success: z.boolean(),
    options: z.array(z.string()).optional(),
  })
  .extend(ErrorResponseFields.shape);

const DatabaseListEntrySchema = z.object({
  seq: z.number(),
  name: z.string(),
  file: z.string(),
});

export const PragmaDatabaseListOutputSchema = z
  .object({
    success: z.boolean(),
    databases: z.array(DatabaseListEntrySchema).optional(),
    configuredPath: z.string().optional(),
    note: z.string().optional(),
  })
  .extend(ErrorResponseFields.shape);

export const PragmaOptimizeOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    durationMs: z.number().optional(),
  })
  .extend(ErrorResponseFields.shape);

export const PragmaSettingsOutputSchema = z
  .object({
    success: z.boolean(),
    pragma: z.string().optional(),
    value: z.unknown().optional(),
    oldValue: z.unknown().optional(),
    newValue: z.unknown().optional(),
  })
  .extend(ErrorResponseFields.shape);

const PragmaTableInfoColumnSchema = z.object({
  cid: z.number(),
  name: z.string(),
  type: z.string(),
  notNull: z.boolean(),
  defaultValue: z.unknown().nullable(),
  pk: z.number(),
});

export const PragmaTableInfoOutputSchema = z
  .object({
    success: z.boolean(),
    table: z.string().optional(),
    columns: z.array(PragmaTableInfoColumnSchema).optional(),
  })
  .extend(ErrorResponseFields.shape);

export const AppendInsightOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    insightCount: z.number().optional(),
  })
  .extend(ErrorResponseFields.shape);

// =============================================================================
// Types
// =============================================================================

export type BackupInput = z.infer<typeof BackupSchema>;
export type AnalyzeInput = z.infer<typeof AnalyzeSchema>;
export type IntegrityCheckInput = z.infer<typeof IntegrityCheckSchema>;
export type OptimizeInput = z.infer<typeof OptimizeSchema>;
export type RestoreInput = z.infer<typeof RestoreSchema>;
export type VerifyBackupInput = z.infer<typeof VerifyBackupSchema>;
export type IndexStatsInput = z.infer<typeof IndexStatsSchema>;
export type PragmaOptimizeInput = z.infer<typeof PragmaOptimizeSchema>;
export type PragmaSettingsInput = z.infer<typeof PragmaSettingsSchema>;
export type PragmaTableInfoInput = z.infer<typeof PragmaTableInfoSchema>;
export type PragmaCompileOptionsInput = z.infer<typeof PragmaCompileOptionsSchema>;
export type PragmaDatabaseListInput = z.infer<typeof PragmaDatabaseListSchema>;
export type AppendInsightInput = z.infer<typeof AppendInsightSchema>;
export type VacuumInput = z.infer<typeof VacuumSchema>;
