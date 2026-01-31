/**
 * SQLite Adapter Types
 *
 * Type definitions specific to the SQLite adapter including
 * configuration, query results, and tool input schemas.
 */

import { z } from "zod";
import type { DatabaseConfig, QueryResult } from "../../types/index.js";

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * SQLite-specific options (with index signature for compatibility)
 */
export interface SqliteOptions {
  /** Enable WAL mode for better concurrency */
  walMode?: boolean;

  /** Foreign key enforcement */
  foreignKeys?: boolean;

  /** Busy timeout in milliseconds */
  busyTimeout?: number;

  /** Cache size in pages (negative = KB) */
  cacheSize?: number;

  /** Enable SpatiaLite extension if available */
  spatialite?: boolean;

  /** Enable CSV extension for CSV virtual tables */
  csv?: boolean;

  /**
   * JSON storage format:
   * - 'text': Always use text JSON (compatible with all SQLite versions)
   * - 'jsonb': Use JSONB binary format (requires SQLite 3.45+, falls back to text)
   * - 'auto': Use JSONB if available, else text (default)
   */
  jsonStorage?: "text" | "jsonb" | "auto";

  /** Enable automatic JSON normalization (key sorting, compact format) */
  jsonNormalize?: boolean;

  /** Index signature for compatibility with DatabaseConfig.options */
  [key: string]: unknown;
}

/**
 * SQLite-specific configuration extending base DatabaseConfig
 */
export interface SqliteConfig extends DatabaseConfig {
  type: "sqlite";

  /** Path to SQLite database file (use ':memory:' for in-memory) */
  filePath?: string;

  /** SQLite-specific options */
  options?: SqliteOptions;
}

/**
 * SQLite query result with additional metadata
 */
export interface SqliteQueryResult extends QueryResult {
  /** Changes made by the query */
  changes?: number;

  /** Last row ID for INSERT operations */
  lastInsertRowid?: number | bigint;
}

// =============================================================================
// JSON Types
// =============================================================================

/**
 * Supported JSON value types
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * JSON normalization result
 */
export interface JsonNormalizationResult {
  normalized: string;
  wasModified: boolean;
  changes: string[];
}

// =============================================================================
// Tool Input Schemas (Zod)
// =============================================================================

// Core Tool Schemas
export const ReadQuerySchema = z.object({
  query: z.string().describe("SELECT query to execute"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statements"),
});

export const WriteQuerySchema = z.object({
  query: z.string().describe("INSERT/UPDATE/DELETE query to execute"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statements"),
});

export const CreateTableSchema = z.object({
  tableName: z.string().describe("Name of the table to create"),
  columns: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().optional().default(true),
        primaryKey: z.boolean().optional().default(false),
        unique: z.boolean().optional().default(false),
        defaultValue: z.unknown().optional(),
      }),
    )
    .describe("Column definitions"),
  ifNotExists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add IF NOT EXISTS clause"),
});

export const DescribeTableSchema = z.object({
  tableName: z.string().describe("Name of the table to describe"),
});

export const DropTableSchema = z.object({
  tableName: z.string().describe("Name of the table to drop"),
  ifExists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add IF EXISTS clause"),
});

export const CreateIndexSchema = z.object({
  indexName: z.string().describe("Name of the index"),
  tableName: z.string().describe("Table to create index on"),
  columns: z.array(z.string()).describe("Columns to index"),
  unique: z.boolean().optional().default(false).describe("Create unique index"),
  ifNotExists: z.boolean().optional().default(true),
});

export const GetIndexesSchema = z.object({
  tableName: z.string().optional().describe("Filter indexes by table name"),
});

// JSON Helper Schemas
export const JsonInsertSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  data: z.unknown().describe("JSON data to insert (auto-normalized)"),
  additionalColumns: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Other column values"),
});

export const JsonUpdateSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path (e.g., $.key.subkey)"),
  value: z.unknown().describe("New value"),
  whereClause: z.string().describe("WHERE clause to identify rows"),
});

export const JsonSelectSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  paths: z.array(z.string()).optional().describe("JSON paths to extract"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
});

export const JsonQuerySchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  filterPaths: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Path-value filters"),
  selectPaths: z.array(z.string()).optional().describe("Paths to select"),
  limit: z.number().optional().default(100),
});

export const JsonValidatePathSchema = z.object({
  path: z.string().describe("JSON path to validate"),
});

export const JsonMergeSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  mergeData: z.unknown().describe("JSON object to merge"),
  whereClause: z.string().describe("WHERE clause to identify rows"),
  deep: z.boolean().optional().default(false).describe("Deep merge"),
});

// JSON Operation Schemas
export const ValidateJsonSchema = z.object({
  json: z.string().describe("JSON string to validate"),
});

export const JsonExtractSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path to extract"),
  whereClause: z.string().optional(),
});

export const JsonSetSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path"),
  value: z.unknown().describe("Value to set"),
  whereClause: z.string().describe("WHERE clause"),
});

export const JsonRemoveSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path to remove"),
  whereClause: z.string().describe("WHERE clause"),
});

// Vacuum Schema
export const VacuumSchema = z.object({
  analyze: z
    .boolean()
    .optional()
    .default(true)
    .describe("Run ANALYZE after VACUUM"),
});

// Analyze JSON Schema
export const AnalyzeJsonSchemaSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to analyze"),
  sampleSize: z
    .number()
    .optional()
    .default(100)
    .describe("Number of rows to sample"),
});

// Create JSON Collection
export const CreateJsonCollectionSchema = z.object({
  tableName: z.string().describe("Collection table name"),
  idColumn: z.string().optional().default("id").describe("ID column name"),
  dataColumn: z
    .string()
    .optional()
    .default("data")
    .describe("JSON data column name"),
  timestamps: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add created_at/updated_at columns"),
  indexes: z
    .array(
      z.object({
        path: z.string().describe("JSON path to index (e.g., $.name)"),
        name: z
          .string()
          .optional()
          .describe("Index name (auto-generated if omitted)"),
      }),
    )
    .optional()
    .describe("JSON path indexes to create"),
});

// Export schema types
export type ReadQueryInput = z.infer<typeof ReadQuerySchema>;
export type WriteQueryInput = z.infer<typeof WriteQuerySchema>;
export type CreateTableInput = z.infer<typeof CreateTableSchema>;
export type DescribeTableInput = z.infer<typeof DescribeTableSchema>;
export type DropTableInput = z.infer<typeof DropTableSchema>;
export type CreateIndexInput = z.infer<typeof CreateIndexSchema>;
export type GetIndexesInput = z.infer<typeof GetIndexesSchema>;
export type JsonInsertInput = z.infer<typeof JsonInsertSchema>;
export type JsonUpdateInput = z.infer<typeof JsonUpdateSchema>;
export type JsonSelectInput = z.infer<typeof JsonSelectSchema>;
export type JsonQueryInput = z.infer<typeof JsonQuerySchema>;
export type JsonValidatePathInput = z.infer<typeof JsonValidatePathSchema>;
export type JsonMergeInput = z.infer<typeof JsonMergeSchema>;
export type ValidateJsonInput = z.infer<typeof ValidateJsonSchema>;
export type JsonExtractInput = z.infer<typeof JsonExtractSchema>;
export type JsonSetInput = z.infer<typeof JsonSetSchema>;
export type JsonRemoveInput = z.infer<typeof JsonRemoveSchema>;
export type VacuumInput = z.infer<typeof VacuumSchema>;
export type AnalyzeJsonSchemaInput = z.infer<typeof AnalyzeJsonSchemaSchema>;
export type CreateJsonCollectionInput = z.infer<
  typeof CreateJsonCollectionSchema
>;
