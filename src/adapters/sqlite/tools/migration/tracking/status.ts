import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import {
  MIGRATIONS_TABLE,
  MigrationStatusSchema,
  MigrationStatusOutputSchema,
  isMigrationTableInitialized,
} from "../schemas.js";

export function createMigrationStatusTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_status",
    description:
      "Get a summary of migration tracking state \u2014 latest version, counts by status, and unique source systems.",
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
            counts: {
              total: 0,
              applied: 0,
              recorded: 0,
              rolledBack: 0,
              failed: 0,
            },
            sourceSystems: [],
          };
        }

        const latestResult = await adapter.executeReadQuery(
          `SELECT version, applied_at FROM "${MIGRATIONS_TABLE}" WHERE status = 'applied' ORDER BY id DESC LIMIT 1`,
        );
        const latest = latestResult.rows?.[0];

        const countsResult = await adapter.executeReadQuery(
          `SELECT status, COUNT(*) as cnt FROM "${MIGRATIONS_TABLE}" GROUP BY status`,
        );
        const counts = {
          total: 0,
          applied: 0,
          recorded: 0,
          rolledBack: 0,
          failed: 0,
        };
        for (const row of countsResult.rows ?? []) {
          const status = row["status"] as string;
          const cnt = row["cnt"] as number;
          counts.total += cnt;
          if (status === "applied") counts.applied = cnt;
          else if (status === "recorded") counts.recorded = cnt;
          else if (status === "rolled_back") counts.rolledBack = cnt;
          else if (status === "failed") counts.failed = cnt;
        }

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
        return formatHandlerError(error);
      }
    },
  };
}
