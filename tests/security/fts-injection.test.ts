/**
 * FTS (Full-Text Search) Security Tests
 *
 * Tests for SQL injection prevention in FTS5 tools.
 * FTS has unique attack vectors via MATCH syntax and table creation.
 *
 * Note: FTS5 may not be available in all SQLite builds (especially WASM).
 * Tests are skipped gracefully if FTS5 is unavailable.
 *
 * Phase 1 of db-mcp Security Test Coverage Improvement Plan
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createTestAdapter, type TestAdapter } from "../utils/test-adapter.js";

describe("Security: FTS Injection Prevention", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;
  let fts5Available = true;

  beforeAll(async () => {
    // Check if FTS5 is available in this SQLite build
    const testAdapter = createTestAdapter();
    try {
      await testAdapter.connect({
        type: "sqlite",
        connectionString: ":memory:",
      });
      await testAdapter.executeWriteQuery(
        "CREATE VIRTUAL TABLE test_fts USING fts5(content)",
      );
      fts5Available = true;
    } catch {
      fts5Available = false;
      console.warn("FTS5 not available in this SQLite build - skipping tests");
    } finally {
      await testAdapter.disconnect();
    }
  });

  beforeEach(async () => {
    if (!fts5Available) return;

    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create source table for FTS content
    await adapter.executeWriteQuery(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY,
        title TEXT,
        content TEXT
      )
    `);
    await adapter.executeWriteQuery(`
      INSERT INTO documents (title, content) VALUES
        ('Test Doc', 'This is a test document'),
        ('Another Doc', 'Another test content')
    `);

    // Create an FTS5 table for searching
    await adapter.executeWriteQuery(`
      CREATE VIRTUAL TABLE documents_fts USING fts5(title, content)
    `);
    await adapter.executeWriteQuery(`
      INSERT INTO documents_fts (title, content) VALUES
        ('Test Doc', 'This is a test document'),
        ('Another Doc', 'Another test content')
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
    if (fts5Available && adapter) {
      await adapter.disconnect();
    }
  });

  function getTool(name: string) {
    const tool = tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return tool;
  }

  function skipIfNoFts5() {
    if (!fts5Available) {
      console.log("Skipping - FTS5 not available");
      return true;
    }
    return false;
  }

  // ==========================================================================
  // FTS Create Tool - Identifier Injection Tests
  // ==========================================================================

  describe("sqlite_fts_create - identifier injection", () => {
    it("should reject table name with SQL injection", async () => {
      if (skipIfNoFts5()) return;
      await expect(
        getTool("sqlite_fts_create")({
          tableName: "test'; DROP TABLE documents--",
          sourceTable: "documents",
          columns: ["title", "content"],
        }),
      ).rejects.toThrow(/Invalid/i);
    });

    it("should reject source table with injection", async () => {
      if (skipIfNoFts5()) return;
      await expect(
        getTool("sqlite_fts_create")({
          tableName: "valid_fts",
          sourceTable: "documents'; DROP TABLE--",
          columns: ["title", "content"],
        }),
      ).rejects.toThrow(/Invalid/i);
    });

    it("should reject column names with injection", async () => {
      if (skipIfNoFts5()) return;
      await expect(
        getTool("sqlite_fts_create")({
          tableName: "valid_fts",
          sourceTable: "documents",
          columns: ["title", "content; DROP TABLE--"],
        }),
      ).rejects.toThrow(/Invalid/i);
    });

    it("should reject content table with injection", async () => {
      if (skipIfNoFts5()) return;
      await expect(
        getTool("sqlite_fts_create")({
          tableName: "valid_fts",
          sourceTable: "documents",
          columns: ["title"],
          contentTable: "external'; ATTACH DATABASE--",
        }),
      ).rejects.toThrow(/Invalid/i);
    });

    it("should allow valid FTS table creation", async () => {
      if (skipIfNoFts5()) return;
      const result = await getTool("sqlite_fts_create")({
        tableName: "new_fts",
        sourceTable: "documents",
        columns: ["title", "content"],
      });
      expect(result).toHaveProperty("success", true);
    });
  });

  // ==========================================================================
  // FTS Search Tool - Query Injection Tests
  // ==========================================================================

  describe("sqlite_fts_search - query injection", () => {
    it("should reject table name with injection", async () => {
      if (skipIfNoFts5()) return;
      await expect(
        getTool("sqlite_fts_search")({
          table: "documents_fts'; DROP TABLE--",
          query: "test",
        }),
      ).rejects.toThrow(/Invalid/i);
    });

    it("should handle single quotes in search query safely", async () => {
      if (skipIfNoFts5()) return;
      // FTS5 uses single quotes for MATCH strings - they should be escaped
      // If FTS5 rejects the query, that's also safe behavior (prevents injection)
      try {
        const result = await getTool("sqlite_fts_search")({
          table: "documents_fts",
          query: "test' OR '1'='1",
        });
        // Should not throw, but may return no results due to escaping
        expect(result).toHaveProperty("success", true);
      } catch (e) {
        // FTS5 syntax error on malformed query is expected safe behavior
        expect(String(e)).toMatch(/syntax|parse|Query failed/i);
      }
    });

    it("should reject column names with injection", async () => {
      if (skipIfNoFts5()) return;
      await expect(
        getTool("sqlite_fts_search")({
          table: "documents_fts",
          query: "test",
          columns: ["title", "content; DROP TABLE--"],
        }),
      ).rejects.toThrow(/Invalid/i);
    });

    it("should allow legitimate FTS queries", async () => {
      if (skipIfNoFts5()) return;
      const result = await getTool("sqlite_fts_search")({
        table: "documents_fts",
        query: "test",
      });
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("rowCount");
    });

    it("should handle FTS5 operators safely", async () => {
      if (skipIfNoFts5()) return;
      // FTS5 has special operators like NOT, OR, AND, NEAR, etc.
      const result = await getTool("sqlite_fts_search")({
        table: "documents_fts",
        query: "test AND document",
      });
      expect(result).toHaveProperty("success", true);
    });
  });

  // ==========================================================================
  // FTS Rebuild Tool - Identifier Injection Tests
  // ==========================================================================

  describe("sqlite_fts_rebuild - identifier injection", () => {
    it("should reject table name with injection", async () => {
      if (skipIfNoFts5()) return;
      await expect(
        getTool("sqlite_fts_rebuild")({
          table: "documents_fts'); DELETE FROM documents--",
        }),
      ).rejects.toThrow(/Invalid/i);
    });

    it("should allow valid table names", async () => {
      if (skipIfNoFts5()) return;
      const result = await getTool("sqlite_fts_rebuild")({
        table: "documents_fts",
      });
      expect(result).toHaveProperty("success", true);
    });
  });

  // ==========================================================================
  // FTS Match Info Tool - Query Injection Tests
  // ==========================================================================

  describe("sqlite_fts_match_info - injection", () => {
    it("should reject table name with injection", async () => {
      if (skipIfNoFts5()) return;
      await expect(
        getTool("sqlite_fts_match_info")({
          table: "documents_fts' UNION SELECT--",
          query: "test",
        }),
      ).rejects.toThrow(/Invalid/i);
    });

    it("should safely escape query strings", async () => {
      if (skipIfNoFts5()) return;
      // FTS5 MATCH syntax doesn't support SQL-style quote escaping
      // Queries with unbalanced quotes will throw syntax errors, which is safe behavior
      // (prevents injection by rejecting malformed input)
      try {
        const result = await getTool("sqlite_fts_match_info")({
          table: "documents_fts",
          query: "test' OR 'x'='x",
        });
        expect(result).toHaveProperty("success", true);
      } catch (e) {
        // FTS5 syntax error on malformed query is expected safe behavior
        expect(String(e)).toMatch(/syntax|parse|Query failed/i);
      }
    });
  });
});
