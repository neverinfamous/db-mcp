import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import type { ToolDefinition, RequestContext } from "../../types/index.js";
import { formatError } from "../../utils/errors/index.js";

// Interface for the adapter methods needed by tool registration
export interface ToolRegistrationAdapter {
  createContext(requestId?: string, server?: unknown, progressToken?: string | number): RequestContext;
}

export function registerToolImpl(adapter: ToolRegistrationAdapter, server: McpServer, tool: ToolDefinition): void {
  const toolOptions: Record<string, unknown> = {
    description: tool.description,
  };

  if (tool.inputSchema !== undefined) {
    const schema = tool.inputSchema;
    if (
      typeof schema === "object" &&
      schema !== null &&
      "partial" in schema &&
      typeof (schema as { partial: unknown }).partial === "function"
    ) {
      toolOptions["inputSchema"] = (
        schema as { partial: () => z.ZodType }
      ).partial();
    } else {
      toolOptions["inputSchema"] = schema;
    }
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

  server.registerTool(
    tool.name,
    toolOptions as {
      description?: string;
      inputSchema?: z.ZodType;
      outputSchema?: z.ZodType;
    },
    async (args: unknown, extra: unknown) => {
      try {
        const extraMeta = extra as {
          _meta?: { progressToken?: string | number };
        };
        const progressToken = extraMeta?._meta?.progressToken;

        const context = adapter.createContext(
          undefined,
          server.server,
          progressToken,
        );
        const result = await tool.handler(args, context);

        if (hasOutputSchema) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result),
              },
            ],
            structuredContent: result as Record<string, unknown>,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text:
                typeof result === "string"
                  ? result
                  : JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
