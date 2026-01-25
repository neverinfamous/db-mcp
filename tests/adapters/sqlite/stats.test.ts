/**
 * Stats Tools Tests
 *
 * Tests for SQLite statistics tools.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteAdapter } from "../../../src/adapters/sqlite/SqliteAdapter.js";

describe("Stats Tools", () => {
  let adapter: SqliteAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = new SqliteAdapter();
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

    // Create test data
    await adapter.executeWriteQuery(`
            CREATE TABLE sales (
                id INTEGER PRIMARY KEY,
                product TEXT,
                amount REAL,
                category TEXT
            )
        `);
    await adapter.executeWriteQuery(`
            INSERT INTO sales (product, amount, category) VALUES
            ('Widget A', 100, 'Electronics'),
            ('Widget B', 200, 'Electronics'),
            ('Gadget C', 150, 'Gadgets'),
            ('Widget D', 50, 'Electronics'),
            ('Gadget E', 300, 'Gadgets')
        `);
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_stats_basic", () => {
    it("should calculate basic statistics", async () => {
      const result = (await tools.get("sqlite_stats_basic")?.({
        table: "sales",
        column: "amount",
      })) as {
        stats: {
          count: number;
          sum: number;
          avg: number;
          min: number;
          max: number;
        };
      };

      expect(result.stats.count).toBe(5);
      expect(result.stats.sum).toBe(800);
      expect(result.stats.avg).toBe(160);
      expect(result.stats.min).toBe(50);
      expect(result.stats.max).toBe(300);
    });

    it("should apply where clause", async () => {
      const result = (await tools.get("sqlite_stats_basic")?.({
        table: "sales",
        column: "amount",
        whereClause: "category = 'Electronics'",
      })) as { stats: { count: number; sum: number } };

      expect(result.stats.count).toBe(3);
      expect(result.stats.sum).toBe(350); // 100 + 200 + 50
    });
  });

  describe("sqlite_stats_count", () => {
    it("should count rows", async () => {
      const result = (await tools.get("sqlite_stats_count")?.({
        table: "sales",
      })) as { count: number };

      expect(result.count).toBe(5);
    });

    it("should count distinct values", async () => {
      const result = (await tools.get("sqlite_stats_count")?.({
        table: "sales",
        column: "category",
        distinct: true,
      })) as { count: number };

      expect(result.count).toBe(2);
    });

    it("should apply where clause", async () => {
      const result = (await tools.get("sqlite_stats_count")?.({
        table: "sales",
        whereClause: "category = 'Electronics'",
      })) as { count: number };

      expect(result.count).toBe(3);
    });
  });

  describe("sqlite_stats_group_by", () => {
    it("should group and aggregate with sum", async () => {
      const result = (await tools.get("sqlite_stats_group_by")?.({
        table: "sales",
        valueColumn: "amount",
        groupByColumn: "category",
        stat: "sum",
      })) as { results: Record<string, unknown>[] };

      const electronics = result.results.find(
        (r) => r["category"] === "Electronics",
      );
      const gadgets = result.results.find((r) => r["category"] === "Gadgets");

      expect(electronics?.["stat_value"]).toBe(350); // 100 + 200 + 50
      expect(gadgets?.["stat_value"]).toBe(450); // 150 + 300
    });

    it("should group and aggregate with avg", async () => {
      const result = (await tools.get("sqlite_stats_group_by")?.({
        table: "sales",
        valueColumn: "amount",
        groupByColumn: "category",
        stat: "avg",
      })) as { results: Record<string, unknown>[] };

      const electronics = result.results.find(
        (r) => r["category"] === "Electronics",
      );
      expect(electronics?.["stat_value"]).toBeCloseTo(116.67, 1);
    });

    it("should group and aggregate with count", async () => {
      const result = (await tools.get("sqlite_stats_group_by")?.({
        table: "sales",
        valueColumn: "amount",
        groupByColumn: "category",
        stat: "count",
      })) as { results: Record<string, unknown>[] };

      const electronics = result.results.find(
        (r) => r["category"] === "Electronics",
      );
      expect(electronics?.["stat_value"]).toBe(3);
    });
  });

  describe("sqlite_stats_top_n", () => {
    it("should get top N values", async () => {
      const result = (await tools.get("sqlite_stats_top_n")?.({
        table: "sales",
        column: "amount",
        n: 3,
      })) as { rows: Record<string, unknown>[] };

      expect(result.rows).toHaveLength(3);
      // First should be 300 (highest)
      expect(result.rows[0]?.["amount"]).toBe(300);
    });

    it("should get bottom N values with asc order", async () => {
      const result = (await tools.get("sqlite_stats_top_n")?.({
        table: "sales",
        column: "amount",
        n: 2,
        orderDirection: "asc",
      })) as { rows: Record<string, unknown>[] };

      expect(result.rows).toHaveLength(2);
      // First should be 50 (lowest)
      expect(result.rows[0]?.["amount"]).toBe(50);
    });
  });

  describe("sqlite_stats_distinct", () => {
    it("should get distinct values", async () => {
      const result = (await tools.get("sqlite_stats_distinct")?.({
        table: "sales",
        column: "category",
      })) as { values: string[] };

      expect(result.values).toContain("Electronics");
      expect(result.values).toContain("Gadgets");
      expect(result.values).toHaveLength(2);
    });
  });

  describe("sqlite_stats_frequency", () => {
    it("should get frequency distribution", async () => {
      const result = (await tools.get("sqlite_stats_frequency")?.({
        table: "sales",
        column: "category",
      })) as { distribution: Record<string, unknown>[] };

      const electronics = result.distribution.find(
        (r) => r["value"] === "Electronics",
      );
      const gadgets = result.distribution.find((r) => r["value"] === "Gadgets");

      expect(electronics?.["frequency"]).toBe(3);
      expect(gadgets?.["frequency"]).toBe(2);
    });
  });

  describe("sqlite_stats_histogram", () => {
    it("should create histogram buckets", async () => {
      const result = (await tools.get("sqlite_stats_histogram")?.({
        table: "sales",
        column: "amount",
        buckets: 5,
      })) as { buckets: { range: string; count: number }[] };

      expect(result.buckets).toBeDefined();
      expect(result.buckets.length).toBeGreaterThan(0);
    });
  });

  describe("sqlite_stats_percentile", () => {
    it("should calculate percentiles", async () => {
      const result = (await tools.get("sqlite_stats_percentile")?.({
        table: "sales",
        column: "amount",
        percentiles: [50, 75, 90],
      })) as { percentiles: { percentile: number; value: number }[] };

      expect(result.percentiles).toBeDefined();
      expect(result.percentiles.length).toBe(3);
      const p50 = result.percentiles.find((p) => p.percentile === 50);
      expect(p50?.value).toBeDefined();
    });
  });
});
