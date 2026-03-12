import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatHandlerErrorResponse } from "../../../../../utils/errors/index.js";
import {
  MIGRATIONS_TABLE,
  MigrationHistorySchema,
  MigrationHistoryOutputSchema,
  isMigrationTableInitialized,
  toMigrationRecord,
} from "../schemas.js";

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
