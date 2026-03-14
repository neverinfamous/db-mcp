import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PromptDefinition, RequestContext } from "../../types/index.js";

// Interface for adapter methods needed by prompt registration
export interface PromptRegistrationAdapter {
  createContext(requestId?: string, server?: unknown, progressToken?: string | number): RequestContext;
}

/**
 * Build argsSchema from prompt argument definitions.
 *
 * Per mcp-builder §1.4 — omit argsSchema when all arguments are optional
 * (SDK parses `undefined` as failure for Zod objects). Only set argsSchema
 * when at least one argument has `required: true`.
 */
function buildArgsSchema(
  args: PromptDefinition["arguments"],
): Record<string, z.ZodType> | undefined {
  if (!args || args.length === 0) return undefined;

  const hasRequired = args.some((a) => a.required === true);
  if (!hasRequired) return undefined;

  const schema: Record<string, z.ZodType> = {};
  for (const arg of args) {
    const field = z.string().describe(arg.description);
    schema[arg.name] = arg.required ? field : field.optional();
  }
  return schema;
}

export function registerPromptImpl(adapter: PromptRegistrationAdapter, server: McpServer, prompt: PromptDefinition): void {
  const argsSchema = buildArgsSchema(prompt.arguments);
  const iconOpts = prompt.icons ? { icons: prompt.icons } : {};

  // Handler logic shared by both overload branches
  const handleResult = async (args: Record<string, string>): Promise<{ messages: { role: "user" | "assistant"; content: { type: "text"; text: string } }[] }> => {
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
  };

  // SDK overloads require separate call paths for typed vs untyped args
  if (argsSchema) {
    server.registerPrompt(
      prompt.name,
      { description: prompt.description, argsSchema, ...iconOpts },
      async (args) => handleResult(args as Record<string, string>),
    );
  } else {
    server.registerPrompt(
      prompt.name,
      { description: prompt.description, ...iconOpts },
      async (args) => handleResult(args as Record<string, string>),
    );
  }
}
