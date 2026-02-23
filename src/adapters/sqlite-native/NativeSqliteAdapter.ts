/**
 * Native SQLite Adapter using better-sqlite3
 *
 * Provides synchronous, native SQLite access with full FTS5, window functions,
 * and SpatiaLite support.
 */

import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import { DatabaseAdapter } from "../DatabaseAdapter.js";
import type {
  DatabaseConfig,
  DatabaseType as DbType,
  HealthStatus,
  IndexInfo,
  QueryResult,
  SchemaInfo,
  TableInfo,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  ToolGroup,
} from "../../types/index.js";
import {
  type McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger, ERROR_CODES } from "../../utils/logger.js";
import type { SqliteConfig, SqliteOptions } from "../sqlite/types.js";
import type { SqliteAdapter } from "../sqlite/SqliteAdapter.js";

// Import shared tools from sql.js adapter
import { getCoreTools } from "../sqlite/tools/core.js";
import { getJsonOperationTools } from "../sqlite/tools/json-operations.js";
import { getJsonHelperTools } from "../sqlite/tools/json-helpers.js";
import { getTextTools } from "../sqlite/tools/text.js";
import { getFtsTools } from "../sqlite/tools/fts.js";
import { getStatsTools } from "../sqlite/tools/stats.js";
import { getVirtualTools } from "../sqlite/tools/virtual.js";
import { getVectorTools } from "../sqlite/tools/vector.js";
import { getGeoTools } from "../sqlite/tools/geo.js";
import { getAdminTools } from "../sqlite/tools/admin.js";
import { getResourceDefinitions } from "../sqlite/resources.js";
import { getPromptDefinitions } from "../sqlite/prompts.js";
import {
  isJsonbSupportedVersion,
  setJsonbSupported,
} from "../sqlite/json-utils.js";

// Import native-specific tools
import { getTransactionTools } from "./tools/transactions.js";
import { getWindowTools } from "./tools/window.js";
import { getSpatialiteTools, isSpatialiteLoaded } from "./tools/spatialite.js";

const log = logger.child("NATIVE_SQLITE");

/**
 * Native SQLite Adapter using better-sqlite3
 */
export class NativeSqliteAdapter extends DatabaseAdapter {
  readonly type: DbType = "sqlite";
  readonly name = "Native SQLite Adapter (better-sqlite3)";
  readonly version = "1.0.0";

  /**
   * Check if this adapter uses native (better-sqlite3) backend.
   * Returns true for native adapter.
   */
  isNativeBackend(): boolean {
    return true;
  }

  /**
   * Get the configured database file path.
   * Returns the user-configured path, not internal WASM virtual filesystem paths.
   */
  getConfiguredPath(): string {
    const config = this.config as SqliteConfig | null;
    return config?.filePath ?? config?.connectionString ?? ":memory:";
  }

  private db: DatabaseType | null = null;

  /**
   * Connect to a SQLite database using better-sqlite3
   */
  override connect(config: DatabaseConfig): Promise<void> {
    if (config.type !== "sqlite") {
      throw new Error(
        `Invalid database type: expected 'sqlite', got '${config.type}'`,
      );
    }

    const sqliteConfig = config as SqliteConfig;
    this.config = sqliteConfig;

    try {
      const filePath =
        sqliteConfig.filePath ?? sqliteConfig.connectionString ?? ":memory:";

      // Create database connection
      this.db = new Database(filePath, {
        readonly: false,
        fileMustExist: false,
      });

      log.info(`Connected to SQLite database (native): ${filePath}`, {
        code: "SQLITE_CONNECT",
      });

      // Apply options
      this.applyOptions(sqliteConfig.options);

      // Enable WAL mode by default for file-based databases
      if (filePath !== ":memory:" && !sqliteConfig.options?.walMode) {
        try {
          this.db.pragma("journal_mode = WAL");
          log.info("Enabled WAL mode for better concurrency", {
            code: "SQLITE_WAL",
          });
        } catch {
          // WAL mode may not be available
        }
      }

      // Detect JSONB support based on SQLite version
      try {
        const versionResult = this.db
          .prepare("SELECT sqlite_version()")
          .get() as { "sqlite_version()": string } | undefined;
        const version = versionResult?.["sqlite_version()"] ?? "0.0.0";
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

      this.connected = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to connect to native SQLite: ${message}`, {
        code: ERROR_CODES.DB.CONNECT_FAILED.full,
      });
      throw new Error(`Native SQLite connection failed: ${message}`, {
        cause: error,
      });
    }

    return Promise.resolve();
  }

  /**
   * Apply SQLite PRAGMA options
   */
  private applyOptions(options?: SqliteOptions): void {
    if (!this.db || !options) return;

    if (options.walMode) {
      this.db.pragma("journal_mode = WAL");
    }
    if (options.foreignKeys !== undefined) {
      this.db.pragma(`foreign_keys = ${options.foreignKeys ? "ON" : "OFF"}`);
    }
    if (options.busyTimeout !== undefined) {
      this.db.pragma(`busy_timeout = ${options.busyTimeout}`);
    }
    if (options.cacheSize !== undefined) {
      this.db.pragma(`cache_size = ${options.cacheSize}`);
    }
    if (options.spatialite) {
      // Compute absolute path to extensions directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const extensionsDir = path.resolve(__dirname, "../../../extensions");

      const spatialitePaths = [
        process.env["SPATIALITE_PATH"],
        // Absolute paths to local extensions
        path.join(
          extensionsDir,
          "mod_spatialite-5.1.0-win-amd64",
          "mod_spatialite",
        ),
        path.join(
          extensionsDir,
          "mod_spatialite-5.1.0-win-amd64",
          "mod_spatialite.dll",
        ),
        // System paths
        "mod_spatialite",
        "mod_spatialite.dll",
        "/usr/lib/x86_64-linux-gnu/mod_spatialite.so",
        "/usr/local/lib/mod_spatialite.so",
        "/usr/local/lib/mod_spatialite.dylib",
      ].filter((p): p is string => Boolean(p));

      // On Windows, SpatiaLite DLL has many dependencies (libgeos, libproj, etc.)
      // These must be in PATH for Windows to find them when loading the extension.
      // Prepend the extension directory to PATH before attempting to load.
      const envSpatialitePath = process.env["SPATIALITE_PATH"];
      if (envSpatialitePath && process.platform === "win32") {
        const spatialiteExtDir = path.dirname(envSpatialitePath);
        const currentPath = process.env["PATH"] ?? "";
        if (!currentPath.includes(spatialiteExtDir)) {
          process.env["PATH"] = spatialiteExtDir + ";" + currentPath;
        }
      }

      let loaded = false;
      for (const extPath of spatialitePaths) {
        try {
          this.db.loadExtension(extPath);
          log.info(`Loaded SpatiaLite extension from ${extPath}`, {
            code: "SQLITE_EXTENSION",
          });
          loaded = true;
          break;
        } catch {
          // Try next path
        }
      }
      if (!loaded) {
        log.warning(
          "SpatiaLite extension not available. Set SPATIALITE_PATH env var.",
          { code: "SQLITE_EXTENSION" },
        );
      }
    }
    if (options.csv) {
      // Compute absolute path to extensions directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const extensionsDir = path.resolve(__dirname, "../../../extensions");

      const csvPaths = [
        process.env["CSV_EXTENSION_PATH"],
        // sqlite-xsv extension with absolute paths
        path.join(extensionsDir, "xsv0.dll"),
        path.join(extensionsDir, "xsv0"),
        // System paths
        "xsv0",
        "xsv0.dll",
        "csv",
        "csv.dll",
        "csv.so",
        "/usr/local/lib/csv.so",
        "/usr/local/lib/csv.dylib",
      ].filter((p): p is string => Boolean(p));

      let loaded = false;
      for (const extPath of csvPaths) {
        try {
          this.db.loadExtension(extPath);
          log.info(`Loaded CSV extension from ${extPath}`, {
            code: "SQLITE_EXTENSION",
          });
          loaded = true;
          break;
        } catch {
          // Try next path
        }
      }
      if (!loaded) {
        log.warning(
          "CSV extension not available. Set CSV_EXTENSION_PATH env var.",
          { code: "SQLITE_EXTENSION" },
        );
      }
    }
  }

  /**
   * Disconnect from the database
   */
  override disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.connected = false;
      log.info("Disconnected from native SQLite database", {
        code: "SQLITE_DISCONNECT",
      });
    }
    return Promise.resolve();
  }

  /**
   * Get health status
   */
  override getHealth(): Promise<HealthStatus> {
    if (!this.db || !this.connected) {
      return Promise.resolve({
        connected: false,
        latencyMs: 0,
      });
    }

    const start = Date.now();
    try {
      this.db.prepare("SELECT 1").get();
      return Promise.resolve({
        connected: true,
        latencyMs: Date.now() - start,
        details: {
          backend: "better-sqlite3",
          fts5: this.hasFts5(),
          spatialite: isSpatialiteLoaded(this),
        },
      });
    } catch {
      return Promise.resolve({
        connected: false,
        latencyMs: Date.now() - start,
      });
    }
  }

  /**
   * Check if FTS5 is available
   */
  private hasFts5(): boolean {
    if (!this.db) return false;
    try {
      this.db.exec(
        "CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_test USING fts5(content)",
      );
      this.db.exec("DROP TABLE IF EXISTS _fts5_test");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize parameters for SQLite binding
   * Converts booleans to integers since SQLite doesn't have native boolean type
   */
  private normalizeParams(params?: unknown[]): unknown[] | undefined {
    if (!params) return undefined;
    return params.map((p) => {
      if (typeof p === "boolean") return p ? 1 : 0;
      return p;
    });
  }

  /**
   * Execute a read query
   */
  override executeReadQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    this.ensureConnected();
    const start = Date.now();

    try {
      const db = this.ensureDb();
      const stmt = db.prepare(sql);
      const normalizedParams = this.normalizeParams(params);
      const rows = normalizedParams
        ? stmt.all(...normalizedParams)
        : stmt.all();

      return Promise.resolve({
        rows: rows as Record<string, unknown>[],
        columns: stmt
          .columns()
          .map((c) => ({ name: c.name, type: c.type ?? "unknown" })),
        executionTimeMs: Date.now() - start,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Query failed: ${message}`, { cause: error });
    }
  }

  /**
   * Execute a write query
   */
  override executeWriteQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    this.ensureConnected();
    const start = Date.now();

    try {
      const db = this.ensureDb();
      const stmt = db.prepare(sql);
      const normalizedParams = this.normalizeParams(params);
      const info = normalizedParams
        ? stmt.run(...normalizedParams)
        : stmt.run();

      return Promise.resolve({
        rows: [],
        rowsAffected: info.changes,
        executionTimeMs: Date.now() - start,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Write query failed: ${message}`, { cause: error });
    }
  }

  /**
   * Execute any query
   */
  override executeQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
    const trimmed = sql.trim().toUpperCase();
    if (
      trimmed.startsWith("SELECT") ||
      trimmed.startsWith("PRAGMA") ||
      trimmed.startsWith("EXPLAIN")
    ) {
      return this.executeReadQuery(sql, params);
    }
    return this.executeWriteQuery(sql, params);
  }

  /**
   * Get schema information
   */
  override async getSchema(): Promise<SchemaInfo> {
    this.ensureConnected();
    const tables = await this.listTables();

    return {
      tables,
      indexes: [],
      views: [],
    };
  }

  /**
   * List all tables
   */
  override listTables(): Promise<TableInfo[]> {
    this.ensureConnected();

    const db = this.ensureDb();
    const result = db
      .prepare(
        `
            SELECT name, type, sql 
            FROM sqlite_master 
            WHERE type IN ('table', 'view') 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `,
      )
      .all() as { name: string; type: string; sql: string }[];

    // Build tables with column info from PRAGMA table_info()
    // Filter out FTS5 virtual tables and shadow tables
    const tables = result
      .filter((row) => {
        // Skip FTS5 virtual tables (end with "_fts") and shadow tables (contain "_fts_")
        if (row.name.endsWith("_fts") || row.name.includes("_fts_")) {
          return false;
        }
        return true;
      })
      .map((row) => {
        const columns = db
          .prepare(`PRAGMA table_info("${row.name}")`)
          .all() as {
          name: string;
          type: string;
          notnull: number;
          pk: number;
        }[];

        return {
          name: row.name,
          type: row.type as "table" | "view",
          columns: columns.map((c) => ({
            name: c.name,
            type: c.type,
            nullable: c.notnull === 0,
            primaryKey: c.pk > 0,
          })),
        };
      });

    return Promise.resolve(tables);
  }

  /**
   * Describe a table
   */
  override describeTable(tableName: string): Promise<TableInfo> {
    this.ensureConnected();

    const db = this.ensureDb();
    const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as {
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }[];

    // Check if table exists (PRAGMA returns empty for non-existent tables)
    if (columns.length === 0) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    return Promise.resolve({
      name: tableName,
      type: "table",
      columns: columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.notnull === 0 ? true : false,
        primaryKey: c.pk > 0 ? true : false,
      })),
    });
  }

  /**
   * List schemas (SQLite only has one)
   */
  override listSchemas(): Promise<string[]> {
    return Promise.resolve(["main"]);
  }

  /**
   * Get all indexes in the database
   * Required by sqlite_indexes resource
   */
  getAllIndexes(): IndexInfo[] {
    this.ensureConnected();
    const db = this.ensureDb();

    // Get all user-created indexes from sqlite_master
    const indexes = db
      .prepare(
        `SELECT name, tbl_name, sql 
         FROM sqlite_master 
         WHERE type = 'index' AND sql IS NOT NULL
         ORDER BY tbl_name, name`,
      )
      .all() as { name: string; tbl_name: string; sql: string }[];

    // Build index info with column details
    return indexes.map((idx) => {
      // Get columns for this index
      const indexInfo = db
        .prepare(`PRAGMA index_info("${idx.name}")`)
        .all() as {
        seqno: number;
        cid: number;
        name: string;
      }[];

      return {
        name: idx.name,
        tableName: idx.tbl_name,
        columns: indexInfo.map((col) => col.name),
        unique: idx.sql?.toUpperCase().includes("UNIQUE") ?? false,
      };
    });
  }

  /**
   * Get capabilities
   */
  override getCapabilities(): AdapterCapabilities {
    return {
      json: true,
      fullTextSearch: true,
      vector: true,
      geospatial: true,
      transactions: true,
      preparedStatements: true,
      connectionPooling: false, // better-sqlite3 is single-connection
      windowFunctions: true,
      spatialite: true,
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
    // Type assertion needed due to interface compatibility
    const self = this as unknown as SqliteAdapter;
    return [
      ...getCoreTools(self),
      ...getJsonOperationTools(self),
      ...getJsonHelperTools(self),
      ...getTextTools(self),
      ...getFtsTools(self),
      ...getStatsTools(self),
      ...getVirtualTools(self),
      ...getVectorTools(self),
      ...getGeoTools(self),
      ...getAdminTools(self),
      // Native-only tools
      ...getTransactionTools(this),
      ...getWindowTools(this),
      ...getSpatialiteTools(this),
    ];
  }

  /**
   * Get resource definitions
   */
  override getResourceDefinitions(): ResourceDefinition[] {
    return getResourceDefinitions(this as unknown as SqliteAdapter);
  }

  /**
   * Get prompt definitions
   */
  override getPromptDefinitions(): PromptDefinition[] {
    return getPromptDefinitions(this as unknown as SqliteAdapter);
  }

  /**
   * Register a tool with the MCP server
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
   * Register a resource with the MCP server
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

      server.registerResource(
        resource.name,
        template,
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
          const content = await resource.handler(resourceUri.toString(), {
            timestamp: new Date(),
            requestId: crypto.randomUUID(),
          });
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
        },
        async (resourceUri: URL) => {
          const content = await resource.handler(resourceUri.toString(), {
            timestamp: new Date(),
            requestId: crypto.randomUUID(),
          });
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
   * Register a prompt with the MCP server
   */
  protected override registerPrompt(
    server: McpServer,
    prompt: PromptDefinition,
  ): void {
    server.registerPrompt(
      prompt.name,
      { description: prompt.description },

      async (args: Record<string, string>) => {
        const result = await prompt.handler(args, {
          timestamp: new Date(),
          requestId: crypto.randomUUID(),
        });
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
   * Ensure database is connected and return database instance
   */
  private ensureDb(): DatabaseType {
    if (!this.db || !this.connected) {
      throw new Error("Not connected to database");
    }
    return this.db;
  }

  /**
   * Get the raw database instance (for tools)
   */
  getDatabase(): DatabaseType {
    return this.ensureDb();
  }

  /**
   * Execute raw SQL and return results (for tools)
   */
  rawQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
    return this.executeQuery(sql, params);
  }

  /**
   * Begin a transaction
   */
  beginTransaction(): void {
    const db = this.ensureDb();
    db.exec("BEGIN TRANSACTION");
  }

  /**
   * Commit a transaction
   */
  commitTransaction(): void {
    const db = this.ensureDb();
    db.exec("COMMIT");
  }

  /**
   * Rollback a transaction
   */
  rollbackTransaction(): void {
    const db = this.ensureDb();
    db.exec("ROLLBACK");
  }

  /**
   * Create a savepoint
   */
  savepoint(name: string): void {
    const db = this.ensureDb();
    db.exec(`SAVEPOINT "${name}"`);
  }

  /**
   * Release a savepoint
   */
  releaseSavepoint(name: string): void {
    const db = this.ensureDb();
    db.exec(`RELEASE SAVEPOINT "${name}"`);
  }

  /**
   * Rollback to a savepoint
   */
  rollbackToSavepoint(name: string): void {
    const db = this.ensureDb();
    db.exec(`ROLLBACK TO SAVEPOINT "${name}"`);
  }
}

// Factory function
export function createNativeSqliteAdapter(): NativeSqliteAdapter {
  return new NativeSqliteAdapter();
}
