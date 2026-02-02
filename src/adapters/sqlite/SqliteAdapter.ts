/**
 * SQLite Adapter
 *
 * MCP adapter for SQLite databases using sql.js (WebAssembly).
 * Provides 73 tools for database operations, JSON, text processing,
 * statistics, vector search, and geospatial features.
 */

import initSqlJs, { type Database } from "sql.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { DatabaseAdapter } from "../DatabaseAdapter.js";
import type {
  DatabaseConfig,
  QueryResult,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  HealthStatus,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  ToolGroup,
} from "../../types/index.js";
import { createModuleLogger, ERROR_CODES } from "../../utils/logger.js";
import {
  QueryError,
  ConnectionError,
  ConfigurationError,
} from "../../utils/errors.js";
import type { SqliteConfig, SqliteOptions } from "./types.js";
import { SchemaManager } from "./SchemaManager.js";

// Tool definitions from modular files
import { getAllToolDefinitions } from "./tools/index.js";
import { getResourceDefinitions } from "./resources.js";
import { getPromptDefinitions } from "./prompts.js";
import { isJsonbSupportedVersion, setJsonbSupported } from "./json-utils.js";

// Module logger
const log = createModuleLogger("SQLITE");

/**
 * SQLite Database Adapter
 *
 * Implements the DatabaseAdapter interface for SQLite using sql.js.
 * Supports file-based and in-memory databases.
 */
export class SqliteAdapter extends DatabaseAdapter {
  override readonly type = "sqlite" as const;
  override readonly name = "SQLite Adapter";
  override readonly version = "1.0.0";

  /**
   * Check if this adapter uses native (better-sqlite3) backend.
   * Returns false for WASM/sql.js adapter.
   */
  isNativeBackend(): boolean {
    return false;
  }

  /**
   * Get the configured database file path.
   * Returns the user-configured path, not internal WASM virtual filesystem paths.
   */
  getConfiguredPath(): string {
    return this.config?.filePath ?? this.config?.connectionString ?? ":memory:";
  }

  private db: Database | null = null;

  protected override config: SqliteConfig | null = null;
  private sqlJsInstance: Awaited<ReturnType<typeof initSqlJs>> | null = null;
  private schemaManager: SchemaManager | null = null;

  /**
   * Connect to a SQLite database
   */
  override async connect(config: DatabaseConfig): Promise<void> {
    if (config.type !== "sqlite") {
      throw new ConfigurationError(
        `Invalid database type: expected 'sqlite', got '${config.type}'`,
        "DB_TYPE_MISMATCH",
      );
    }

    this.config = config as SqliteConfig;

    try {
      // Initialize sql.js
      this.sqlJsInstance = await initSqlJs();

      const filePath =
        this.config.filePath ?? this.config.connectionString ?? ":memory:";

      if (filePath === ":memory:") {
        // Create in-memory database
        this.db = new this.sqlJsInstance.Database();
        log.info("Connected to in-memory SQLite database", {
          code: "SQLITE_CONNECT",
        });
      } else {
        // For file-based databases, we need to read the file
        // sql.js works in-memory but can load/save to files
        try {
          const fs = await import("fs");
          if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            this.db = new this.sqlJsInstance.Database(buffer);
            log.info(`Connected to SQLite database: ${filePath}`, {
              code: "SQLITE_CONNECT",
            });
          } else {
            // Create new database
            this.db = new this.sqlJsInstance.Database();
            log.info(`Created new SQLite database: ${filePath}`, {
              code: "SQLITE_CONNECT",
            });
          }
        } catch {
          // Browser environment or no file access - create in-memory
          this.db = new this.sqlJsInstance.Database();
          log.warning("File access unavailable, using in-memory database", {
            code: "SQLITE_FALLBACK",
          });
        }
      }

      // Apply options
      this.applyOptions(this.config.options);

      // Enable WAL mode by default for file-based databases (better concurrency)
      // Only if not already configured and not in-memory
      if (filePath !== ":memory:" && !this.config.options?.walMode) {
        try {
          this.db.run("PRAGMA journal_mode = WAL");
          log.info("Enabled WAL mode for better concurrency", {
            code: "SQLITE_WAL",
          });
        } catch {
          // WAL mode may not be supported (e.g., sql.js limitations)
        }
      }

      // Detect JSONB support based on SQLite version
      try {
        const versionResult = this.db.exec("SELECT sqlite_version()");
        const version = (versionResult[0]?.values[0]?.[0] as string) ?? "0.0.0";
        const jsonbSupported = isJsonbSupportedVersion(version);
        setJsonbSupported(jsonbSupported);
        if (jsonbSupported) {
          log.info(`JSONB support enabled (SQLite ${version})`, {
            code: "SQLITE_JSONB",
          });
        }
      } catch {
        setJsonbSupported(false);
      }

      // Initialize SchemaManager with this adapter as the executor
      this.schemaManager = new SchemaManager(this);

      this.connected = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to connect to SQLite: ${message}`, {
        code: ERROR_CODES.DB.CONNECT_FAILED.full,
      });
      throw new ConnectionError(
        `SQLite connection failed: ${message}`,
        "DB_CONNECT_FAILED",
        {
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Apply SQLite PRAGMA options
   */
  private applyOptions(options?: SqliteOptions): void {
    if (!this.db || !options) return;

    if (options.walMode) {
      this.db.run("PRAGMA journal_mode = WAL");
    }
    if (options.foreignKeys !== undefined) {
      this.db.run(
        `PRAGMA foreign_keys = ${options.foreignKeys ? "ON" : "OFF"}`,
      );
    }
    if (options.busyTimeout !== undefined) {
      this.db.run(`PRAGMA busy_timeout = ${options.busyTimeout}`);
    }
    if (options.cacheSize !== undefined) {
      this.db.run(`PRAGMA cache_size = ${options.cacheSize}`);
    }
  }

  /**
   * Disconnect from the database
   */
  override async disconnect(): Promise<void> {
    if (this.db) {
      // Save to file if configured
      if (this.config?.filePath && this.config.filePath !== ":memory:") {
        try {
          const fs = await import("fs");
          const data = this.db.export();
          fs.writeFileSync(this.config.filePath, Buffer.from(data));
          log.info(`Saved database to: ${this.config.filePath}`, {
            code: "SQLITE_DISCONNECT",
          });
        } catch {
          log.warning("Could not save database to file", {
            code: "SQLITE_SAVE_FAILED",
          });
        }
      }

      this.db.close();
      this.db = null;
      this.connected = false;
      log.info("Disconnected from SQLite database", {
        code: "SQLITE_DISCONNECT",
      });
    }
  }

  /**
   * Get database health status
   */
  override getHealth(): Promise<HealthStatus> {
    if (!this.db) {
      return Promise.resolve({ connected: false, error: "Not connected" });
    }

    try {
      const start = Date.now();
      const result = this.db.exec("SELECT sqlite_version() as version");
      const latencyMs = Date.now() - start;

      const version =
        (result[0]?.values[0]?.[0] as string | undefined) ?? "unknown";

      return Promise.resolve({
        connected: true,
        latencyMs,
        version,
        details: {
          filePath:
            this.config?.filePath ??
            this.config?.connectionString ??
            ":memory:",
          walMode: this.config?.options?.walMode ?? false,
        },
      });
    } catch (error) {
      return Promise.resolve({
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Normalize parameters for SQLite binding
   * Converts booleans to integers since SQLite doesn't have native boolean type
   */
  private normalizeParams(
    params?: unknown[],
  ): (string | number | null | Uint8Array)[] | undefined {
    if (!params) return undefined;
    return params.map((p) => {
      if (typeof p === "boolean") return p ? 1 : 0;
      return p as string | number | null | Uint8Array;
    });
  }

  /**
   * Execute a read-only query
   */
  override executeReadQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    this.ensureConnected();
    this.validateQuery(sql, true);

    const db = this.ensureDb();
    const start = Date.now();

    try {
      const normalizedParams = this.normalizeParams(params);
      const results = normalizedParams
        ? db.exec(sql, normalizedParams)
        : db.exec(sql);

      if (results.length === 0) {
        return Promise.resolve({
          rows: [],
          executionTimeMs: Date.now() - start,
        });
      }

      const firstResult = results[0];
      if (!firstResult) {
        return Promise.resolve({
          rows: [],
          executionTimeMs: Date.now() - start,
        });
      }

      const columns: ColumnInfo[] = firstResult.columns.map((name) => ({
        name,
        type: "unknown",
      }));
      const rows = firstResult.values.map((row) => {
        const obj: Record<string, unknown> = {};
        firstResult.columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });

      return Promise.resolve({
        rows,
        columns,
        executionTimeMs: Date.now() - start,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Query failed: ${message}`, {
        code: ERROR_CODES.DB.QUERY_FAILED.full,
      });
      throw new QueryError(
        `Query execution failed: ${message}`,
        "DB_QUERY_FAILED",
        {
          sql,
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Execute a write query
   */
  override executeWriteQuery(
    sql: string,
    params?: unknown[],
    skipValidation = false,
  ): Promise<QueryResult> {
    this.ensureConnected();
    if (!skipValidation) {
      this.validateQuery(sql, false);
    }

    const db = this.ensureDb();
    const start = Date.now();

    try {
      const normalizedParams = this.normalizeParams(params);
      if (normalizedParams) {
        db.run(sql, normalizedParams);
      } else {
        db.run(sql);
      }

      const changes = db.getRowsModified();

      // Auto-invalidate schema cache on DDL operations
      const normalizedSql = sql.trim().toUpperCase();
      if (
        normalizedSql.startsWith("CREATE") ||
        normalizedSql.startsWith("ALTER") ||
        normalizedSql.startsWith("DROP")
      ) {
        this.clearSchemaCache();
      }

      return Promise.resolve({
        rowsAffected: changes,
        executionTimeMs: Date.now() - start,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Write query failed: ${message}`, {
        code: ERROR_CODES.DB.QUERY_FAILED.full,
      });
      throw new QueryError(
        `Write query failed: ${message}`,
        "DB_WRITE_FAILED",
        {
          sql,
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Execute any query (for admin operations)
   */
  override executeQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected();

    const db = this.ensureDb();
    const start = Date.now();

    try {
      const normalizedParams = this.normalizeParams(params);
      const results = normalizedParams
        ? db.exec(sql, normalizedParams)
        : db.exec(sql);

      if (results.length === 0) {
        // Auto-invalidate schema cache on DDL operations
        const normalizedSql = sql.trim().toUpperCase();
        if (
          normalizedSql.startsWith("CREATE") ||
          normalizedSql.startsWith("ALTER") ||
          normalizedSql.startsWith("DROP")
        ) {
          this.clearSchemaCache();
        }
        return Promise.resolve({
          rowsAffected: db.getRowsModified(),
          executionTimeMs: Date.now() - start,
        });
      }

      const firstResult = results[0];
      if (!firstResult) {
        return Promise.resolve({
          rowsAffected: db.getRowsModified(),
          executionTimeMs: Date.now() - start,
        });
      }

      const rows = firstResult.values.map((row) => {
        const obj: Record<string, unknown> = {};
        firstResult.columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });

      // Auto-invalidate schema cache on DDL operations
      const normalizedSql = sql.trim().toUpperCase();
      if (
        normalizedSql.startsWith("CREATE") ||
        normalizedSql.startsWith("ALTER") ||
        normalizedSql.startsWith("DROP")
      ) {
        this.clearSchemaCache();
      }

      return Promise.resolve({
        rows,
        executionTimeMs: Date.now() - start,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Query failed: ${message}`);
    }
  }

  /**
   * Get full database schema (cached via SchemaManager)
   */
  override async getSchema(): Promise<SchemaInfo> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.getSchema();
    }
    // Fallback if SchemaManager not initialized
    const tables = await this.listTables();
    const indexes = await this.getIndexes();
    return { tables, indexes };
  }

  /**
   * List all tables (cached via SchemaManager)
   */
  override async listTables(): Promise<TableInfo[]> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.listTables();
    }
    // Fallback if SchemaManager not initialized
    const result = await this.executeReadQuery(
      `SELECT name, type FROM sqlite_master 
             WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
             ORDER BY name`,
    );

    const tables: TableInfo[] = [];
    for (const row of result.rows ?? []) {
      const name = row["name"] as string;
      const type = row["type"] as "table" | "view";
      const tableInfo = await this.describeTable(name);
      tables.push({ ...tableInfo, type });
    }
    return tables;
  }

  /**
   * Describe a table's structure (cached via SchemaManager)
   */
  override async describeTable(tableName: string): Promise<TableInfo> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.describeTable(tableName);
    }
    // Fallback if SchemaManager not initialized
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }
    const result = await this.executeReadQuery(
      `PRAGMA table_info("${tableName}")`,
    );
    const columns: ColumnInfo[] = (result.rows ?? []).map((row) => ({
      name: row["name"] as string,
      type: row["type"] as string,
      nullable: row["notnull"] === 0,
      primaryKey: row["pk"] === 1,
      defaultValue: row["dflt_value"],
    }));
    const countResult = await this.executeReadQuery(
      `SELECT COUNT(*) as count FROM "${tableName}"`,
    );
    const rowCount = (countResult.rows?.[0]?.["count"] as number) ?? 0;
    return {
      name: tableName,
      type: "table",
      columns,
      rowCount,
    };
  }

  /**
   * List available schemas (SQLite has only 'main')
   */
  override listSchemas(): Promise<string[]> {
    return Promise.resolve(["main"]);
  }

  /**
   * Get indexes, optionally for a specific table (cached via SchemaManager)
   */
  async getIndexes(table?: string): Promise<IndexInfo[]> {
    this.ensureConnected();
    if (this.schemaManager) {
      if (table) {
        return this.schemaManager.getTableIndexes(table);
      }
      return this.schemaManager.getAllIndexes();
    }
    // Fallback if SchemaManager not initialized
    let sql = `SELECT name, tbl_name, sql FROM sqlite_master 
             WHERE type = 'index' AND sql IS NOT NULL`;
    if (table) {
      sql += ` AND tbl_name = '${table.replace(/'/g, "''")}'`;
    }
    const result = await this.executeReadQuery(sql);

    const indexes: IndexInfo[] = [];
    for (const row of result.rows ?? []) {
      const indexName = row["name"] as string;
      const tableName = row["tbl_name"] as string;
      const sqlDef = row["sql"] as string;

      // Get column info for this index via PRAGMA index_info
      let columns: string[] = [];
      try {
        const indexInfo = await this.executeReadQuery(
          `PRAGMA index_info("${indexName}")`,
        );
        columns = (indexInfo.rows ?? []).map((col) => col["name"] as string);
      } catch {
        // If PRAGMA fails, fall back to empty columns
        columns = [];
      }

      indexes.push({
        name: indexName,
        tableName,
        columns,
        unique: sqlDef?.toUpperCase().includes("UNIQUE") ?? false,
      });
    }

    return indexes;
  }

  /**
   * Get all indexes in a single query (cached via SchemaManager)
   * Performance optimization: eliminates N+1 query pattern
   */
  async getAllIndexes(): Promise<IndexInfo[]> {
    return this.getIndexes();
  }

  /**
   * Clear the schema metadata cache
   * Call after DDL operations or when fresh data is needed
   */
  clearSchemaCache(): void {
    if (this.schemaManager) {
      this.schemaManager.clearCache();
    }
  }

  /**
   * Get adapter capabilities
   */
  override getCapabilities(): AdapterCapabilities {
    return {
      json: true,
      fullTextSearch: true, // FTS5 support
      vector: true, // Custom implementation
      geospatial: false, // SpatiaLite not bundled
      transactions: true,
      preparedStatements: true,
      connectionPooling: false, // sql.js is single-connection
    };
  }

  /**
   * Get supported tool groups
   */
  override getSupportedToolGroups(): ToolGroup[] {
    return ["core", "json", "text", "stats", "vector", "admin", "geo"];
  }

  /**
   * Get all tool definitions
   */
  override getToolDefinitions(): ToolDefinition[] {
    return getAllToolDefinitions(this);
  }

  /**
   * Get resource definitions
   */
  override getResourceDefinitions(): ResourceDefinition[] {
    return getResourceDefinitions(this);
  }

  /**
   * Get prompt definitions
   */
  override getPromptDefinitions(): PromptDefinition[] {
    return getPromptDefinitions(this);
  }

  /**
   * Get adapter info for metadata resource
   */
  override getInfo(): {
    type: string;
    name: string;
    version: string;
    connected: boolean;
  } {
    return {
      type: this.type,
      name: this.name,
      version: this.version,
      connected: this.connected,
    };
  }

  /**
   * Register a single tool with the MCP server
   * Uses modern registerTool() API for MCP 2025-11-25 compliance
   */
  protected override registerTool(
    server: McpServer,
    tool: ToolDefinition,
  ): void {
    // Build tool options for registerTool()
    const toolOptions: Record<string, unknown> = {
      description: tool.description,
    };

    // Pass full inputSchema (not just .shape) for proper validation
    if (tool.inputSchema !== undefined) {
      toolOptions["inputSchema"] = tool.inputSchema;
    }

    // MCP 2025-11-25: Pass outputSchema for structured responses
    if (tool.outputSchema !== undefined) {
      toolOptions["outputSchema"] = tool.outputSchema;
    }

    // MCP 2025-11-25: Pass annotations for behavioral hints
    if (tool.annotations) {
      toolOptions["annotations"] = tool.annotations;
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
                  text: JSON.stringify(result, null, 2),
                },
              ],
              structuredContent: result as Record<string, unknown>,
            };
          }

          // Standard text content response
          return {
            content: [
              {
                type: "text" as const,
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  /**
   * Register a single resource with the MCP server
   * Handles both static resources and URI templates
   */
  protected override registerResource(
    server: McpServer,
    resource: ResourceDefinition,
  ): void {
    // Check if URI contains template placeholders like {tableName}
    const isTemplate = /\{[^}]+\}/.test(resource.uri);

    if (isTemplate) {
      // Create ResourceTemplate for parameterized URIs
      // list: undefined signals no enumeration callback for this template
      const template = new ResourceTemplate(resource.uri, { list: undefined });

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      server.resource(
        resource.name,
        template as never, // Type cast for SDK compatibility
        {
          mimeType: resource.mimeType ?? "application/json",
          description: resource.description,
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      server.resource(
        resource.name,
        resource.uri,
        {
          mimeType: resource.mimeType ?? "application/json",
          description: resource.description,
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
   * Register a single prompt with the MCP server
   */
  protected override registerPrompt(
    server: McpServer,
    prompt: PromptDefinition,
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    server.prompt(
      prompt.name,
      prompt.description,
      {}, // MCP SDK expects Zod schema, use empty object for no-arg prompts
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

  /**
   * Ensure database is connected
   */
  private ensureConnected(): void {
    if (!this.db || !this.connected) {
      throw new Error("Not connected to database");
    }
  }

  /**
   * Ensure database is connected and return the database instance
   */
  private ensureDb(): Database {
    if (!this.db || !this.connected) {
      throw new Error("Not connected to database");
    }
    return this.db;
  }

  /**
   * Get the raw database instance (for tools)
   */
  getDatabase(): Database {
    return this.ensureDb();
  }

  /**
   * Execute raw SQL and return results (for tools)
   */
  rawQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
    return this.executeQuery(sql, params);
  }
}

// Factory function
export function createSqliteAdapter(): SqliteAdapter {
  return new SqliteAdapter();
}
