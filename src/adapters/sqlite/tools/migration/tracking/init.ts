import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { idempotent } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import {
  MIGRATIONS_TABLE,
  MigrationInitSchema,
  MigrationInitOutputSchema,
  isMigrationTableInitialized,
} from "../schemas.js";

export function createMigrationInitTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_init",
    description:
      "Initialize the migration tracking system by creating the _mcp_migrations table. Safe to call multiple times \u2014 idempotent.",
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
        return formatHandlerError(error);
      }
    },
  };
}
