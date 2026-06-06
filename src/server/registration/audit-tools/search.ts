import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuditLogger } from "../../../audit/logger.js";
import { logger } from "../../../utils/logger/index.js";
import { formatHandlerError } from "../../../utils/errors/index.js";
import {
  registerToolScopes,
  scopesGrantToolAccess,
} from "../../../auth/scopes/enforcement.js";
import { getAuthContext } from "../../../auth/auth-context.js";
import { InsufficientScopeError } from "../../../auth/errors.js";
import {
  AuditSearchSchema,
  AuditSearchOutputSchema,
} from "../../../adapters/sqlite/schemas/admin.js";
import { toSDK } from "../../../utils/annotations.js";

/**
 * Register the sqlite_audit_search tool.
 */
export function registerAuditSearchTool(
  server: McpServer,
  auditLogger: AuditLogger | null,
): void {
  if (!auditLogger) return;

  server.registerTool(
    "sqlite_audit_search",
    {
      title: "Search Audit Log",
      description:
        "Search and filter structured audit logs from the System Database. Returns recent tool invocations, outcomes, token estimates, and parameters.",
      inputSchema: AuditSearchSchema,
      outputSchema: AuditSearchOutputSchema,
      annotations: toSDK({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        sensitiveHint: true,
      }),
    },
    async (args: unknown) => {
      try {
        const authCtx = getAuthContext();
        if (
          authCtx &&
          !scopesGrantToolAccess(authCtx.scopes, "sqlite_audit_search")
        ) {
          throw new InsufficientScopeError(["admin", "full"], authCtx.scopes);
        }

        const parsed = AuditSearchSchema.parse(args ?? {});
        const { entries, totalCount } = await auditLogger.search(parsed);

        const result = {
          success: true,
          entries,
          count: entries.length,
          totalCount,
        };

        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(result), "utf8") / 4,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { ...result, _meta: { tokenEstimate } },
                null,
                2,
              ),
            },
          ],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (error: unknown) {
        const structured = formatHandlerError(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          isError: true,
          structuredContent: structured as unknown as Record<string, unknown>,
        };
      }
    },
  );

  registerToolScopes(new Map([["sqlite_audit_search", ["admin", "full"]]]));

  logger.info("Registered audit search tool: sqlite_audit_search", {
    module: "AUDIT",
  });
}
