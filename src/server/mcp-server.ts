/**
 * db-mcp - Main MCP Server
 *
 * SQLite MCP server with OAuth 2.1 authentication,
 * HTTP/SSE transport, and dynamic tool filtering.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
  McpServerConfig,
  DatabaseConfig,
  ToolFilterConfig,
} from "../types/index.js";
import { VERSION, NAME } from "../version.js";
import { type DatabaseAdapter } from "../adapters/database-adapter.js";
import type { HttpTransportConfig } from "../transports/http/types.js";
import {
  parseToolFilter,
  getFilterSummary,
  getToolFilterFromEnv,
} from "../filtering/tool-filter.js";
import {
  INSTRUCTIONS,
  HELP_CONTENT,
} from "../constants/server-instructions.js";
import type { ToolGroup } from "../types/index.js";
import { logger } from "../utils/logger/index.js";
import { SERVER_ICONS } from "../utils/icons.js";
import { READ_ONLY } from "../utils/annotations.js";
import { DbMcpError } from "../utils/errors/base.js";
import { ErrorCategory } from "../utils/errors/categories.js";

/**
 * Main db-mcp server class
 *
 * Manages database adapters, tool registration, and MCP protocol handling.
 */
export class DbMcpServer {
  private server: McpServer;
  private adapters = new Map<string, DatabaseAdapter>();
  private toolFilter: ToolFilterConfig;
  private config: McpServerConfig;

  constructor(config: McpServerConfig) {
    this.config = config;

    // Initialize tool filter from config or environment (needed for help resources)
    this.toolFilter = config.toolFilter
      ? parseToolFilter(config.toolFilter)
      : getToolFilterFromEnv();

    // Initialize MCP server with slim instructions (~600 chars)
    this.server = new McpServer(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          logging: {},
        },
        instructions: INSTRUCTIONS,
      },
    );

    // Log filter summary
    logger.info(getFilterSummary(this.toolFilter), { module: "FILTER" });

    // Log server initialization with capabilities
    logger.info("MCP Server initialized", {
      module: "SERVER",
      name: config.name,
      version: config.version,
      toolFilter: config.toolFilter ?? "none",
      capabilities: ["logging"],
    });

    // Register built-in tools and help resources
    this.registerBuiltInTools();
    this.registerHelpResources();
  }

  /**
   * Register a database adapter
   */
  async registerAdapter(
    adapter: DatabaseAdapter,
    config: DatabaseConfig,
  ): Promise<void> {
    const adapterId = `${adapter.type}:${config.connectionString ?? "default"}`;

    // Connect to database
    await adapter.connect(config);

    // Store adapter
    this.adapters.set(adapterId, adapter);

    // Register adapter's tools with filtering
    adapter.registerTools(this.server, this.toolFilter);
    adapter.registerResources(this.server);
    adapter.registerPrompts(this.server);

    logger.info(`Registered adapter: ${adapter.name} (${adapterId})`, {
      module: "SERVER",
    });
  }

  /**
   * Get an adapter by ID
   */
  getAdapter(adapterId: string): DatabaseAdapter | undefined {
    return this.adapters.get(adapterId);
  }

  /**
   * Get all registered adapters
   */
  getAdapters(): Map<string, DatabaseAdapter> {
    return this.adapters;
  }

  /**
   * Register built-in server tools (health, info, etc.)
   */
  private registerBuiltInTools(): void {
    // Build options with icons (SDK type doesn't include icons, so we cast)
    const serverInfoOpts: Record<string, unknown> = {
      title: "Server Info",
      description:
        "Get information about the db-mcp server and registered adapters",
      icons: SERVER_ICONS,
      annotations: READ_ONLY,
    };

    // Server info tool
    this.server.registerTool(
      "server_info",
      serverInfoOpts as { description?: string },
      () => {
        const adapterInfo = [];
        for (const [id, adapter] of this.adapters) {
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
                  name: this.config.name,
                  version: this.config.version,
                  transport: this.config.transport,
                  adapters: adapterInfo,
                  toolFilter: {
                    raw: this.toolFilter.raw,
                    enabledGroups: [...this.toolFilter.enabledGroups],
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // Health check tool
    const healthOpts: Record<string, unknown> = {
      title: "Server Health",
      description: "Check health status of all database connections",
      icons: SERVER_ICONS,
      annotations: READ_ONLY,
    };

    this.server.registerTool(
      "server_health",
      healthOpts as { description?: string },
      async () => {
        const health: Record<string, unknown> = {
          server: "healthy",
          timestamp: new Date().toISOString(),
          adapters: {},
        };

        for (const [id, adapter] of this.adapters) {
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
      },
    );

    // List adapters tool
    const listAdaptersOpts: Record<string, unknown> = {
      title: "List Adapters",
      description: "List all registered database adapters",
      icons: SERVER_ICONS,
      annotations: READ_ONLY,
    };

    this.server.registerTool(
      "list_adapters",
      listAdaptersOpts as { description?: string },
      () => {
        const adapters = [];
        for (const [id, adapter] of this.adapters) {
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
      },
    );
  }

  /**
   * Register sqlite://help resources for on-demand reference documentation.
   * Always registers sqlite://help (gotchas). Group-specific help is filtered
   * by the tool filter configuration.
   */
  private registerHelpResources(): void {
    // Always register sqlite://help (gotchas + code mode + WASM vs native)
    const gotchasContent = HELP_CONTENT.get("gotchas");
    if (gotchasContent) {
      this.server.registerResource(
        "sqlite_help",
        "sqlite://help",
        {
          description:
            "Critical gotchas, WASM vs Native comparison, and Code Mode API reference",
          mimeType: "text/markdown",
        },
        () => ({
          contents: [
            {
              uri: "sqlite://help",
              mimeType: "text/markdown",
              text: gotchasContent,
            },
          ],
        }),
      );
    }

    // Register group-specific help resources based on tool filter
    const groupHelpKeys: { group: ToolGroup; key: string }[] = [
      { group: "json", key: "json" },
      { group: "text", key: "text" },
      { group: "stats", key: "stats" },
      { group: "vector", key: "vector" },
      { group: "geo", key: "geo" },
      { group: "admin", key: "admin" },
      { group: "introspection", key: "introspection" },
      { group: "migration", key: "migration" },
    ];

    for (const { group, key } of groupHelpKeys) {
      if (!this.toolFilter.enabledGroups.has(group)) continue;

      const content = HELP_CONTENT.get(key);
      if (!content) continue;

      this.server.registerResource(
        `sqlite_help_${key}`,
        `sqlite://help/${key}`,
        {
          description: `Tool reference for the ${group} tool group`,
          mimeType: "text/markdown",
        },
        () => ({
          contents: [
            {
              uri: `sqlite://help/${key}`,
              mimeType: "text/markdown",
              text: content,
            },
          ],
        }),
      );
    }

    // Log registered help resources
    const registeredHelp = ["sqlite://help"];
    for (const { group, key } of groupHelpKeys) {
      if (this.toolFilter.enabledGroups.has(group)) {
        registeredHelp.push(`sqlite://help/${key}`);
      }
    }
    logger.info(`Help resources: ${registeredHelp.join(", ")}`, {
      module: "SERVER",
    });
  }

  /**
   * Start the server with the configured transport
   */
  async start(): Promise<void> {
    switch (this.config.transport) {
      case "stdio":
        await this.startStdio();
        break;
      case "http":
        await this.startHttp();
        break;
      default:
        throw new DbMcpError(
          `Unsupported transport: ${this.config.transport}`,
          "SERVER_START_FAILED",
          ErrorCategory.CONFIGURATION,
        );
    }
  }

  /**
   * Start server with stdio transport
   */
  private async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info(`db-mcp server started (stdio transport)`, {
      module: "SERVER",
    });
  }

  /**
   * Start server with HTTP transport (Streamable HTTP with SSE support)
   */
  private async startHttp(): Promise<void> {
    // Dynamic import to avoid loading Express in stdio mode
    const { HttpTransport } = await import("../transports/http/index.js");

    // Build OAuth config, only including defined optional properties
    const oauthConfig: HttpTransportConfig["oauth"] = {
      enabled: this.config.oauth?.enabled ?? false,
      authorizationServerUrl: this.config.oauth?.authorizationServerUrl ?? "",
      audience: this.config.oauth?.audience ?? this.config.name,
    };

    // Only add optional properties if they are defined
    if (this.config.oauth?.issuer !== undefined) {
      oauthConfig.issuer = this.config.oauth.issuer;
    }
    if (this.config.oauth?.jwksUri !== undefined) {
      oauthConfig.jwksUri = this.config.oauth.jwksUri;
    }
    if (this.config.oauth?.clockTolerance !== undefined) {
      oauthConfig.clockTolerance = this.config.oauth.clockTolerance;
    }
    if (this.config.oauth?.publicPaths !== undefined) {
      oauthConfig.publicPaths = this.config.oauth.publicPaths;
    }

    const transport = new HttpTransport({
      port: this.config.port ?? 3000,
      ...(this.config.host !== undefined && { host: this.config.host }),
      ...(this.config.authToken !== undefined && {
        authToken: this.config.authToken,
      }),
      ...(this.config.enableHSTS !== undefined && {
        enableHSTS: this.config.enableHSTS,
      }),
      oauth: oauthConfig,
      stateless: this.config.statelessHttp ?? false,
    });

    // Initialize transport with the MCP server reference
    // In stateful mode, transport manages sessions internally
    // In stateless mode, transport creates a single shared connection
    await transport.initialize(this.server);
    await transport.start();

    const mode = this.config.statelessHttp ? "stateless" : "stateful";
    const host = this.config.host ?? "0.0.0.0";
    const port = String(this.config.port ?? 3000);
    logger.info(
      `db-mcp server started (HTTP transport on ${host}:${port}, ${mode} mode)`,
      { module: "TRANSPORT", mode },
    );
  }

  /**
   * Gracefully shut down the server
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down db-mcp server...", { module: "SERVER" });

    // Disconnect all adapters
    for (const [id, adapter] of this.adapters) {
      try {
        await adapter.disconnect();
        logger.info(`Disconnected adapter: ${id}`, { module: "SERVER" });
      } catch (error) {
        logger.error(`Error disconnecting adapter ${id}`, {
          module: "SERVER",
          error: error instanceof Error ? error : undefined,
        });
      }
    }

    // Close MCP server
    await this.server.close();
    logger.info("Server shutdown complete", { module: "SERVER" });
  }
}

/**
 * Create and configure a db-mcp server instance
 */
export function createServer(config: McpServerConfig): DbMcpServer {
  return new DbMcpServer(config);
}

/**
 * Default server configuration
 */
export const DEFAULT_CONFIG: Partial<McpServerConfig> = {
  name: NAME,
  version: VERSION,
  transport: "stdio",
  databases: [],
};
