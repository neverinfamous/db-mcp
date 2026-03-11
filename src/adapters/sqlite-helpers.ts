/**
 * Shared SQLite Adapter Helpers
 *
 * Common utilities shared between WASM (sql.js) and native (better-sqlite3) adapters.
 */

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
