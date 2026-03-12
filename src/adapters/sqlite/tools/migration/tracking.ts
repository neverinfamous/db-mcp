/**
 * Migration Tracking Tools
 *
 * Schema migration lifecycle management with SHA-256 dedup.
 * These tools write a `_mcp_migrations` table to the user's database.
 * Opt-in via the 'migration' tool group.
 * 6 tools total.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly, write, idempotent } from "../../../../utils/annotations.js";
import { formatHandlerErrorResponse } from "../../../../utils/errors/index.js";
import {
  MIGRATIONS_TABLE,
  MigrationInitSchema,
  MigrationRecordSchema,
  MigrationApplySchema,
  MigrationRollbackSchema,
  MigrationHistorySchema,
  MigrationStatusSchema,
  MigrationInitOutputSchema,
  MigrationRecordOutputSchema,
  MigrationApplyOutputSchema,
  MigrationRollbackOutputSchema,
  MigrationHistoryOutputSchema,
  MigrationStatusOutputSchema,
  hashMigration,
  isMigrationTableInitialized,
  toMigrationRecord,
} from "./schemas.js";

// =============================================================================
// Tool Creators
// =============================================================================


export function createMigrationInitTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_init",
    description:
      "Initialize the migration tracking system by creating the _mcp_migrations table. Safe to call multiple times — idempotent.",
    group: "migration",
    inputSchema: MigrationInitSchema,
    outputSchema: MigrationInitOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Migration Init"),
    handler: async (params: unknown, _context: RequestContext) => {
      MigrationInitSchema.parse(params);

      try {
        const exists = await isMigrationTableInitialized(adapter);

        if (!exists) {
          await adapter.executeQuery(
            `CREATE TABLE "${MIGRATIONS_TABLE}" (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              version TEXT NOT NULL,
              description TEXT,
              migration_sql TEXT NOT NULL,
              rollback_sql TEXT,
              migration_hash TEXT NOT NULL,
              source_system TEXT DEFAULT 'manual',
              applied_by TEXT,
              applied_at TEXT NOT NULL DEFAULT (datetime('now')),
              status TEXT NOT NULL DEFAULT 'applied',
              rolled_back_at TEXT
            )`,
          );

          return {
            success: true,
            tableCreated: true,
            tableName: MIGRATIONS_TABLE,
            existingRecords: 0,
          };
        }

        const countResult = await adapter.executeReadQuery(
          `SELECT COUNT(*) as cnt FROM "${MIGRATIONS_TABLE}"`,
        );
        const count =
          (countResult.rows?.[0]?.["cnt"] as number | undefined) ?? 0;

        return {
          success: true,
          tableCreated: false,
          tableName: MIGRATIONS_TABLE,
          existingRecords: count,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createMigrationRecordTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_record",
    description:
      "Record a migration that was applied externally (not executed by this tool). Uses SHA-256 hashing for dedup — duplicate SQL blocks are rejected.",
    group: "migration",
    inputSchema: MigrationRecordSchema,
    outputSchema: MigrationRecordOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Migration Record"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = MigrationRecordSchema.parse(params);
        if (!(await isMigrationTableInitialized(adapter))) {
          return {
            success: false,
            error:
              "Migration tracking not initialized. Run sqlite_migration_init first.",
          };
        }

        const hash = hashMigration(input.migrationSql);

        // Check for duplicate hash
        const dupCheck = await adapter.executeReadQuery(
          `SELECT id, version FROM "${MIGRATIONS_TABLE}" WHERE migration_hash = ?`,
          [hash],
        );
        if ((dupCheck.rows?.length ?? 0) > 0) {
          const existing = dupCheck.rows?.[0];
          return {
            success: false,
            error: `Duplicate migration: SQL matches existing migration #${String(existing?.["id"])} (version: ${String(existing?.["version"])})`,
          };
        }

        await adapter.executeQuery(
          `INSERT INTO "${MIGRATIONS_TABLE}" (version, description, migration_sql, rollback_sql, migration_hash, source_system, applied_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            input.version,
            input.description ?? null,
            input.migrationSql,
            input.rollbackSql ?? null,
            hash,
            input.sourceSystem ?? "manual",
            input.appliedBy ?? null,
          ],
        );

        // Fetch the inserted record
        const result = await adapter.executeReadQuery(
          `SELECT id, version, description, applied_at, applied_by, migration_hash, source_system, status
           FROM "${MIGRATIONS_TABLE}" WHERE migration_hash = ?`,
          [hash],
        );
        const record = result.rows?.[0];

        return {
          success: true,
          record: record ? toMigrationRecord(record) : undefined,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createMigrationApplyTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_apply",
    description:
      "Execute migration SQL and record it atomically. If the SQL fails, no record is created. Uses SHA-256 hashing for dedup.",
    group: "migration",
    inputSchema: MigrationApplySchema,
    outputSchema: MigrationApplyOutputSchema,
    requiredScopes: ["admin"],
    annotations: write("Migration Apply"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = MigrationApplySchema.parse(params);
        if (!(await isMigrationTableInitialized(adapter))) {
          return {
            success: false,
            error:
              "Migration tracking not initialized. Run sqlite_migration_init first.",
          };
        }

        const hash = hashMigration(input.migrationSql);

        // Check for duplicate hash
        const dupCheck = await adapter.executeReadQuery(
          `SELECT id, version FROM "${MIGRATIONS_TABLE}" WHERE migration_hash = ?`,
          [hash],
        );
        if ((dupCheck.rows?.length ?? 0) > 0) {
          const existing = dupCheck.rows?.[0];
          return {
            success: false,
            error: `Duplicate migration: SQL matches existing migration #${String(existing?.["id"])} (version: ${String(existing?.["version"])})`,
          };
        }

        // Execute the migration SQL
        try {
          await adapter.executeQuery(input.migrationSql);
        } catch (execError) {
          // Record as failed
          await adapter.executeQuery(
            `INSERT INTO "${MIGRATIONS_TABLE}" (version, description, migration_sql, rollback_sql, migration_hash, source_system, applied_by, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'failed')`,
            [
              input.version,
              input.description ?? null,
              input.migrationSql,
              input.rollbackSql ?? null,
              hash,
              input.sourceSystem ?? "agent",
              input.appliedBy ?? null,
            ],
          );
          const structured = formatHandlerErrorResponse(execError);
          return {
            success: false,
            error: `Migration execution failed: ${structured.error}`,
          };
        }

        // Record successful migration
        await adapter.executeQuery(
          `INSERT INTO "${MIGRATIONS_TABLE}" (version, description, migration_sql, rollback_sql, migration_hash, source_system, applied_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            input.version,
            input.description ?? null,
            input.migrationSql,
            input.rollbackSql ?? null,
            hash,
            input.sourceSystem ?? "agent",
            input.appliedBy ?? null,
          ],
        );

        // Fetch the inserted record
        const result = await adapter.executeReadQuery(
          `SELECT id, version, description, applied_at, applied_by, migration_hash, source_system, status
           FROM "${MIGRATIONS_TABLE}" WHERE migration_hash = ?`,
          [hash],
        );
        const record = result.rows?.[0];

        return {
          success: true,
          record: record ? toMigrationRecord(record) : undefined,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createMigrationRollbackTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_rollback",
    description:
      "Roll back a migration by ID or version. Requires that rollback SQL was recorded with the migration. Supports dry-run mode to preview the rollback SQL without executing.",
    group: "migration",
    inputSchema: MigrationRollbackSchema,
    outputSchema: MigrationRollbackOutputSchema,
    requiredScopes: ["admin"],
    annotations: write("Migration Rollback"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = MigrationRollbackSchema.parse(params);

      try {
        if (!(await isMigrationTableInitialized(adapter))) {
          return {
            success: false,
            error:
              "Migration tracking not initialized. Run sqlite_migration_init first.",
          };
        }

        if (input.id === undefined && input.version === undefined) {
          return {
            success: false,
            error: "Either 'id' or 'version' must be provided",
          };
        }

        // Find the migration
        let query: string;
        let queryParams: unknown[];
        if (input.id !== undefined) {
          query = `SELECT * FROM "${MIGRATIONS_TABLE}" WHERE id = ?`;
          queryParams = [input.id];
        } else {
          query = `SELECT * FROM "${MIGRATIONS_TABLE}" WHERE version = ? ORDER BY id DESC LIMIT 1`;
          queryParams = [input.version];
        }

        const result = await adapter.executeReadQuery(query, queryParams);
        if ((result.rows?.length ?? 0) === 0) {
          return {
            success: false,
            error: `Migration not found: ${input.id !== undefined ? `id=${input.id}` : `version=${input.version}`}`,
          };
        }

        const migration = result.rows?.[0];
        if (!migration) {
          return { success: false, error: "Migration record not found" };
        }
        const rollbackSql = migration["rollback_sql"] as string | null;

        if (!rollbackSql) {
          return {
            success: false,
            rollbackSql: null,
            error: "No rollback SQL recorded for this migration",
          };
        }

        if (input.dryRun) {
          return {
            success: true,
            dryRun: true,
            rollbackSql,
          };
        }

        // Execute rollback
        await adapter.executeQuery(rollbackSql);

        // Update status
        await adapter.executeQuery(
          `UPDATE "${MIGRATIONS_TABLE}" SET status = 'rolled_back', rolled_back_at = datetime('now') WHERE id = ?`,
          [migration["id"]],
        );

        // Fetch updated record
        const updated = await adapter.executeReadQuery(
          `SELECT id, version, description, applied_at, applied_by, migration_hash, source_system, status
           FROM "${MIGRATIONS_TABLE}" WHERE id = ?`,
          [migration["id"]],
        );
        const record = updated.rows?.[0];

        return {
          success: true,
          dryRun: false,
          rollbackSql,
          record: record ? toMigrationRecord(record) : undefined,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createMigrationHistoryTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_history",
    description:
      "Query migration history with optional filters by status and source system. Supports pagination.",
    group: "migration",
    inputSchema: MigrationHistorySchema,
    outputSchema: MigrationHistoryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Migration History"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = MigrationHistorySchema.parse(params);

      try {
        if (!(await isMigrationTableInitialized(adapter))) {
          return {
            success: false,
            error:
              "Migration tracking not initialized. Run sqlite_migration_init first.",
          };
        }

        const limit = input.limit ?? 50;
        const offset = input.offset ?? 0;

        let query = `SELECT id, version, description, applied_at, applied_by, migration_hash, source_system, status FROM "${MIGRATIONS_TABLE}"`;
        const conditions: string[] = [];
        const queryParams: unknown[] = [];

        if (input.status) {
          conditions.push("status = ?");
          queryParams.push(input.status);
        }
        if (input.sourceSystem) {
          conditions.push("source_system = ?");
          queryParams.push(input.sourceSystem);
        }

        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(" AND ")}`;
        }

        // Total count
        const countQuery = query.replace(
          /SELECT .* FROM/,
          "SELECT COUNT(*) as cnt FROM",
        );
        const countResult = await adapter.executeReadQuery(
          countQuery,
          queryParams,
        );
        const total =
          (countResult.rows?.[0]?.["cnt"] as number | undefined) ?? 0;

        // Paginated results
        query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);
        const result = await adapter.executeReadQuery(query, queryParams);

        const records = (result.rows ?? []).map(toMigrationRecord);

        const outputRecords = input.compact
          ? records.map(
              ({ migrationHash: _h, sourceSystem: _s, ...rest }) => rest,
            )
          : records;

        return {
          success: true,
          records: outputRecords,
          total,
          limit,
          offset,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createMigrationStatusTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_status",
    description:
      "Get a summary of migration tracking state — latest version, counts by status, and unique source systems.",
    group: "migration",
    inputSchema: MigrationStatusSchema,
    outputSchema: MigrationStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Migration Status"),
    handler: async (params: unknown, _context: RequestContext) => {
      MigrationStatusSchema.parse(params);

      try {
        const initialized = await isMigrationTableInitialized(adapter);

        if (!initialized) {
          return {
            success: true,
            initialized: false,
            latestVersion: null,
            latestAppliedAt: null,
            counts: { total: 0, applied: 0, rolledBack: 0, failed: 0 },
            sourceSystems: [],
          };
        }

        // Latest migration
        const latestResult = await adapter.executeReadQuery(
          `SELECT version, applied_at FROM "${MIGRATIONS_TABLE}" WHERE status = 'applied' ORDER BY id DESC LIMIT 1`,
        );
        const latest = latestResult.rows?.[0];

        // Counts by status
        const countsResult = await adapter.executeReadQuery(
          `SELECT status, COUNT(*) as cnt FROM "${MIGRATIONS_TABLE}" GROUP BY status`,
        );
        const counts = { total: 0, applied: 0, rolledBack: 0, failed: 0 };
        for (const row of countsResult.rows ?? []) {
          const status = row["status"] as string;
          const cnt = row["cnt"] as number;
          counts.total += cnt;
          if (status === "applied") counts.applied = cnt;
          else if (status === "rolled_back") counts.rolledBack = cnt;
          else if (status === "failed") counts.failed = cnt;
        }

        // Unique source systems
        const systemsResult = await adapter.executeReadQuery(
          `SELECT DISTINCT source_system FROM "${MIGRATIONS_TABLE}" WHERE source_system IS NOT NULL ORDER BY source_system`,
        );
        const sourceSystems = (systemsResult.rows ?? []).map(
          (r) => r["source_system"] as string,
        );

        return {
          success: true,
          initialized: true,
          latestVersion: (latest?.["version"] as string) ?? null,
          latestAppliedAt: (latest?.["applied_at"] as string) ?? null,
          counts,
          sourceSystems,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
