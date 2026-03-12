import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ResourceDefinition, RequestContext } from "../../types/index.js";

// Interface for adapter methods needed by resource registration
export interface ResourceRegistrationAdapter {
  createContext(requestId?: string, server?: unknown, progressToken?: string | number): RequestContext;
}

export function registerResourceImpl(adapter: ResourceRegistrationAdapter, server: McpServer, resource: ResourceDefinition): void {
  const isTemplate = /\{[^}]+\}/.test(resource.uri);

  if (isTemplate) {
    const template = new ResourceTemplate(resource.uri, { list: undefined });

    server.registerResource(
      resource.name,
      template,
      {
        mimeType: resource.mimeType ?? "application/json",
        description: resource.description,
        ...(resource.icons ? { icons: resource.icons } : {}),
      },
      async (
        resourceUri: URL,
        _variables: Record<string, string | string[]>,
      ) => {
        const context = adapter.createContext();
        const content = await resource.handler(
          resourceUri.toString(),
          context,
        );
        return {
          contents: [
            {
              uri: resourceUri.toString(),
              mimeType: resource.mimeType ?? "application/json",
              text:
                typeof content === "string"
                  ? content
                  : JSON.stringify(content, null, 2),
            },
          ],
        };
      },
    );
  } else {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        mimeType: resource.mimeType ?? "application/json",
        description: resource.description,
        ...(resource.icons ? { icons: resource.icons } : {}),
      },
      async (resourceUri: URL) => {
        const context = adapter.createContext();
        const content = await resource.handler(
          resourceUri.toString(),
          context,
        );
        return {
          contents: [
            {
              uri: resourceUri.toString(),
              mimeType: resource.mimeType ?? "application/json",
              text:
                typeof content === "string"
                  ? content
                  : JSON.stringify(content, null, 2),
            },
          ],
        };
      },
    );
  }
}
