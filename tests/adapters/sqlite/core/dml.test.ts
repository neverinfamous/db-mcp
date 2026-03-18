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

    // =========================================================================
    // PRAGMA Guards
    // =========================================================================

    it("should reject mutating PRAGMA assignment form", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "PRAGMA journal_mode = WAL",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Mutating PRAGMA");
    });

    it("should reject schema-qualified mutating PRAGMA", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "PRAGMA main.journal_mode = DELETE",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Mutating PRAGMA");
    });

    it("should reject non-whitelisted PRAGMA function-call form", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "PRAGMA page_size(4096)",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("page_size");
      expect(result.error).toContain("not allowed");
    });

    it("should allow read-only PRAGMA function-call: table_info", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE pragma_test (id INTEGER PRIMARY KEY, name TEXT)",
      );

      const result = (await tools.get("sqlite_read_query")?.({
        query: "PRAGMA table_info('pragma_test')",
      })) as { success: boolean; rows: unknown[] };

      expect(result.success).toBe(true);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("should allow simple read-only PRAGMA without parens", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "PRAGMA table_list",
      })) as { success: boolean; rows: unknown[] };

      expect(result.success).toBe(true);
      expect(result.rows).toBeDefined();
    });

    it("should allow read-only PRAGMA: foreign_key_list", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE fk_src (id INTEGER PRIMARY KEY)",
      );
      await adapter.executeWriteQuery(
        "CREATE TABLE fk_test (id INTEGER PRIMARY KEY, ref INTEGER REFERENCES fk_src(id))",
      );

      const result = (await tools.get("sqlite_read_query")?.({
        query: "PRAGMA foreign_key_list('fk_test')",
      })) as { success: boolean };

      expect(result.success).toBe(true);
    });

    // =========================================================================
    // CTE Read Parser
    // =========================================================================

    it("should allow simple CTE with SELECT", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "WITH t AS (SELECT 1 AS v) SELECT * FROM t",
      })) as { success: boolean; rows: Record<string, unknown>[] };

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.["v"]).toBe(1);
    });

    it("should allow RECURSIVE CTE", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query:
          "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt",
      })) as { success: boolean; rows: Record<string, unknown>[] };

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(5);
    });

    it("should allow multi-CTE query", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query:
          "WITH a AS (SELECT 1 AS x), b AS (SELECT 2 AS y) SELECT a.x, b.y FROM a, b",
      })) as { success: boolean; rows: Record<string, unknown>[] };

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.["x"]).toBe(1);
      expect(result.rows[0]?.["y"]).toBe(2);
    });

    it("should allow CTE with explicit column list", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "WITH t(a, b) AS (SELECT 10, 20) SELECT a, b FROM t",
      })) as { success: boolean; rows: Record<string, unknown>[] };

      expect(result.success).toBe(true);
      expect(result.rows[0]?.["a"]).toBe(10);
      expect(result.rows[0]?.["b"]).toBe(20);
    });

    it("should reject CTE-prefixed INSERT via read_query", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE cte_read_test (id INTEGER PRIMARY KEY, val INTEGER)",
      );

      const result = (await tools.get("sqlite_read_query")?.({
        query:
          "WITH vals(v) AS (VALUES (1)) INSERT INTO cte_read_test (val) SELECT v FROM vals",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("should reject CTE-prefixed UPDATE via read_query", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query:
          "WITH vals AS (SELECT 1 AS v) UPDATE data SET value = vals.v FROM vals",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("not allowed");
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
