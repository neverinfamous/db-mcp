/**
 * db-mcp — Database Types
 *
 * Core database type definitions: connections, queries, schema,
 * tables, columns, indexes, and constraints.
 */

// =============================================================================
// Database Types
// =============================================================================

/**
 * Supported database types.
 * This MCP server only supports SQLite. Other database types
 * would require separate MCP server projects.
 */
export type DatabaseType = "sqlite";

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  /** Database type identifier */
  type: DatabaseType;

  /** Connection string (file path or ":memory:") */
  connectionString?: string;

  /** Additional database-specific options */
  options?: Record<string, unknown>;
}

/**
 * Database connection health status
 */
export interface HealthStatus {
  connected: boolean;
  latencyMs?: number;
  version?: string;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Query execution result
 */
export interface QueryResult {
  /** Rows returned (for SELECT queries) */
  rows?: Record<string, unknown>[];

  /** Number of rows affected (for INSERT/UPDATE/DELETE) */
  rowsAffected?: number;

  /** Last inserted ID (for INSERT with auto-increment) */
  lastInsertId?: number | string;

  /** Query execution time in milliseconds */
  executionTimeMs?: number;

  /** Column metadata */
  columns?: ColumnInfo[];
}

/**
 * Column metadata information
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: unknown;
}

/**
 * Table information
 */
export interface TableInfo {
  name: string;
  schema?: string;
  type: "table" | "view" | "materialized_view";
  rowCount?: number;
  columns?: ColumnInfo[];
}

/**
 * Schema information for a database
 */
export interface SchemaInfo {
  tables: TableInfo[];
  views?: TableInfo[];
  indexes?: IndexInfo[];
  constraints?: ConstraintInfo[];
}

/**
 * Index information
 */
export interface IndexInfo {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
  type?: string;
}

/**
 * Constraint information
 */
export interface ConstraintInfo {
  name: string;
  tableName: string;
  type: "primary_key" | "foreign_key" | "unique" | "check";
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}
