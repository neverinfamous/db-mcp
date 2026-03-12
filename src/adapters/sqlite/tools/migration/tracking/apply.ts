import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { write } from "../../../../../utils/annotations.js";
import { formatHandlerErrorResponse } from "../../../../../utils/errors/index.js";
import {
  MIGRATIONS_TABLE,
  MigrationApplySchema,
  MigrationApplyOutputSchema,
  hashMigration,
  isMigrationTableInitialized,
  toMigrationRecord,
} from "../schemas.js";

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

        try {
          await adapter.executeQuery(input.migrationSql);
        } catch (execError) {
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
