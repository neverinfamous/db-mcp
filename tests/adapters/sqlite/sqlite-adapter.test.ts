/**
 * SQLite Adapter Tests
 *
 * Tests for the SQLite adapter core functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../utils/test-adapter.js";

describe("SqliteAdapter", () => {
  let adapter: TestAdapter;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("connection", () => {
    it("should connect to in-memory database", async () => {
      const health = await adapter.getHealth();
      expect(health.connected).toBe(true);
    });

    it("should report correct adapter type", () => {
      expect(adapter.type).toBe("sqlite");
    });

    it("should report correct adapter name", () => {
      // Native adapter has different name than sql.js adapter
      expect(adapter.name).toMatch(/SQLite.*Adapter/);
    });

    it("should get adapter info", () => {
      const info = adapter.getInfo();
      expect(info.type).toBe("sqlite");
      expect(info.connected).toBe(true);
    });
  });

  describe("executeReadQuery", () => {
    it("should execute SELECT queries", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)",
      );
      await adapter.executeWriteQuery(
        "INSERT INTO test (name) VALUES ('Alice')",
      );

      const result = await adapter.executeReadQuery("SELECT * FROM test");

      expect(result.rows).toHaveLength(1);
      expect(result.rows?.[0]?.["name"]).toBe("Alice");
    });

    it("should return column info", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test (id INTEGER, name TEXT)",
      );
      // Insert a row so we have data to return columns for
      await adapter.executeWriteQuery(
        "INSERT INTO test (id, name) VALUES (1, 'test')",
      );

      const result = await adapter.executeReadQuery("SELECT * FROM test");

      expect(result.columns).toBeDefined();
      const columnNames = result.columns?.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("name");
    });
  });

  describe("executeWriteQuery", () => {
    it("should execute INSERT and return rows affected", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)",
      );

      const result = await adapter.executeWriteQuery(
        "INSERT INTO test (name) VALUES ('Bob')",
      );

      expect(result.rowsAffected).toBe(1);
    });

    it("should execute UPDATE and return rows affected", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)",
      );
      await adapter.executeWriteQuery(
        "INSERT INTO test (name) VALUES ('Alice')",
      );
      await adapter.executeWriteQuery("INSERT INTO test (name) VALUES ('Bob')");

      const result = await adapter.executeWriteQuery(
        "UPDATE test SET name = 'Updated' WHERE name = 'Alice'",
      );

      expect(result.rowsAffected).toBe(1);
    });

    it("should execute DELETE and return rows affected", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)",
      );
      await adapter.executeWriteQuery(
        "INSERT INTO test (name) VALUES ('Alice')",
      );

      const result = await adapter.executeWriteQuery(
        "DELETE FROM test WHERE name = 'Alice'",
      );

      expect(result.rowsAffected).toBe(1);
    });
  });

  describe("getSchema", () => {
    it("should return schema info", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)",
      );

      const schema = await adapter.getSchema();

      expect(schema.tables).toBeDefined();
      expect(schema.tables?.length).toBeGreaterThan(0);
    });
  });

  describe("listTables", () => {
    it("should list tables", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE users (id INTEGER PRIMARY KEY)",
      );
      await adapter.executeWriteQuery(
        "CREATE TABLE orders (id INTEGER PRIMARY KEY)",
      );

      const tables = await adapter.listTables();

      expect(tables.length).toBe(2);
      expect(tables.map((t) => t.name)).toContain("users");
      expect(tables.map((t) => t.name)).toContain("orders");
    });

    it("should exclude system tables", async () => {
      const tables = await adapter.listTables();

      for (const table of tables) {
        expect(table.name).not.toMatch(/^sqlite_/);
      }
    });
  });

  describe("describeTable", () => {
    it("should describe table structure", async () => {
      await adapter.executeWriteQuery(`
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE
                )
            `);

      const tableInfo = await adapter.describeTable("users");

      expect(tableInfo.name).toBe("users");
      expect(tableInfo.columns).toHaveLength(3);

      const idCol = tableInfo.columns?.find((c) => c.name === "id");
      expect(idCol?.type).toContain("INTEGER");
      expect(idCol?.primaryKey).toBe(true);
    });
  });

  describe("getCapabilities", () => {
    it("should return adapter capabilities", () => {
      const caps = adapter.getCapabilities();

      expect(caps.transactions).toBe(true);
      expect(caps.json).toBe(true);
      expect(caps.fullTextSearch).toBe(true);
    });
  });

  describe("getSupportedToolGroups", () => {
    it("should return supported tool groups", () => {
      const groups = adapter.getSupportedToolGroups();

      expect(groups).toContain("core");
      expect(groups).toContain("json");
      expect(groups).toContain("text");
      expect(groups).toContain("stats");
      expect(groups).toContain("vector");
      expect(groups).toContain("admin");
    });
  });

  describe("getToolDefinitions", () => {
    it("should return tool definitions", () => {
      const tools = adapter.getToolDefinitions();

      expect(tools.length).toBeGreaterThan(0);
      // Native adapter has 106 tools, WASM has 102
      expect(tools.length).toBeGreaterThanOrEqual(102);
    });

    it("should have required tool properties", () => {
      const tools = adapter.getToolDefinitions();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.group).toBeDefined();
        expect(tool.handler).toBeDefined();
      }
    });
  });

  describe("getResourceDefinitions", () => {
    it("should return resource definitions", () => {
      const resources = adapter.getResourceDefinitions();

      expect(resources.length).toBe(8);
    });
  });

  describe("getPromptDefinitions", () => {
    it("should return prompt definitions", () => {
      const prompts = adapter.getPromptDefinitions();

      expect(prompts.length).toBe(10);
    });
  });

  describe("getAllIndexes", () => {
    it("should get all indexes", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE idx_test (id INTEGER, val TEXT)",
      );
      await adapter.executeWriteQuery("CREATE INDEX idx_val ON idx_test(val)");

      const indexes = await adapter.getAllIndexes();

      expect(indexes.length).toBeGreaterThan(0);
      const names = indexes.map((i) => i.name);
      expect(names).toContain("idx_val");
    });
  });

  describe("listSchemas", () => {
    it("should list schemas (returns main)", async () => {
      const schemas = await adapter.listSchemas();

      expect(schemas).toEqual(["main"]);
    });
  });
});
