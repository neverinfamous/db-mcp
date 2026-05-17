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

export const UpsertSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  data: z.record(z.string(), z.unknown()).describe("Column-value pairs to insert"),
  values: z.record(z.string(), z.unknown()).optional().describe("Alias for data"),
  conflictColumns: z.union([z.array(z.string()), z.string()]).optional().describe("Columns that form the unique constraint (ON CONFLICT). If omitted, falls back to INSERT OR REPLACE."),
  conflictColumn: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for conflictColumns"),
  updateColumns: z.array(z.string()).optional().describe("Columns to update on conflict (default: all except conflict columns). Only used if conflictColumns is provided."),
  returning: z.array(z.string()).optional().describe("Columns to return"),
});

// =============================================================================
// BatchInsert Schema
// =============================================================================

export const BatchInsertSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  rows: z.array(z.record(z.string(), z.unknown())).describe("Array of row objects to insert"),
  returning: z.array(z.string()).optional().describe("Columns to return"),
});

// =============================================================================
// Count Schema
// =============================================================================

export const CountSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  where: z.string().optional().describe("WHERE clause (supports ? placeholders)"),
  params: z.unknown().optional().describe("Parameters for WHERE clause placeholders"),
  condition: z.string().optional().describe("Alias for where"),
  filter: z.string().optional().describe("Alias for where"),
  whereClause: z.string().optional().describe("Alias for where"),
  column: z.string().optional().describe("Column to count (default: * for all rows)"),
  columnName: z.string().optional().describe("Alias for column"),
  distinct: z.boolean().optional().describe("Count distinct values of the specified column"),
});

// =============================================================================
// Exists Schema
// =============================================================================

export const ExistsSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  where: z.string().optional().describe("WHERE clause (supports ? placeholders)"),
  params: z.unknown().optional().describe("Parameters for WHERE clause placeholders"),
  condition: z.string().optional().describe("Alias for where"),
  filter: z.string().optional().describe("Alias for where"),
  whereClause: z.string().optional().describe("Alias for where"),
});

// =============================================================================
// Truncate Schema
// =============================================================================

export const TruncateSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  restartIdentity: z.boolean().optional().describe("Restart identity sequences (DELETE FROM sqlite_sequence)"),
});
