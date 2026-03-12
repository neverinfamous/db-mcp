import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PromptDefinition, RequestContext } from "../../types/index.js";

// Interface for adapter methods needed by prompt registration
export interface PromptRegistrationAdapter {
  createContext(requestId?: string, server?: unknown, progressToken?: string | number): RequestContext;
}

export function registerPromptImpl(adapter: PromptRegistrationAdapter, server: McpServer, prompt: PromptDefinition): void {
  server.registerPrompt(
    prompt.name,
    {
      description: prompt.description,
      ...(prompt.icons ? { icons: prompt.icons } : {}),
    },
    async (args: Record<string, string>) => {
      const context = adapter.createContext();
      const result = await prompt.handler(args, context);
      
      const messages: {
        role: "user" | "assistant";
        content: { type: "text"; text: string };
      }[] = Array.isArray(result)
        ? (result as {
            role: "user" | "assistant";
            content: { type: "text"; text: string };
          }[])
        : [
            {
              role: "assistant" as const,
              content: {
                type: "text" as const,
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result),
              },
            },
          ];
      return { messages };
    },
  );
}
