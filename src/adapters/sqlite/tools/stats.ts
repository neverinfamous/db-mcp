/**
 * SQLite Statistics Tools
 *
 * Statistical analysis and aggregation functions:
 * sum, avg, min, max, count, distinct, percentile, histogram, correlation,
 * outlier detection, regression, hypothesis testing.
 * 13 tools total.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { readOnly } from "../../../utils/annotations.js";
import { validateWhereClause } from "../../../utils/index.js";
import {
  ReadQueryOutputSchema,
  StatsHistogramOutputSchema,
  StatsPercentileOutputSchema,
  StatsCorrelationOutputSchema,
} from "../output-schemas.js";

// Stats schemas
const BasicStatsSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column for statistics"),
  whereClause: z.string().optional(),
});

const CountSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().optional().describe("Column to count (default: *)"),
  distinct: z.boolean().optional().default(false),
  whereClause: z.string().optional(),
});

const GroupByStatsSchema = z.object({
  table: z.string().describe("Table name"),
  valueColumn: z.string().describe("Column for statistical value"),
  groupByColumn: z.string().describe("Column to group by"),
  stat: z
    .enum(["sum", "avg", "min", "max", "count"])
    .describe("Statistic type"),
  whereClause: z.string().optional(),
  orderBy: z.enum(["value", "group"]).optional().default("group"),
  limit: z.number().optional().default(100),
});

const HistogramSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column"),
  buckets: z.number().optional().default(10).describe("Number of buckets"),
  whereClause: z.string().optional(),
});

const PercentileSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column"),
  percentiles: z
    .array(z.number().min(0).max(100))
    .describe("Percentiles to compute"),
  whereClause: z.string().optional(),
});

const CorrelationSchema = z.object({
  table: z.string().describe("Table name"),
  column1: z.string().describe("First numeric column"),
  column2: z.string().describe("Second numeric column"),
  whereClause: z.string().optional(),
});

const TopNSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to rank"),
  n: z.number().optional().default(10).describe("Number of top values"),
  orderDirection: z.enum(["asc", "desc"]).optional().default("desc"),
  whereClause: z.string().optional(),
});

const DistinctValuesSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to get distinct values"),
  limit: z.number().optional().default(100),
  whereClause: z.string().optional(),
});

const SummaryStatsSchema = z.object({
  table: z.string().describe("Table name"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Columns to summarize (default: all numeric)"),
  whereClause: z.string().optional(),
});

const FrequencySchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to count frequency"),
  limit: z.number().optional().default(20),
  whereClause: z.string().optional(),
});

// New statistical schemas
const OutlierSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column to analyze"),
  method: z.enum(["iqr", "zscore"]).optional().default("iqr"),
  threshold: z
    .number()
    .optional()
    .describe("IQR multiplier (default 1.5) or Z-score threshold (default 3)"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const RegressionSchema = z.object({
  table: z.string().describe("Table name"),
  xColumn: z.string().describe("Independent variable column"),
  yColumn: z.string().describe("Dependent variable column"),
  degree: z
    .number()
    .min(1)
    .max(3)
    .optional()
    .default(1)
    .describe("Polynomial degree (1=linear)"),
  whereClause: z.string().optional(),
});

const HypothesisSchema = z.object({
  table: z.string().describe("Table name"),
  testType: z.enum(["ttest_one", "ttest_two", "chi_square"]),
  column: z.string().describe("Primary column for analysis"),
  column2: z
    .string()
    .optional()
    .describe("Second column for two-sample t-test"),
  groupColumn: z.string().optional().describe("Group column for chi-square"),
  expectedMean: z
    .number()
    .optional()
    .describe("Expected mean for one-sample t-test"),
  whereClause: z.string().optional(),
});

/**
 * Get all statistics tools
 */
export function getStatsTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createBasicStatsTool(adapter),
    createCountTool(adapter),
    createGroupByStatsTool(adapter),
    createHistogramTool(adapter),
    createPercentileTool(adapter),
    createCorrelationTool(adapter),
    createTopNTool(adapter),
    createDistinctValuesTool(adapter),
    createSummaryStatsTool(adapter),
    createFrequencyTool(adapter),
    // New statistical tools
    createOutlierTool(adapter),
    createRegressionTool(adapter),
    createHypothesisTool(adapter),
  ];
}

/**
 * Basic statistics (sum, avg, min, max, stdev)
 */
function createBasicStatsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_basic",
    description:
      "Get basic statistics (count, sum, avg, min, max) for a numeric column.",
    group: "stats",
    inputSchema: BasicStatsSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Basic Statistics"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = BasicStatsSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      let sql = `SELECT 
                COUNT("${input.column}") as count,
                SUM("${input.column}") as sum,
                AVG("${input.column}") as avg,
                MIN("${input.column}") as min,
                MAX("${input.column}") as max,
                MAX("${input.column}") - MIN("${input.column}") as range
            FROM "${input.table}"`;

      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        sql += ` WHERE ${input.whereClause}`;
      }

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        column: input.column,
        stats: result.rows?.[0],
      };
    },
  };
}

/**
 * Count rows
 */
function createCountTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_count",
    description: "Count rows, optionally distinct values in a column.",
    group: "stats",
    inputSchema: CountSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Count Rows"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CountSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }

      let countExpr: string;
      if (input.column) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
          throw new Error("Invalid column name");
        }
        countExpr = input.distinct
          ? `COUNT(DISTINCT "${input.column}")`
          : `COUNT("${input.column}")`;
      } else {
        countExpr = "COUNT(*)";
      }

      let sql = `SELECT ${countExpr} as count FROM "${input.table}"`;
      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        sql += ` WHERE ${input.whereClause}`;
      }

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        count: result.rows?.[0]?.["count"] ?? 0,
        distinct: input.distinct,
      };
    },
  };
}

/**
 * Group by with aggregation
 */
function createGroupByStatsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_group_by",
    description: "Aggregate statistics grouped by a column.",
    group: "stats",
    inputSchema: GroupByStatsSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Group By Stats"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = GroupByStatsSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.valueColumn)) {
        throw new Error("Invalid value column name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.groupByColumn)) {
        throw new Error("Invalid group by column name");
      }

      const statFunc = input.stat.toUpperCase();
      const orderCol =
        input.orderBy === "value" ? "stat_value" : `"${input.groupByColumn}"`;

      let sql = `SELECT "${input.groupByColumn}", ${statFunc}("${input.valueColumn}") as stat_value 
                FROM "${input.table}"`;

      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        sql += ` WHERE ${input.whereClause}`;
      }

      sql += ` GROUP BY "${input.groupByColumn}" ORDER BY ${orderCol} DESC LIMIT ${input.limit}`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        statistic: input.stat,
        rowCount: result.rows?.length ?? 0,
        results: result.rows,
      };
    },
  };
}

/**
 * Histogram
 */
function createHistogramTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_histogram",
    description: "Create a histogram with specified number of buckets.",
    group: "stats",
    inputSchema: HistogramSchema,
    outputSchema: StatsHistogramOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Histogram"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = HistogramSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      // First get min/max
      let minMaxSql = `SELECT MIN("${input.column}") as min_val, MAX("${input.column}") as max_val FROM "${input.table}"`;
      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        minMaxSql += ` WHERE ${input.whereClause}`;
      }

      const minMaxResult = await adapter.executeReadQuery(minMaxSql);
      const minVal = (minMaxResult.rows?.[0]?.["min_val"] as number) ?? 0;
      const maxVal = (minMaxResult.rows?.[0]?.["max_val"] as number) ?? 0;
      const range = maxVal - minVal;
      const bucketSize = range / input.buckets;

      if (bucketSize === 0) {
        return {
          success: true,
          buckets: [{ min: minVal, max: maxVal, count: 1 }],
        };
      }

      // Build histogram using CASE expressions
      const bucketCases = [];
      for (let i = 0; i < input.buckets; i++) {
        const bucketMin = minVal + i * bucketSize;
        const bucketMax = minVal + (i + 1) * bucketSize;
        bucketCases.push(
          `SUM(CASE WHEN "${input.column}" >= ${bucketMin} AND "${input.column}" < ${bucketMax} THEN 1 ELSE 0 END) as bucket_${i}`,
        );
      }

      let sql = `SELECT ${bucketCases.join(", ")} FROM "${input.table}"`;
      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        sql += ` WHERE ${input.whereClause}`;
      }

      const result = await adapter.executeReadQuery(sql);

      // Format buckets
      const buckets = [];
      for (let i = 0; i < input.buckets; i++) {
        const bucketMin = minVal + i * bucketSize;
        const bucketMax = minVal + (i + 1) * bucketSize;
        buckets.push({
          bucket: i,
          min: bucketMin,
          max: bucketMax,
          count: result.rows?.[0]?.[`bucket_${i}`] ?? 0,
        });
      }

      return {
        success: true,
        column: input.column,
        range: { min: minVal, max: maxVal },
        bucketSize,
        buckets,
      };
    },
  };
}

/**
 * Percentiles
 */
function createPercentileTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_percentile",
    description:
      "Calculate percentiles (median, quartiles, etc.) for a column.",
    group: "stats",
    inputSchema: PercentileSchema,
    outputSchema: StatsPercentileOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Percentile"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = PercentileSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      let sql = `SELECT "${input.column}" as value FROM "${input.table}" WHERE "${input.column}" IS NOT NULL`;
      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        sql += ` AND ${input.whereClause}`;
      }
      sql += ` ORDER BY "${input.column}"`;

      const result = await adapter.executeReadQuery(sql);
      const values = (result.rows ?? []).map((r) => r["value"] as number);

      if (values.length === 0) {
        return {
          success: true,
          percentiles: input.percentiles.map((p) => ({
            percentile: p,
            value: null,
          })),
        };
      }

      // Calculate percentiles
      const percentiles = input.percentiles.map((p) => {
        const index = Math.ceil((p / 100) * values.length) - 1;
        const safeIndex = Math.max(0, Math.min(index, values.length - 1));
        return {
          percentile: p,
          value: values[safeIndex],
        };
      });

      return {
        success: true,
        column: input.column,
        count: values.length,
        percentiles,
      };
    },
  };
}

/**
 * Correlation between two columns
 */
function createCorrelationTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_correlation",
    description:
      "Calculate Pearson correlation coefficient between two numeric columns.",
    group: "stats",
    inputSchema: CorrelationSchema,
    outputSchema: StatsCorrelationOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Correlation"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CorrelationSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column1)) {
        throw new Error("Invalid column1 name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column2)) {
        throw new Error("Invalid column2 name");
      }

      // Get paired values
      let sql = `SELECT "${input.column1}" as x, "${input.column2}" as y 
                FROM "${input.table}" 
                WHERE "${input.column1}" IS NOT NULL AND "${input.column2}" IS NOT NULL`;
      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        sql += ` AND ${input.whereClause}`;
      }

      const result = await adapter.executeReadQuery(sql);
      const pairs = (result.rows ?? []).map((r) => ({
        x: r["x"] as number,
        y: r["y"] as number,
      }));

      if (pairs.length < 2) {
        return {
          success: true,
          correlation: null,
          message: "Need at least 2 data points",
        };
      }

      // Calculate correlation in JS
      const n = pairs.length;
      const sumX = pairs.reduce((s, p) => s + p.x, 0);
      const sumY = pairs.reduce((s, p) => s + p.y, 0);
      const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
      const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);
      const sumY2 = pairs.reduce((s, p) => s + p.y * p.y, 0);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt(
        (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
      );

      const correlation = denominator === 0 ? 0 : numerator / denominator;

      return {
        success: true,
        column1: input.column1,
        column2: input.column2,
        n: pairs.length,
        correlation: Math.round(correlation * 10000) / 10000,
      };
    },
  };
}

/**
 * Top N values
 */
function createTopNTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_top_n",
    description: "Get top N values from a column.",
    group: "stats",
    inputSchema: TopNSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Top N Values"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TopNSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      const order = input.orderDirection.toUpperCase();

      let sql = `SELECT * FROM "${input.table}"`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += ` ORDER BY "${input.column}" ${order} LIMIT ${input.n}`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        column: input.column,
        direction: input.orderDirection,
        count: result.rows?.length ?? 0,
        rows: result.rows,
      };
    },
  };
}

/**
 * Distinct values
 */
function createDistinctValuesTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_distinct",
    description: "Get distinct values from a column.",
    group: "stats",
    inputSchema: DistinctValuesSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Distinct Values"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DistinctValuesSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      let sql = `SELECT DISTINCT "${input.column}" as value FROM "${input.table}"`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += ` LIMIT ${input.limit}`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        column: input.column,
        distinctCount: result.rows?.length ?? 0,
        values: result.rows?.map((r) => r["value"]),
      };
    },
  };
}

/**
 * Summary statistics for all numeric columns
 */
function createSummaryStatsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_summary",
    description: "Get summary statistics for multiple columns at once.",
    group: "stats",
    inputSchema: SummaryStatsSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Summary Stats"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = SummaryStatsSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }

      // Get table info to find columns
      const tableInfo = await adapter.describeTable(input.table);

      // Filter to requested columns or all columns from table
      let columns = (tableInfo.columns ?? []).map((c) => c.name);
      if (input.columns && input.columns.length > 0) {
        for (const col of input.columns) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
            throw new Error(`Invalid column name: ${col}`);
          }
        }
        columns = input.columns;
      }

      // Build summary query for each column
      const summaries: Record<string, unknown>[] = [];

      for (const col of columns) {
        let sql = `SELECT 
                    COUNT("${col}") as count,
                    AVG("${col}") as avg,
                    MIN("${col}") as min,
                    MAX("${col}") as max
                FROM "${input.table}"`;

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        try {
          const result = await adapter.executeReadQuery(sql);
          summaries.push({
            column: col,
            ...result.rows?.[0],
          });
        } catch {
          // Column may not be numeric, skip
          summaries.push({ column: col, error: "Not numeric" });
        }
      }

      return {
        success: true,
        table: input.table,
        summaries,
      };
    },
  };
}

/**
 * Value frequency distribution
 */
function createFrequencyTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_frequency",
    description: "Get frequency distribution of values in a column.",
    group: "stats",
    inputSchema: FrequencySchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Frequency"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = FrequencySchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      let sql = `SELECT "${input.column}" as value, COUNT(*) as frequency 
                FROM "${input.table}"`;
      if (input.whereClause) {
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += ` GROUP BY "${input.column}" ORDER BY frequency DESC LIMIT ${input.limit}`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        column: input.column,
        distinctValues: result.rows?.length ?? 0,
        distribution: result.rows,
      };
    },
  };
}

// =============================================================================
// New Statistical Tools
// =============================================================================

/**
 * Approximate normal CDF for p-value calculation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Approximate t-distribution p-value (two-tailed)
 */
function tDistPValue(t: number, df: number): number {
  // Use normal approximation for large df
  if (df > 30) {
    return 2 * (1 - normalCDF(Math.abs(t)));
  }
  // Simplified approximation for smaller df
  const x = df / (df + t * t);
  // Beta incomplete function approximation
  const p = Math.pow(x, df / 2) * 0.5;
  return Math.min(1, Math.max(0, 2 * p));
}

/**
 * Outlier detection using IQR or Z-score
 */
function createOutlierTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_outliers",
    description:
      "Detect outliers using IQR (Interquartile Range) or Z-score method.",
    group: "stats",
    inputSchema: OutlierSchema,
    outputSchema: z.object({
      success: z.boolean(),
      method: z.string(),
      stats: z.object({
        mean: z.number().optional(),
        stdDev: z.number().optional(),
        q1: z.number().optional(),
        q3: z.number().optional(),
        iqr: z.number().optional(),
        lowerBound: z.number(),
        upperBound: z.number(),
      }),
      outlierCount: z.number(),
      totalRows: z.number(),
      outliers: z.array(
        z.object({
          value: z.number(),
          rowid: z.number().optional(),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Outlier Detection"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = OutlierSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      const whereClause = input.whereClause ? ` AND ${input.whereClause}` : "";

      if (input.method === "zscore") {
        const threshold = input.threshold ?? 3;

        // Get mean and stddev
        const statsResult = await adapter.executeReadQuery(
          `SELECT AVG("${input.column}") as mean, 
                  (SUM(("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause})) * 
                       ("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}))) / 
                   (COUNT(*) - 1)) as variance,
                  COUNT(*) as total
           FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}`,
        );

        const mean = Number(statsResult.rows?.[0]?.["mean"] ?? 0);
        const variance = Number(statsResult.rows?.[0]?.["variance"] ?? 0);
        const stdDev = Math.sqrt(variance);
        const total = Number(statsResult.rows?.[0]?.["total"] ?? 0);

        const lowerBound = mean - threshold * stdDev;
        const upperBound = mean + threshold * stdDev;

        // Find outliers
        const outlierResult = await adapter.executeReadQuery(
          `SELECT rowid, "${input.column}" as value FROM "${input.table}" 
           WHERE "${input.column}" IS NOT NULL${whereClause}
             AND ("${input.column}" < ${lowerBound} OR "${input.column}" > ${upperBound})
           LIMIT ${input.limit}`,
        );

        const outliers = (outlierResult.rows ?? []).map((row) => {
          const rowid = row["rowid"];
          return {
            value: Number(row["value"]),
            ...(typeof rowid === "number" ? { rowid } : {}),
          };
        });

        return {
          success: true,
          method: "zscore",
          stats: { mean, stdDev, lowerBound, upperBound },
          outlierCount: outliers.length,
          totalRows: total,
          outliers,
        };
      } else {
        // IQR method
        const multiplier = input.threshold ?? 1.5;

        // Get sorted values for percentile calculation
        const allResult = await adapter.executeReadQuery(
          `SELECT "${input.column}" as value FROM "${input.table}" 
           WHERE "${input.column}" IS NOT NULL${whereClause}
           ORDER BY "${input.column}"`,
        );

        const values = (allResult.rows ?? []).map((r) => Number(r["value"]));
        const n = values.length;

        if (n === 0) {
          return {
            success: true,
            method: "iqr",
            stats: { q1: 0, q3: 0, iqr: 0, lowerBound: 0, upperBound: 0 },
            outlierCount: 0,
            totalRows: 0,
            outliers: [],
          };
        }

        const q1Idx = Math.floor(n * 0.25);
        const q3Idx = Math.floor(n * 0.75);
        const q1 = values[q1Idx] ?? 0;
        const q3 = values[q3Idx] ?? 0;
        const iqr = q3 - q1;

        const lowerBound = q1 - multiplier * iqr;
        const upperBound = q3 + multiplier * iqr;

        // Find outliers
        const outlierResult = await adapter.executeReadQuery(
          `SELECT rowid, "${input.column}" as value FROM "${input.table}" 
           WHERE "${input.column}" IS NOT NULL${whereClause}
             AND ("${input.column}" < ${lowerBound} OR "${input.column}" > ${upperBound})
           LIMIT ${input.limit}`,
        );

        const outliers = (outlierResult.rows ?? []).map((row) => {
          const rowid = row["rowid"];
          return {
            value: Number(row["value"]),
            ...(typeof rowid === "number" ? { rowid } : {}),
          };
        });

        return {
          success: true,
          method: "iqr",
          stats: { q1, q3, iqr, lowerBound, upperBound },
          outlierCount: outliers.length,
          totalRows: n,
          outliers,
        };
      }
    },
  };
}

/**
 * Linear/polynomial regression analysis
 */
function createRegressionTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_regression",
    description:
      "Perform linear or polynomial regression analysis between two columns.",
    group: "stats",
    inputSchema: RegressionSchema,
    outputSchema: z.object({
      success: z.boolean(),
      type: z.string(),
      sampleSize: z.number(),
      coefficients: z.object({
        slope: z.number(),
        intercept: z.number(),
      }),
      rSquared: z.number(),
      correlation: z.number(),
      equation: z.string(),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Regression Analysis"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = RegressionSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.xColumn)) {
        throw new Error("Invalid X column name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.yColumn)) {
        throw new Error("Invalid Y column name");
      }

      const andClause = input.whereClause ? ` AND ${input.whereClause}` : "";

      // For now, only implement linear regression (degree=1)
      // Get regression statistics using SQL
      const sql = `
        SELECT 
          COUNT(*) as n,
          AVG("${input.xColumn}") as mean_x,
          AVG("${input.yColumn}") as mean_y,
          SUM(("${input.xColumn}" - (SELECT AVG("${input.xColumn}") FROM "${input.table}" WHERE "${input.xColumn}" IS NOT NULL AND "${input.yColumn}" IS NOT NULL${andClause})) * 
              ("${input.yColumn}" - (SELECT AVG("${input.yColumn}") FROM "${input.table}" WHERE "${input.xColumn}" IS NOT NULL AND "${input.yColumn}" IS NOT NULL${andClause}))) as sum_xy,
          SUM(("${input.xColumn}" - (SELECT AVG("${input.xColumn}") FROM "${input.table}" WHERE "${input.xColumn}" IS NOT NULL AND "${input.yColumn}" IS NOT NULL${andClause})) * 
              ("${input.xColumn}" - (SELECT AVG("${input.xColumn}") FROM "${input.table}" WHERE "${input.xColumn}" IS NOT NULL AND "${input.yColumn}" IS NOT NULL${andClause}))) as sum_xx,
          SUM(("${input.yColumn}" - (SELECT AVG("${input.yColumn}") FROM "${input.table}" WHERE "${input.xColumn}" IS NOT NULL AND "${input.yColumn}" IS NOT NULL${andClause})) * 
              ("${input.yColumn}" - (SELECT AVG("${input.yColumn}") FROM "${input.table}" WHERE "${input.xColumn}" IS NOT NULL AND "${input.yColumn}" IS NOT NULL${andClause}))) as sum_yy
        FROM "${input.table}"
        WHERE "${input.xColumn}" IS NOT NULL AND "${input.yColumn}" IS NOT NULL${andClause}
      `;

      const result = await adapter.executeReadQuery(sql);
      const row = result.rows?.[0];

      const n = Number(row?.["n"] ?? 0);
      const meanX = Number(row?.["mean_x"] ?? 0);
      const meanY = Number(row?.["mean_y"] ?? 0);
      const sumXY = Number(row?.["sum_xy"] ?? 0);
      const sumXX = Number(row?.["sum_xx"] ?? 0);
      const sumYY = Number(row?.["sum_yy"] ?? 0);

      if (n < 2 || sumXX === 0) {
        throw new Error("Insufficient data for regression analysis");
      }

      const slope = sumXY / sumXX;
      const intercept = meanY - slope * meanX;
      const correlation = sumXY / Math.sqrt(sumXX * sumYY);
      const rSquared = correlation * correlation;

      const interceptSign = intercept >= 0 ? "+" : "-";
      const equation = `y = ${slope.toFixed(4)}x ${interceptSign} ${Math.abs(intercept).toFixed(4)}`;

      return {
        success: true,
        type: input.degree === 1 ? "linear" : `polynomial_${input.degree}`,
        sampleSize: n,
        coefficients: { slope, intercept },
        rSquared,
        correlation,
        equation,
      };
    },
  };
}

/**
 * Hypothesis testing (t-test, chi-square)
 */
function createHypothesisTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_hypothesis",
    description:
      "Perform statistical hypothesis tests: one-sample t-test, two-sample t-test, or chi-square test.",
    group: "stats",
    inputSchema: HypothesisSchema,
    outputSchema: z.object({
      success: z.boolean(),
      testType: z.string(),
      statistic: z.number(),
      pValue: z.number(),
      degreesOfFreedom: z.number(),
      significant: z.boolean(),
      details: z.record(z.string(), z.unknown()),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Hypothesis Testing"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = HypothesisSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
        throw new Error("Invalid column name");
      }

      const whereClause = input.whereClause ? ` AND ${input.whereClause}` : "";

      if (input.testType === "ttest_one") {
        const expectedMean = input.expectedMean ?? 0;

        const statsResult = await adapter.executeReadQuery(
          `SELECT COUNT(*) as n, AVG("${input.column}") as mean,
                  SUM(("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause})) * 
                      ("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}))) / 
                  (COUNT(*) - 1) as variance
           FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}`,
        );

        const n = Number(statsResult.rows?.[0]?.["n"] ?? 0);
        const mean = Number(statsResult.rows?.[0]?.["mean"] ?? 0);
        const variance = Number(statsResult.rows?.[0]?.["variance"] ?? 0);
        const stdDev = Math.sqrt(variance);
        const df = n - 1;

        if (n < 2) {
          throw new Error("Insufficient sample size for t-test");
        }

        const tStatistic = (mean - expectedMean) / (stdDev / Math.sqrt(n));
        const pValue = tDistPValue(tStatistic, df);

        return {
          success: true,
          testType: "ttest_one",
          statistic: tStatistic,
          pValue,
          degreesOfFreedom: df,
          significant: pValue < 0.05,
          details: {
            sampleMean: mean,
            sampleStdDev: stdDev,
            sampleSize: n,
            expectedMean,
          },
        };
      } else if (input.testType === "ttest_two") {
        if (!input.column2) {
          throw new Error("column2 is required for two-sample t-test");
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column2)) {
          throw new Error("Invalid column2 name");
        }

        // Get stats for both columns
        const statsResult = await adapter.executeReadQuery(
          `SELECT 
             COUNT("${input.column}") as n1, AVG("${input.column}") as mean1,
             SUM(("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause})) * 
                 ("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}))) / 
             (COUNT("${input.column}") - 1) as var1,
             COUNT("${input.column2}") as n2, AVG("${input.column2}") as mean2,
             SUM(("${input.column2}" - (SELECT AVG("${input.column2}") FROM "${input.table}" WHERE "${input.column2}" IS NOT NULL${whereClause})) * 
                 ("${input.column2}" - (SELECT AVG("${input.column2}") FROM "${input.table}" WHERE "${input.column2}" IS NOT NULL${whereClause}))) / 
             (COUNT("${input.column2}") - 1) as var2
           FROM "${input.table}" WHERE 1=1${whereClause}`,
        );

        const n1 = Number(statsResult.rows?.[0]?.["n1"] ?? 0);
        const n2 = Number(statsResult.rows?.[0]?.["n2"] ?? 0);
        const mean1 = Number(statsResult.rows?.[0]?.["mean1"] ?? 0);
        const mean2 = Number(statsResult.rows?.[0]?.["mean2"] ?? 0);
        const var1 = Number(statsResult.rows?.[0]?.["var1"] ?? 0);
        const var2 = Number(statsResult.rows?.[0]?.["var2"] ?? 0);

        if (n1 < 2 || n2 < 2) {
          throw new Error("Insufficient sample size for t-test");
        }

        // Welch's t-test
        const tStatistic = (mean1 - mean2) / Math.sqrt(var1 / n1 + var2 / n2);
        const dfNum = Math.pow(var1 / n1 + var2 / n2, 2);
        const dfDen =
          Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
        const df = dfNum / dfDen;
        const pValue = tDistPValue(tStatistic, df);

        return {
          success: true,
          testType: "ttest_two",
          statistic: tStatistic,
          pValue,
          degreesOfFreedom: df,
          significant: pValue < 0.05,
          details: {
            group1: { mean: mean1, variance: var1, n: n1 },
            group2: { mean: mean2, variance: var2, n: n2 },
          },
        };
      } else {
        // Chi-square test
        if (!input.groupColumn) {
          throw new Error("groupColumn is required for chi-square test");
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.groupColumn)) {
          throw new Error("Invalid groupColumn name");
        }

        // Get contingency table
        const freqResult = await adapter.executeReadQuery(
          `SELECT "${input.column}" as col1, "${input.groupColumn}" as col2, COUNT(*) as observed
           FROM "${input.table}" 
           WHERE "${input.column}" IS NOT NULL AND "${input.groupColumn}" IS NOT NULL${whereClause}
           GROUP BY "${input.column}", "${input.groupColumn}"`,
        );

        // Calculate totals
        const rowTotals = new Map<string, number>();
        const colTotals = new Map<string, number>();
        let grandTotal = 0;

        for (const row of freqResult.rows ?? []) {
          const col1 = String(row["col1"]);
          const col2 = String(row["col2"]);
          const observed = Number(row["observed"]);

          rowTotals.set(col1, (rowTotals.get(col1) ?? 0) + observed);
          colTotals.set(col2, (colTotals.get(col2) ?? 0) + observed);
          grandTotal += observed;
        }

        // Calculate chi-square statistic
        let chiSquare = 0;
        for (const row of freqResult.rows ?? []) {
          const col1 = String(row["col1"]);
          const col2 = String(row["col2"]);
          const observed = Number(row["observed"]);
          const expected =
            ((rowTotals.get(col1) ?? 0) * (colTotals.get(col2) ?? 0)) /
            grandTotal;
          if (expected > 0) {
            chiSquare += Math.pow(observed - expected, 2) / expected;
          }
        }

        const df = (rowTotals.size - 1) * (colTotals.size - 1);
        // Approximate p-value using chi-square distribution
        const pValue = df > 0 ? Math.exp(-chiSquare / 2) : 1;

        return {
          success: true,
          testType: "chi_square",
          statistic: chiSquare,
          pValue,
          degreesOfFreedom: df,
          significant: pValue < 0.05,
          details: {
            grandTotal,
            rowCategories: rowTotals.size,
            colCategories: colTotals.size,
          },
        };
      }
    },
  };
}
