/**
 * Window Function Tools Tests
 *
 * Tests for SQLite window function tools in native adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getWindowTools } from "../../../../src/adapters/sqlite-native/tools/window.js";
import { NativeSqliteAdapter } from "../../../../src/adapters/sqlite-native/NativeSqliteAdapter.js";
import type {
  RequestContext,
  ToolDefinition,
} from "../../../../src/types/index.js";

describe("Window Function Tools", () => {
  let adapter: NativeSqliteAdapter;
  let tools: ToolDefinition[];
  let mockContext: RequestContext;

  beforeEach(async () => {
    adapter = new NativeSqliteAdapter();
    await adapter.connect({ type: "sqlite", database: ":memory:" });

    // Create test table with numeric data
    await adapter.executeWriteQuery(`
      CREATE TABLE sales (
        id INTEGER PRIMARY KEY,
        region TEXT NOT NULL,
        product TEXT NOT NULL,
        amount INTEGER NOT NULL,
        sale_date TEXT NOT NULL
      )
    `);

    // Insert test data
    await adapter.executeWriteQuery(`
      INSERT INTO sales (region, product, amount, sale_date) VALUES
        ('North', 'Widget', 100, '2024-01-01'),
        ('North', 'Widget', 150, '2024-01-02'),
        ('North', 'Gadget', 200, '2024-01-03'),
        ('South', 'Widget', 80, '2024-01-01'),
        ('South', 'Gadget', 120, '2024-01-02'),
        ('South', 'Widget', 90, '2024-01-03')
    `);

    tools = getWindowTools(adapter);
    mockContext = {
      requestId: "test-req-1",
      timestamp: new Date(),
    };

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
    vi.restoreAllMocks();
  });

  describe("getWindowTools", () => {
    it("should return 6 window function tools", () => {
      expect(tools).toHaveLength(6);
    });

    it("should include all expected tools", () => {
      const names = tools.map((t) => t.name);
      expect(names).toContain("sqlite_window_row_number");
      expect(names).toContain("sqlite_window_rank");
      expect(names).toContain("sqlite_window_lag_lead");
      expect(names).toContain("sqlite_window_running_total");
      expect(names).toContain("sqlite_window_moving_avg");
      expect(names).toContain("sqlite_window_ntile");
    });

    it("should assign all tools to stats group", () => {
      for (const tool of tools) {
        expect(tool.group).toBe("stats");
      }
    });

    it("should require read scope for all tools", () => {
      for (const tool of tools) {
        expect(tool.requiredScopes).toContain("read");
      }
    });
  });

  describe("sqlite_window_row_number", () => {
    const getTool = () =>
      tools.find((t) => t.name === "sqlite_window_row_number")!;

    it("should assign row numbers based on order", async () => {
      const result = (await getTool().handler(
        { table: "sales", orderBy: "amount DESC" },
        mockContext,
      )) as {
        success: boolean;
        rowCount: number;
        rows: { row_num: number; amount: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(6);
      expect(result.rows).toBeDefined();
      expect(result.rows[0].row_num).toBe(1);
      expect(result.rows[0].amount).toBe(200); // Highest amount first
    });

    it("should support partitionBy", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          orderBy: "amount DESC",
          partitionBy: "region",
        },
        mockContext,
      )) as {
        success: boolean;
        rows: { region: string; row_num: number }[];
      };

      expect(result.success).toBe(true);
      // Each region should have row numbers 1, 2, 3
      const northRows = result.rows.filter((r) => r.region === "North");
      const rowNums = northRows.map((r) => r.row_num);
      expect(rowNums).toContain(1);
      expect(rowNums).toContain(2);
      expect(rowNums).toContain(3);
    });

    it("should support selectColumns", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          orderBy: "amount",
          selectColumns: ["region", "amount"],
        },
        mockContext,
      )) as { success: boolean; rows: Record<string, unknown>[] };

      expect(result.success).toBe(true);
      expect(result.rows[0]).toHaveProperty("region");
      expect(result.rows[0]).toHaveProperty("amount");
      expect(result.rows[0]).toHaveProperty("row_num");
    });

    it("should support whereClause", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          orderBy: "amount",
          whereClause: "region = 'North'",
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
    });

    it("should respect limit", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          orderBy: "amount",
          limit: 2,
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it("should reject invalid table names", async () => {
      // "DROP TABLE sales" contains space so it's invalid
      await expect(
        getTool().handler(
          { table: "DROP TABLE sales", orderBy: "id" },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });
  });

  describe("sqlite_window_rank", () => {
    const getTool = () => tools.find((t) => t.name === "sqlite_window_rank")!;

    it("should calculate RANK by default", async () => {
      const result = (await getTool().handler(
        { table: "sales", orderBy: "amount DESC" },
        mockContext,
      )) as {
        success: boolean;
        rankType: string;
        rows: { rank_value: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.rankType).toBe("rank");
      expect(result.rows[0].rank_value).toBe(1);
    });

    it("should support DENSE_RANK", async () => {
      const result = (await getTool().handler(
        { table: "sales", orderBy: "amount DESC", rankType: "dense_rank" },
        mockContext,
      )) as { success: boolean; rankType: string };

      expect(result.success).toBe(true);
      expect(result.rankType).toBe("dense_rank");
    });

    it("should support PERCENT_RANK", async () => {
      const result = (await getTool().handler(
        { table: "sales", orderBy: "amount DESC", rankType: "percent_rank" },
        mockContext,
      )) as {
        success: boolean;
        rankType: string;
        rows: { rank_value: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.rankType).toBe("percent_rank");
      // First row should have rank 0
      expect(result.rows[0].rank_value).toBe(0);
    });

    it("should support whereClause", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          orderBy: "amount DESC",
          whereClause: "region = 'North'",
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
    });

    it("should reject invalid table names", async () => {
      // Starts with number, invalid
      await expect(
        getTool().handler({ table: "1invalid", orderBy: "id" }, mockContext),
      ).rejects.toThrow("Invalid table name");
    });
  });

  describe("sqlite_window_lag_lead", () => {
    const getTool = () =>
      tools.find((t) => t.name === "sqlite_window_lag_lead")!;

    it("should calculate LAG values", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          column: "amount",
          orderBy: "sale_date",
          direction: "lag",
        },
        mockContext,
      )) as {
        success: boolean;
        direction: string;
        offset: number;
        rows: { lag_value: number | null }[];
      };

      expect(result.success).toBe(true);
      expect(result.direction).toBe("lag");
      expect(result.offset).toBe(1);
      // First row should have null lag_value
      expect(result.rows[0].lag_value).toBeNull();
    });

    it("should calculate LEAD values", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          column: "amount",
          orderBy: "sale_date",
          direction: "lead",
        },
        mockContext,
      )) as {
        success: boolean;
        direction: string;
        rows: { lead_value: number | null }[];
      };

      expect(result.success).toBe(true);
      expect(result.direction).toBe("lead");
      // Last row should have null lead_value
      const lastRow = result.rows[result.rows.length - 1];
      expect(lastRow.lead_value).toBeNull();
    });

    it("should support custom offset", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          column: "amount",
          orderBy: "sale_date",
          direction: "lag",
          offset: 2,
        },
        mockContext,
      )) as {
        success: boolean;
        offset: number;
        rows: { lag_value: number | null }[];
      };

      expect(result.success).toBe(true);
      expect(result.offset).toBe(2);
      // First two rows should have null lag_value
      expect(result.rows[0].lag_value).toBeNull();
      expect(result.rows[1].lag_value).toBeNull();
    });

    it("should support whereClause", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          column: "amount",
          orderBy: "sale_date",
          direction: "lag",
          whereClause: "region = 'North'",
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
    });

    it("should reject invalid table name", async () => {
      // Contains space, invalid
      await expect(
        getTool().handler(
          {
            table: "bad table",
            column: "amount",
            orderBy: "id",
            direction: "lag",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });

    it("should reject invalid column name", async () => {
      // Contains space, invalid
      await expect(
        getTool().handler(
          {
            table: "sales",
            column: "bad column",
            orderBy: "id",
            direction: "lag",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid column name");
    });
  });

  describe("sqlite_window_running_total", () => {
    const getTool = () =>
      tools.find((t) => t.name === "sqlite_window_running_total")!;

    it("should calculate running total", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          valueColumn: "amount",
          orderBy: "id",
        },
        mockContext,
      )) as {
        success: boolean;
        valueColumn: string;
        rows: { running_total: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.valueColumn).toBe("amount");
      // Verify running total is cumulative
      expect(result.rows[0].running_total).toBe(100); // First row = 100
      expect(result.rows[1].running_total).toBe(250); // 100 + 150
    });

    it("should reset running total per partition", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          valueColumn: "amount",
          orderBy: "id",
          partitionBy: "region",
        },
        mockContext,
      )) as {
        success: boolean;
        rows: { region: string; running_total: number }[];
      };

      expect(result.success).toBe(true);
      // Each region should have separate running totals
      const northRows = result.rows.filter((r) => r.region === "North");
      const northLastTotal = northRows[northRows.length - 1].running_total;
      expect(northLastTotal).toBe(450); // 100 + 150 + 200
    });

    it("should support whereClause", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          valueColumn: "amount",
          orderBy: "id",
          whereClause: "region = 'South'",
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
    });

    it("should reject invalid table name", async () => {
      // Starts with number, invalid
      await expect(
        getTool().handler(
          { table: "123", valueColumn: "amount", orderBy: "id" },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });

    it("should reject invalid column name", async () => {
      // Contains dash, invalid
      await expect(
        getTool().handler(
          { table: "sales", valueColumn: "bad-col", orderBy: "id" },
          mockContext,
        ),
      ).rejects.toThrow("Invalid column name");
    });
  });

  describe("sqlite_window_moving_avg", () => {
    const getTool = () =>
      tools.find((t) => t.name === "sqlite_window_moving_avg")!;

    it("should calculate moving average", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          valueColumn: "amount",
          orderBy: "id",
          windowSize: 3,
        },
        mockContext,
      )) as {
        success: boolean;
        valueColumn: string;
        windowSize: number;
        rows: { moving_avg: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.valueColumn).toBe("amount");
      expect(result.windowSize).toBe(3);
      expect(result.rows[0]).toHaveProperty("moving_avg");
    });

    it("should accept partition", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          valueColumn: "amount",
          orderBy: "id",
          windowSize: 2,
          partitionBy: "region",
        },
        mockContext,
      )) as { success: boolean };

      expect(result.success).toBe(true);
    });

    it("should support whereClause", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          valueColumn: "amount",
          orderBy: "id",
          windowSize: 2,
          whereClause: "amount > 100",
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBeGreaterThan(0);
    });

    it("should reject invalid table name", async () => {
      // Starts with number (1invalid), invalid
      await expect(
        getTool().handler(
          {
            table: "1DROP",
            valueColumn: "amount",
            orderBy: "id",
            windowSize: 3,
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });

    it("should reject invalid column name", async () => {
      // Contains space, invalid
      await expect(
        getTool().handler(
          {
            table: "sales",
            valueColumn: "SELECT *",
            orderBy: "id",
            windowSize: 3,
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid column name");
    });
  });

  describe("sqlite_window_ntile", () => {
    const getTool = () => tools.find((t) => t.name === "sqlite_window_ntile")!;

    it("should divide into quartiles", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          orderBy: "amount DESC",
          buckets: 4,
        },
        mockContext,
      )) as { success: boolean; buckets: number; rows: { bucket: number }[] };

      expect(result.success).toBe(true);
      expect(result.buckets).toBe(4);
      // All rows should have bucket between 1 and 4
      for (const row of result.rows) {
        expect(row.bucket).toBeGreaterThanOrEqual(1);
        expect(row.bucket).toBeLessThanOrEqual(4);
      }
    });

    it("should support partitionBy", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          orderBy: "amount DESC",
          buckets: 2,
          partitionBy: "region",
        },
        mockContext,
      )) as { success: boolean; rows: { bucket: number }[] };

      expect(result.success).toBe(true);
      // Buckets should be 1 or 2 within each region
      for (const row of result.rows) {
        expect(row.bucket).toBeGreaterThanOrEqual(1);
        expect(row.bucket).toBeLessThanOrEqual(2);
      }
    });

    it("should support whereClause", async () => {
      const result = (await getTool().handler(
        {
          table: "sales",
          orderBy: "amount DESC",
          buckets: 2,
          whereClause: "product = 'Widget'",
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(4); // 4 Widget sales
    });

    it("should reject invalid table name", async () => {
      // Contains dash, invalid
      await expect(
        getTool().handler(
          { table: "bad-table", orderBy: "id", buckets: 4 },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });
  });
});
