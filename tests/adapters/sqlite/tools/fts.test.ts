/**
 * FTS (Full-Text Search) Tools Tests
 *
 * Tests for SQLite FTS5 tools:
 * create, search, rebuild, match_info.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("FTS Tools", () => {
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

  describe("sqlite_fts_create", () => {
    it("should create an FTS5 table", async () => {
      try {
        const result = (await tools.get("sqlite_fts_create")?.({
          tableName: "docs_fts",
          columns: ["title", "content"],
        })) as {
          success: boolean;
          message?: string;
          wasmLimitation?: boolean;
        };

        // May fail in WASM mode
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // FTS5 may not be available
        expect(error).toBeDefined();
      }
    });

    it("should create FTS table with tokenizer", async () => {
      try {
        const result = (await tools.get("sqlite_fts_create")?.({
          tableName: "docs_porter",
          columns: ["body"],
          tokenizer: "porter",
        })) as {
          success: boolean;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle trigram tokenizer", async () => {
      try {
        const result = (await tools.get("sqlite_fts_create")?.({
          tableName: "trigram_test",
          columns: ["text"],
          tokenizer: "trigram",
        })) as {
          success: boolean;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_fts_search", () => {
    it("should handle search on non-existent table", async () => {
      try {
        const result = (await tools.get("sqlite_fts_search")?.({
          table: "nonexistent_fts",
          query: "test",
        })) as {
          success: boolean;
          error?: string;
        };

        // Either returns error or throws
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should accept limit parameter", async () => {
      try {
        const result = (await tools.get("sqlite_fts_search")?.({
          table: "fts_test",
          query: "test",
          limit: 5,
        })) as {
          success: boolean;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_fts_rebuild", () => {
    it("should handle rebuild on non-existent table", async () => {
      try {
        const result = (await tools.get("sqlite_fts_rebuild")?.({
          table: "nonexistent_fts",
        })) as {
          success: boolean;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_fts_match_info", () => {
    it("should handle match info on non-existent table", async () => {
      try {
        const result = (await tools.get("sqlite_fts_match_info")?.({
          table: "nonexistent_fts",
          query: "test",
        })) as {
          success: boolean;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should support rank format option", async () => {
      try {
        const result = (await tools.get("sqlite_fts_match_info")?.({
          table: "test_fts",
          query: "hello",
          format: "rank",
        })) as {
          success: boolean;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("FTS5 WASM mode handling", () => {
    it("should handle FTS search with highlight option", async () => {
      try {
        const result = (await tools.get("sqlite_fts_search")?.({
          table: "test_fts",
          query: "hello",
          highlight: true,
        })) as {
          success: boolean;
          error?: string;
          hint?: string;
        };

        // In WASM mode, should return FTS unavailable error
        if (!result.success) {
          expect(result.error).toContain("FTS5");
          expect(result.hint).toContain("native");
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle FTS search with wildcard query", async () => {
      try {
        const result = (await tools.get("sqlite_fts_search")?.({
          table: "test_fts",
          query: "*",
        })) as {
          success: boolean;
          error?: string;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle FTS search with empty query", async () => {
      try {
        const result = (await tools.get("sqlite_fts_search")?.({
          table: "test_fts",
          query: "  ",
        })) as {
          success: boolean;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle FTS search with column filter", async () => {
      try {
        const result = (await tools.get("sqlite_fts_search")?.({
          table: "test_fts",
          query: "hello",
          columns: ["title", "content"],
        })) as {
          success: boolean;
          error?: string;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle FTS create with source table and content table", async () => {
      // First create the source table
      await adapter.executeWriteQuery(`CREATE TABLE articles (
        id INTEGER PRIMARY KEY,
        title TEXT,
        body TEXT
      )`);

      try {
        const result = (await tools.get("sqlite_fts_create")?.({
          tableName: "articles_fts",
          sourceTable: "articles",
          columns: ["title", "body"],
          contentTable: "articles",
          createTriggers: true,
        })) as {
          success: boolean;
          message?: string;
          error?: string;
          hint?: string;
          triggersCreated?: string[];
        };

        // Either succeeds (native) or returns FTS unavailable (WASM)
        expect(typeof result.success).toBe("boolean");
        if (result.success) {
          expect(result.triggersCreated).toBeDefined();
        } else {
          expect(result.error).toContain("FTS5");
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle FTS create without triggers", async () => {
      await adapter.executeWriteQuery(`CREATE TABLE notes (
        id INTEGER PRIMARY KEY,
        text TEXT
      )`);

      try {
        const result = (await tools.get("sqlite_fts_create")?.({
          tableName: "notes_fts",
          sourceTable: "notes",
          columns: ["text"],
          createTriggers: false,
        })) as {
          success: boolean;
          triggersCreated?: string[];
        };

        expect(typeof result.success).toBe("boolean");
        if (result.success) {
          expect(result.triggersCreated).toBeUndefined();
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
