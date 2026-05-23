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

  /** Optional SQL statements to run immediately after connection */
  initializationSql?: string[];

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

/**
 * Alias coercion: maps legacy parameter names to canonical names.
 * If the canonical field is missing but the alias is present, the alias
 * value is transparently moved to the canonical field.
 *
 * Applied in handlers before `.parse()` — NOT in the schema itself,
 * because wrapping in `z.preprocess()` turns `ZodObject` into `ZodEffects`
 * which breaks the SDK's `.partial()` call in `registerToolImpl`.
 */

/**
 * Coerce string-typed numbers to actual numbers.
 * Returns undefined for non-numeric strings so the schema default kicks in.
 */

export function resolveAliases(
  params: unknown,
  aliasMap: Record<string, string>,
): unknown {
  if (typeof params !== "object" || params === null) return params;
  const obj = params as Record<string, unknown>;
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if ((obj[canonical] === undefined || obj[canonical] === "") && obj[alias] !== undefined) {
      obj[canonical] = obj[alias];
    }
  }
  return obj;
}

// Core Tool Schemas

// JSON Helper Schemas

// JSON Operation Schemas

// Vacuum Schema
export const VacuumSchema = z.object({
  analyze: z
    .boolean()
    .optional()
    .default(true)
    .describe("Run ANALYZE after VACUUM"),
});

// Analyze JSON Schema

// Create JSON Collection

// JSON Security Scan

// Export schema types
