/**
 * Statistical Analysis Tool Output Schemas (14 stats tools)
 */

import { z } from "zod";
import { ErrorFieldsMixin } from "./error-mixin.js";

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
