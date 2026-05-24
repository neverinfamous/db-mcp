import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DatabaseAdapter } from "../../adapters/database-adapter.js";
import type { McpServerConfig, ToolFilterConfig } from "../../types/index.js";
import { SERVER_ICONS } from "../../utils/icons.js";
import { READ_ONLY } from "../../utils/annotations.js";
import { registerToolScopes } from "../../auth/scopes/enforcement.js";

/**
 * Register built-in server tools (health, info, etc.)
 */
export function registerBuiltInTools(
  server: McpServer,
  adaptersMap: Map<string, DatabaseAdapter>,
  config: McpServerConfig,
  toolFilter: ToolFilterConfig
): void {

    // Build options with icons (SDK type doesn't include icons, so we cast)
    const serverInfoOpts: Record<string, unknown> = {
      title: "Server Info",
      description:
        "Get information about the db-mcp server and registered adapters",
      icons: SERVER_ICONS,
      annotations: READ_ONLY,
    };

    // Server info tool
    server.registerTool("server_info", serverInfoOpts, () => {
      const adapterInfo = [];
      for (const [id, adapter] of adaptersMap) {
        adapterInfo.push({
          id,
          ...adapter.getInfo(),
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                name: config.name,
                version: config.version,
                transport: config.transport,
                adapters: adapterInfo,
                toolFilter: {
                  raw: toolFilter.raw,
                  enabledGroups: [...toolFilter.enabledGroups],
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    });

    // Health check tool
    const healthOpts: Record<string, unknown> = {
      title: "Server Health",
      description: "Check health status of all database connections",
      icons: SERVER_ICONS,
      annotations: READ_ONLY,
    };

    server.registerTool("server_health", healthOpts, async () => {
      const health: Record<string, unknown> = {
        server: "healthy",
        timestamp: new Date().toISOString(),
        adapters: {},
      };

      for (const [id, adapter] of adaptersMap) {
        try {
          const adapterHealth = await adapter.getHealth();
          (health["adapters"] as Record<string, unknown>)[id] = adapterHealth;
        } catch (error) {
          (health["adapters"] as Record<string, unknown>)[id] = {
            connected: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    });

    // List adapters tool
    const listAdaptersOpts: Record<string, unknown> = {
      title: "List Adapters",
      description: "List all registered database adapters",
      icons: SERVER_ICONS,
      annotations: READ_ONLY,
    };

    server.registerTool("list_adapters", listAdaptersOpts, () => {
      const adapters = [];
      for (const [id, adapter] of adaptersMap) {
        adapters.push({
          id,
          type: adapter.type,
          name: adapter.name,
          version: adapter.version,
          connected: adapter.isConnected(),
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(adapters, null, 2),
          },
        ],
      };
    });
  
    // Map scopes so these tools don't fail closed
    registerToolScopes(
      new Map([
        ["server_info", ["read", "write", "admin", "full"]],
        ["server_health", ["read", "write", "admin", "full"]],
        ["list_adapters", ["read", "write", "admin", "full"]],
      ]),
    );
}