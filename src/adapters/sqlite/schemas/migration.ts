/**
 * Migration Tool Output Schemas
 */

import { z } from "zod";
import { ErrorFieldsMixin } from "./error-mixin.js";

const coerceNumber = (val: unknown): unknown => {
  if (typeof val === "string") {
    if (val.trim() === "") return undefined;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }
  return val;
};

/**
 * Migration record entry (shared sub-schema)
 */
export const MigrationRecordEntry = z.object({
  id: z.number(),
  version: z.string(),
  description: z.string().nullable(),
  appliedAt: z.string(),
  appliedBy: z.string().nullable(),
  migrationHash: z.string(),
  sourceSystem: z.string().nullable(),
  status: z.string(),
});

/**
 * sqlite_migration_init output
 */
export const MigrationInitOutputSchema = z
  .object({
    success: z.boolean(),
    tableCreated: z.boolean().optional(),
    tableName: z.string().optional(),
    existingRecords: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_migration_record output
 */
export const MigrationRecordOutputSchema = z
  .object({
    success: z.boolean(),
    record: MigrationRecordEntry.optional(),
    warning: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_migration_apply output
 */
export const MigrationApplyOutputSchema = z
  .object({
    success: z.boolean(),
    record: MigrationRecordEntry.optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_migration_rollback output
 */
export const MigrationRollbackOutputSchema = z
  .object({
    success: z.boolean(),
    dryRun: z.boolean().optional(),
    rollbackSql: z.string().nullable().optional(),
    warning: z.string().optional(),
    record: MigrationRecordEntry.optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_migration_history output
 */
export const MigrationHistoryOutputSchema = z
  .object({
    success: z.boolean(),
    records: z.array(MigrationRecordEntry).optional(),
    total: z.number().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_migration_status output
 */
export const MigrationStatusOutputSchema = z
  .object({
    success: z.boolean(),
    initialized: z.boolean().optional(),
    latestVersion: z.string().nullable().optional(),
    latestAppliedAt: z.string().nullable().optional(),
    counts: z
      .object({
        total: z.number(),
        applied: z.number(),
        recorded: z.number(),
        rolledBack: z.number(),
        failed: z.number(),
      })
      .optional(),
    sourceSystems: z.array(z.string()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Input Schemas
// =============================================================================

export const MigrationInitSchema = z.object({}).default({});

export const MigrationRecordSchema = z.object({
  version: z
    .string()
    .describe("Version identifier (e.g., '1.0.0', '2024-01-15-add-users')"),
  description: z
    .string()
    .optional()
    .describe("Human-readable description of the migration"),
  migrationSql: z
    .string()
    .optional()
    .describe("The DDL/SQL statements applied"),
  sql: z
    .string()
    .optional()
    .describe("The DDL/SQL statements applied (alias for migrationSql)"),
  rollbackSql: z.string().optional().describe("SQL to reverse this migration"),
  sourceSystem: z
    .string()
    .optional()
    .describe("Origin system (e.g., 'manual', 'agent', 'prisma')"),
  appliedBy: z
    .string()
    .optional()
    .describe("Who/what applied this migration (e.g., agent name, user)"),
});

export const MigrationRecordValidationSchema =
  MigrationRecordSchema.superRefine((data, ctx) => {
    if (!/^[a-zA-Z0-9_.-]+$/.test(data.version)) {
      ctx.addIssue({
        code: "custom",
        path: ["version"],
        message:
          "Version must contain only alphanumeric characters, dots, dashes, or underscores",
      });
    }
    if (!data.migrationSql && !data.sql) {
      ctx.addIssue({
        code: "custom",
        path: ["sql"],
        message: "Either sql or migrationSql must be provided",
      });
    }
  });

export const MigrationApplySchema = MigrationRecordSchema;

export const MigrationApplyValidationSchema = MigrationRecordValidationSchema;

export const MigrationRollbackSchema = z.object({
  id: z.preprocess(
    coerceNumber,
    z.union([z.number(), z.string()]).refine(v => v === undefined || typeof v === 'number', { message: "Expected number, received string" }).optional().describe("Migration ID to roll back"),
  ),
  version: z
    .string()
    .optional()
    .describe("Migration version to roll back (alternative to id)"),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      "If true, return the rollback SQL without executing (default: false)",
    ),
});

export const MigrationRollbackValidationSchema =
  MigrationRollbackSchema.superRefine((data, ctx) => {
    if (data.id === undefined && data.version === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["version"],
        message: "Either id or version must be provided",
      });
    }
    if (data.version !== undefined && !/^[a-zA-Z0-9_.-]+$/.test(data.version)) {
      ctx.addIssue({
        code: "custom",
        path: ["version"],
        message:
          "Version must contain only alphanumeric characters, dots, dashes, or underscores",
      });
    }
  });

export const MigrationHistorySchema = z
  .object({
    status: z
      .enum(["applied", "recorded", "rolled_back", "failed"])
      .optional()
      .describe("Filter by status"),
    sourceSystem: z.string().optional().describe("Filter by source system"),
    limit: z.preprocess(
      coerceNumber,
      z.union([z.number(), z.string()]).refine(v => v === undefined || typeof v === 'number', { message: "Expected number, received string" }).optional().describe("Maximum records to return (default: 50)"),
    ),
    offset: z.preprocess(
      coerceNumber,
      z.union([z.number(), z.string()]).refine(v => v === undefined || typeof v === 'number', { message: "Expected number, received string" }).optional().describe("Offset for pagination (default: 0)"),
    ),
    compact: z
      .boolean()
      .optional()
      .describe(
        "Omit migrationHash and sourceSystem from records to reduce payload (default: false)",
      ),
  })
  .default({});

export const MigrationStatusSchema = z.object({}).default({});

// =============================================================================
// Types
// =============================================================================

export type MigrationInitInput = z.infer<typeof MigrationInitSchema>;
export type MigrationRecordInput = z.infer<typeof MigrationRecordSchema>;
export type MigrationRecordValidationInput = z.infer<
  typeof MigrationRecordValidationSchema
>;
export type MigrationApplyInput = z.infer<typeof MigrationApplySchema>;
export type MigrationApplyValidationInput = z.infer<
  typeof MigrationApplyValidationSchema
>;
export type MigrationRollbackInput = z.infer<typeof MigrationRollbackSchema>;
export type MigrationRollbackValidationInput = z.infer<
  typeof MigrationRollbackValidationSchema
>;
export type MigrationHistoryInput = z.infer<typeof MigrationHistorySchema>;
export type MigrationStatusInput = z.infer<typeof MigrationStatusSchema>;
