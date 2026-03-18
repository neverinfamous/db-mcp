import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { write } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import {
  MIGRATIONS_TABLE,
  MigrationRecordSchema,
  MigrationRecordOutputSchema,
  hashMigration,
  isMigrationTableInitialized,
  toMigrationRecord,
} from "../schemas.js";

export function createMigrationRecordTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_record",
    description:
      "Record a migration that was applied externally (not executed by this tool). Uses SHA-256 hashing for dedup \u2014 duplicate SQL blocks are rejected.",
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
            code: "MIGRATION_NOT_INITIALIZED",
          };
        }

        const hash = hashMigration(input.migrationSql);

        const dupCheck = await adapter.executeReadQuery(
          `SELECT id, version FROM "${MIGRATIONS_TABLE}" WHERE migration_hash = ?`,
          [hash],
        );
        if ((dupCheck.rows?.length ?? 0) > 0) {
          const existing = dupCheck.rows?.[0];
          return {
            success: false,
            error: `Duplicate migration: SQL matches existing migration #${String(existing?.["id"])} (version: ${String(existing?.["version"])})`,
            code: "DUPLICATE_MIGRATION",
          };
        }

        // Block duplicate version names to prevent rollback ambiguity
        const versionCheck = await adapter.executeReadQuery(
          `SELECT id, status FROM "${MIGRATIONS_TABLE}" WHERE version = ?`,
          [input.version],
        );
        if ((versionCheck.rows?.length ?? 0) > 0) {
          const existing = versionCheck.rows?.[0];
          return {
            success: false,
            error: `Duplicate version: '${input.version}' already exists (id=${String(existing?.["id"])}, status=${String(existing?.["status"])}). Use a unique version identifier.`,
            code: "DUPLICATE_VERSION",
          };
        }

        await adapter.executeQuery(
          `INSERT INTO "${MIGRATIONS_TABLE}" (version, description, migration_sql, rollback_sql, migration_hash, source_system, applied_by, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'recorded')`,
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

        const result = await adapter.executeReadQuery(
          `SELECT id, version, description, applied_at, applied_by, migration_hash, source_system, status
           FROM "${MIGRATIONS_TABLE}" WHERE version = ?`,
          [input.version],
        );
        const record = result.rows?.[0];

        return {
          success: true,
          record: record ? toMigrationRecord(record) : undefined,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
