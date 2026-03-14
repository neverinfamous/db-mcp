import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { write } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import {
  MIGRATIONS_TABLE,
  MigrationRollbackSchema,
  MigrationRollbackOutputSchema,
  isMigrationTableInitialized,
  toMigrationRecord,
} from "../schemas.js";

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

        await adapter.executeQuery(rollbackSql);

        await adapter.executeQuery(
          `UPDATE "${MIGRATIONS_TABLE}" SET status = 'rolled_back', rolled_back_at = datetime('now') WHERE id = ?`,
          [migration["id"]],
        );

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
        return formatHandlerError(error);
      }
    },
  };
}
