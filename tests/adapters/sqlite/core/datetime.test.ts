import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Core Tools - Datetime", () => {
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
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_date_add", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test_dates (id INTEGER, dt TEXT)",
      );
      await adapter.executeWriteQuery(
        "INSERT INTO test_dates (id, dt) VALUES (1, '2023-01-01 12:00:00'), (2, '2023-01-02 12:00:00')",
      );
    });

    it("should handle missing required params", async () => {
      const res = (await tools.get("sqlite_date_add")?.({
        table: "test_dates",
        column: "dt",
        // missing amount and unit
      })) as { success: boolean };
      expect(res.success).toBe(false);
    });

    it("should handle invalid table/column", async () => {
      const res = (await tools.get("sqlite_date_add")?.({
        table: "test_dates",
        column: "nonexistent",
        amount: 1,
        unit: "days",
      })) as { success: boolean; error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("not found in table");
    });

    it("should add days correctly", async () => {
      const res = (await tools.get("sqlite_date_add")?.({
        table: "test_dates",
        column: "dt",
        amount: 1,
        unit: "days",
        selectColumns: ["id"],
        whereClause: "id = 1",
      })) as { success: boolean; rows: any[] };
      expect(res.success).toBe(true);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].date_add_result).toContain("2023-01-02 12:00:00");
      expect(res.rows[0].id).toBe(1);
    });

    it("should subtract hours correctly", async () => {
      const res = (await tools.get("sqlite_date_add")?.({
        table: "test_dates",
        column: "dt",
        amount: -2,
        unit: "hours",
        conditions: [{ column: "id", operator: "=", value: 2 }],
      })) as { success: boolean; rows: any[] };
      expect(res.success).toBe(true);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].date_add_result).toContain("2023-01-02 10:00:00");
    });

    it("should detect out of bounds calculations", async () => {
      // Adding 10000 years will push it past year 9999
      const res = (await tools.get("sqlite_date_add")?.({
        table: "test_dates",
        column: "dt",
        amount: 10000,
        unit: "years",
      })) as { success: boolean; error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("out of bounds");
    });
  });

  describe("sqlite_date_diff", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test_dates (id INTEGER, start_dt TEXT, end_dt TEXT)",
      );
      await adapter.executeWriteQuery(
        "INSERT INTO test_dates (id, start_dt, end_dt) VALUES (1, '2023-01-01 12:00:00', '2023-01-02 12:00:00')",
      );
    });

    it("should diff two columns in days", async () => {
      const res = (await tools.get("sqlite_date_diff")?.({
        table: "test_dates",
        column1: "end_dt",
        column2: "start_dt",
        unit: "days",
        whereClause: "id = 1",
      })) as { success: boolean; rows: any[] };
      expect(res.success).toBe(true);
      expect(res.rows[0].date_diff_result).toBe(1); // 1 day difference
    });

    it("should diff literal and column in hours", async () => {
      const res = (await tools.get("sqlite_date_diff")?.({
        table: "test_dates",
        column1: "'2023-01-01 14:00:00'",
        column2: "start_dt",
        unit: "hours",
      })) as { success: boolean; rows: any[] };
      expect(res.success).toBe(true);
      expect(Math.round(res.rows[0].date_diff_result)).toBe(2); // 2 hours difference
    });

    it("should apply limit correctly", async () => {
      await adapter.executeWriteQuery(
        "INSERT INTO test_dates (id, start_dt, end_dt) VALUES (2, '2023-01-01', '2023-01-03')",
      );
      const res = (await tools.get("sqlite_date_diff")?.({
        table: "test_dates",
        column1: "end_dt",
        column2: "start_dt",
        unit: "days",
        limit: 1,
      })) as { success: boolean; rows: any[] };
      expect(res.success).toBe(true);
      expect(res.rows).toHaveLength(1);
    });

    it("should error on non-existent column", async () => {
      const res = (await tools.get("sqlite_date_diff")?.({
        table: "test_dates",
        column1: "end_dt",
        column2: "nonexistent",
        unit: "days",
      })) as { success: boolean; error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("not found in table");
    });
  });
});
