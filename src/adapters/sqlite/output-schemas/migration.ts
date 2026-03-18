/**
 * Migration Tool Output Schemas
 */

import { z } from "zod";
import { ErrorFieldsMixin } from "./error-mixin.js";

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
