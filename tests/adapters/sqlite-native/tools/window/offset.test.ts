/**
 * Window Function Tools - Offset Tests
 *
 * Tests for SQLite window function offset tools in native adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getWindowTools } from "../../../../../src/adapters/sqlite-native/tools/window.js";
import { NativeSqliteAdapter } from "../../../../../src/adapters/sqlite-native/native-sqlite-adapter.js";
import type {
  RequestContext,
  ToolDefinition,
} from "../../../../../src/types/index.js";

describe("Window Function Tools - Offset", () => {
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
      const result = (await getTool().handler(
        {
          table: "bad table",
          column: "amount",
          orderBy: "id",
          direction: "lag",
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
          column: "bad column",
          orderBy: "id",
          direction: "lag",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid column name");
    });
  });
});
