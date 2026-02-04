/**
 * SchemaManager Tests
 *
 * Tests for SQLite SchemaManager with TTL-based caching for schema metadata.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { SchemaManager } from "../../../src/adapters/sqlite/SchemaManager.js";
import type { QueryResult } from "../../../src/types/index.js";

describe("SchemaManager", () => {
  let mockExecuteReadQuery: Mock;
  let schemaManager: SchemaManager;

  beforeEach(() => {
    mockExecuteReadQuery = vi.fn();
    schemaManager = new SchemaManager({
      executeReadQuery: mockExecuteReadQuery,
    });
  });

  describe("getCacheTtl", () => {
    it("should return the default cache TTL", () => {
      const ttl = schemaManager.getCacheTtl();
      expect(typeof ttl).toBe("number");
      expect(ttl).toBeGreaterThan(0);
    });
  });

  describe("clearCache", () => {
    it("should clear cached metadata", async () => {
      // First, populate cache by listing tables
      mockExecuteReadQuery.mockResolvedValue({
        rows: [{ name: "users", type: "table" }],
      } as QueryResult);

      await schemaManager.listTables();
      expect(mockExecuteReadQuery).toHaveBeenCalled();

      // Clear the cache
      schemaManager.clearCache();

      // Reset mock to verify it's called again
      mockExecuteReadQuery.mockClear();
      mockExecuteReadQuery.mockResolvedValue({
        rows: [{ name: "users", type: "table" }],
      } as QueryResult);

      await schemaManager.listTables();
      expect(mockExecuteReadQuery).toHaveBeenCalled();
    });
  });

  describe("listTables", () => {
    it("should list tables from sqlite_master", async () => {
      mockExecuteReadQuery
        .mockResolvedValueOnce({
          rows: [
            { name: "users", type: "table" },
            { name: "products", type: "table" },
          ],
        } as QueryResult)
        // PRAGMA table_info for users
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
            {
              name: "name",
              type: "TEXT",
              notnull: 0,
              pk: 0,
              dflt_value: null,
            },
          ],
        } as QueryResult)
        // COUNT for users
        .mockResolvedValueOnce({ rows: [{ count: 10 }] } as QueryResult)
        // PRAGMA table_info for products
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
          ],
        } as QueryResult)
        // COUNT for products
        .mockResolvedValueOnce({ rows: [{ count: 5 }] } as QueryResult);

      const tables = await schemaManager.listTables();

      expect(tables.length).toBe(2);
      expect(tables[0]?.name).toBe("users");
      expect(tables[1]?.name).toBe("products");
    });

    it("should skip FTS5 virtual tables", async () => {
      mockExecuteReadQuery.mockResolvedValueOnce({
        rows: [
          { name: "articles", type: "table" },
          { name: "articles_fts", type: "table" }, // FTS5 virtual
          { name: "articles_fts_config", type: "table" }, // FTS5 shadow
        ],
      } as QueryResult);

      // Only articles is processed
      mockExecuteReadQuery
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
          ],
        } as QueryResult)
        .mockResolvedValueOnce({ rows: [{ count: 100 }] } as QueryResult);

      const tables = await schemaManager.listTables();

      expect(tables.length).toBe(1);
      expect(tables[0]?.name).toBe("articles");
    });

    it("should use cache on subsequent calls", async () => {
      mockExecuteReadQuery
        .mockResolvedValueOnce({ rows: [{ name: "users", type: "table" }] })
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 10 }] });

      await schemaManager.listTables();
      const callCount = mockExecuteReadQuery.mock.calls.length;

      // Second call should use cache
      await schemaManager.listTables();
      expect(mockExecuteReadQuery.mock.calls.length).toBe(callCount);
    });
  });

  describe("describeTable", () => {
    it("should describe a table structure", async () => {
      mockExecuteReadQuery
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
            {
              name: "email",
              type: "TEXT",
              notnull: 0,
              pk: 0,
              dflt_value: null,
            },
          ],
        } as QueryResult)
        .mockResolvedValueOnce({ rows: [{ count: 25 }] } as QueryResult);

      const tableInfo = await schemaManager.describeTable("users");

      expect(tableInfo.name).toBe("users");
      expect(tableInfo.columns?.length).toBe(2);
      expect(tableInfo.columns?.[0]?.name).toBe("id");
      expect(tableInfo.columns?.[0]?.primaryKey).toBe(true);
      expect(tableInfo.rowCount).toBe(25);
    });

    it("should throw for non-existent table", async () => {
      mockExecuteReadQuery.mockResolvedValue({
        rows: [],
      } as QueryResult);

      await expect(
        schemaManager.describeTable("nonexistent"),
      ).rejects.toThrowError("Table 'nonexistent' does not exist");
    });

    it("should throw for invalid table name", async () => {
      await expect(
        schemaManager.describeTable("invalid-name!"),
      ).rejects.toThrowError("Invalid table name");
    });
  });

  describe("getAllIndexes", () => {
    it("should get all indexes", async () => {
      mockExecuteReadQuery
        .mockResolvedValueOnce({
          rows: [
            {
              name: "idx_users_email",
              tbl_name: "users",
              sql: "CREATE INDEX idx_users_email ON users(email)",
            },
            {
              name: "idx_products_sku",
              tbl_name: "products",
              sql: "CREATE UNIQUE INDEX idx_products_sku ON products(sku)",
            },
          ],
        } as QueryResult)
        // PRAGMA index_info for idx_users_email
        .mockResolvedValueOnce({
          rows: [{ name: "email" }],
        } as QueryResult)
        // PRAGMA index_info for idx_products_sku
        .mockResolvedValueOnce({
          rows: [{ name: "sku" }],
        } as QueryResult);

      const indexes = await schemaManager.getAllIndexes();

      expect(indexes.length).toBe(2);
      expect(indexes[0]?.name).toBe("idx_users_email");
      expect(indexes[0]?.unique).toBe(false);
      expect(indexes[1]?.name).toBe("idx_products_sku");
      expect(indexes[1]?.unique).toBe(true);
    });

    it("should use cache on subsequent calls", async () => {
      mockExecuteReadQuery.mockResolvedValue({
        rows: [{ name: "idx_test", tbl_name: "test", sql: "CREATE INDEX..." }],
      });

      await schemaManager.getAllIndexes();
      const callCount = mockExecuteReadQuery.mock.calls.length;

      await schemaManager.getAllIndexes();
      expect(mockExecuteReadQuery.mock.calls.length).toBe(callCount);
    });
  });

  describe("getTableIndexes", () => {
    it("should filter indexes by table name", async () => {
      mockExecuteReadQuery
        .mockResolvedValueOnce({
          rows: [
            { name: "idx_users_email", tbl_name: "users", sql: "CREATE INDEX" },
            {
              name: "idx_products_sku",
              tbl_name: "products",
              sql: "CREATE INDEX",
            },
          ],
        })
        .mockResolvedValue({ rows: [{ name: "col" }] });

      const indexes = await schemaManager.getTableIndexes("users");

      expect(indexes.length).toBe(1);
      expect(indexes[0]?.name).toBe("idx_users_email");
    });
  });

  describe("getSchema", () => {
    it("should return full schema with tables and indexes", async () => {
      mockExecuteReadQuery
        // listTables query
        .mockResolvedValueOnce({
          rows: [{ name: "users", type: "table" }],
        })
        // PRAGMA table_info
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
          ],
        })
        // COUNT
        .mockResolvedValueOnce({ rows: [{ count: 10 }] })
        // getAllIndexes query
        .mockResolvedValueOnce({
          rows: [{ name: "idx_users", tbl_name: "users", sql: "CREATE INDEX" }],
        })
        .mockResolvedValueOnce({ rows: [{ name: "id" }] });

      const schema = await schemaManager.getSchema();

      expect(schema.tables?.length).toBe(1);
      expect(schema.indexes?.length).toBe(1);
    });
  });

  describe("cache expiration", () => {
    it("should expire and re-fetch cache after TTL", async () => {
      const originalDateNow = Date.now;
      let currentTime = 1000000;

      // Mock Date.now
      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      mockExecuteReadQuery
        // First listTables call
        .mockResolvedValueOnce({
          rows: [{ name: "users", type: "table" }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 10 }] });

      // First call - populates cache
      await schemaManager.listTables();
      expect(mockExecuteReadQuery).toHaveBeenCalledTimes(3);

      // Second call within TTL - uses cache
      mockExecuteReadQuery.mockClear();
      await schemaManager.listTables();
      expect(mockExecuteReadQuery).not.toHaveBeenCalled();

      // Advance time past TTL (default is 5000ms)
      currentTime += 10000;

      // Third call after TTL - re-fetches
      mockExecuteReadQuery
        .mockResolvedValueOnce({
          rows: [{ name: "users", type: "table" }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 10 }] });

      await schemaManager.listTables();
      expect(mockExecuteReadQuery).toHaveBeenCalled();

      // Restore
      Date.now = originalDateNow;
      vi.restoreAllMocks();
    });
  });

  describe("error handling", () => {
    it("should skip table when describeTable fails", async () => {
      mockExecuteReadQuery
        .mockResolvedValueOnce({
          rows: [
            { name: "good_table", type: "table" },
            { name: "bad_table", type: "table" },
          ],
        })
        // good_table PRAGMA succeeds
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 5 }] })
        // bad_table PRAGMA fails
        .mockRejectedValueOnce(new Error("PRAGMA failed"));

      const tables = await schemaManager.listTables();
      expect(tables.length).toBe(1);
      expect(tables[0]?.name).toBe("good_table");
    });

    it("should return 0 rowCount when COUNT fails", async () => {
      mockExecuteReadQuery
        .mockResolvedValueOnce({
          rows: [
            {
              name: "id",
              type: "INTEGER",
              notnull: 1,
              pk: 1,
              dflt_value: null,
            },
          ],
        })
        .mockRejectedValueOnce(new Error("COUNT failed"));

      const tableInfo = await schemaManager.describeTable("test_table");
      expect(tableInfo.rowCount).toBe(0);
    });

    it("should return empty columns when PRAGMA index_info fails", async () => {
      mockExecuteReadQuery
        // getAllIndexes query
        .mockResolvedValueOnce({
          rows: [
            { name: "idx_test", tbl_name: "test", sql: "CREATE UNIQUE INDEX" },
          ],
        })
        // PRAGMA index_info fails
        .mockRejectedValueOnce(new Error("PRAGMA index_info failed"));

      const indexes = await schemaManager.getAllIndexes();
      expect(indexes.length).toBe(1);
      expect(indexes[0]?.columns).toEqual([]);
      expect(indexes[0]?.unique).toBe(true);
    });
  });
});
