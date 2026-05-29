import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("Admin Tools - Reindex", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    tools = new Map();
    const toolDefs = adapter.getToolDefinitions();
    const context = { scopes: ["read", "write", "admin"] };

    for (const tool of toolDefs) {
      tools.set(tool.name, (params) => tool.handler(params, context as never));
    }

    await adapter.executeWriteQuery(
      "CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)",
    );
    await adapter.executeWriteQuery(
      "CREATE INDEX test_idx ON test_table(name)",
    );
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_reindex", () => {
    it("should reindex entire database without target", async () => {
      const res = (await tools.get("sqlite_reindex")?.({})) as {
        success: boolean;
        message: string;
      };
      expect(res.success).toBe(true);
      expect(res.message).toContain("entire database");
    });

    it("should reindex specific table", async () => {
      const res = (await tools.get("sqlite_reindex")?.({
        target: "test_table",
      })) as { success: boolean; message: string };
      expect(res.success).toBe(true);
      expect(res.message).toContain("Reindexed 'test_table'");
    });

    it("should reindex specific index", async () => {
      const res = (await tools.get("sqlite_reindex")?.({
        target: "test_idx",
      })) as { success: boolean; message: string };
      expect(res.success).toBe(true);
      expect(res.message).toContain("Reindexed 'test_idx'");
    });

    it("should reject invalid target format (SQL injection prevention)", async () => {
      const res = (await tools.get("sqlite_reindex")?.({
        target: "test_table; DROP TABLE test_table",
      })) as { success: boolean; code: string; error: string };
      expect(res.success).toBe(false);
      expect(res.code).toBe("VALIDATION_ERROR");
      expect(res.error).toContain("must be a valid identifier");
    });

    it("should fail gracefully on nonexistent target", async () => {
      // Reindex on nonexistent target throws an error in SQLite
      const res = (await tools.get("sqlite_reindex")?.({
        target: "nonexistent",
      })) as { success: boolean };
      expect(res.success).toBe(false);
    });
  });
});
