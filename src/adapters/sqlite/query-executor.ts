/**
 * SQLite Query Executor
 *
 * Core query execution logic extracted from SqliteAdapter for modularity.
 * All functions operate on a sql.js Database instance passed as an argument.
 */

import type { Database } from "sql.js";
import type { QueryResult, ColumnInfo } from "../../types/index.js";
import { QueryError } from "../../utils/errors/index.js";
import { createModuleLogger, ERROR_CODES } from "../../utils/logger.js";
import { normalizeSqliteParams } from "../sqlite-helpers.js";

const log = createModuleLogger("SQLITE");

/** sql.js binding parameter types */
type SqlJsParams = (string | number | null | Uint8Array)[] | undefined;

/**
 * Convert sql.js query results to row objects.
 * Shared between executeRead and executeGeneral to eliminate duplication.
 */
export function rowsFromSqlJsResult(result: {
  columns: string[];
  values: unknown[][];
}): Record<string, unknown>[] {
  return result.values.map((row) => {
    const obj: Record<string, unknown> = {};
    result.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

/**
 * Execute a read-only query against a sql.js Database.
 */
export function executeRead(
  db: Database,
  sql: string,
  params?: unknown[],
): Promise<QueryResult> {
  const start = Date.now();

  try {
    const normalizedParams = normalizeSqliteParams(params) as SqlJsParams;
    const results = normalizedParams
      ? db.exec(sql, normalizedParams)
      : db.exec(sql);

    if (results.length === 0) {
      return Promise.resolve({
        rows: [],
        executionTimeMs: Date.now() - start,
      });
    }

    const firstResult = results[0];
    if (!firstResult) {
      return Promise.resolve({
        rows: [],
        executionTimeMs: Date.now() - start,
      });
    }

    const columns: ColumnInfo[] = firstResult.columns.map((name) => ({
      name,
      type: "unknown",
    }));
    const rows = rowsFromSqlJsResult(firstResult);

    return Promise.resolve({
      rows,
      columns,
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
 * Execute a write query against a sql.js Database.
 *
 * @returns QueryResult with rowsAffected count
 */
export function executeWrite(
  db: Database,
  sql: string,
  params?: unknown[],
): Promise<QueryResult> {
  const start = Date.now();

  try {
    const normalizedParams = normalizeSqliteParams(params) as SqlJsParams;
    if (normalizedParams) {
      db.run(sql, normalizedParams);
    } else {
      db.run(sql);
    }

    const changes = db.getRowsModified();

    return Promise.resolve({
      rowsAffected: changes,
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
 * Execute any query (for admin operations) against a sql.js Database.
 *
 * Returns rows if the statement produces results, otherwise rowsAffected.
 */
export function executeGeneral(
  db: Database,
  sql: string,
  params?: unknown[],
): Promise<QueryResult> {
  const start = Date.now();

  try {
    const normalizedParams = normalizeSqliteParams(params) as SqlJsParams;
    const results = normalizedParams
      ? db.exec(sql, normalizedParams)
      : db.exec(sql);

    if (results.length === 0) {
      return Promise.resolve({
        rowsAffected: db.getRowsModified(),
        executionTimeMs: Date.now() - start,
      });
    }

    const firstResult = results[0];
    if (!firstResult) {
      return Promise.resolve({
        rowsAffected: db.getRowsModified(),
        executionTimeMs: Date.now() - start,
      });
    }

    const rows = rowsFromSqlJsResult(firstResult);

    return Promise.resolve({
      rows,
      executionTimeMs: Date.now() - start,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Query failed: ${message}`, { cause: error });
  }
}
