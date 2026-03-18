import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import { IntegrityCheckOutputSchema } from "../../../output-schemas/index.js";
import { IntegrityCheckSchema } from "../helpers.js";

/**
 * Check database integrity
 */
export function createIntegrityCheckTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_integrity_check",
    description: "Check database integrity for corruption or errors.",
    group: "admin",
    inputSchema: IntegrityCheckSchema,
    outputSchema: IntegrityCheckOutputSchema,
    requiredScopes: ["admin"],
    annotations: readOnly("Integrity Check"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = IntegrityCheckSchema.parse(params);

        const sql = `PRAGMA integrity_check(${input.maxErrors})`;
        const result = await adapter.executeReadQuery(sql);

        const messages = (result.rows ?? []).map(
          (r) => r["integrity_check"],
        ) as string[];
        const isOk = messages.length === 1 && messages[0] === "ok";

        return {
          success: true,
          integrity: isOk ? "ok" : "errors_found",
          errorCount: isOk ? 0 : messages.length,
          messages: isOk ? undefined : messages,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
