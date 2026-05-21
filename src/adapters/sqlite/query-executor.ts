/**
 * SQLite Query Executor
 *
 * Core query execution logic extracted from SqliteAdapter for modularity.
 * All functions operate on a sql.js Database instance passed as an argument.
 */

import type { Database } from "sql.js";
import type { QueryResult, ColumnInfo } from "../../types/index.js";
import {
  QueryError,
  ResourceNotFoundError,
  findSuggestion,
} from "../../utils/errors/index.js";
import { createModuleLogger, ERROR_CODES } from "../../utils/logger/index.js";
import type { ModuleLogger } from "../../utils/logger/index.js";
import { normalizeSqliteParams } from "../sqlite-helpers.js";

const log = createModuleLogger("SQLITE");

/**
 * Helper to translate raw SQLite errors into typed db-mcp errors with better messages.
 */
export function translateSqliteError(
  error: unknown,
  sql: string,
  operation: string,
  overrideLog?: ModuleLogger,
): never {
  const message = error instanceof Error ? error.message : String(error);
  const match = findSuggestion(message);

  // Extract table/column names if possible for better error messages
  const improvedMessage = `${operation} failed: ${message}`;
  const details: Record<string, unknown> = { sql };

  if (match?.code === "TABLE_NOT_FOUND") {
    const tableMatch = /no such table[:\s]*(['"]?)(\w+)\1/i.exec(message);
    const tableName = tableMatch ? tableMatch[2] : "unknown";
    throw new ResourceNotFoundError(
      `Table '${tableName}' not found`,
      "TABLE_NOT_FOUND",
      {
        resourceType: "table",
        resourceName: tableName,
        details,
        suggestion: match.suggestion,
        cause: error instanceof Error ? error : undefined,
      },
    );
  }

  if (match?.code === "COLUMN_NOT_FOUND") {
    const colMatch =
      /no such column[:\s]*(['"]?)(\w+)\1/i.exec(message) ??
      /has no column named[:\s]*(['"]?)(\w+)\1/i.exec(message);
    const colName = colMatch ? colMatch[2] : "unknown";
    throw new ResourceNotFoundError(
      `Column '${colName}' not found`,
      "COLUMN_NOT_FOUND",
      {
        resourceType: "column",
        resourceName: colName,
        details,
        suggestion: match.suggestion,
        cause: error instanceof Error ? error : undefined,
      },
    );
  }

  const loggerToUse = overrideLog ?? log;
  loggerToUse.error(`${operation} failed: ${message}`, {
    code: ERROR_CODES.DB.QUERY_FAILED.full,
  });

  throw new QueryError(improvedMessage, match?.code ?? "DB_QUERY_FAILED", {
    sql,
    cause: error instanceof Error ? error : undefined,
    suggestion: match?.suggestion,
  });
}

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
  const numColumns = result.columns.length;
  const numRows = result.values.length;
  const rows = new Array<Record<string, unknown>>(numRows);
  const cols = result.columns;

  for (let i = 0; i < numRows; i++) {
    const rowObj: Record<string, unknown> = {};
    const rowValues = result.values[i];
    if (rowValues) {
      for (let j = 0; j < numColumns; j++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        rowObj[cols[j]!] = rowValues[j];
      }
    }
    rows[i] = rowObj;
  }
  return rows;
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
    translateSqliteError(error, sql, "Query execution");
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
    let rows: Record<string, unknown>[] = [];

    // sql.js db.run does not return rows. If RETURNING is used, we must use exec.
    if (/\bRETURNING\b/i.test(sql)) {
      const results = normalizedParams
        ? db.exec(sql, normalizedParams)
        : db.exec(sql);
      if (results.length > 0 && results[0]) {
        rows = rowsFromSqlJsResult(results[0]);
      }
    } else {
      if (normalizedParams) {
        db.run(sql, normalizedParams);
      } else {
        db.run(sql);
      }
    }

    const changes = db.getRowsModified();

    let lastInsertId: number | undefined;
    try {
      const rowidResult = db.exec("SELECT last_insert_rowid()");
      if (rowidResult[0]?.values[0]) {
        lastInsertId = Number(rowidResult[0].values[0][0]);
      }
    } catch {
      // Ignore if not supported
    }

    const result: QueryResult = {
      rows,
      rowsAffected: changes,
      executionTimeMs: Date.now() - start,
    };
    if (lastInsertId !== undefined) {
      result.lastInsertId = lastInsertId;
    }
    return Promise.resolve(result);
  } catch (error) {
    translateSqliteError(error, sql, "Write query");
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
    translateSqliteError(error, sql, "Query");
  }
}
