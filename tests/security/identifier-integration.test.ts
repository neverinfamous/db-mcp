/**
 * Identifier Integration Security Tests
 *
 * Tests that verify identifier validation is correctly applied
 * in tool handlers that have explicit identifier validation.
 *
 * These tests verify the INTEGRATION of identifier validation,
 * confirming that tools properly reject invalid table/column names.
 *
 * Note: Only tests tools that have explicit identifier validation.
 * Tools without validation (like some geo/admin tools) are not tested here.
 *
 * Phase 4 of db-mcp Security Test Coverage Improvement Plan
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteAdapter } from "../../src/adapters/sqlite/SqliteAdapter.js";

describe("Security: Identifier Integration", () => {
  let adapter: SqliteAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = new SqliteAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create test tables
    await adapter.executeWriteQuery(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        data TEXT DEFAULT '{"key": "value"}'
      )
    `);
    await adapter.executeWriteQuery(`
      INSERT INTO users (name, email) VALUES
        ('Alice', 'alice@test.com'),
        ('Bob', 'bob@test.com')
    `);

    // Get tools as a map
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

  function getTool(name: string) {
    const tool = tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return tool;
  }

  // ==========================================================================
  // FTS Tools - Identifier Injection (has explicit validation)
  // ==========================================================================

  describe("FTS tools - identifier injection", () => {
    it("should reject FTS table name with SQL injection in create", async () => {
      await expect(
        getTool("sqlite_fts_create")({
          tableName: "fts'; DROP TABLE users--",
          sourceTable: "users",
          columns: ["name", "email"],
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject source table name with injection", async () => {
      await expect(
        getTool("sqlite_fts_create")({
          tableName: "valid_fts",
          sourceTable: "users'; ATTACH DATABASE--",
          columns: ["name"],
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject column name with injection", async () => {
      await expect(
        getTool("sqlite_fts_create")({
          tableName: "valid_fts",
          sourceTable: "users",
          columns: ["name; DROP TABLE--"],
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject FTS search table with injection", async () => {
      await expect(
        getTool("sqlite_fts_search")({
          table: "fts_table' UNION SELECT--",
          query: "test",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject FTS rebuild table with injection", async () => {
      await expect(
        getTool("sqlite_fts_rebuild")({
          table: "fts_table'; DELETE FROM users--",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject FTS match_info table with injection", async () => {
      await expect(
        getTool("sqlite_fts_match_info")({
          table: "fts_table'); DROP TABLE--",
          query: "test",
        }),
      ).rejects.toThrow(/invalid/i);
    });
  });

  // ==========================================================================
  // Text Tools - Identifier Injection (has explicit validation)
  // ==========================================================================

  describe("text tools - identifier injection", () => {
    it("should reject table name with injection in regex_extract", async () => {
      await expect(
        getTool("sqlite_regex_extract")({
          table: "users'; DROP TABLE--",
          column: "name",
          pattern: ".*",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject column name with injection in regex_extract", async () => {
      await expect(
        getTool("sqlite_regex_extract")({
          table: "users",
          column: "name; DROP TABLE--",
          pattern: ".*",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in regex_match", async () => {
      await expect(
        getTool("sqlite_regex_match")({
          table: 'users"; DELETE--',
          column: "name",
          pattern: "test",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in text_split", async () => {
      await expect(
        getTool("sqlite_text_split")({
          table: "users' OR '1'='1",
          column: "name",
          delimiter: " ",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in text_replace", async () => {
      await expect(
        getTool("sqlite_text_replace")({
          table: "users; ATTACH DATABASE--",
          column: "name",
          search: "a",
          replace: "b",
        }),
      ).rejects.toThrow(/invalid/i);
    });
  });

  // ==========================================================================
  // Vector Tools - Identifier Injection (has explicit validation)
  // ==========================================================================

  describe("vector tools - identifier injection", () => {
    it("should reject table name with injection in vector_create_table", async () => {
      await expect(
        getTool("sqlite_vector_create_table")({
          table: "vectors'; DROP TABLE users--",
          dimensions: 128,
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in vector_store", async () => {
      await expect(
        getTool("sqlite_vector_store")({
          table: 'vectors"; DELETE FROM--',
          id: "1",
          vector: [0.1, 0.2, 0.3],
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject idColumn name with injection in vector_store", async () => {
      await expect(
        getTool("sqlite_vector_store")({
          table: "vectors",
          id: "1",
          vector: [0.1, 0.2, 0.3],
          idColumn: "id'; DROP TABLE--",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject vectorColumn name with injection in vector_store", async () => {
      await expect(
        getTool("sqlite_vector_store")({
          table: "vectors",
          id: "1",
          vector: [0.1, 0.2, 0.3],
          vectorColumn: 'embedding"; DELETE--',
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in vector_search", async () => {
      await expect(
        getTool("sqlite_vector_search")({
          table: "vectors' UNION SELECT--",
          queryVector: [0.1, 0.2, 0.3],
          limit: 10,
        }),
      ).rejects.toThrow(/invalid/i);
    });
  });

  // ==========================================================================
  // Virtual Table Tools - Identifier Injection (has explicit validation)
  // ==========================================================================

  describe("virtual table tools - identifier injection", () => {
    it("should reject view name with injection in create_view", async () => {
      await expect(
        getTool("sqlite_create_view")({
          viewName: "my_view'; DROP TABLE--",
          query: "SELECT * FROM users",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject view name with injection in drop_view", async () => {
      await expect(
        getTool("sqlite_drop_view")({
          viewName: 'my_view"; DELETE FROM users--',
        }),
      ).rejects.toThrow(/invalid/i);
    });
  });

  // ==========================================================================
  // Admin Tools - Identifier Injection (only tools with validation)
  // ==========================================================================

  describe("admin tools - identifier injection", () => {
    it("should reject PRAGMA name with injection", async () => {
      await expect(
        getTool("sqlite_pragma_settings")({
          pragma: "cache_size; DROP TABLE users--",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in pragma_table_info", async () => {
      await expect(
        getTool("sqlite_pragma_table_info")({
          table: "users'; ATTACH DATABASE--",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in index_stats", async () => {
      await expect(
        getTool("sqlite_index_stats")({
          table: "users' UNION SELECT--",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in analyze", async () => {
      await expect(
        getTool("sqlite_analyze")({
          table: "users'; DROP TABLE--",
        }),
      ).rejects.toThrow(/invalid/i);
    });
  });

  // ==========================================================================
  // Stats Tools - Identifier Injection (has explicit validation)
  // ==========================================================================

  describe("stats tools - identifier injection", () => {
    it("should reject table name with injection in stats_basic", async () => {
      await expect(
        getTool("sqlite_stats_basic")({
          table: "users'; DROP TABLE--",
          column: "id",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject column name with injection in stats_basic", async () => {
      await expect(
        getTool("sqlite_stats_basic")({
          table: "users",
          column: "id; DROP TABLE users--",
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in stats_histogram", async () => {
      await expect(
        getTool("sqlite_stats_histogram")({
          table: 'users"; DELETE--',
          column: "id",
          buckets: 10,
        }),
      ).rejects.toThrow(/invalid/i);
    });

    it("should reject table name with injection in stats_group_by", async () => {
      await expect(
        getTool("sqlite_stats_group_by")({
          table: "users' OR 1=1--",
          column: "id",
          groupColumn: "name",
        }),
      ).rejects.toThrow(/invalid/i);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should allow valid table names", async () => {
      const result = await getTool("sqlite_stats_basic")({
        table: "users",
        column: "id",
      });
      expect(result).toHaveProperty("success", true);
    });

    it("should allow table names with underscores", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE user_profiles (id INTEGER PRIMARY KEY)",
      );
      const result = await getTool("sqlite_stats_basic")({
        table: "user_profiles",
        column: "id",
      });
      expect(result).toHaveProperty("success", true);
    });

    it("should allow table names starting with underscore", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE _internal (id INTEGER PRIMARY KEY)",
      );
      const result = await getTool("sqlite_stats_basic")({
        table: "_internal",
        column: "id",
      });
      expect(result).toHaveProperty("success", true);
    });
  });
});
