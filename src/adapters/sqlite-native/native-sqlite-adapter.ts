/**
 * Native SQLite Adapter using better-sqlite3
 *
 * Provides synchronous, native SQLite access with full FTS5, window functions,
 * and SpatiaLite support.
 */

import Database from "better-sqlite3";
import type { Database as BetterSqliteDb } from "better-sqlite3";
import { DatabaseAdapter } from "../database-adapter.js";
import type {
  DatabaseConfig,
  DatabaseType,
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
import { logger, ERROR_CODES } from "../../utils/logger/index.js";
import {
  ConnectionError,
  ConfigurationError,
  DbMcpError,
  ErrorCategory,
} from "../../utils/errors/index.js";
import type { SqliteConfig, SqliteOptions } from "../sqlite/types.js";
import type { SqliteAdapter } from "../sqlite/sqlite-adapter.js";
import { SchemaManager } from "../sqlite/schema-manager.js";

import { getResourceDefinitions } from "../sqlite/resources.js";
import { getPromptDefinitions } from "../sqlite/prompts/index.js";
import { getNativeToolDefinitions } from "./registration/index.js";

// Import native-specific tools
import { isSpatialiteLoaded } from "./tools/spatialite/index.js";
import { loadSpatialite, loadCsvExtension } from "./extensions.js";
import {
  beginTransaction as txnBegin,
  commitTransaction as txnCommit,
  rollbackTransaction as txnRollback,
  savepoint as txnSavepoint,
  releaseSavepoint as txnRelease,
  rollbackToSavepoint as txnRollbackTo,
} from "./transaction-methods.js";

const log = logger.child("NATIVE_SQLITE");

import { isDDL, applyCommonPragmas, autoEnableWal, detectAndSetJsonbSupport } from "../sqlite-helpers.js";

// Query execution logic (extracted for modularity)
import { nativeExecuteRead, nativeExecuteWrite } from "./native-query-executor.js";

/**
 * Native SQLite Adapter using better-sqlite3
 */
export class NativeSqliteAdapter extends DatabaseAdapter {
  readonly type: DatabaseType = "sqlite";
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

  private db: BetterSqliteDb | null = null;
  private schemaManager: SchemaManager | null = null;
  private cachedToolDefinitions: ToolDefinition[] | null = null;

  /**
   * Connect to a SQLite database using better-sqlite3
   */
  override connect(config: DatabaseConfig): Promise<void> {
    if (config.type !== "sqlite") {
      throw new ConfigurationError(
        `Invalid database type: expected 'sqlite', got '${config.type as string}'`,
        "DB_TYPE_MISMATCH",
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

      const db = this.db;
      autoEnableWal(
        { runPragma: (pragma) => db.pragma(pragma) },
        filePath,
        sqliteConfig.options,
        log,
      );

      // Detect JSONB support based on SQLite version
      detectAndSetJsonbSupport(() => {
        const versionResult = db
          .prepare("SELECT sqlite_version()")
          .get() as { "sqlite_version()": string } | undefined;
        return versionResult?.["sqlite_version()"] ?? "0.0.0";
      }, log);

      // Initialize SchemaManager with this adapter as the executor
      this.schemaManager = new SchemaManager(this);

      this.connected = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to connect to native SQLite: ${message}`, {
        code: ERROR_CODES.DB.CONNECT_FAILED.full,
      });
      throw new ConnectionError(
        `Native SQLite connection failed: ${message}`,
        "DB_CONNECT_FAILED",
        {
          cause: error instanceof Error ? error : undefined,
        },
      );
    }

    return Promise.resolve();
  }

  /**
   * Apply SQLite PRAGMA options and load extensions
   */
  private applyOptions(options?: SqliteOptions): void {
    if (!this.db || !options) return;

    const db = this.db;
    applyCommonPragmas(
      { runPragma: (pragma) => db.pragma(pragma) },
      options,
    );

    // Load native-only extensions
    if (options.spatialite) {
      loadSpatialite(db, log);
    }
    if (options.csv) {
      loadCsvExtension(db, log);
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
   * Check if FTS5 is available via compile options.
   * Uses PRAGMA compile_options instead of creating a virtual table probe,
   * which can fail when SpatiaLite extensions are loaded.
   */
  private hasFts5(): boolean {
    if (!this.db) return false;
    try {
      const rows = this.db.prepare("PRAGMA compile_options").all() as {
        compile_options: string;
      }[];
      return rows.some((r) => r.compile_options === "ENABLE_FTS5");
    } catch {
      return false;
    }
  }



  /**
   * Execute a read query
   */
  override executeReadQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    this.ensureConnected();
    return nativeExecuteRead(this.ensureDb(), sql, params, log);
  }

  /**
   * Execute a write query
   */
  override executeWriteQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    this.ensureConnected();
    const result = nativeExecuteWrite(this.ensureDb(), sql, params, log);

    // Auto-invalidate schema cache on DDL operations
    if (isDDL(sql)) {
      this.clearSchemaCache();
    }

    return result;
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
   * Get schema information (cached via SchemaManager)
   */
  override async getSchema(): Promise<SchemaInfo> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.getSchema();
    }
    // Fallback if SchemaManager not initialized
    const tables = await this.listTables();
    return { tables, indexes: [] };
  }

  /**
   * List all tables (cached via SchemaManager)
   */
  override async listTables(): Promise<TableInfo[]> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.listTables();
    }
    // Fallback: direct query without caching
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
   * Describe a table (cached via SchemaManager)
   */
  override async describeTable(tableName: string): Promise<TableInfo> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.describeTable(tableName);
    }
    // Fallback: direct query without caching
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new DbMcpError(
        "Invalid table name",
        "SQLITE_INVALID_TABLE",
        ErrorCategory.VALIDATION
      );
    }
    const result = await this.executeReadQuery(
      `PRAGMA table_info("${tableName}")`,
    );
    if (!result.rows || result.rows.length === 0) {
      throw new DbMcpError(
        `Table '${tableName}' does not exist`,
        "SQLITE_TABLE_NOT_FOUND",
        ErrorCategory.RESOURCE
      );
    }
    return {
      name: tableName,
      type: "table",
      columns: (result.rows ?? []).map((c) => ({
        name: c["name"] as string,
        type: c["type"] as string,
        nullable: c["notnull"] === 0,
        primaryKey: (c["pk"] as number) > 0,
      })),
    };
  }

  /**
   * List schemas (SQLite only has one)
   */
  override listSchemas(): Promise<string[]> {
    return Promise.resolve(["main"]);
  }

  /**
   * Get all indexes in the database (cached via SchemaManager)
   * Required by sqlite_indexes resource
   */
  async getAllIndexes(): Promise<IndexInfo[]> {
    this.ensureConnected();
    if (this.schemaManager) {
      return this.schemaManager.getAllIndexes();
    }
    // Fallback: direct query without caching
    const db = this.ensureDb();
    const indexes = db
      .prepare(
        `SELECT name, tbl_name, sql
         FROM sqlite_master
         WHERE type = 'index' AND sql IS NOT NULL
         ORDER BY tbl_name, name`,
      )
      .all() as { name: string; tbl_name: string; sql: string }[];

    return indexes.map((idx) => {
      const indexInfo = db
        .prepare(`PRAGMA index_info("${idx.name}")`)
        .all() as { seqno: number; cid: number; name: string }[];
      return {
        name: idx.name,
        tableName: idx.tbl_name,
        columns: indexInfo.map((col) => col.name),
        unique: idx.sql?.toUpperCase().includes("UNIQUE") ?? false,
      };
    });
  }

  /**
   * Clear the schema metadata cache.
   * Called automatically after DDL operations.
   */
  clearSchemaCache(): void {
    if (this.schemaManager) {
      this.schemaManager.clearCache();
    }
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
    return ["core", "json", "text", "stats", "vector", "admin", "geo", "introspection", "migration"];
  }

  /**
   * Get all tool definitions (cached — immutable per adapter instance)
   */
  override getToolDefinitions(): ToolDefinition[] {
    if (this.cachedToolDefinitions) return this.cachedToolDefinitions;

    this.cachedToolDefinitions = getNativeToolDefinitions(this);
    return this.cachedToolDefinitions;
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
   * Ensure database is connected and return database instance
   */
  private ensureDb(): BetterSqliteDb {
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
  getDatabase(): BetterSqliteDb {
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
    txnBegin(this.ensureDb());
  }

  /**
   * Commit a transaction
   */
  commitTransaction(): void {
    txnCommit(this.ensureDb());
  }

  /**
   * Rollback a transaction
   */
  rollbackTransaction(): void {
    txnRollback(this.ensureDb());
  }

  /**
   * Create a savepoint
   */
  savepoint(name: string): void {
    txnSavepoint(this.ensureDb(), name);
  }

  /**
   * Release a savepoint
   */
  releaseSavepoint(name: string): void {
    txnRelease(this.ensureDb(), name);
  }

  /**
   * Rollback to a savepoint
   */
  rollbackToSavepoint(name: string): void {
    txnRollbackTo(this.ensureDb(), name);
  }
}

// Factory function
export function createNativeSqliteAdapter(): NativeSqliteAdapter {
  return new NativeSqliteAdapter();
}
