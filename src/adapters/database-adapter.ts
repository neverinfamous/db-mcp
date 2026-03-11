/**
 * db-mcp - Database Adapter Interface
 *
 * Abstract base class for SQLite database adapters.
 * Provides a consistent interface for SQLite database operations
 * across WASM and native backend variants.
 *
 * Includes concrete default implementations for MCP registration
 * (registerTool, registerResource, registerPrompt) that subclasses
 * inherit. Override only if the adapter needs custom behavior.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import type {
  DatabaseConfig,
  DatabaseType,
  HealthStatus,
  QueryResult,
  SchemaInfo,
  TableInfo,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  RequestContext,
  ToolGroup,
  ToolFilterConfig,
} from "../types/index.js";
import { isToolEnabled } from "../filtering/tool-filter.js";
import {
  formatError,
  ConnectionError,
} from "../utils/errors/index.js";
import { validateQuery } from "./query-validation.js";

/**
 * Abstract base class for database adapters
 */
export abstract class DatabaseAdapter {
  /** Database type identifier */
  abstract readonly type: DatabaseType;

  /** Human-readable adapter name */
  abstract readonly name: string;

  /** Adapter version */
  abstract readonly version: string;

  /** Connection status */
  protected connected = false;

  /** Database configuration */
  protected config: DatabaseConfig | null = null;

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Connect to the database
   * @param config - Database connection configuration
   */
  abstract connect(config: DatabaseConfig): Promise<void>;

  /**
   * Disconnect from the database
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if connected to the database
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get health status of the database connection
   */
  abstract getHealth(): Promise<HealthStatus>;

  // ===========================================================================
  // Query Execution
  // ===========================================================================

  /**
   * Execute a read-only query (SELECT)
   * @param sql - SQL query string
   * @param params - Query parameters for prepared statements
   */
  abstract executeReadQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult>;

  /**
   * Execute a write query (INSERT, UPDATE, DELETE)
   * @param sql - SQL query string
   * @param params - Query parameters for prepared statements
   * @param skipValidation - Skip security validation (for trusted internal operations)
   */
  abstract executeWriteQuery(
    sql: string,
    params?: unknown[],
    skipValidation?: boolean,
  ): Promise<QueryResult>;

  /**
   * Execute any query (for admin operations)
   * @param sql - SQL query string
   * @param params - Query parameters for prepared statements
   */
  abstract executeQuery(sql: string, params?: unknown[]): Promise<QueryResult>;

  // ===========================================================================
  // Schema Introspection
  // ===========================================================================

  /**
   * Get full database schema information
   */
  abstract getSchema(): Promise<SchemaInfo>;

  /**
   * List all tables in the database
   */
  abstract listTables(): Promise<TableInfo[]>;

  /**
   * Describe a specific table's structure
   * @param tableName - Name of the table
   */
  abstract describeTable(tableName: string): Promise<TableInfo>;

  /**
   * List available schemas/databases
   */
  abstract listSchemas(): Promise<string[]>;

  // ===========================================================================
  // Capabilities
  // ===========================================================================

  /**
   * Get adapter capabilities
   */
  abstract getCapabilities(): AdapterCapabilities;

  /**
   * Get supported tool groups for this adapter
   */
  abstract getSupportedToolGroups(): ToolGroup[];

  // ===========================================================================
  // Tool Registration
  // ===========================================================================

  /**
   * Get all tool definitions for this adapter
   */
  abstract getToolDefinitions(): ToolDefinition[];

  /**
   * Get all resource definitions for this adapter
   */
  abstract getResourceDefinitions(): ResourceDefinition[];

  /**
   * Get all prompt definitions for this adapter
   */
  abstract getPromptDefinitions(): PromptDefinition[];

  /**
   * Register tools with the MCP server
   * @param server - MCP server instance
   * @param filterConfig - Tool filter configuration
   */
  registerTools(server: McpServer, filterConfig: ToolFilterConfig): void {
    const tools = this.getToolDefinitions();

    for (const tool of tools) {
      if (!isToolEnabled(tool, filterConfig)) {
        continue;
      }

      // Register with MCP server
      this.registerTool(server, tool);
    }
  }

  /**
   * Register a single tool with the MCP server.
   * Uses modern registerTool() API for MCP 2025-11-25 compliance.
   * Subclasses may override for custom behavior.
   */
  protected registerTool(server: McpServer, tool: ToolDefinition): void {
    // Build tool options for registerTool()
    const toolOptions: Record<string, unknown> = {
      description: tool.description,
    };

    // Pass inputSchema for tool discovery, but make it lenient for SDK validation.
    // Uses .partial() so the SDK accepts any subset of params (including {}).
    // Handler-level Schema.parse() catches missing required fields and returns
    // structured {success: false} errors instead of raw MCP -32602.
    if (tool.inputSchema !== undefined) {
      const schema = tool.inputSchema;
      // Duck-type check for ZodObject.partial() — type-only import prevents instanceof
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

    // MCP 2025-11-25: Pass outputSchema for structured responses
    if (tool.outputSchema !== undefined) {
      toolOptions["outputSchema"] = tool.outputSchema;
    }

    // MCP 2025-11-25: Pass annotations for behavioral hints
    if (tool.annotations) {
      toolOptions["annotations"] = tool.annotations;
    }

    // MCP 2025-11-25: Pass icons for visual representation
    if (tool.icons) {
      toolOptions["icons"] = tool.icons;
    }

    // Track whether tool has outputSchema for response handling
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
          // Extract progressToken from extra._meta (SDK passes RequestHandlerExtra)
          const extraMeta = extra as {
            _meta?: { progressToken?: string | number };
          };
          const progressToken = extraMeta?._meta?.progressToken;

          // Create context with progress support
          const context = this.createContext(
            undefined,
            server.server,
            progressToken,
          );
          const result = await tool.handler(args, context);

          // MCP 2025-11-25: Return structuredContent if outputSchema present
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

          // Standard text content response — compact JSON (no pretty-print)
          // reduces serialization overhead by ~15-20% on large payloads
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
          // Keep pretty-print on error responses for debugging readability
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

  /**
   * Register resources with the MCP server
   */
  registerResources(server: McpServer): void {
    const resources = this.getResourceDefinitions();

    for (const resource of resources) {
      this.registerResource(server, resource);
    }
  }

  /**
   * Register a single resource with the MCP server.
   * Handles both static resources and URI templates.
   * Subclasses may override for custom behavior.
   */
  protected registerResource(
    server: McpServer,
    resource: ResourceDefinition,
  ): void {
    // Check if URI contains template placeholders like {tableName}
    const isTemplate = /\{[^}]+\}/.test(resource.uri);

    if (isTemplate) {
      // Create ResourceTemplate for parameterized URIs
      // list: undefined signals no enumeration callback for this template
      const template = new ResourceTemplate(resource.uri, { list: undefined });

      server.registerResource(
        resource.name,
        template,
        {
          mimeType: resource.mimeType ?? "application/json",
          description: resource.description,
          ...(resource.icons ? { icons: resource.icons } : {}),
        },
        // Callback receives URL and extracted template variables
        async (
          resourceUri: URL,
          _variables: Record<string, string | string[]>,
        ) => {
          // Pass full URI to handler so it can extract variables
          const context = this.createContext();
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
      // Static resource registration
      server.registerResource(
        resource.name,
        resource.uri,
        {
          mimeType: resource.mimeType ?? "application/json",
          description: resource.description,
          ...(resource.icons ? { icons: resource.icons } : {}),
        },
        async (resourceUri: URL) => {
          const context = this.createContext();
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

  /**
   * Register prompts with the MCP server
   */
  registerPrompts(server: McpServer): void {
    const prompts = this.getPromptDefinitions();

    for (const prompt of prompts) {
      this.registerPrompt(server, prompt);
    }
  }

  /**
   * Register a single prompt with the MCP server.
   * Subclasses may override for custom behavior.
   */
  protected registerPrompt(server: McpServer, prompt: PromptDefinition): void {
    server.registerPrompt(
      prompt.name,
      {
        description: prompt.description,
        ...(prompt.icons ? { icons: prompt.icons } : {}),
      },

      async (args: Record<string, string>) => {
        const context = this.createContext();
        const result = await prompt.handler(args, context);
        // Type-safe message construction
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

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Validate query for safety (SQL injection prevention)
   * @param sql - SQL query to validate
   * @param isReadOnly - Whether to enforce read-only restrictions
   */
  protected validateQuery(sql: string, isReadOnly: boolean): void {
    validateQuery(sql, isReadOnly);
  }

  /**
   * Create a request context for tool execution
   * @param requestId Optional request ID for tracing
   * @param server Optional MCP Server instance for progress notifications
   * @param progressToken Optional progress token from client request _meta
   */
  protected createContext(
    requestId?: string,
    server?: unknown,
    progressToken?: string | number,
  ): RequestContext {
    const context: RequestContext = {
      timestamp: new Date(),
      requestId: requestId ?? crypto.randomUUID(),
    };
    if (server !== undefined) {
      context.server = server;
    }
    if (progressToken !== undefined) {
      context.progressToken = progressToken;
    }
    return context;
  }

  /**
   * Ensure the adapter is connected to the database.
   * Throws ConnectionError if not connected.
   * Subclasses may override to add additional checks (e.g., db instance null).
   */
  protected ensureConnected(): void {
    if (!this.connected) {
      throw new ConnectionError(
        "Not connected to database",
        "DB_NOT_CONNECTED",
      );
    }
  }

  /**
   * Get adapter info for logging/debugging
   */
  getInfo(): Record<string, unknown> {
    return {
      type: this.type,
      name: this.name,
      version: this.version,
      connected: this.connected,
      capabilities: this.getCapabilities(),
      toolGroups: this.getSupportedToolGroups(),
    };
  }
}
