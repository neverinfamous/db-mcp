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
