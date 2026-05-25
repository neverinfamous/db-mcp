/**
 * Native SQLite Query Executor
 *
 * Core query execution logic extracted from NativeSqliteAdapter for modularity.
 * All functions operate on a better-sqlite3 Database instance passed as an argument.
 */

import type { Database as BetterSqliteDb } from "better-sqlite3";
import type { QueryResult } from "../../types/index.js";
import type { ModuleLogger } from "../../utils/logger/index.js";
import { normalizeSqliteParams } from "../sqlite-helpers.js";
import { translateSqliteError } from "../sqlite/query-executor.js";

/**
 * Execute a read-only query against a better-sqlite3 Database.
 */
export function nativeExecuteRead(
  db: BetterSqliteDb,
  sql: string,
  params: unknown[] | undefined,
  log: ModuleLogger,
): Promise<QueryResult> {
  const start = Date.now();

  try {
    const stmt = db.prepare(sql);
    const normalizedParams = normalizeSqliteParams(params);
    const rows = normalizedParams ? stmt.all(...normalizedParams) : stmt.all();

    return Promise.resolve({
      rows: rows as Record<string, unknown>[],
      columns: stmt
        .columns()
        .map((c) => ({ name: c.name, type: c.type ?? "unknown" })),
      executionTimeMs: Date.now() - start,
    });
  } catch (error: unknown) {
    translateSqliteError(error, sql, "Query execution", log);
  }
}

/**
 * Execute a write query against a better-sqlite3 Database.
 *
 * @returns QueryResult with rowsAffected count
 */
export function nativeExecuteWrite(
  db: BetterSqliteDb,
  sql: string,
  params: unknown[] | undefined,
  log: ModuleLogger,
): Promise<QueryResult> {
  const start = Date.now();

  try {
    const stmt = db.prepare(sql);
    const normalizedParams = normalizeSqliteParams(params);

    if (stmt.reader) {
      // If the query returns data (e.g., INSERT ... RETURNING)
      const rows = normalizedParams
        ? stmt.all(...normalizedParams)
        : stmt.all();
      return Promise.resolve({
        rows: rows as Record<string, unknown>[],
        rowsAffected: rows.length, // .all() does not return changes, but we know it's rows.length for RETURNING
        executionTimeMs: Date.now() - start,
      });
    }

    const info = normalizedParams ? stmt.run(...normalizedParams) : stmt.run();

    const result: QueryResult = {
      rows: [],
      rowsAffected: info.changes,
      executionTimeMs: Date.now() - start,
    };
    if (info.lastInsertRowid !== undefined) {
      result.lastInsertId = Number(info.lastInsertRowid);
    }
    return Promise.resolve(result);
  } catch (error: unknown) {
    translateSqliteError(error, sql, "Write query", log);
  }
}

/**
 * Execute any query (routing SELECT/PRAGMA/EXPLAIN to read, rest to write).
 */
export function nativeExecuteGeneral(
  db: BetterSqliteDb,
  sql: string,
  params: unknown[] | undefined,
  log: ModuleLogger,
): Promise<QueryResult> {
  const trimmed = sql.trim().toUpperCase();
  if (
    trimmed.startsWith("SELECT") ||
    trimmed.startsWith("PRAGMA") ||
    trimmed.startsWith("EXPLAIN")
  ) {
    return nativeExecuteRead(db, sql, params, log);
  }
  return nativeExecuteWrite(db, sql, params, log);
}
