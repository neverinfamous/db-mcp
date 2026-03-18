/**
 * Core Tools Tests - DML
 *
 * Tests for SQLite core tools related to Data Manipulation Language:
 * read_query, write_query.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Core Tools - DML", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
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

  describe("sqlite_read_query", () => {
    it("should execute read queries", async () => {
      await adapter.executeWriteQuery("CREATE TABLE data (value INTEGER)");
      await adapter.executeWriteQuery("INSERT INTO data VALUES (1), (2), (3)");

      const result = (await tools.get("sqlite_read_query")?.({
        query: "SELECT SUM(value) as total FROM data",
      })) as { rows: Record<string, unknown>[] };

      expect(result.rows[0]?.["total"]).toBe(6);
    });

    it("should reject write queries", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "DROP TABLE users",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for nonexistent table", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "SELECT * FROM nonexistent_table_xyz",
      })) as { success: boolean; error?: string; rows: unknown[] };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.rows).toEqual([]);
    });
  });

  describe("sqlite_write_query", () => {
    it("should execute write queries", async () => {
      await adapter.executeWriteQuery("CREATE TABLE counter (n INTEGER)");

      const result = (await tools.get("sqlite_write_query")?.({
        query: "INSERT INTO counter VALUES (42)",
      })) as { rowsAffected: number };

      expect(result.rowsAffected).toBe(1);
    });

    it("should reject SELECT statements", async () => {
      const result = (await tools.get("sqlite_write_query")?.({
        query: "SELECT * FROM sqlite_master",
      })) as { success: boolean; error?: string; rowsAffected: number };

      expect(result.success).toBe(false);
      expect(result.error).toContain("SELECT");
      expect(result.rowsAffected).toBe(0);
    });

    it("should reject DDL statements", async () => {
      await adapter.executeWriteQuery("CREATE TABLE ddl_test (id INTEGER)");

      const result = (await tools.get("sqlite_write_query")?.({
        query: "DROP TABLE ddl_test",
      })) as { success: boolean; error?: string; rowsAffected: number };

      expect(result.success).toBe(false);
      expect(result.error).toContain("DROP");
      expect(result.rowsAffected).toBe(0);

      // Table should still exist
      const tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).toContain("ddl_test");
    });

    it("should reject CREATE statements", async () => {
      const result = (await tools.get("sqlite_write_query")?.({
        query: "CREATE TABLE hack (id INTEGER)",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("CREATE");
    });

    it("should return structured error for invalid DML", async () => {
      const result = (await tools.get("sqlite_write_query")?.({
        query: "INSERT INTO nonexistent_xyz VALUES (1)",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should accept CTE-prefixed INSERT (WITH...INSERT)", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE cte_target (id INTEGER PRIMARY KEY, value INTEGER)",
      );

      const result = (await tools.get("sqlite_write_query")?.({
        query:
          "WITH vals(v) AS (VALUES (1), (2), (3)) INSERT INTO cte_target (value) SELECT v FROM vals",
      })) as { success: boolean; rowsAffected: number };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(3);
    });

    it("should accept CTE-prefixed DELETE (WITH...DELETE)", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE cte_del (id INTEGER PRIMARY KEY, name TEXT)",
      );
      await adapter.executeWriteQuery(
        "INSERT INTO cte_del VALUES (1, 'a'), (2, 'b')",
      );

      const result = (await tools.get("sqlite_write_query")?.({
        query:
          "WITH targets AS (SELECT id FROM cte_del WHERE name = 'a') DELETE FROM cte_del WHERE id IN (SELECT id FROM targets)",
      })) as { success: boolean; rowsAffected: number };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it("should reject CTE-prefixed SELECT via write_query", async () => {
      const result = (await tools.get("sqlite_write_query")?.({
        query: "WITH t AS (SELECT 1 AS v) SELECT * FROM t",
      })) as { success: boolean; error?: string; rowsAffected: number };

      expect(result.success).toBe(false);
      expect(result.error).toContain("SELECT");
      expect(result.rowsAffected).toBe(0);
    });

    it("should reject unrecognized statement types", async () => {
      const result = (await tools.get("sqlite_write_query")?.({
        query: "FOOBAR something",
      })) as { success: boolean; error?: string; rowsAffected: number };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unrecognized statement type");
      expect(result.rowsAffected).toBe(0);
    });

    it("should reject empty query", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });
  });
});
