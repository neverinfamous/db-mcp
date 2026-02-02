/**
 * SQLite Schema Manager
 *
 * Provides TTL-based caching for schema metadata operations.
 * Ported from mysql-mcp's SchemaManager pattern.
 */

import type {
  QueryResult,
  TableInfo,
  SchemaInfo,
  IndexInfo,
  ColumnInfo,
} from "../../types/index.js";

export interface QueryExecutor {
  executeReadQuery(sql: string, params?: unknown[]): Promise<QueryResult>;
}

/**
 * Default cache TTL in milliseconds (configurable via METADATA_CACHE_TTL_MS env var)
 * SQLite is embedded/local, so 5s default (vs mysql-mcp's 30s for network latency)
 */
const DEFAULT_CACHE_TTL_MS = parseInt(
  process.env["METADATA_CACHE_TTL_MS"] ?? "5000",
  10,
);

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * SchemaManager provides cached access to database schema metadata.
 * Reduces repeated schema queries during tool/resource invocations.
 */
export class SchemaManager {
  private metadataCache = new Map<string, CacheEntry<unknown>>();
  private cacheTtlMs = DEFAULT_CACHE_TTL_MS;

  constructor(private executor: QueryExecutor) {}

  /**
   * Get cached value if not expired
   */
  private getCached(key: string): unknown {
    const entry = this.metadataCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.metadataCache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /**
   * Set cache value
   */
  private setCache(key: string, data: unknown): void {
    this.metadataCache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear all cached metadata (useful after DDL operations)
   */
  clearCache(): void {
    this.metadataCache.clear();
  }

  /**
   * Get the current cache TTL in milliseconds
   */
  getCacheTtl(): number {
    return this.cacheTtlMs;
  }

  /**
   * Get full database schema (cached)
   */
  async getSchema(): Promise<SchemaInfo> {
    const cached = this.getCached("schema") as SchemaInfo | undefined;
    if (cached) return cached;

    const tables = await this.listTables();
    const indexes = await this.getAllIndexes();

    const schema: SchemaInfo = { tables, indexes };
    this.setCache("schema", schema);
    return schema;
  }

  /**
   * List all tables (cached)
   */
  async listTables(): Promise<TableInfo[]> {
    const cached = this.getCached("tables") as TableInfo[] | undefined;
    if (cached) return cached;

    const result = await this.executor.executeReadQuery(
      `SELECT name, type FROM sqlite_master 
       WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    );

    const tables: TableInfo[] = [];
    for (const row of result.rows ?? []) {
      const name = row["name"] as string;
      const type = row["type"] as "table" | "view";

      // Skip FTS5 virtual tables and shadow tables (they're internal implementation details)
      // - Virtual tables: end with "_fts" (e.g., "articles_fts")
      // - Shadow tables: contain "_fts_" (e.g., "articles_fts_config", "articles_fts_data")
      if (name.endsWith("_fts") || name.includes("_fts_")) {
        continue;
      }

      try {
        const tableInfo = await this.describeTable(name);
        tables.push({ ...tableInfo, type });
      } catch {
        // FTS5 virtual tables fail PRAGMA table_info in WASM mode (no FTS5 module)
        // Skip these tables rather than failing the entire operation
        continue;
      }
    }

    this.setCache("tables", tables);
    return tables;
  }

  /**
   * Describe a table's structure (cached per table)
   */
  async describeTable(tableName: string): Promise<TableInfo> {
    const cacheKey = `table_${tableName}`;
    const cached = this.getCached(cacheKey) as TableInfo | undefined;
    if (cached) return cached;

    // Validate table name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }

    const result = await this.executor.executeReadQuery(
      `PRAGMA table_info("${tableName}")`,
    );

    // Check if table exists (PRAGMA returns empty for non-existent tables)
    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    const columns: ColumnInfo[] = (result.rows ?? []).map((row) => ({
      name: row["name"] as string,
      type: row["type"] as string,
      nullable: row["notnull"] === 0,
      primaryKey: row["pk"] === 1,
      defaultValue: row["dflt_value"],
    }));

    // Get row count (wrapped in try-catch for FTS5/virtual tables in WASM mode)
    let rowCount = 0;
    try {
      const countResult = await this.executor.executeReadQuery(
        `SELECT COUNT(*) as count FROM "${tableName}"`,
      );
      rowCount = (countResult.rows?.[0]?.["count"] as number) ?? 0;
    } catch {
      // FTS5 virtual tables may fail in WASM mode (no FTS5 module)
      // Return 0 for row count rather than failing the entire operation
      rowCount = 0;
    }

    const tableInfo: TableInfo = {
      name: tableName,
      type: "table",
      columns,
      rowCount,
    };

    this.setCache(cacheKey, tableInfo);
    return tableInfo;
  }

  /**
   * Get all indexes in a single query (cached)
   * Performance optimization: eliminates N+1 query pattern
   */
  async getAllIndexes(): Promise<IndexInfo[]> {
    const cached = this.getCached("all_indexes") as IndexInfo[] | undefined;
    if (cached) return cached;

    const result = await this.executor.executeReadQuery(
      `SELECT name, tbl_name, sql FROM sqlite_master 
       WHERE type = 'index' AND sql IS NOT NULL`,
    );

    const indexes: IndexInfo[] = [];

    for (const row of result.rows ?? []) {
      const indexName = row["name"] as string;
      const tableName = row["tbl_name"] as string;
      const sql = row["sql"] as string;

      // Get column info for this index via PRAGMA index_info
      let columns: string[] = [];
      try {
        const indexInfo = await this.executor.executeReadQuery(
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
        unique: sql?.toUpperCase().includes("UNIQUE") ?? false,
      });
    }

    this.setCache("all_indexes", indexes);
    return indexes;
  }

  /**
   * Get indexes for a specific table (uses cached all_indexes)
   */
  async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    const allIndexes = await this.getAllIndexes();
    return allIndexes.filter((idx) => idx.tableName === tableName);
  }
}
