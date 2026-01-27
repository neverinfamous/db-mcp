/**
 * db-mcp - Database Adapter Interface
 *
 * Abstract base class that all database adapters must implement.
 * Provides a consistent interface for database operations across
 * different database systems.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import { isToolEnabled } from "../filtering/ToolFilter.js";

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
   */
  abstract executeWriteQuery(
    sql: string,
    params?: unknown[],
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
   * Register a single tool with the MCP server
   */
  protected abstract registerTool(
    server: McpServer,
    tool: ToolDefinition,
  ): void;

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
   * Register a single resource with the MCP server
   */
  protected abstract registerResource(
    server: McpServer,
    resource: ResourceDefinition,
  ): void;

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
   * Register a single prompt with the MCP server
   */
  protected abstract registerPrompt(
    server: McpServer,
    prompt: PromptDefinition,
  ): void;

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Validate query for safety (SQL injection prevention)
   * @param sql - SQL query to validate
   * @param isReadOnly - Whether to enforce read-only restrictions
   */
  protected validateQuery(sql: string, isReadOnly: boolean): void {
    const trimmedSql = sql.trim().toUpperCase();

    if (isReadOnly) {
      // For read-only queries, block mutating statements
      const writePrefixes = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "DROP",
        "CREATE",
        "ALTER",
        "TRUNCATE",
      ];
      for (const prefix of writePrefixes) {
        if (trimmedSql.startsWith(prefix)) {
          throw new Error(
            `Read-only mode: ${prefix} statements are not allowed`,
          );
        }
      }
    }

    // Block obvious SQL injection patterns
    // Note: This is a basic check; parameterized queries are the primary defense
    const dangerousPatterns = [
      /;\s*DROP\s+/i,
      /;\s*DELETE\s+/i,
      /;\s*TRUNCATE\s+/i,
      /--.*$/m, // SQL comments (potential injection)
      /\/\*.*\*\//s, // Block comments
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        throw new Error("Query contains potentially dangerous patterns");
      }
    }
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
