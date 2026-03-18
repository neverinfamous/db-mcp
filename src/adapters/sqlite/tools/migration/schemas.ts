/**
 * Migration Tracking Schemas
 *
 * Input/output Zod schemas and utility functions for migration tools.
 */

import { z } from "zod";
import { createHash } from "node:crypto";
import type { SqliteAdapter } from "../../sqlite-adapter.js";

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

export const MigrationApplySchema = MigrationRecordSchema;

export const MigrationRollbackSchema = z.object({
  id: z.preprocess(
    (val) => (typeof val === "number" ? val : undefined),
    z.number().optional().describe("Migration ID to roll back"),
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

export const MigrationHistorySchema = z
  .object({
    status: z
      .enum(["applied", "rolled_back", "failed"])
      .optional()
      .describe("Filter by status"),
    sourceSystem: z.string().optional().describe("Filter by source system"),
    limit: z.preprocess(
      (val) => (typeof val === "number" ? val : undefined),
      z.number().optional().describe("Maximum records to return (default: 50)"),
    ),
    offset: z.preprocess(
      (val) => (typeof val === "number" ? val : undefined),
      z.number().optional().describe("Offset for pagination (default: 0)"),
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
// Output Schemas (re-exported from centralized output-schemas/)
// =============================================================================

export {
  MigrationRecordEntry,
  MigrationInitOutputSchema,
  MigrationRecordOutputSchema,
  MigrationApplyOutputSchema,
  MigrationRollbackOutputSchema,
  MigrationHistoryOutputSchema,
  MigrationStatusOutputSchema,
} from "../../output-schemas/migration.js";

// =============================================================================
// Utilities
// =============================================================================

/**
 * Map a raw SQLite row to a typed migration record.
 * Shared by record, apply, rollback, and history tools.
 */
export function toMigrationRecord(row: Record<string, unknown>): {
  id: number;
  version: string;
  description: string | null;
  appliedAt: string;
  appliedBy: string | null;
  migrationHash: string;
  sourceSystem: string | null;
  status: string;
} {
  return {
    id: row["id"] as number,
    version: row["version"] as string,
    description: (row["description"] as string) ?? null,
    appliedAt: row["applied_at"] as string,
    appliedBy: (row["applied_by"] as string) ?? null,
    migrationHash: row["migration_hash"] as string,
    sourceSystem: (row["source_system"] as string) ?? null,
    status: row["status"] as string,
  };
}

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
