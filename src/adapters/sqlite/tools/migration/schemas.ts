/**
 * Migration Tracking Schemas
 *
 * Input/output Zod schemas and utility functions for migration tools.
 */

import { z } from "zod";
import { createHash } from "node:crypto";
import type { SqliteAdapter } from "../../SqliteAdapter.js";

// =============================================================================
// Constants
// =============================================================================

export const MIGRATIONS_TABLE = "_mcp_migrations";

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
  migrationSql: z.string().describe("The DDL/SQL statements applied"),
  rollbackSql: z
    .string()
    .optional()
    .describe("SQL to reverse this migration"),
  sourceSystem: z
    .string()
    .optional()
    .describe("Origin system (e.g., 'manual', 'agent', 'prisma')"),
  appliedBy: z
    .string()
    .optional()
    .describe("Who/what applied this migration (e.g., agent name, user)"),
});

export const MigrationApplySchema = MigrationRecordSchema;

export const MigrationRollbackSchema = z.object({
  id: z.coerce.number().optional().describe("Migration ID to roll back"),
  version: z
    .string()
    .optional()
    .describe("Migration version to roll back (alternative to id)"),
  dryRun: z
    .boolean()
    .optional()
    .describe("If true, return the rollback SQL without executing (default: false)"),
});

export const MigrationHistorySchema = z
  .object({
    status: z
      .enum(["applied", "rolled_back", "failed"])
      .optional()
      .describe("Filter by status"),
    sourceSystem: z
      .string()
      .optional()
      .describe("Filter by source system"),
    limit: z.coerce
      .number()
      .optional()
      .describe("Maximum records to return (default: 50)"),
    offset: z.coerce
      .number()
      .optional()
      .describe("Offset for pagination (default: 0)"),
  })
  .default({});

export const MigrationStatusSchema = z.object({}).default({});

// =============================================================================
// Output Schemas
// =============================================================================

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

export const MigrationInitOutputSchema = z.object({
  success: z.boolean(),
  tableCreated: z.boolean().optional(),
  tableName: z.string().optional(),
  existingRecords: z.number().optional(),
  error: z.string().optional(),
});

export const MigrationRecordOutputSchema = z.object({
  success: z.boolean(),
  record: MigrationRecordEntry.optional(),
  error: z.string().optional(),
});

export const MigrationApplyOutputSchema = z.object({
  success: z.boolean(),
  record: MigrationRecordEntry.optional(),
  error: z.string().optional(),
});

export const MigrationRollbackOutputSchema = z.object({
  success: z.boolean(),
  dryRun: z.boolean().optional(),
  rollbackSql: z.string().nullable().optional(),
  record: MigrationRecordEntry.optional(),
  error: z.string().optional(),
});

export const MigrationHistoryOutputSchema = z.object({
  success: z.boolean(),
  records: z.array(MigrationRecordEntry).optional(),
  total: z.number().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  error: z.string().optional(),
});

export const MigrationStatusOutputSchema = z.object({
  success: z.boolean(),
  initialized: z.boolean().optional(),
  latestVersion: z.string().nullable().optional(),
  latestAppliedAt: z.string().nullable().optional(),
  counts: z
    .object({
      total: z.number(),
      applied: z.number(),
      rolledBack: z.number(),
      failed: z.number(),
    })
    .optional(),
  sourceSystems: z.array(z.string()).optional(),
  error: z.string().optional(),
});

// =============================================================================
// Utilities
// =============================================================================

/**
 * Hash migration SQL for dedup using SHA-256
 */
export function hashMigration(sql: string): string {
  return createHash("sha256").update(sql.trim()).digest("hex");
}

/**
 * Check if the migrations tracking table exists
 */
export async function isMigrationTableInitialized(
  adapter: SqliteAdapter,
): Promise<boolean> {
  const result = await adapter.executeReadQuery(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`,
    [MIGRATIONS_TABLE],
  );
  return (result.rows?.length ?? 0) > 0;
}
