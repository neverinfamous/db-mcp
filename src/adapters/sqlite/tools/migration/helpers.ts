/**
 * Migration Tracking Schemas
 *
 * Input/output Zod schemas and utility functions for migration tools.
 */

import { createHash } from "node:crypto";
import type { SqliteAdapter } from "../../sqlite-adapter.js";

// =============================================================================
// Constants
// =============================================================================

export const MIGRATIONS_TABLE = "_mcp_migrations";



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
