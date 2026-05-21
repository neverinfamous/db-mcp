import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { write } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import {
  MigrationApplySchema,
  MigrationApplyValidationSchema,
  MigrationApplyOutputSchema,
} from "../../../schemas/migration.js";
import {
  MIGRATIONS_TABLE,
  hashMigration,
  isMigrationTableInitialized,
  toMigrationRecord,
} from "../helpers.js";
import {
  sendProgress,
  buildProgressContext,
} from "../../../../../utils/progress-utils.js";

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
        const input = MigrationApplyValidationSchema.parse(params);

        if (!(await isMigrationTableInitialized(adapter))) {
          return {
            success: false,
            error:
              "Migration tracking not initialized. Run sqlite_migration_init first.",
            code: "MIGRATION_NOT_INITIALIZED",
          };
        }

        const actualSql = input.migrationSql ?? input.sql ?? "";
        const hash = hashMigration(actualSql);

        const dupCheck = await adapter.executeReadQuery(
          `SELECT id, version, status FROM "${MIGRATIONS_TABLE}" WHERE migration_hash = ? AND status = 'applied'`,
          [hash],
        );
        if ((dupCheck.rows?.length ?? 0) > 0) {
          const existing = dupCheck.rows?.[0];
          return {
            success: false,
            error: `Duplicate migration: SQL matches existing applied migration #${String(existing?.["id"])} (version: ${String(existing?.["version"])})`,
            code: "DUPLICATE_MIGRATION",
          };
        }

        // Block duplicate version names to prevent rollback ambiguity, UNLESS it's just 'recorded' or 'failed'
        const versionCheck = await adapter.executeReadQuery(
          `SELECT id, status FROM "${MIGRATIONS_TABLE}" WHERE version = ?`,
          [input.version],
        );
        let existingId: number | undefined = undefined;

        if ((versionCheck.rows?.length ?? 0) > 0) {
          const existing = versionCheck.rows?.[0];
          if (existing?.["status"] === "applied") {
            return {
              success: false,
              error: `Duplicate version: '${input.version}' already exists (id=${String(existing?.["id"])}, status=${existing?.["status"] as string}). Use a unique version identifier.`,
              code: "DUPLICATE_VERSION",
            };
          }
          existingId = existing?.["id"] as number;
        }

        try {
          const progress = buildProgressContext(_context);
          await sendProgress(
            progress,
            1,
            2,
            `Applying migration ${input.version}...`,
          );
          await adapter.executeQuery(actualSql);
          await sendProgress(progress, 2, 2, `Migration applied successfully`);
        } catch (execError) {
          if (existingId !== undefined) {
            await adapter.executeQuery(
              `UPDATE "${MIGRATIONS_TABLE}" SET migration_sql = ?, rollback_sql = ?, migration_hash = ?, source_system = ?, applied_by = ?, status = 'failed', applied_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [
                actualSql,
                input.rollbackSql ?? null,
                hash,
                input.sourceSystem ?? "agent",
                input.appliedBy ?? null,
                existingId,
              ],
            );
          } else {
            await adapter.executeQuery(
              `INSERT INTO "${MIGRATIONS_TABLE}" (version, description, migration_sql, rollback_sql, migration_hash, source_system, applied_by, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'failed')`,
              [
                input.version,
                input.description ?? null,
                actualSql,
                input.rollbackSql ?? null,
                hash,
                input.sourceSystem ?? "agent",
                input.appliedBy ?? null,
              ],
            );
          }
          const structured = formatHandlerError(execError);
          return {
            success: false,
            error: `Migration execution failed: ${structured.error}`,
            code: "MIGRATION_EXECUTION_FAILED",
          };
        }

        if (existingId !== undefined) {
          await adapter.executeQuery(
            `UPDATE "${MIGRATIONS_TABLE}" SET migration_sql = ?, rollback_sql = ?, migration_hash = ?, source_system = ?, applied_by = ?, status = 'applied', applied_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [
              actualSql,
              input.rollbackSql ?? null,
              hash,
              input.sourceSystem ?? "agent",
              input.appliedBy ?? null,
              existingId,
            ],
          );
        } else {
          await adapter.executeQuery(
            `INSERT INTO "${MIGRATIONS_TABLE}" (version, description, migration_sql, rollback_sql, migration_hash, source_system, applied_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              input.version,
              input.description ?? null,
              actualSql,
              input.rollbackSql ?? null,
              hash,
              input.sourceSystem ?? "agent",
              input.appliedBy ?? null,
            ],
          );
        }

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
