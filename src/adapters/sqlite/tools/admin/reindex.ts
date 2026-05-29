/**
 * REINDEX Tool
 *
 * Rebuild indexes to fix corruption or update after collation changes.
 * Supports targeting specific indexes, tables, or the entire database.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { admin } from "../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { ReindexSchema, ReindexOutputSchema } from "../../schemas/admin.js";

export function createReindexTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_reindex",
    description:
      "Rebuild indexes to fix corruption or update after collation changes. Targets a specific index, all indexes on a table, or all indexes in the database. Use after sqlite_integrity_check reports index issues.",
    group: "admin",
    inputSchema: ReindexSchema,
    outputSchema: ReindexOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Reindex"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = ReindexSchema.parse(params);
        const start = Date.now();

        let sql: string;
        if (input.target) {
          // Validate target is alphanumeric/underscore (prevent injection)
          if (!/^[a-zA-Z_]\w*$/.test(input.target)) {
            return {
              success: false,
              error: `Invalid target '${input.target}': must be a valid identifier`,
              code: "VALIDATION_ERROR",
              sql: "",
            };
          }
          sql = `REINDEX "${input.target.replace(/"/g, '""')}"`;
        } else {
          sql = "REINDEX";
        }

        await adapter.executeQuery(sql);
        const durationMs = Date.now() - start;

        return {
          success: true,
          message: input.target
            ? `Reindexed '${input.target}' successfully`
            : "Reindexed entire database successfully",
          sql,
          durationMs,
        };
      } catch (error: unknown) {
        return { ...formatHandlerError(error), sql: "" };
      }
    },
  };
}
