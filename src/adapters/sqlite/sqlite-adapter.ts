/**
 * SQLite Adapter
 *
 * MCP adapter for SQLite databases using sql.js (WebAssembly).
 * Provides tools for database operations, JSON, text processing,
 * statistics, vector search, and geospatial features.
 * FTS5 tools are excluded (WASM mode does not support FTS5).
 */

import type { Database } from "sql.js";
import { DatabaseAdapter } from "../database-adapter.js";
import type {
  DatabaseConfig,
  QueryResult,
  SchemaInfo,
  TableInfo,
  IndexInfo,
  HealthStatus,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  ToolGroup,
} from "../../types/index.js";
import { ConnectionError } from "../../utils/errors/index.js";
import { VERSION } from "../../version.js";
import type { SqliteConfig } from "./types.js";
import type { SchemaManager } from "./schema-manager.js";

// Tool definitions from modular files
import { getAllToolDefinitions } from "./tools/index.js";
import { getResourceDefinitions } from "./resources.js";
import { getPromptDefinitions } from "./prompts/index.js";

// Query execution logic (extracted for modularity)
import { executeRead, executeWrite, executeGeneral } from "./query-executor.js";

import { isDDL } from "../sqlite-helpers.js";

import {
  connectSqliteDatabase,
  disconnectSqliteDatabase,
} from "./sqlite-adapter/lifecycle.js";
import {
  fallBackListTables,
  fallBackDescribeTable,
  fallBackGetIndexes,
  fallBackGetSchema,
} from "./sqlite-adapter/schema.js";

/**
 * SQLite Database Adapter
 *
 * Implements the DatabaseAdapter interface for SQLite using sql.js.
 * Supports file-based and in-memory databases.
 */
export class SqliteAdapter extends DatabaseAdapter {
  override readonly type = "sqlite" as const;
  override readonly name = "SQLite Adapter";
  override readonly version = VERSION;

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
  private schemaManager: SchemaManager | null = null;
  private cachedToolDefinitions: ToolDefinition[] | null = null;

  /**
   * Connect to a SQLite database
   */
  override async connect(config: DatabaseConfig): Promise<void> {
    this.config = config;
    const { db, schemaManager } = await connectSqliteDatabase(this, config);
    this.db = db;
    this.schemaManager = schemaManager;
    this.connected = true;
  }

  /**
   * Disconnect from the database
   */
  override async disconnect(): Promise<void> {
    if (this.db) {
      await disconnectSqliteDatabase(this.db, this.config);
      this.db = null;
      this.connected = false;
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
            (this.config?.filePath ?? this.config?.connectionString)
              ? "<redacted>"
              : ":memory:",
          walMode: this.config?.options?.walMode ?? false,
        },
      });
    } catch (error: unknown) {
      return Promise.resolve({
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
    return executeRead(this.ensureDb(), sql, params);
  }

  /**
   * Execute a write query
   */
  override async executeWriteQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    this.ensureConnected();
    this.validateQuery(sql, false);

    const result = await executeWrite(this.ensureDb(), sql, params);

    // Auto-invalidate schema cache on DDL operations
    if (isDDL(sql)) {
      const match = /(?:table|view|index)\s+([a-zA-Z0-9_]+)/i.exec(sql);
      if (match?.[1] && this.schemaManager) {
        this.schemaManager.clearTableCache(match[1]);
      } else {
        this.clearSchemaCache();
      }
    }

    return result;
  }

  /**
   * Execute any query (for admin operations)
   */
  override async executeQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    this.ensureConnected();
    this.validateQuery(sql, false);

    const result = await executeGeneral(this.ensureDb(), sql, params);

    // Auto-invalidate schema cache on DDL operations
    if (isDDL(sql)) {
      const match = /(?:table|view|index)\s+([a-zA-Z0-9_]+)/i.exec(sql);
      if (match?.[1] && this.schemaManager) {
        this.schemaManager.clearTableCache(match[1]);
      } else {
        this.clearSchemaCache();
      }
    }

    return result;
  }

  /**
   * Execute a SQL script containing multiple statements
   */
  override executeScript(sql: string): Promise<void> {
    this.ensureConnected();
    this.ensureDb().run(sql);
    this.clearSchemaCache();
    return Promise.resolve();
  }

  /**
   * Get full database schema (cached via SchemaManager)
   */
  override async getSchema(): Promise<SchemaInfo> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.getSchema();
    }
    return fallBackGetSchema(this);
  }

  /**
   * List all tables (cached via SchemaManager)
   */
  override async listTables(): Promise<TableInfo[]> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.listTables();
    }
    return fallBackListTables(this);
  }

  /**
   * Describe a table's structure (cached via SchemaManager)
   */
  override async describeTable(tableName: string): Promise<TableInfo> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.describeTable(tableName);
    }
    return fallBackDescribeTable(this, tableName);
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
    return fallBackGetIndexes(this, table);
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
      fullTextSearch: false, // FTS5 not available in WASM/sql.js build
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
    return [
      "core",
      "json",
      "text",
      "stats",
      "vector",
      "admin",
      "geo",
      "introspection",
      "migration",
    ];
  }

  /**
   * Get all tool definitions
   */
  override getToolDefinitions(): ToolDefinition[] {
    this.cachedToolDefinitions ??= getAllToolDefinitions(this);
    return this.cachedToolDefinitions;
  }

  /**
   * Get tools filtered by adapter capabilities
   * Used by Code Mode to accurately reflect available runtime features
   */
  getAvailableToolDefinitions(): ToolDefinition[] {
    const allTools = this.getToolDefinitions();
    const capabilities = this.getCapabilities();

    return allTools.filter((tool) => {
      if (!capabilities.transactions && tool.group === "transactions") {
        return false;
      }
      if (!capabilities.vector && tool.group === "vector") {
        return false;
      }
      if (!capabilities.geospatial) {
        const spatialiteTools = [
          "sqlite_geo_load_spatialite",
          "sqlite_geo_spatial_table",
          "sqlite_geo_spatial_query",
          "sqlite_geo_spatial_analysis",
          "sqlite_geo_spatial_index",
          "sqlite_geo_transform",
          "sqlite_geo_import",
        ];
        if (spatialiteTools.includes(tool.name)) {
          return false;
        }
      }

      // Filter out FTS5 tools if FTS is not supported
      if (!capabilities.fullTextSearch && tool.name.startsWith("sqlite_fts_")) {
        return false;
      }

      return true;
    });
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
   * Ensure database is connected
   */
  protected override ensureConnected(): void {
    super.ensureConnected();
    if (!this.db) {
      throw new ConnectionError(
        "Not connected to database",
        "DB_NOT_CONNECTED",
      );
    }
  }

  /**
   * Ensure database is connected and return the database instance
   */
  private ensureDb(): Database {
    this.ensureConnected();
    const db = this.db;
    if (!db) {
      throw new ConnectionError(
        "Not connected to database",
        "DB_NOT_CONNECTED",
      );
    }
    return db;
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
    return executeGeneral(this.ensureDb(), sql, params);
  }
}

// Factory function
export function createSqliteAdapter(): SqliteAdapter {
  return new SqliteAdapter();
}
