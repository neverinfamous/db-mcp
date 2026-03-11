/**
 * SQLite Adapter
 *
 * MCP adapter for SQLite databases using sql.js (WebAssembly).
 * Provides tools for database operations, JSON, text processing,
 * statistics, vector search, and geospatial features.
 * FTS5 tools are excluded (WASM mode does not support FTS5).
 */

import initSqlJs, { type Database } from "sql.js";
import { DatabaseAdapter } from "../database-adapter.js";
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
  ConnectionError,
  ConfigurationError,
} from "../../utils/errors/index.js";
import type { SqliteConfig, SqliteOptions } from "./types.js";
import { SchemaManager } from "./schema-manager.js";

// Tool definitions from modular files
import { getAllToolDefinitions } from "./tools/index.js";
import { getResourceDefinitions } from "./resources.js";
import { getPromptDefinitions } from "./prompts/index.js";
import { isJsonbSupportedVersion, setJsonbSupported } from "./json-utils.js";

// Query execution logic (extracted for modularity)
import { executeRead, executeWrite, executeGeneral } from "./query-executor.js";

// Module logger
const log = createModuleLogger("SQLITE");

import { isDDL, applyCommonPragmas } from "../sqlite-helpers.js";



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
        `Invalid database type: expected 'sqlite', got '${config.type as string}'`,
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

    const db = this.db;
    applyCommonPragmas(
      { runPragma: (pragma) => db.run(`PRAGMA ${pragma}`) },
      options,
    );
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
    skipValidation = false,
  ): Promise<QueryResult> {
    this.ensureConnected();
    if (!skipValidation) {
      this.validateQuery(sql, false);
    }

    const result = await executeWrite(this.ensureDb(), sql, params);

    // Auto-invalidate schema cache on DDL operations
    if (isDDL(sql)) {
      this.clearSchemaCache();
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

    const result = await executeGeneral(this.ensureDb(), sql, params);

    // Auto-invalidate schema cache on DDL operations
    if (isDDL(sql)) {
      this.clearSchemaCache();
    }

    return result;
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
      let columns: string[];
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
    return ["core", "json", "text", "stats", "vector", "admin", "geo", "introspection", "migration"];
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
