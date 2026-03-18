import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { admin } from "../../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../../utils/index.js";
import {
  buildProgressContext,
  sendProgress,
} from "../../../../../utils/progress-utils.js";
import { OptimizeOutputSchema } from "../../../output-schemas/index.js";
import { OptimizeSchema } from "../helpers.js";

/**
 * Optimize database
 */
export function createOptimizeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_optimize",
    description: "Optimize database by reindexing and/or analyzing.",
    group: "admin",
    inputSchema: OptimizeSchema,
    outputSchema: OptimizeOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Optimize Database"),
    handler: async (params: unknown, context: RequestContext) => {
      const input = OptimizeSchema.parse(params);
      const progress = buildProgressContext(context);

      const totalSteps =
        1 + (input.reindex ? 1 : 0) + (input.analyze ? 1 : 0) + 1;
      let step = 0;

      const operations: string[] = [];
      const start = Date.now();

      await sendProgress(
        progress,
        ++step,
        totalSteps,
        "Starting optimization...",
      );

      if (input.reindex) {
        await sendProgress(progress, ++step, totalSteps, "Reindexing...");
        if (input.table) {
          const table = sanitizeIdentifier(input.table);
          await adapter.executeQuery(`REINDEX ${table}`);
          operations.push(`reindexed ${input.table}`);
        } else {
          await adapter.executeQuery("REINDEX");
          operations.push("reindexed all");
        }
      }

      if (input.analyze) {
        await sendProgress(progress, step + 1, totalSteps, "Analyzing...");
        if (input.table) {
          const table = sanitizeIdentifier(input.table);
          await adapter.executeQuery(`ANALYZE ${table}`);
          operations.push(`analyzed ${input.table}`);
        } else {
          await adapter.executeQuery("ANALYZE");
          operations.push("analyzed all");
        }
      }

      const duration = Date.now() - start;

      await sendProgress(
        progress,
        totalSteps,
        totalSteps,
        "Optimization complete",
      );

      return {
        success: true,
        message: `Optimization complete: ${operations.length > 0 ? operations.join(", ") : "no operations performed"}`,
        operations,
        durationMs: duration,
      };
    },
  };
}
