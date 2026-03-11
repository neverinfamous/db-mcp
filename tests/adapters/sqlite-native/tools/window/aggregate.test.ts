/**
 * Window Function Tools - Aggregate Tests
 *
 * Tests for SQLite window function aggregate tools in native adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getWindowTools } from "../../../../../src/adapters/sqlite-native/tools/window.js";
import { NativeSqliteAdapter } from "../../../../../src/adapters/sqlite-native/native-sqlite-adapter.js";
import type {
  RequestContext,
  ToolDefinition,
} from "../../../../../src/types/index.js";

describe("Window Function Tools - Aggregate", () => {
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
      const result = (await getTool().handler(
        { table: "123", valueColumn: "amount", orderBy: "id" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid table name");
    });

    it("should reject invalid column name", async () => {
      // Contains dash, invalid
      const result = (await getTool().handler(
        { table: "sales", valueColumn: "bad-col", orderBy: "id" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid column name");
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
      const result = (await getTool().handler(
        {
          table: "1DROP",
          valueColumn: "amount",
          orderBy: "id",
          windowSize: 3,
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid table name");
    });

    it("should reject invalid column name", async () => {
      // Contains space, invalid
      const result = (await getTool().handler(
        {
          table: "sales",
          valueColumn: "SELECT *",
          orderBy: "id",
          windowSize: 3,
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid column name");
    });
  });
});
