/**
 * SQLite Query Executor Unit Tests
 *
 * Tests WASM query execution: read, write, and general queries.
 * Note: executeRead/executeWrite/executeGeneral throw synchronously
 * (they return Promise.resolve for success, but throw in catch blocks).
 */

import { describe, it, expect } from "vitest";
import initSqlJs from "sql.js";
import {
  executeRead,
  executeWrite,
  executeGeneral,
  rowsFromSqlJsResult,
} from "../../../src/adapters/sqlite/query-executor.js";
import { QueryError } from "../../../src/utils/errors/index.js";

// =============================================================================
// Test Setup
// =============================================================================

async function createTestDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(
    "CREATE TABLE test_qe (id INTEGER PRIMARY KEY, name TEXT, value REAL)",
  );
  db.run("INSERT INTO test_qe VALUES (1, 'alpha', 1.1)");
  db.run("INSERT INTO test_qe VALUES (2, 'beta', 2.2)");
  db.run("INSERT INTO test_qe VALUES (3, 'gamma', 3.3)");
  return db;
}

// =============================================================================
// rowsFromSqlJsResult
// =============================================================================

describe("rowsFromSqlJsResult", () => {
  it("should convert sql.js result to row objects", () => {
    const result = {
      columns: ["id", "name"],
      values: [
        [1, "alpha"],
        [2, "beta"],
      ],
    };

    const rows = rowsFromSqlJsResult(result);

    expect(rows).toEqual([
      { id: 1, name: "alpha" },
      { id: 2, name: "beta" },
    ]);
  });

  it("should handle empty values", () => {
    const result = { columns: ["id"], values: [] };
    expect(rowsFromSqlJsResult(result)).toEqual([]);
  });

  it("should handle null values in rows", () => {
    const result = {
      columns: ["id", "name"],
      values: [[1, null]],
    };

    const rows = rowsFromSqlJsResult(result);
    expect(rows[0]).toEqual({ id: 1, name: null });
  });
});

// =============================================================================
// executeRead
// =============================================================================

describe("executeRead", () => {
  it("should execute SELECT and return rows", async () => {
    const db = await createTestDb();

    const result = await executeRead(db, "SELECT * FROM test_qe ORDER BY id");

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({ id: 1, name: "alpha", value: 1.1 });
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.columns).toBeDefined();

    db.close();
  });

  it("should execute query with parameters", async () => {
    const db = await createTestDb();

    const result = await executeRead(
      db,
      "SELECT * FROM test_qe WHERE id = ?",
      [2],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ id: 2, name: "beta", value: 2.2 });

    db.close();
  });

  it("should return empty rows for no-match query", async () => {
    const db = await createTestDb();

    const result = await executeRead(
      db,
      "SELECT * FROM test_qe WHERE id = 999",
    );

    expect(result.rows).toHaveLength(0);

    db.close();
  });

  it("should throw QueryError for invalid SQL", async () => {
    const db = await createTestDb();

    // executeRead throws synchronously
    expect(() => executeRead(db, "INVALID SQL")).toThrow(QueryError);

    db.close();
  });

  it("should throw QueryError for non-existent table", async () => {
    const db = await createTestDb();

    expect(() => executeRead(db, "SELECT * FROM nonexistent")).toThrow(
      QueryError,
    );

    db.close();
  });
});

// =============================================================================
// executeWrite
// =============================================================================

describe("executeWrite", () => {
  it("should execute INSERT and return rowsAffected", async () => {
    const db = await createTestDb();

    const result = await executeWrite(
      db,
      "INSERT INTO test_qe VALUES (4, 'delta', 4.4)",
    );

    expect(result.rowsAffected).toBe(1);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);

    db.close();
  });

  it("should execute UPDATE with parameters", async () => {
    const db = await createTestDb();

    const result = await executeWrite(
      db,
      "UPDATE test_qe SET name = ? WHERE id = ?",
      ["updated", 1],
    );

    expect(result.rowsAffected).toBe(1);

    // Verify the update
    const check = await executeRead(
      db,
      "SELECT name FROM test_qe WHERE id = 1",
    );
    expect(check.rows[0]).toEqual({ name: "updated" });

    db.close();
  });

  it("should execute DELETE", async () => {
    const db = await createTestDb();

    const result = await executeWrite(db, "DELETE FROM test_qe WHERE id = 3");

    expect(result.rowsAffected).toBe(1);

    db.close();
  });

  it("should return 0 rowsAffected for no-match UPDATE", async () => {
    const db = await createTestDb();

    const result = await executeWrite(
      db,
      "UPDATE test_qe SET name = 'x' WHERE id = 999",
    );

    expect(result.rowsAffected).toBe(0);

    db.close();
  });

  it("should throw QueryError for constraint violation", async () => {
    const db = await createTestDb();

    expect(() =>
      executeWrite(db, "INSERT INTO test_qe VALUES (1, 'dup', 0)"),
    ).toThrow(QueryError);

    db.close();
  });

  it("should throw QueryError for invalid SQL", async () => {
    const db = await createTestDb();

    expect(() => executeWrite(db, "INVALID SQL")).toThrow(QueryError);

    db.close();
  });
});

// =============================================================================
// executeGeneral
// =============================================================================

describe("executeGeneral", () => {
  it("should execute query that returns rows", async () => {
    const db = await createTestDb();

    const result = await executeGeneral(
      db,
      "SELECT * FROM test_qe ORDER BY id",
    );

    expect(result.rows).toHaveLength(3);

    db.close();
  });

  it("should execute non-result query and return rowsAffected", async () => {
    const db = await createTestDb();

    const result = await executeGeneral(
      db,
      "CREATE TABLE test_general (id INTEGER)",
    );

    expect(result.rowsAffected).toBeDefined();

    db.close();
  });

  it("should execute PRAGMA query", async () => {
    const db = await createTestDb();

    const result = await executeGeneral(db, "PRAGMA table_info(test_qe)");

    expect(result.rows).toBeDefined();
    expect(result.rows!.length).toBeGreaterThan(0);

    db.close();
  });

  it("should handle parameters", async () => {
    const db = await createTestDb();

    const result = await executeGeneral(
      db,
      "SELECT * FROM test_qe WHERE name = ?",
      ["beta"],
    );

    expect(result.rows).toHaveLength(1);

    db.close();
  });

  it("should throw QueryError for invalid SQL", async () => {
    const db = await createTestDb();

    expect(() => executeGeneral(db, "INVALID SQL")).toThrow(QueryError);

    db.close();
  });
});
