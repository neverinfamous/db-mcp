import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { admin } from "../../../../../utils/annotations.js";
import { formatHandlerErrorResponse } from "../../../../../utils/errors/index.js";
import { sanitizeIdentifier } from "../../../../../utils/index.js";
import { AnalyzeOutputSchema } from "../../../output-schemas/index.js";
import { AnalyzeSchema } from "../helpers.js";

/**
 * Analyze tables for query optimization
 */
export function createAnalyzeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_analyze",
    description: "Analyze table statistics to improve query performance.",
    group: "admin",
    inputSchema: AnalyzeSchema,
    outputSchema: AnalyzeOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Analyze Tables"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = AnalyzeSchema.parse(params);

        let sql: string;
        if (input.table) {
          const table = sanitizeIdentifier(input.table);
          sql = `ANALYZE ${table}`;
        } else {
          sql = "ANALYZE";
        }

        const start = Date.now();
        await adapter.executeQuery(sql);
        const duration = Date.now() - start;

        return {
          success: true,
          message: input.table
            ? `Table '${input.table}' analyzed`
            : "All tables analyzed",
          durationMs: duration,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
