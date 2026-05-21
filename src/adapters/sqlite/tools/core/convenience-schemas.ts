/**
 * SQLite Core Tools - Convenience Schemas
 *
 * Zod schemas and preprocessors for convenience operations:
 * Upsert, BatchInsert, Count, Exists, Truncate.
 */

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
      suggestion:
        "Table or view does not exist. Run sqlite_list_tables to see available tables.",
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
