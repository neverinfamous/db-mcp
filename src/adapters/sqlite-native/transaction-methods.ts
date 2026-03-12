/**
 * Native SQLite Transaction Methods
 *
 * Transaction management utilities extracted from NativeSqliteAdapter
 * to keep the main adapter file under the 500-line limit.
 */

import type { Database as BetterSqliteDb } from "better-sqlite3";

/**
 * Begin a transaction
 */
export function beginTransaction(db: BetterSqliteDb): void {
  db.exec("BEGIN TRANSACTION");
}

/**
 * Commit a transaction
 */
export function commitTransaction(db: BetterSqliteDb): void {
  db.exec("COMMIT");
}

/**
 * Rollback a transaction
 */
export function rollbackTransaction(db: BetterSqliteDb): void {
  db.exec("ROLLBACK");
}

/**
 * Create a savepoint
 */
export function savepoint(db: BetterSqliteDb, name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error("Invalid savepoint name. Must start with a letter/underscore and contain only alphanumeric chars.");
  }
  // Name is validated to be safe (no quotes or special chars)
  db.exec(`SAVEPOINT "${name}"`);
}

/**
 * Release a savepoint
 */
export function releaseSavepoint(db: BetterSqliteDb, name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error("Invalid savepoint name. Must start with a letter/underscore and contain only alphanumeric chars.");
  }
  db.exec(`RELEASE SAVEPOINT "${name}"`);
}

/**
 * Rollback to a savepoint
 */
export function rollbackToSavepoint(db: BetterSqliteDb, name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error("Invalid savepoint name. Must start with a letter/underscore and contain only alphanumeric chars.");
  }
  db.exec(`ROLLBACK TO SAVEPOINT "${name}"`);
}
