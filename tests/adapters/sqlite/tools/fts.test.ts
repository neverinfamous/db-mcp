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
      // NativeSqliteAdapter includes FTS tools directly
      expect(tools.has("sqlite_fts_create")).toBe(true);
      expect(tools.has("sqlite_fts_search")).toBe(true);
      expect(tools.has("sqlite_fts_rebuild")).toBe(true);
      expect(tools.has("sqlite_fts_match_info")).toBe(true);
    });

    it("should NOT include FTS tools in shared WASM tool index", async () => {
      // The shared getAllToolDefinitions (used by WASM adapter) should not include FTS
      const { getAllToolDefinitions } =
        await import("../../../../src/adapters/sqlite/tools/index.js");
      const sharedTools = getAllToolDefinitions(
        adapter as unknown as import("../../../../src/adapters/sqlite/SqliteAdapter.js").SqliteAdapter,
      );
      const ftsTools = sharedTools.filter((t: { name: string }) =>
        t.name.includes("fts"),
      );
      expect(ftsTools).toHaveLength(0);
    });
  });
});
