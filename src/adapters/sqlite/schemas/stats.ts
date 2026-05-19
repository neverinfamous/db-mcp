/**
 * Statistical Analysis Tool Output Schemas (14 stats tools)
 */

import { z } from "zod";

import { ErrorFieldsMixin } from "./error-mixin.js";

const coerceNumber = (val: unknown): unknown => {
  if (typeof val === "string") {
    const num = Number(val);
    return isNaN(num) ? val : num;
  }
  return val;
};

const coerceEnumValues =
  (allowed: readonly string[]) =>
  (val: unknown): unknown =>
    typeof val === "string" && allowed.includes(val) ? val : undefined;

/**
 * Generic row record for stats query results
 */
const StatsRowRecordSchema = z.record(z.string(), z.unknown());

/**
 * sqlite_stats_basic output
 */
export const StatsBasicOutputSchema = z
  .object({
    success: z.boolean(),
    column: z.string().optional(),
    stats: z
      .object({
        count: z.number(),
        sum: z.number().nullable(),
        avg: z.number().nullable(),
        min: z.number().nullable(),
        max: z.number().nullable(),
        range: z.number().nullable(),
      })
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_count output
 */
export const StatsCountOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number().optional(),
    distinct: z.boolean().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_group_by output
 */
export const StatsGroupByOutputSchema = z
  .object({
    success: z.boolean(),
    statistic: z.string().optional(),
    rowCount: z.number().optional(),
    results: z.array(StatsRowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_top_n output
 */
export const StatsTopNOutputSchema = z
  .object({
    success: z.boolean(),
    column: z.string().optional(),
    direction: z.string().optional(),
    count: z.number().optional(),
    rows: z.array(StatsRowRecordSchema).optional(),
    hint: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_distinct output
 */
export const StatsDistinctOutputSchema = z
  .object({
    success: z.boolean(),
    column: z.string().optional(),
    distinctCount: z.number().optional(),
    values: z.array(z.unknown()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_summary output
 */
export const StatsSummaryOutputSchema = z
  .object({
    success: z.boolean(),
    table: z.string().optional(),
    summaries: z
      .array(
        z.object({
          column: z.string(),
          count: z.number().optional(),
          avg: z.number().nullable().optional(),
          min: z.number().nullable().optional(),
          max: z.number().nullable().optional(),
          error: z.string().optional(),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_frequency output
 */
export const StatsFrequencyOutputSchema = z
  .object({
    success: z.boolean(),
    column: z.string().optional(),
    distinctValues: z.number().optional(),
    distribution: z
      .array(
        z.object({
          value: z.unknown(),
          frequency: z.number(),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_percentile output (array version for multiple percentiles)
 */
export const StatsPercentileOutputSchema = z
  .object({
    success: z.boolean(),
    column: z.string().optional(),
    count: z.number().optional(),
    percentiles: z
      .array(
        z.object({
          percentile: z.number(),
          value: z.number().nullable(),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_histogram output
 */
export const StatsHistogramOutputSchema = z
  .object({
    success: z.boolean(),
    column: z.string().optional(),
    range: z
      .object({
        min: z.number(),
        max: z.number(),
      })
      .optional(),
    bucketSize: z.number().optional(),
    buckets: z
      .array(
        z.object({
          bucket: z.number().optional(),
          min: z.number(),
          max: z.number(),
          count: z.number(),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_correlation output
 */
export const StatsCorrelationOutputSchema = z
  .object({
    success: z.boolean(),
    column1: z.string().optional(),
    column2: z.string().optional(),
    n: z.number().optional(),
    correlation: z.number().nullable().optional(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_regression output
 */
export const StatsRegressionOutputSchema = z
  .object({
    success: z.boolean(),
    type: z.string().optional(),
    sampleSize: z.number().optional(),
    coefficients: z
      .object({
        intercept: z.number(),
        linear: z.number().optional(),
        quadratic: z.number().optional(),
        cubic: z.number().optional(),
      })
      .optional(),
    rSquared: z.number().optional(),
    equation: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_outliers output
 */
export const StatsOutliersOutputSchema = z
  .object({
    success: z.boolean(),
    method: z.string().optional(),
    stats: z
      .object({
        mean: z.number().optional(),
        stdDev: z.number().optional(),
        q1: z.number().optional(),
        q3: z.number().optional(),
        iqr: z.number().optional(),
        lowerBound: z.number(),
        upperBound: z.number(),
      })
      .optional(),
    outlierCount: z.number().optional(),
    totalRows: z.number().optional(),
    outliers: z
      .array(
        z.object({
          value: z.number(),
          rowid: z.number().optional(),
        }),
      )
      .optional(),
    truncated: z.boolean().optional(),
    totalOutliers: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_hypothesis output
 */
export const StatsHypothesisOutputSchema = z
  .object({
    success: z.boolean(),
    testType: z.string().optional(),
    statistic: z.number().optional(),
    pValue: z.number().optional(),
    degreesOfFreedom: z.number().optional(),
    significant: z.boolean().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Anomaly Detection Output Schemas
// =============================================================================

/**
 * sqlite_stats_detect_anomalies output
 */
export const StatsDetectAnomaliesOutputSchema = z
  .object({
    success: z.boolean(),
    anomalies: z
      .array(
        z.object({
          column: z.string(),
          mean: z.number(),
          stddev: z.number(),
          anomalyCount: z.number(),
          totalRows: z.number(),
          topDeviations: z.array(
            z.object({
              rowid: z.number(),
              value: z.number(),
              zScore: z.number(),
            }),
          ),
        }),
      )
      .optional(),
    riskLevel: z.enum(["low", "moderate", "high", "critical"]).optional(),
    totalColumnsAnalyzed: z.number().optional(),
    totalAnomalies: z.number().optional(),
    summary: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_detect_bloat output
 */
export const StatsDetectBloatOutputSchema = z
  .object({
    success: z.boolean(),
    database: z
      .object({
        totalSizeBytes: z.number(),
        pageSize: z.number(),
        totalPages: z.number(),
        freePages: z.number(),
        fragmentationPct: z.number(),
        journalMode: z.string(),
        autoVacuum: z.string(),
      })
      .optional(),
    tables: z
      .array(
        z.object({
          name: z.string(),
          sizeBytes: z.number(),
          pageCount: z.number(),
          rowCount: z.number(),
          pctOfTotal: z.number(),
          riskScore: z.number(),
          riskLevel: z.enum(["low", "moderate", "high", "critical"]),
          factors: z.object({
            fragmentation: z.number(),
            tableSizeImpact: z.number(),
            autoVacuumStatus: z.number(),
            journalMode: z.number(),
          }),
          recommendations: z.array(z.string()),
        }),
      )
      .optional(),
    highRiskCount: z.number().optional(),
    totalAnalyzed: z.number().optional(),
    summary: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_stats_detect_schema_risks output
 */
export const StatsDetectSchemaRisksOutputSchema = z
  .object({
    success: z.boolean(),
    tables: z
      .array(
        z.object({
          name: z.string(),
          rowCount: z.number(),
          columnCount: z.number(),
          indexCount: z.number(),
          hasPrimaryKey: z.boolean(),
          foreignKeyCount: z.number(),
          unindexedForeignKeys: z.array(z.string()),
          riskScore: z.number(),
          riskLevel: z.enum(["low", "moderate", "high", "critical"]),
          factors: z.object({
            missingFkIndexes: z.number(),
            wideTable: z.number(),
            noPrimaryKey: z.number(),
            largeUnindexed: z.number(),
          }),
          recommendations: z.array(z.string()),
        }),
      )
      .optional(),
    highRiskCount: z.number().optional(),
    totalAnalyzed: z.number().optional(),
    summary: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);


// =============================================================================
// Input Schemas
// =============================================================================

export const BasicStatsSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table name"),
  column: z.string().describe("Numeric column for statistics"),
  columnName: z.string().optional().describe("Alias for column name"),
  whereClause: z.string().optional(),
});

export const StatsCountSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table name"),
  column: z.string().optional().describe("Column to count (default: *)"),
  columnName: z.string().optional().describe("Alias for column name"),
  distinct: z.boolean().optional().default(false),
  whereClause: z.string().optional(),
});

export const GroupByStatsSchema = z.object({
  table: z.string().describe("Table name"),
  valueColumn: z.string().describe("Column for statistical value"),
  groupByColumn: z.string().describe("Column to group by"),
  stat: z
    .string()
    .describe("Statistic type: 'sum', 'avg', 'min', 'max', or 'count'"),
  whereClause: z.string().optional(),
  orderBy: z.preprocess(
    coerceEnumValues(["value", "group"]),
    z.enum(["value", "group"]).optional().default("group"),
  ),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const HistogramSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column"),
  buckets: z.preprocess(
    coerceNumber,
    z.number().optional().default(10).describe("Number of buckets"),
  ),
  whereClause: z.string().optional(),
});

export const PercentileSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column"),
  percentiles: z.array(z.number()).describe("Percentiles to compute"),
  whereClause: z.string().optional(),
});

export const CorrelationSchema = z.object({
  table: z.string().describe("Table name"),
  column1: z.string().describe("First numeric column"),
  column2: z.string().describe("Second numeric column"),
  whereClause: z.string().optional(),
});

export const TopNSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to rank"),
  n: z.preprocess(
    coerceNumber,
    z.number().optional().default(10).describe("Number of top values"),
  ),
  orderDirection: z.preprocess(
    coerceEnumValues(["asc", "desc"]),
    z.enum(["asc", "desc"]).optional().default("desc"),
  ),
  whereClause: z.string().optional(),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result (default: all columns)"),
});

export const DistinctValuesSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to get distinct values"),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
  whereClause: z.string().optional(),
});

export const SummaryStatsSchema = z.object({
  table: z.string().describe("Table name"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Columns to summarize (default: all numeric)"),
  whereClause: z.string().optional(),
});

export const FrequencySchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to count frequency"),
  limit: z.preprocess(coerceNumber, z.number().optional().default(20)),
  whereClause: z.string().optional(),
});

export const OutlierSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column to analyze"),
  method: z.preprocess(
    coerceEnumValues(["iqr", "zscore"]),
    z.enum(["iqr", "zscore"]).optional().default("iqr"),
  ),
  threshold: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .describe(
        "IQR multiplier (default 1.5) or Z-score threshold (default 3)",
      ),
  ),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
  maxOutliers: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(50)
      .describe(
        "Maximum number of outliers to return (default 50). Reduces payload size for large datasets.",
      ),
  ),
});

export const RegressionSchema = z.object({
  table: z.string().describe("Table name"),
  xColumn: z.string().describe("Independent variable column"),
  yColumn: z.string().describe("Dependent variable column"),
  degree: z.preprocess(
    coerceNumber,
    z.number().optional().default(1).describe("Polynomial degree (1=linear)"),
  ),
  whereClause: z.string().optional(),
});

export const HypothesisSchema = z.object({
  table: z.string().describe("Table name"),
  testType: z
    .string()
    .describe("Test type: 'ttest_one', 'ttest_two', or 'chi_square'"),
  column: z.string().describe("Primary column for analysis"),
  column2: z
    .string()
    .optional()
    .describe("Second column for two-sample t-test"),
  groupColumn: z.string().optional().describe("Group column for chi-square"),
  expectedMean: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Expected mean for one-sample t-test"),
  ),
  whereClause: z.string().optional(),
});


// =============================================================================
// Types
// =============================================================================

export type BasicStatsInput = z.infer<typeof BasicStatsSchema>;
export type StatsCountInput = z.infer<typeof StatsCountSchema>;
export type GroupByStatsInput = z.infer<typeof GroupByStatsSchema>;
export type HistogramInput = z.infer<typeof HistogramSchema>;
export type PercentileInput = z.infer<typeof PercentileSchema>;
export type CorrelationInput = z.infer<typeof CorrelationSchema>;
export type TopNInput = z.infer<typeof TopNSchema>;
export type DistinctValuesInput = z.infer<typeof DistinctValuesSchema>;
export type SummaryStatsInput = z.infer<typeof SummaryStatsSchema>;
export type FrequencyInput = z.infer<typeof FrequencySchema>;
export type OutlierInput = z.infer<typeof OutlierSchema>;
export type RegressionInput = z.infer<typeof RegressionSchema>;
export type HypothesisInput = z.infer<typeof HypothesisSchema>;


// // const coerceNumber = (val: unknown): unknown =>
//   typeof val === "string"
//     ? isNaN(Number(val))
//       ? undefined
//       : Number(val)
//     : val;

export const DetectSchemaRisksSchema = z
  .object({
    limit: z.preprocess(
      coerceNumber,
      z
        .number()
        .optional()
        .default(50)
        .describe("Maximum tables to analyze (default: 50)"),
    ),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe("Exclude SpatiaLite system tables (default: true)"),
    includeZeroRisk: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include tables with 0 risk score (default: false)"),
  })
  .default(() => ({ limit: 50, includeZeroRisk: false }));
export type DetectSchemaRisksInput = z.infer<typeof DetectSchemaRisksSchema>;

export const DetectAnomaliesSchema = z.object({
  table: z.string().describe("Table name to analyze"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Numeric columns to analyze (default: all numeric columns)"),
  threshold: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(2.0)
      .describe("Z-score threshold for flagging anomalies (default: 2.0)"),
  ),
  limit: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(50)
      .describe("Maximum anomalies to return per column (default: 50)"),
  ),
  whereClause: z.string().optional().describe("Optional WHERE clause filter"),
});
export type DetectAnomaliesInput = z.infer<typeof DetectAnomaliesSchema>;

export const DetectBloatSchema = z
  .object({
    limit: z.preprocess(
      coerceNumber,
      z
        .number()
        .optional()
        .default(25)
        .describe("Maximum tables to analyze (default: 25)"),
    ),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe("Exclude SpatiaLite system tables (default: true)"),
    includeZeroRisk: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include tables with 0 risk score (default: false)"),
  })
  .default(() => ({ limit: 25, includeZeroRisk: false }));
export type DetectBloatInput = z.infer<typeof DetectBloatSchema>;
