/**
 * db-mcp - Main MCP Server
 * 
 * Code mode MCP server that supports multiple database adapters,
 * OAuth 2.0 authentication, and dynamic tool filtering.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type {
    McpServerConfig,
    DatabaseConfig,
    ToolFilterConfig
} from '../types/index.js';
import { type DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import {
    parseToolFilter,
    getFilterSummary,
    getToolFilterFromEnv
} from '../filtering/ToolFilter.js';

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

        // Initialize MCP server
        this.server = new McpServer({
            name: config.name,
            version: config.version
        });

        // Initialize tool filter from config or environment
        this.toolFilter = config.toolFilter
            ? parseToolFilter(config.toolFilter)
            : getToolFilterFromEnv();

        // Log filter summary
        console.error(getFilterSummary(this.toolFilter));

        // Register built-in tools
        this.registerBuiltInTools();
    }

    /**
     * Register a database adapter
     */
    async registerAdapter(adapter: DatabaseAdapter, config: DatabaseConfig): Promise<void> {
        const adapterId = `${adapter.type}:${config.database ?? 'default'}`;

        // Connect to database
        await adapter.connect(config);

        // Store adapter
        this.adapters.set(adapterId, adapter);

        // Register adapter's tools with filtering
        adapter.registerTools(this.server, this.toolFilter.enabledTools);
        adapter.registerResources(this.server);
        adapter.registerPrompts(this.server);

        console.error(`Registered adapter: ${adapter.name} (${adapterId})`);
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
        // Server info tool
        // Using server.tool pattern (deprecated but registerTool API differs)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        this.server.tool(
            'server_info',
            'Get information about the db-mcp server and registered adapters',
            {},
            () => {
                const adapterInfo = [];
                for (const [id, adapter] of this.adapters) {
                    adapterInfo.push({
                        id,
                        ...adapter.getInfo()
                    });
                }

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            name: this.config.name,
                            version: this.config.version,
                            transport: this.config.transport,
                            adapters: adapterInfo,
                            toolFilter: {
                                raw: this.toolFilter.raw,
                                enabledCount: this.toolFilter.enabledTools.size
                            }
                        }, null, 2)
                    }]
                };
            }
        );

        // Health check tool
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        this.server.tool(
            'server_health',
            'Check health status of all database connections',
            {},
            async () => {
                const health: Record<string, unknown> = {
                    server: 'healthy',
                    timestamp: new Date().toISOString(),
                    adapters: {}
                };

                for (const [id, adapter] of this.adapters) {
                    try {
                        const adapterHealth = await adapter.getHealth();
                        (health['adapters'] as Record<string, unknown>)[id] = adapterHealth;
                    } catch (error) {
                        (health['adapters'] as Record<string, unknown>)[id] = {
                            connected: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                }

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(health, null, 2)
                    }]
                };
            }
        );

        // List adapters tool
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        this.server.tool(
            'list_adapters',
            'List all registered database adapters',
            {},
            () => {
                const adapters = [];
                for (const [id, adapter] of this.adapters) {
                    adapters.push({
                        id,
                        type: adapter.type,
                        name: adapter.name,
                        version: adapter.version,
                        connected: adapter.isConnected()
                    });
                }

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(adapters, null, 2)
                    }]
                };
            }
        );
    }

    /**
     * Start the server with the configured transport
     */
    async start(): Promise<void> {
        switch (this.config.transport) {
            case 'stdio':
                await this.startStdio();
                break;
            case 'http':
                await this.startHttp();
                break;
            default:
                throw new Error(`Unsupported transport: ${this.config.transport}`);
        }
    }

    /**
     * Start server with stdio transport
     */
    private async startStdio(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error(`db-mcp server started (stdio transport)`);
    }

    /**
     * Start server with HTTP transport (Streamable HTTP)
     */
    private async startHttp(): Promise<void> {
        const { HttpTransport } = await import('../transports/http.js');

        // Build OAuth config, only including defined optional properties
        const oauthConfig: {
            enabled: boolean;
            authorizationServerUrl: string;
            audience: string;
            issuer?: string;
            jwksUri?: string;
            clockTolerance?: number;
            publicPaths?: string[];
        } = {
            enabled: this.config.oauth?.enabled ?? false,
            authorizationServerUrl: this.config.oauth?.authorizationServerUrl ?? '',
            audience: this.config.oauth?.audience ?? this.config.name
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
            oauth: oauthConfig
        });

        const mcpTransport = await transport.initialize();
        await this.server.connect(mcpTransport);
        await transport.start();

        console.error(`db-mcp server started (HTTP transport on port ${String(this.config.port ?? 3000)})`);
    }

    /**
     * Gracefully shut down the server
     */
    async shutdown(): Promise<void> {
        console.error('Shutting down db-mcp server...');

        // Disconnect all adapters
        for (const [id, adapter] of this.adapters) {
            try {
                await adapter.disconnect();
                console.error(`Disconnected adapter: ${id}`);
            } catch (error) {
                console.error(`Error disconnecting adapter ${id}:`, error);
            }
        }

        // Close MCP server
        await this.server.close();
        console.error('Server shutdown complete');
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
    name: 'db-mcp',
    version: '0.1.0',
    transport: 'stdio',
    databases: []
};
