/**
 * Native SQLite Query Executor
 *
 * Core query execution logic extracted from NativeSqliteAdapter for modularity.
 * All functions operate on a better-sqlite3 Database instance passed as an argument.
 */

import type { Database as BetterSqliteDb } from "better-sqlite3";
import type { QueryResult } from "../../types/index.js";
import { QueryError } from "../../utils/errors/index.js";
import { ERROR_CODES } from "../../utils/logger.js";
import type { ModuleLogger } from "../../utils/logger.js";
import { normalizeSqliteParams } from "../sqlite-helpers.js";

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
    const rows = normalizedParams
      ? stmt.all(...normalizedParams)
      : stmt.all();

    return Promise.resolve({
      rows: rows as Record<string, unknown>[],
      columns: stmt
        .columns()
        .map((c) => ({ name: c.name, type: c.type ?? "unknown" })),
      executionTimeMs: Date.now() - start,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Query failed: ${message}`, {
      code: ERROR_CODES.DB.QUERY_FAILED.full,
    });
    throw new QueryError(
      `Query execution failed: ${message}`,
      "DB_QUERY_FAILED",
      {
        sql,
        cause: error instanceof Error ? error : undefined,
      },
    );
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
    const info = normalizedParams
      ? stmt.run(...normalizedParams)
      : stmt.run();

    return Promise.resolve({
      rows: [],
      rowsAffected: info.changes,
      executionTimeMs: Date.now() - start,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Write query failed: ${message}`, {
      code: ERROR_CODES.DB.QUERY_FAILED.full,
    });
    throw new QueryError(
      `Write query failed: ${message}`,
      "DB_WRITE_FAILED",
      {
        sql,
        cause: error instanceof Error ? error : undefined,
      },
    );
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
