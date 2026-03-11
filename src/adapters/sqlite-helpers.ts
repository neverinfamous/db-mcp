/**
 * Shared SQLite Adapter Helpers
 *
 * Common utilities shared between WASM (sql.js) and native (better-sqlite3) adapters.
 */

import type { SqliteOptions } from "./sqlite/types.js";

/**
 * Check if SQL is a DDL statement (CREATE, ALTER, DROP).
 * Used to auto-invalidate schema cache on structure changes.
 */
export function isDDL(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  return (
    normalized.startsWith("CREATE") ||
    normalized.startsWith("ALTER") ||
    normalized.startsWith("DROP")
  );
}

/**
 * Normalize parameters for SQLite binding.
 * Converts booleans to integers since SQLite doesn't have native boolean type.
 * Shared between WASM and native adapters.
 */
export function normalizeSqliteParams(
  params?: unknown[],
): unknown[] | undefined {
  if (!params) return undefined;
  return params.map((p) => {
    if (typeof p === "boolean") return p ? 1 : 0;
    return p;
  });
}

// =============================================================================
// Shared PRAGMA Helpers
// =============================================================================

/**
 * Abstraction over the different PRAGMA execution APIs.
 * - WASM (sql.js): `db.run("PRAGMA journal_mode = WAL")`
 * - Native (better-sqlite3): `db.pragma("journal_mode = WAL")`
 */
export interface PragmaExecutor {
  /** Execute a PRAGMA statement (e.g., "journal_mode = WAL") */
  runPragma(pragma: string): void;
}

/**
 * Apply common SQLite PRAGMA options.
 * Shared between WASM and native adapters to eliminate duplication.
 */
export function applyCommonPragmas(
  executor: PragmaExecutor,
  options: SqliteOptions,
): void {
  if (options.walMode) {
    executor.runPragma("journal_mode = WAL");
  }
  if (options.foreignKeys !== undefined) {
    executor.runPragma(
      `foreign_keys = ${options.foreignKeys ? "ON" : "OFF"}`,
    );
  }
  if (options.busyTimeout !== undefined) {
    executor.runPragma(`busy_timeout = ${options.busyTimeout}`);
  }
  if (options.cacheSize !== undefined) {
    executor.runPragma(`cache_size = ${options.cacheSize}`);
  }
}

