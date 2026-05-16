/**
 * SQLite Core Tools - Convenience Schemas
 *
 * Zod schemas and preprocessors for convenience operations:
 * Upsert, BatchInsert, Count, Exists, Truncate.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../../sqlite-adapter.js";
import {
  ErrorCategory,
  type ErrorResponse,
} from "../../../../utils/errors/index.js";
import { resolveAliases } from "../../types.js";

// =============================================================================
// Table Existence Validation (P154 Pattern)
// =============================================================================

/**
 * Validate that a table exists before executing operations.
 * Throws a high-signal error instead of letting raw SQLite
 * "no such table" errors propagate.
 */
export async function validateTableExists(
  adapter: SqliteAdapter,
  table: string,
): Promise<ErrorResponse | null> {
  const tableSql = `SELECT 1 FROM pragma_table_list(?) WHERE type IN ('table', 'view') LIMIT 1`;
  const result = await adapter.executeReadQuery(tableSql, [table]);

  if (!result.rows || result.rows.length === 0) {
    return {
      success: false,
      error: `Table or view '${table}' not found. Use sqlite_list_tables to see available tables.`,
      code: "TABLE_NOT_FOUND",
      category: ErrorCategory.RESOURCE,
      suggestion: "Table or view does not exist. Run sqlite_list_tables to see available tables.",
      details: undefined,
      recoverable: false,
    };
  }
  return null;
}

// =============================================================================
// Common Preprocessors
// =============================================================================

/**
 * Preprocess table parameters:
 * - Alias: tableName/name → table
 */
export function preprocessTableParams(input: unknown): unknown {
  return resolveAliases(input, { table: "tableName", name: "table" });
}

// =============================================================================
// Upsert Schema
// =============================================================================

export const UpsertSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  data: z.record(z.string(), z.unknown()).optional().describe("Column-value pairs to insert"),
  values: z.record(z.string(), z.unknown()).optional().describe("Alias for data"),
  conflictColumns: z.array(z.string()).optional().describe("Columns that form the unique constraint (ON CONFLICT). If omitted, falls back to INSERT OR REPLACE."),
  updateColumns: z.array(z.string()).optional().describe("Columns to update on conflict (default: all except conflict columns). Only used if conflictColumns is provided."),
  returning: z.array(z.string()).optional().describe("Columns to return"),
});

export const UpsertSchema = z
  .preprocess((val) => resolveAliases(val, { table: "tableName", data: "values" }), UpsertSchemaBase)
  .transform((d) => ({
    ...d,
    table: d.table ?? d.tableName ?? "",
    data: d.data ?? d.values ?? {},
    conflictColumns: d.conflictColumns ?? [],
  }))
  .refine((d) => d.table !== "", {
    message: 'table (or tableName alias) is required. Usage: sqlite_upsert({ table: "users", data: { name: "John" }, conflictColumns: ["id"] })',
  })
  .refine((d) => Object.keys(d.data).length > 0, {
    message: "data (or values alias) is required",
  });

// =============================================================================
// BatchInsert Schema
// =============================================================================

export const BatchInsertSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  rows: z.array(z.record(z.string(), z.unknown())).optional().describe("Array of row objects to insert"),
  returning: z.array(z.string()).optional().describe("Columns to return"),
});

export const BatchInsertSchema = z
  .preprocess((val) => resolveAliases(val, { table: "tableName" }), BatchInsertSchemaBase)
  .transform((data) => ({
    ...data,
    table: data.table ?? data.tableName ?? "",
    rows: data.rows ?? [],
  }))
  .refine((data) => data.table !== "", {
    message: 'table (or tableName alias) is required. Usage: sqlite_batch_insert({ table: "users", rows: [{ name: "John" }, { name: "Jane" }] })',
  })
  .refine((data) => data.rows.length > 0, {
    message: 'rows must not be empty. Provide at least one row to insert.',
  });

// =============================================================================
// Count Schema
// =============================================================================

export const CountSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  where: z.string().optional().describe("WHERE clause (supports ? placeholders)"),
  params: z.unknown().optional().describe("Parameters for WHERE clause placeholders"),
  condition: z.string().optional().describe("Alias for where"),
  filter: z.string().optional().describe("Alias for where"),
  column: z.string().optional().describe("Column to count (default: * for all rows)"),
});

export const CountSchema = z
  .preprocess((val) => resolveAliases(resolveAliases(val, { table: "tableName" }), { where: "condition" }), CountSchemaBase)
  .transform((data) => ({
    ...data,
    table: data.table ?? data.tableName ?? "",
    where: data.where ?? data.condition ?? data.filter,
    params: Array.isArray(data.params) ? data.params : (data.params !== undefined && data.params !== null ? [data.params] : []),
  }))
  .refine((data) => data.table !== "", {
    message: 'table (or tableName alias) is required.',
  });

// =============================================================================
// Exists Schema
// =============================================================================

export const ExistsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  where: z.string().optional().describe("WHERE clause (supports ? placeholders)"),
  params: z.unknown().optional().describe("Parameters for WHERE clause placeholders"),
  condition: z.string().optional().describe("Alias for where"),
  filter: z.string().optional().describe("Alias for where"),
});

export const ExistsSchema = z
  .preprocess((val) => resolveAliases(resolveAliases(val, { table: "tableName" }), { where: "condition" }), ExistsSchemaBase)
  .transform((data) => ({
    ...data,
    table: data.table ?? data.tableName ?? "",
    where: data.where ?? data.condition ?? data.filter,
    params: Array.isArray(data.params) ? data.params : (data.params !== undefined && data.params !== null ? [data.params] : []),
  }))
  .refine((data) => data.table !== "", {
    message: 'table (or tableName alias) is required.',
  });

// =============================================================================
// Truncate Schema
// =============================================================================

export const TruncateSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  restartIdentity: z.boolean().optional().describe("Restart identity sequences (DELETE FROM sqlite_sequence)"),
});

export const TruncateSchema = z
  .preprocess((val) => resolveAliases(val, { table: "tableName" }), TruncateSchemaBase)
  .transform((data) => ({
    ...data,
    table: data.table ?? data.tableName ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: 'table (or tableName alias) is required.',
  });
