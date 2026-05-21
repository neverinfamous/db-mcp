import { describe, it, expect, vi } from "vitest";
import {
  createDbStatTool,
  createVacuumTool,
} from "../../../../../src/adapters/sqlite/tools/virtual/analysis.js";
import type { SqliteAdapter } from "../../../../../src/adapters/sqlite/sqlite-adapter.js";
import type { RequestContext } from "../../../../../src/types/index.js";

function createMockAdapter() {
  return {
    isNativeBackend: vi.fn().mockReturnValue(true),
    executeReadQuery: vi.fn().mockResolvedValue({ rows: [] }),
    executeQuery: vi.fn().mockResolvedValue(undefined),
  } as unknown as SqliteAdapter;
}

const mockContext = {
  scopes: ["read", "write", "admin"],
  progressToken: "123",
  mcpServer: {
    sendProgress: vi.fn(),
  },
} as unknown as RequestContext;

describe("Analysis Tools", () => {
  describe("sqlite_dbstat fallback logic", () => {
    it("should fallback to PRAGMA page_count and estimated rows when dbstat fails", async () => {
      const adapter = createMockAdapter();
      // Throw on the first dbstat query, but succeed on fallback queries
      vi.mocked(adapter.executeReadQuery).mockImplementation(
        async (sql: string) => {
          if (sql.includes("dbstat")) {
            throw new Error("dbstat not available");
          }
          if (sql.includes("PRAGMA page_count")) {
            return { rows: [{ page_count: 5 }] };
          }
          if (
            sql.includes("sqlite_master WHERE type='table' AND name='my_table'")
          ) {
            return { rows: [{ name: "my_table" }] };
          }
          if (sql.includes("COUNT(*) as count")) {
            return { rows: [{ count: 1050 }] };
          }
          if (sql.includes("NOT LIKE 'sqlite_%'")) {
            return { rows: [{ cnt: 3 }] };
          }
          return { rows: [] };
        },
      );

      const tool = createDbStatTool(adapter);

      // Test fallback for specific table
      const resultTable = (await tool.handler(
        { table: "my_table", limit: 10 },
        mockContext,
      )) as any;
      expect(resultTable.success).toBe(true);
      expect(resultTable.table).toBe("my_table");
      expect(resultTable.rowCount).toBe(1050);
      expect(resultTable.estimatedPages).toBe(11); // 1050 / 100 ceil
      expect(resultTable.totalDatabasePages).toBe(5);

      // Test fallback for missing table
      const resultMissing = (await tool.handler(
        { table: "missing", limit: 10 },
        mockContext,
      )) as any;
      expect(resultMissing.success).toBe(false);
      expect(resultMissing.message).toContain("not found");

      // Test fallback without specific table
      const resultGeneral = (await tool.handler(
        { limit: 10 },
        mockContext,
      )) as any;
      expect(resultGeneral.success).toBe(true);
      expect(resultGeneral.pageCount).toBe(5);
      expect(resultGeneral.tableCount).toBe(3);
    });
  });

  describe("sqlite_vacuum", () => {
    it("should execute vacuum successfully", async () => {
      const adapter = createMockAdapter();
      const tool = createVacuumTool(adapter);

      const result = (await tool.handler({}, mockContext)) as any;
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeDefined();
    });

    it("should execute vacuum into successfully", async () => {
      const adapter = createMockAdapter();
      const tool = createVacuumTool(adapter);

      const result = (await tool.handler(
        { into: "backup.db" },
        mockContext,
      )) as any;
      expect(result.success).toBe(true);
      expect(vi.mocked(adapter.executeQuery)).toHaveBeenCalledWith(
        "VACUUM INTO 'backup.db'",
      );
    });

    it("should fail vacuum into if not native backend", async () => {
      const adapter = createMockAdapter();
      vi.mocked(adapter.isNativeBackend).mockReturnValue(false);
      const tool = createVacuumTool(adapter);

      const result = (await tool.handler(
        { into: "backup.db" },
        mockContext,
      )) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("VACUUM INTO not available");
    });

    it("should handle vacuum errors", async () => {
      const adapter = createMockAdapter();
      vi.mocked(adapter.executeQuery).mockRejectedValue(
        new Error("Vacuum failed"),
      );
      const tool = createVacuumTool(adapter);

      const result = (await tool.handler({}, mockContext)) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("Vacuum failed");
    });
  });
});
