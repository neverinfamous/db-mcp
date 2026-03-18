/**
 * SQLite Adapter Schema Fallback Unit Tests
 *
 * Tests the fallback schema functions for WASM mode.
 * These functions operate on a SqliteAdapter instance.
 */

import { describe, it, expect, vi } from "vitest";
import {
  fallBackGetSchema,
  fallBackListTables,
  fallBackDescribeTable,
  fallBackGetIndexes,
} from "../../../src/adapters/sqlite/sqlite-adapter/schema.js";

// =============================================================================
// Helpers
// =============================================================================

function createMockAdapter() {
  return {
    listTables: vi.fn(),
    describeTable: vi.fn(),
    getIndexes: vi.fn(),
    executeReadQuery: vi.fn(),
  } as any;
}

// =============================================================================
// fallBackGetSchema
// =============================================================================

describe("fallBackGetSchema", () => {
  it("should return tables and indexes from adapter", async () => {
    const adapter = createMockAdapter();
    const mockTables = [{ name: "users", type: "table", columns: [] }];
    const mockIndexes = [{ name: "idx_1", tableName: "users", columns: ["id"] }];
    adapter.listTables.mockResolvedValue(mockTables);
    adapter.getIndexes.mockResolvedValue(mockIndexes);

    const result = await fallBackGetSchema(adapter);

    expect(result.tables).toBe(mockTables);
    expect(result.indexes).toBe(mockIndexes);
    expect(adapter.listTables).toHaveBeenCalled();
    expect(adapter.getIndexes).toHaveBeenCalled();
  });
});

// =============================================================================
// fallBackListTables
// =============================================================================

describe("fallBackListTables", () => {
  it("should query sqlite_master and describe each table", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { name: "users", type: "table" },
        { name: "orders", type: "table" },
      ],
    });
    adapter.describeTable
      .mockResolvedValueOnce({ name: "users", columns: [{ name: "id" }] })
      .mockResolvedValueOnce({ name: "orders", columns: [{ name: "id" }] });

    const result = await fallBackListTables(adapter);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: "users", type: "table" });
    expect(result[1]).toMatchObject({ name: "orders", type: "table" });
    expect(adapter.describeTable).toHaveBeenCalledTimes(2);
  });

  it("should handle empty sqlite_master", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });

    const result = await fallBackListTables(adapter);
    expect(result).toHaveLength(0);
  });
});

// =============================================================================
// fallBackDescribeTable
// =============================================================================

describe("fallBackDescribeTable", () => {
  it("should describe table columns via PRAGMA", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery
      .mockResolvedValueOnce({
        rows: [
          { name: "id", type: "INTEGER", notnull: 1, pk: 1, dflt_value: null },
          { name: "email", type: "TEXT", notnull: 0, pk: 0, dflt_value: null },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ count: 42 }],
      });

    const result = await fallBackDescribeTable(adapter, "users");

    expect(result.name).toBe("users");
    expect(result.type).toBe("table");
    expect(result.columns).toHaveLength(2);
    expect(result.columns[0]).toMatchObject({
      name: "id",
      type: "INTEGER",
      primaryKey: true,
    });
    expect(result.rowCount).toBe(42);
  });

  it("should throw for SQL injection attempt in table name", async () => {
    const adapter = createMockAdapter();

    await expect(
      fallBackDescribeTable(adapter, "DROP TABLE users; --"),
    ).rejects.toThrow("Invalid table name");
  });

  it("should throw for empty table name", async () => {
    const adapter = createMockAdapter();

    await expect(
      fallBackDescribeTable(adapter, ""),
    ).rejects.toThrow();
  });

  it("should accept valid table names with underscores", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const result = await fallBackDescribeTable(adapter, "test_table_2");

    expect(result.name).toBe("test_table_2");
  });
});

// =============================================================================
// fallBackGetIndexes
// =============================================================================

describe("fallBackGetIndexes", () => {
  it("should return indexes from sqlite_master", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery
      .mockResolvedValueOnce({
        rows: [
          { name: "idx_email", tbl_name: "users", sql: "CREATE INDEX idx_email ON users(email)" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ name: "email" }],
      });

    const result = await fallBackGetIndexes(adapter);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "idx_email",
      tableName: "users",
      columns: ["email"],
      unique: false,
    });
  });

  it("should detect UNIQUE indexes", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery
      .mockResolvedValueOnce({
        rows: [
          { name: "idx_uniq", tbl_name: "users", sql: "CREATE UNIQUE INDEX idx_uniq ON users(email)" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ name: "email" }],
      });

    const result = await fallBackGetIndexes(adapter);

    expect(result[0]!.unique).toBe(true);
  });

  it("should filter by table name when provided", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });

    await fallBackGetIndexes(adapter, "users");

    const sql = adapter.executeReadQuery.mock.calls[0][0];
    expect(sql).toContain("users");
  });

  it("should handle empty indexes", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });

    const result = await fallBackGetIndexes(adapter);
    expect(result).toHaveLength(0);
  });

  it("should handle PRAGMA index_info failure gracefully", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery
      .mockResolvedValueOnce({
        rows: [
          { name: "idx_broken", tbl_name: "test", sql: "CREATE INDEX idx_broken ON test(col)" },
        ],
      })
      .mockRejectedValueOnce(new Error("PRAGMA failed"));

    const result = await fallBackGetIndexes(adapter);

    expect(result).toHaveLength(1);
    expect(result[0]!.columns).toEqual([]);
  });
});
