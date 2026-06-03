/**
 * FTS (Full-Text Search) Tools Tests
 *
 * Tests for SQLite FTS5 tools:
 * create, search, rebuild, match_info.
 *
 * Note: The test adapter uses NativeSqliteAdapter (better-sqlite3) which
 * includes FTS5 tools. The WASM adapter (sql.js) does NOT register FTS tools
 * since FTS5 is not available in WASM mode — see tools/index.ts.
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

  describe("FTS tools registration (native adapter)", () => {
    it("should register FTS tools in native adapter", () => {
      expect(tools.has("sqlite_fts_create")).toBe(true);
      expect(tools.has("sqlite_fts_search")).toBe(true);
      expect(tools.has("sqlite_fts_rebuild")).toBe(true);
      expect(tools.has("sqlite_fts_match_info")).toBe(true);
      expect(tools.has("sqlite_fts_headline")).toBe(true);
    });

    it("should NOT include FTS tools in shared WASM tool index", async () => {
      const { getAllToolDefinitions } =
        await import("../../../../src/adapters/sqlite/tools/index.js");
      const sharedTools = getAllToolDefinitions(
        adapter as unknown as import("../../../../src/adapters/sqlite/sqlite-adapter.js").SqliteAdapter,
      );
      const ftsTools = sharedTools.filter((t: { name: string }) =>
        t.name.includes("fts"),
      );
      expect(ftsTools).toHaveLength(0);
    });
  });

  describe("FTS Execution", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery(
        `CREATE TABLE documents (id INTEGER PRIMARY KEY, title TEXT, body TEXT)`,
      );
      await adapter.executeWriteQuery(
        `INSERT INTO documents (title, body) VALUES ('First Post', 'Hello world, this is a test.')`,
      );
      await adapter.executeWriteQuery(
        `INSERT INTO documents (title, body) VALUES ('Second Post', 'FTS5 is a powerful full-text search engine.')`,
      );
    });

    it("should create FTS table and triggers", async () => {
      const result = (await tools.get("sqlite_fts_create")?.({
        ftsTable: "documents_fts",
        sourceTable: "documents",
        columns: ["title", "body"],
        createTriggers: true,
      })) as any;
      expect(result.success).toBe(true);
      expect(result.tableName).toBe("documents_fts");
      expect(result.triggersCreated).toBeDefined();
      expect(result.triggersCreated?.length).toBe(3);
    });

    it("should search FTS table and support facets", async () => {
      // First create
      await tools.get("sqlite_fts_create")?.({
        ftsTable: "documents_fts",
        sourceTable: "documents",
        columns: ["title", "body"],
      });

      const searchAll = (await tools.get("sqlite_fts_search")?.({
        table: "documents_fts",
        query: "*",
        limit: 10,
      })) as any;
      expect(searchAll.success).toBe(true);
      expect(searchAll.rowCount).toBeGreaterThan(0);

      const searchSpecific = (await tools.get("sqlite_fts_search")?.({
        table: "documents_fts",
        query: "powerful",
        highlight: true,
        limit: 10,
        includeFacets: true,
      })) as any;
      expect(searchSpecific.success).toBe(true);
      expect(searchSpecific.results[0].snippet).toBeDefined();
      expect(searchSpecific.facets).toBeDefined();
      expect(typeof searchSpecific.facets.title).toBe("number");
    });

    it("should support cursor-based pagination", async () => {
      await tools.get("sqlite_fts_create")?.({
        ftsTable: "documents_fts",
        sourceTable: "documents",
        columns: ["title", "body"],
      });

      const firstPage = (await tools.get("sqlite_fts_search")?.({
        table: "documents_fts",
        query: "*",
        limit: 1,
        includeRowData: true,
      })) as any;
      expect(firstPage.success).toBe(true);
      expect(firstPage.results).toHaveLength(1);
      expect(firstPage.nextCursor).toBeDefined();

      const secondPage = (await tools.get("sqlite_fts_search")?.({
        table: "documents_fts",
        query: "*",
        limit: 1,
        includeRowData: true,
        cursor: firstPage.nextCursor,
      })) as any;
      expect(secondPage.success).toBe(true);
      expect(secondPage.results).toHaveLength(1);
      expect(secondPage.results[0].title).not.toBe(firstPage.results[0].title);
    });

    it("should search with column filters", async () => {
      await tools.get("sqlite_fts_create")?.({
        ftsTable: "documents_fts",
        sourceTable: "documents",
        columns: ["title", "body"],
      });
      const searchSpecific = (await tools.get("sqlite_fts_search")?.({
        table: "documents_fts",
        query: "Hello",
        columns: ["body"],
        limit: 10,
      })) as any;
      expect(searchSpecific.success).toBe(true);
      expect(searchSpecific.results[0].body).toContain("Hello");
    });

    it("should rebuild FTS index", async () => {
      await tools.get("sqlite_fts_create")?.({
        ftsTable: "documents_fts",
        sourceTable: "documents",
        columns: ["title", "body"],
      });
      const rebuild = (await tools.get("sqlite_fts_rebuild")?.({
        table: "documents_fts",
      })) as any;
      expect(rebuild.success).toBe(true);
    });

    it("should return match info", async () => {
      await tools.get("sqlite_fts_create")?.({
        ftsTable: "documents_fts",
        sourceTable: "documents",
        columns: ["title", "body"],
      });
      const matchInfo = (await tools.get("sqlite_fts_match_info")?.({
        table: "documents_fts",
        query: "test",
        format: "bm25",
      })) as any;
      expect(matchInfo.success).toBe(true);
      expect(matchInfo.results[0].score).toBeDefined();
    });

    it("should generate headlines", async () => {
      await tools.get("sqlite_fts_create")?.({
        ftsTable: "documents_fts",
        sourceTable: "documents",
        columns: ["title", "body"],
      });
      const headline = (await tools.get("sqlite_fts_headline")?.({
        table: "documents_fts",
        query: "engine",
        column: "body",
      })) as any;
      expect(headline.success).toBe(true);
      expect(headline.results[0].headline).toBeDefined();
      expect(headline.results[0].snippet).toBeDefined();

      const wildcard = (await tools.get("sqlite_fts_headline")?.({
        table: "documents_fts",
        query: "*",
        column: "body",
      })) as any;
      expect(wildcard.success).toBe(true);
    });
  });

  describe("Error Paths", () => {
    it("should handle missing table in create", async () => {
      const result = (await tools.get("sqlite_fts_create")?.({
        columns: ["title"],
      })) as any;
      expect(result.success).toBe(false);
      expect(result.code).toBe("VALIDATION_ERROR");
    });

    it("should handle invalid table in search", async () => {
      const result = (await tools.get("sqlite_fts_search")?.({
        table: "nonexistent",
        query: "test",
      })) as any;
      expect(result.success).toBe(false);
      expect(result.code).toBe("TABLE_NOT_FOUND");
    });
  });
});
