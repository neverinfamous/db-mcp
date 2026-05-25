import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDefinition, RequestContext } from "../../types/index.js";
import { formatHandlerError } from "../../utils/errors/index.js";
import type { AuditInterceptor } from "../../audit/interceptor.js";
import { registerToolScope } from "../../auth/scope-map.js";
import { registerToolScopes } from "../../auth/scopes/enforcement.js";

// Interface for the adapter methods needed by tool registration
export interface ToolRegistrationAdapter {
  createContext(
    requestId?: string,
    server?: unknown,
    progressToken?: string | number,
  ): RequestContext;
  getAuditInterceptor?(): AuditInterceptor | null;
}

export function registerToolImpl(
  adapter: ToolRegistrationAdapter,
  server: McpServer,
  tool: ToolDefinition,
): void {
  const toolOptions: Record<string, unknown> = {
    description: tool.description,
  };

  const requiredScope = tool.requiredScopes?.[0] ?? "admin";
  registerToolScope(tool.name, requiredScope);
  registerToolScopes(new Map([[tool.name, tool.requiredScopes ?? ["admin"]]]));

  if (tool.inputSchema !== undefined) {
    const schema = tool.inputSchema;
    toolOptions["inputSchema"] = schema;
  }

  if (tool.outputSchema !== undefined) {
    toolOptions["outputSchema"] = tool.outputSchema;
  }

  if (tool.annotations) {
    toolOptions["annotations"] = tool.annotations;
  }

  if (tool.icons) {
    toolOptions["icons"] = tool.icons;
  }

  const hasOutputSchema = Boolean(tool.outputSchema);

  /** MCP tool handler response shape */
  interface ToolResponse {
    [x: string]: unknown;
    content: { type: "text"; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  }

  server.registerTool(
    tool.name,
    toolOptions,
    async (
      argsOrExtra: unknown,
      possibleExtra?: unknown,
    ): Promise<ToolResponse> => {
      try {
        const extra = possibleExtra !== undefined ? possibleExtra : argsOrExtra;
        const args = possibleExtra !== undefined ? argsOrExtra : {};
        const extraMeta = extra as {
          _meta?: { progressToken?: string | number };
        };
        const progressToken = extraMeta?._meta?.progressToken;

        const context = adapter.createContext(
          undefined,
          server.server,
          progressToken,
        );

        const execFn = async (): Promise<ToolResponse> => {
          const result = await tool.handler(args, context);

          // Inject _meta.tokenEstimate into object responses
          if (hasOutputSchema) {
            const enriched = JSON.stringify({
              ...(result as object),
              _meta: { tokenEstimate: 0 },
            });
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(enriched, "utf8") / 4,
            );
            const finalText = enriched.replace(
              '"tokenEstimate":0',
              `"tokenEstimate":${String(tokenEstimate)}`,
            );
            return {
              content: [
                {
                  type: "text" as const,
                  text: finalText,
                },
              ],
              structuredContent: result as Record<string, unknown>,
            };
          }

          if (typeof result === "object" && result !== null) {
            const withMeta = JSON.stringify(
              { ...result, _meta: { tokenEstimate: 0 } },
              null,
              2,
            );
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(withMeta, "utf8") / 4,
            );
            const finalText = withMeta.replace(
              '"tokenEstimate": 0',
              `"tokenEstimate": ${String(tokenEstimate)}`,
            );
            return {
              content: [{ type: "text" as const, text: finalText }],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text:
                  typeof result === "string" ? result : JSON.stringify(result),
              },
            ],
          };
        };

        // Wire audit interceptor if available
        const auditInterceptor = adapter.getAuditInterceptor?.();
        if (auditInterceptor) {
          // around() is a transparent pass-through that returns exactly
          // what execFn returns. The cast is safe because execFn's return
          // shape is the MCP handler response type.
          return await auditInterceptor.around(
            tool.name,
            args,
            context.requestId,
            execFn,
          );
        }
        return await execFn();
      } catch (error: unknown) {
        const structured = formatHandlerError(error);

        // Token estimate for error responses
        if (hasOutputSchema) {
          const enriched = JSON.stringify({
            ...structured,
            _meta: { tokenEstimate: 0 },
          });
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(enriched, "utf8") / 4,
          );
          const finalText = enriched.replace(
            '"tokenEstimate":0',
            `"tokenEstimate":${String(tokenEstimate)}`,
          );
          return {
            content: [
              {
                type: "text" as const,
                text: finalText,
              },
            ],
            structuredContent: structured as unknown as Record<string, unknown>,
            isError: true,
          };
        }

        const withMeta = JSON.stringify(
          { ...structured, _meta: { tokenEstimate: 0 } },
          null,
          2,
        );
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(withMeta, "utf8") / 4,
        );
        const finalText = withMeta.replace(
          '"tokenEstimate": 0',
          `"tokenEstimate": ${String(tokenEstimate)}`,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: finalText,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
