/**
 * Core Tools Tests
 *
 * Tests for SQLite core tools.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteAdapter } from "../../../src/adapters/sqlite/SqliteAdapter.js";

describe("Core Tools", () => {
  let adapter: SqliteAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = new SqliteAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Get tools as a map for easy access
    tools = new Map();
    const toolDefs = adapter.getToolDefinitions();
    const context = { scopes: ["read", "write", "admin"] };

    for (const tool of toolDefs) {
      tools.set(tool.name, (params) => tool.handler(params, context as never));
    }
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_create_table", () => {
    it("should create a table", async () => {
      const result = await tools.get("sqlite_create_table")?.({
        tableName: "users", // Correct property name
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "name", type: "TEXT" },
        ],
      });

      expect(result).toHaveProperty("success", true);

      const tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).toContain("users");
    });
  });

  describe("sqlite_list_tables", () => {
    it("should list tables", async () => {
      await adapter.executeWriteQuery("CREATE TABLE products (id INTEGER)");
      await adapter.executeWriteQuery("CREATE TABLE orders (id INTEGER)");

      const result = (await tools.get("sqlite_list_tables")?.({})) as {
        tables: { name: string }[];
      };

      expect(result.tables.map((t) => t.name)).toContain("products");
      expect(result.tables.map((t) => t.name)).toContain("orders");
    });
  });

  describe("sqlite_describe_table", () => {
    it("should describe table columns", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)",
      );

      const result = (await tools.get("sqlite_describe_table")?.({
        tableName: "items", // Correct property name
      })) as { columns: { name: string }[] };

      expect(result.columns.map((c) => c.name)).toContain("id");
      expect(result.columns.map((c) => c.name)).toContain("name");
    });
  });

  describe("sqlite_read_query", () => {
    it("should execute read queries", async () => {
      await adapter.executeWriteQuery("CREATE TABLE data (value INTEGER)");
      await adapter.executeWriteQuery("INSERT INTO data VALUES (1), (2), (3)");

      const result = (await tools.get("sqlite_read_query")?.({
        query: "SELECT SUM(value) as total FROM data", // Correct property name
      })) as { rows: Record<string, unknown>[] };

      expect(result.rows[0]?.["total"]).toBe(6);
    });

    it("should reject write queries", async () => {
      await expect(
        tools.get("sqlite_read_query")?.({
          query: "DROP TABLE users",
        }),
      ).rejects.toThrow();
    });
  });

  describe("sqlite_write_query", () => {
    it("should execute write queries", async () => {
      await adapter.executeWriteQuery("CREATE TABLE counter (n INTEGER)");

      const result = (await tools.get("sqlite_write_query")?.({
        query: "INSERT INTO counter VALUES (42)", // Correct property name
      })) as { rowsAffected: number };

      expect(result.rowsAffected).toBe(1);
    });
  });

  describe("sqlite_create_index", () => {
    it("should create an index", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE indexed (id INTEGER, name TEXT)",
      );

      const result = await tools.get("sqlite_create_index")?.({
        indexName: "idx_name", // Correct property name
        tableName: "indexed", // Correct property name
        columns: ["name"],
      });

      expect(result).toHaveProperty("success", true);
    });
  });

  describe("sqlite_get_indexes", () => {
    it("should list indexes", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE indexed (id INTEGER, name TEXT)",
      );
      await adapter.executeWriteQuery("CREATE INDEX idx_test ON indexed(name)");

      const result = (await tools.get("sqlite_get_indexes")?.({
        tableName: "indexed",
      })) as { indexes: { name: string }[] };

      expect(result.indexes.length).toBeGreaterThan(0);
    });
  });

  describe("sqlite_drop_table", () => {
    it("should drop a table", async () => {
      await adapter.executeWriteQuery("CREATE TABLE todrop (id INTEGER)");

      let tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).toContain("todrop");

      await tools.get("sqlite_drop_table")?.({ tableName: "todrop" }); // Correct property name

      tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).not.toContain("todrop");
    });
  });
});
