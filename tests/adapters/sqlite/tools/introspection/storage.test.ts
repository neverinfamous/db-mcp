import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("Storage Analysis Tool", () => {
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
    const context = { scopes: ["read"] };

    for (const tool of toolDefs) {
      if (tool.group === "introspection") {
        tools.set(tool.name, (params) => tool.handler(params, context as never));
      }
    }
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_storage_analysis", () => {
    it("should return basic storage analysis", async () => {
      // Create some data
      await adapter.executeWriteQuery("CREATE TABLE storage_test (id INTEGER PRIMARY KEY, data TEXT)");
      await adapter.executeWriteQuery("INSERT INTO storage_test (data) VALUES ('test1'), ('test2')");

      const result = (await tools.get("sqlite_storage_analysis")?.({})) as {
        success: boolean;
        database: {
          totalSizeBytes: number;
          pageSize: number;
          totalPages: number;
          freePages: number;
          fragmentationPct: number;
          journalMode: string;
          autoVacuum: string;
        };
        tables: { name: string }[];
        recommendations: unknown[];
      };

      expect(result.success).toBe(true);
      expect(result.database.pageSize).toBeGreaterThan(0);
      expect(result.database.totalPages).toBeGreaterThan(0);
      expect(result.database.journalMode).toBeDefined();
      expect(Array.isArray(result.tables)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);

      const tableNames = result.tables.map(t => t.name);
      expect(tableNames).toContain("storage_test");
    });

    it("should handle error when limit is invalid", async () => {
      const result = (await tools.get("sqlite_storage_analysis")?.({
        limit: 1000
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("limit must be between 1 and 500");
    });

    it("should respect excludeSystemTables false", async () => {
      const result = (await tools.get("sqlite_storage_analysis")?.({
        excludeSystemTables: false
      })) as {
        success: boolean;
        tables: { name: string }[];
      };

      expect(result.success).toBe(true);
    });

    it("should omit tables array if includeTableDetails is false", async () => {
      const result = (await tools.get("sqlite_storage_analysis")?.({
        includeTableDetails: false
      })) as {
        success: boolean;
        tables?: unknown;
      };

      expect(result.success).toBe(true);
      expect(result.tables).toBeUndefined();
    });
  });
});
