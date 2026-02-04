/**
 * Statistics Tools Tests
 *
 * Tests for SQLite statistics tools:
 * basic stats, count, group by, histogram, percentile, correlation,
 * top N, distinct, summary, frequency, outliers, regression, hypothesis.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Statistics Tools", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create test table with numeric data
    await adapter.executeWriteQuery(`
      CREATE TABLE sales (
        id INTEGER PRIMARY KEY,
        product TEXT,
        category TEXT,
        price REAL,
        quantity INTEGER,
        date TEXT
      )
    `);

    // Insert test data with varied values for stats
    await adapter.executeWriteQuery(`
      INSERT INTO sales (id, product, category, price, quantity, date) VALUES 
      (1, 'Apple', 'Fruit', 1.50, 10, '2024-01-01'),
      (2, 'Banana', 'Fruit', 0.75, 20, '2024-01-02'),
      (3, 'Orange', 'Fruit', 1.25, 15, '2024-01-03'),
      (4, 'Carrot', 'Vegetable', 0.50, 30, '2024-01-04'),
      (5, 'Broccoli', 'Vegetable', 1.00, 25, '2024-01-05'),
      (6, 'Milk', 'Dairy', 2.50, 8, '2024-01-06'),
      (7, 'Cheese', 'Dairy', 4.00, 5, '2024-01-07'),
      (8, 'Yogurt', 'Dairy', 1.75, 12, '2024-01-08'),
      (9, 'Bread', 'Bakery', 2.00, 18, '2024-01-09'),
      (10, 'Cake', 'Bakery', 8.00, 3, '2024-01-10')
    `);

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

  describe("sqlite_stats_basic", () => {
    it("should calculate basic statistics", async () => {
      const result = (await tools.get("sqlite_stats_basic")?.({
        table: "sales",
        column: "price",
      })) as {
        success: boolean;
        stats: {
          count: number;
          sum: number;
          avg: number;
          min: number;
          max: number;
        };
      };

      expect(result.success).toBe(true);
      expect(result.stats.count).toBe(10);
      expect(result.stats.min).toBe(0.5);
      expect(result.stats.max).toBe(8);
    });

    it("should work with whereClause filter", async () => {
      const result = (await tools.get("sqlite_stats_basic")?.({
        table: "sales",
        column: "price",
        whereClause: "category = 'Fruit'",
      })) as {
        success: boolean;
        stats: { count: number };
      };

      expect(result.success).toBe(true);
      expect(result.stats.count).toBe(3);
    });
  });

  describe("sqlite_stats_count", () => {
    it("should count rows", async () => {
      const result = (await tools.get("sqlite_stats_count")?.({
        table: "sales",
      })) as {
        success: boolean;
        count: number;
      };

      expect(result.success).toBe(true);
      expect(result.count).toBe(10);
    });

    it("should count with filter", async () => {
      const result = (await tools.get("sqlite_stats_count")?.({
        table: "sales",
        whereClause: "price > 1.5",
      })) as {
        success: boolean;
        count: number;
      };

      expect(result.success).toBe(true);
      expect(result.count).toBe(5); // Milk, Cheese, Yogurt, Bread, Cake
    });
  });

  describe("sqlite_stats_group_by", () => {
    it("should group and aggregate", async () => {
      const result = (await tools.get("sqlite_stats_group_by")?.({
        table: "sales",
        groupByColumn: "category",
        valueColumn: "price",
        stat: "avg",
      })) as {
        success: boolean;
        rowCount: number;
        results: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(4); // 4 categories
    });

    it("should support count function", async () => {
      const result = (await tools.get("sqlite_stats_group_by")?.({
        table: "sales",
        groupByColumn: "category",
        valueColumn: "id",
        stat: "count",
      })) as {
        success: boolean;
        results: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_stats_histogram", () => {
    it("should create histogram buckets", async () => {
      const result = (await tools.get("sqlite_stats_histogram")?.({
        table: "sales",
        column: "price",
        buckets: 5,
      })) as {
        success: boolean;
        buckets: { min: number; max: number; count: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.buckets.length).toBeGreaterThan(0);
    });
  });

  describe("sqlite_stats_percentile", () => {
    it("should calculate percentiles", async () => {
      const result = (await tools.get("sqlite_stats_percentile")?.({
        table: "sales",
        column: "price",
        percentiles: [25, 50, 75],
      })) as {
        success: boolean;
        percentiles: { percentile: number; value: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.percentiles.length).toBe(3);
    });
  });

  describe("sqlite_stats_correlation", () => {
    it("should calculate correlation between columns", async () => {
      const result = (await tools.get("sqlite_stats_correlation")?.({
        table: "sales",
        column1: "price",
        column2: "quantity",
      })) as {
        success: boolean;
        correlation: number;
      };

      expect(result.success).toBe(true);
      expect(typeof result.correlation).toBe("number");
    });
  });

  describe("sqlite_stats_top_n", () => {
    it("should return top N rows", async () => {
      const result = (await tools.get("sqlite_stats_top_n")?.({
        table: "sales",
        column: "price",
        n: 3,
      })) as {
        success: boolean;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rows.length).toBe(3);
    });

    it("should support ascending order", async () => {
      const result = (await tools.get("sqlite_stats_top_n")?.({
        table: "sales",
        column: "price",
        n: 3,
        orderDirection: "asc",
      })) as {
        success: boolean;
        rows: { price: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.rows[0]?.price).toBe(0.5); // Carrot is cheapest
    });
  });

  describe("sqlite_stats_distinct", () => {
    it("should return distinct values", async () => {
      const result = (await tools.get("sqlite_stats_distinct")?.({
        table: "sales",
        column: "category",
      })) as {
        success: boolean;
        distinctCount: number;
        values: string[];
      };

      expect(result.success).toBe(true);
      expect(result.distinctCount).toBe(4);
      expect(result.values).toContain("Fruit");
      expect(result.values).toContain("Dairy");
    });
  });

  describe("sqlite_stats_summary", () => {
    it("should generate column summary", async () => {
      const result = (await tools.get("sqlite_stats_summary")?.({
        table: "sales",
        columns: ["price", "quantity"],
      })) as {
        success: boolean;
        summaries: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.summaries.length).toBe(2);
    });

    it("should auto-detect numeric columns when columns not specified", async () => {
      const result = (await tools.get("sqlite_stats_summary")?.({
        table: "sales",
      })) as {
        success: boolean;
        summaries: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      // Should auto-detect price, quantity, and id as numeric
      expect(result.summaries.length).toBeGreaterThan(0);
    });
  });

  describe("sqlite_stats_frequency", () => {
    it("should calculate value frequencies", async () => {
      const result = (await tools.get("sqlite_stats_frequency")?.({
        table: "sales",
        column: "category",
      })) as {
        success: boolean;
        distribution: { value: string; count: number; percentage: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.distribution.length).toBe(4);
    });
  });

  describe("sqlite_stats_outliers", () => {
    it("should detect outliers using IQR", async () => {
      const result = (await tools.get("sqlite_stats_outliers")?.({
        table: "sales",
        column: "price",
        method: "iqr",
      })) as {
        success: boolean;
        outliers: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      // Cake at $8 might be an outlier
    });

    it("should detect outliers using z-score", async () => {
      const result = (await tools.get("sqlite_stats_outliers")?.({
        table: "sales",
        column: "price",
        method: "zscore",
        threshold: 2,
      })) as {
        success: boolean;
        outliers: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_stats_regression", () => {
    it("should calculate linear regression", async () => {
      const result = (await tools.get("sqlite_stats_regression")?.({
        table: "sales",
        xColumn: "quantity",
        yColumn: "price",
      })) as {
        success: boolean;
        coefficients: { linear: number; intercept: number };
        rSquared: number;
      };

      expect(result.success).toBe(true);
      expect(typeof result.coefficients?.linear).toBe("number");
      expect(typeof result.coefficients?.intercept).toBe("number");
    });
  });

  describe("sqlite_stats_hypothesis", () => {
    it("should perform t-test", async () => {
      const result = (await tools.get("sqlite_stats_hypothesis")?.({
        table: "sales",
        column: "price",
        expectedMean: 2.0,
        testType: "ttest_one",
      })) as {
        success: boolean;
        statistic: number;
        pValue: number;
      };

      expect(result.success).toBe(true);
      expect(typeof result.statistic).toBe("number");
    });
  });
});
