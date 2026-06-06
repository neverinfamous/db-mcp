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
        conditions: [{ column: "category", operator: "=", value: "Fruit" }],
      })) as {
        success: boolean;
        stats: { count: number };
      };

      expect(result.success).toBe(true);
      expect(result.stats.count).toBe(3);
    });

    it("should handle non-numeric string values as null", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE weird_stats (id INTEGER, val REAL)",
      );
      await adapter.executeWriteQuery(
        "INSERT INTO weird_stats (id, val) VALUES (1, 'not a number')",
      );

      const result = (await tools.get("sqlite_stats_basic")?.({
        table: "weird_stats",
        column: "val",
      })) as { success: boolean; stats: any };

      expect(result.success).toBe(true);
      // SQLite sum() on strings usually returns 0 or null depending on data/version.
      // Our JS logic does toNumberOrNull which checks Number.isNaN
      expect(result.stats.sum).toBe(0); // SUM('not a number') in SQLite returns 0.0, which JS sees as 0
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
        conditions: [{ column: "price", operator: ">", value: 1.5 }],
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

    it("should reject buckets less than 1", async () => {
      const result = (await tools.get("sqlite_stats_histogram")?.({
        table: "sales",
        column: "price",
        buckets: 0,
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("buckets' must be at least 1");
    });

    it("should handle empty tables", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE empty_hist (id INTEGER, val REAL)",
      );
      const result = (await tools.get("sqlite_stats_histogram")?.({
        table: "empty_hist",
        column: "val",
        buckets: 5,
      })) as { success: boolean; buckets: any[] };

      expect(result.success).toBe(true);
      expect(result.buckets.length).toBe(0);
    });

    it("should handle uniform data (all values same)", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE uniform_hist (id INTEGER, val REAL)",
      );
      await adapter.executeWriteQuery(
        "INSERT INTO uniform_hist (id, val) VALUES (1, 10), (2, 10), (3, 10)",
      );

      const result = (await tools.get("sqlite_stats_histogram")?.({
        table: "uniform_hist",
        column: "val",
        buckets: 5,
      })) as { success: boolean; buckets: any[] };

      expect(result.success).toBe(true);
      expect(result.buckets.length).toBe(1);
      expect(result.buckets[0].count).toBe(3);
      expect(result.buckets[0].min).toBe(10);
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

    it("should reject invalid percentiles", async () => {
      const result = (await tools.get("sqlite_stats_percentile")?.({
        table: "sales",
        column: "price",
        percentiles: [-1, 105],
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Percentile values must be between 0 and 100",
      );
    });

    it("should handle empty tables gracefully", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE empty_perc (id INTEGER, val REAL)",
      );
      const result = (await tools.get("sqlite_stats_percentile")?.({
        table: "empty_perc",
        column: "val",
        percentiles: [50],
      })) as {
        success: boolean;
        percentiles: { percentile: number; value: number | null }[];
      };

      expect(result.success).toBe(true);
      expect(result.percentiles[0].value).toBeNull();
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

  describe("sqlite_stats_detect_anomalies", () => {
    it("should detect anomalies in numeric columns", async () => {
      // First, insert an outlier
      await adapter.executeWriteQuery(
        `INSERT INTO sales (id, product, category, price, quantity, date) VALUES (11, 'Golden Apple', 'Fruit', 100.0, 10, '2024-01-11')`,
      );
      const result = (await tools.get("sqlite_stats_detect_anomalies")?.({
        table: "sales",
        threshold: 1.0,
      })) as {
        success: boolean;
        anomalies: Record<string, unknown>[];
        summary: string;
        riskLevel: string;
      };

      expect(result.success).toBe(true);
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.riskLevel).toBeDefined();
    });

    it("should handle single column selection and where clause", async () => {
      const result = (await tools.get("sqlite_stats_detect_anomalies")?.({
        table: "sales",
        column: "price",
        threshold: 1.0,
        conditions: [{ column: "price", operator: "<", value: 10.0 }],
      })) as { success: boolean; anomalies: Record<string, unknown>[] };

      expect(result.success).toBe(true);
      // Wait, there might be anomalies within the normal range depending on stats
      expect(Array.isArray(result.anomalies)).toBe(true);
    });

    it("should handle multiple columns selection", async () => {
      const result = (await tools.get("sqlite_stats_detect_anomalies")?.({
        table: "sales",
        columns: ["price", "quantity"],
        threshold: 1.0,
      })) as { success: boolean; anomalies: Record<string, unknown>[] };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_stats_detect_bloat", () => {
    it("should analyze database bloat successfully", async () => {
      const result = (await tools.get("sqlite_stats_detect_bloat")?.({
        limit: 10,
        includeZeroRisk: true,
      })) as {
        success: boolean;
        database: Record<string, unknown>;
        tables: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.database).toBeDefined();
      expect(result.tables.length).toBeGreaterThan(0);
    });
  });

  describe("sqlite_stats_detect_schema_risks", () => {
    it("should analyze schema risks successfully", async () => {
      // Create a table missing a primary key and with many columns to trigger some risk
      await adapter.executeWriteQuery(
        `CREATE TABLE risk_test (col1 TEXT, col2 INTEGER)`,
      );
      // Insert some rows to ensure it might show up in risks if rowCount > threshold, but we're including zero risk
      const result = (await tools.get("sqlite_stats_detect_schema_risks")?.({
        limit: 10,
        includeZeroRisk: true,
      })) as {
        success: boolean;
        tables: Record<string, unknown>[];
        summary: string;
      };

      expect(result.success).toBe(true);
      expect(result.tables.length).toBeGreaterThan(0);
      const riskTestTable = result.tables.find(
        (t: any) => t.name === "risk_test",
      );
      expect(riskTestTable).toBeDefined();
      expect(riskTestTable).toBeDefined();
      expect((riskTestTable as any)?.hasPrimaryKey).toBe(false);
    });

    it("should detect text primary key and unindexed foreign keys", async () => {
      await adapter.executeWriteQuery(
        `CREATE TABLE text_pk_test (id TEXT PRIMARY KEY, val TEXT)`
      );
      await adapter.executeWriteQuery(
        `CREATE TABLE fk_test (id INTEGER PRIMARY KEY, parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES text_pk_test(id))`
      );
      
      const result = (await tools.get("sqlite_stats_detect_schema_risks")?.({
        limit: 10,
        includeZeroRisk: true,
      })) as {
        success: boolean;
        tables: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      
      const textPkTable = result.tables.find((t: any) => t.name === "text_pk_test") as any;
      expect(textPkTable).toBeDefined();
      expect(textPkTable.hasPrimaryKey).toBe(true);

      const fkTable = result.tables.find((t: any) => t.name === "fk_test") as any;
      expect(fkTable).toBeDefined();
      expect(fkTable.foreignKeyCount).toBe(1);
      expect(fkTable.unindexedForeignKeys.length).toBe(1);
    });

    it("should detect untyped columns", async () => {
      await adapter.executeWriteQuery(
        `CREATE TABLE untyped_test (id INTEGER PRIMARY KEY, untyped_col)`
      );
      const result = (await tools.get("sqlite_stats_detect_schema_risks")?.({
        includeZeroRisk: true,
      })) as {
        success: boolean;
        tables: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      const untypedTable = result.tables.find((t: any) => t.name === "untyped_test") as any;
      expect(untypedTable).toBeDefined();
    });
  });

  describe("sqlite_stats_sample", () => {
    it("should return random sample of rows", async () => {
      const result = (await tools.get("sqlite_stats_sample")?.({
        table: "sales",
        sampleSize: 3,
      })) as {
        success: boolean;
        sampleSize: number;
        totalRows: number;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.sampleSize).toBe(3);
      expect(result.totalRows).toBe(10);
      expect(result.rows.length).toBe(3);
    });

    it("should select specific columns", async () => {
      const result = (await tools.get("sqlite_stats_sample")?.({
        table: "sales",
        sampleSize: 2,
        selectColumns: ["product", "price"],
      })) as {
        success: boolean;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rows[0]).toHaveProperty("product");
      expect(result.rows[0]).toHaveProperty("price");
      expect(result.rows[0]).not.toHaveProperty("id");
    });

    it("should handle whereClause string", async () => {
      const result = (await tools.get("sqlite_stats_sample")?.({
        table: "sales",
        sampleSize: 5,
        whereClause: "category = 'Dairy'",
      })) as {
        success: boolean;
        totalRows: number;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(3);
      expect(result.rows.length).toBeLessThanOrEqual(3);
    });

    it("should return validation error for invalid sample size", async () => {
      const result = (await tools.get("sqlite_stats_sample")?.({
        table: "sales",
        sampleSize: 0,
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("sampleSize must be at least 1");
    });
  });

  // =========================================================================
  // Error Path Tests
  // =========================================================================

  describe("Error Handling", () => {
    it("should return TABLE_NOT_FOUND for nonexistent table (basic)", async () => {
      const result = (await tools.get("sqlite_stats_basic")?.({
        table: "nonexistent_table",
        column: "price",
      })) as { success: boolean; code?: string; error?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("TABLE_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (basic)", async () => {
      const result = (await tools.get("sqlite_stats_basic")?.({
        table: "sales",
        column: "nonexistent_col",
      })) as { success: boolean; code?: string; error?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return TABLE_NOT_FOUND for nonexistent table (count)", async () => {
      const result = (await tools.get("sqlite_stats_count")?.({
        table: "nonexistent_table",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("TABLE_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (count)", async () => {
      const result = (await tools.get("sqlite_stats_count")?.({
        table: "sales",
        column: "nonexistent_col",
        distinct: true,
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (group_by)", async () => {
      const result = (await tools.get("sqlite_stats_group_by")?.({
        table: "sales",
        valueColumn: "nonexistent_col",
        groupByColumn: "category",
        stat: "avg",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (histogram)", async () => {
      const result = (await tools.get("sqlite_stats_histogram")?.({
        table: "sales",
        column: "nonexistent_col",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (correlation)", async () => {
      const result = (await tools.get("sqlite_stats_correlation")?.({
        table: "sales",
        column1: "price",
        column2: "nonexistent_col",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (top_n)", async () => {
      const result = (await tools.get("sqlite_stats_top_n")?.({
        table: "sales",
        column: "nonexistent_col",
        n: 5,
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (distinct)", async () => {
      const result = (await tools.get("sqlite_stats_distinct")?.({
        table: "sales",
        column: "nonexistent_col",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return TABLE_NOT_FOUND for nonexistent table (summary)", async () => {
      const result = (await tools.get("sqlite_stats_summary")?.({
        table: "nonexistent_table",
        columns: ["price"],
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("TABLE_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (summary)", async () => {
      const result = (await tools.get("sqlite_stats_summary")?.({
        table: "sales",
        columns: ["nonexistent_col"],
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (frequency)", async () => {
      const result = (await tools.get("sqlite_stats_frequency")?.({
        table: "sales",
        column: "nonexistent_col",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (outliers)", async () => {
      const result = (await tools.get("sqlite_stats_outliers")?.({
        table: "sales",
        column: "nonexistent_col",
        method: "iqr",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (regression)", async () => {
      const result = (await tools.get("sqlite_stats_regression")?.({
        table: "sales",
        xColumn: "nonexistent_col",
        yColumn: "price",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (hypothesis)", async () => {
      const result = (await tools.get("sqlite_stats_hypothesis")?.({
        table: "sales",
        column: "nonexistent_col",
        testType: "ttest_one",
        expectedMean: 0,
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return TABLE_NOT_FOUND for nonexistent table (anomalies)", async () => {
      const result = (await tools.get("sqlite_stats_detect_anomalies")?.({
        table: "nonexistent_table",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("TABLE_NOT_FOUND");
    });

    it("should return COLUMN_NOT_FOUND for nonexistent column (anomalies)", async () => {
      const result = (await tools.get("sqlite_stats_detect_anomalies")?.({
        table: "sales",
        column: "nonexistent_col",
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });
  });
});
