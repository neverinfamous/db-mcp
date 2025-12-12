/**
 * Native SQLite Adapter Module
 * 
 * Uses better-sqlite3 for synchronous, native SQLite access with
 * FTS5, window functions, SpatiaLite, and transaction support.
 */

export { NativeSqliteAdapter, createNativeSqliteAdapter } from './NativeSqliteAdapter.js';
export { getTransactionTools } from './tools/transactions.js';
export { getWindowTools } from './tools/window.js';
