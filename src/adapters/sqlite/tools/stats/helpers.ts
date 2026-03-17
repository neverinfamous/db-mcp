/**
 * Stats Helper Utilities
 *
 * Shared validation functions, types, and constants for statistics tools.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../../sqlite-adapter.js";

/**
 * Coerce string-typed numbers to actual numbers.
 * Returns undefined for non-numeric strings so the schema default kicks in.
 */
const coerceNumber = (val: unknown): unknown =>
  typeof val === "string"
    ? isNaN(Number(val))
      ? undefined
      : Number(val)
    : val;

/**
 * Create a coercer for optional enum params with defaults.
 * Returns `undefined` for any value NOT in the allowed set
 * (including empty strings), so `.optional().default()` kicks in.
 * Prevents raw MCP -32602 for invalid enum values.
 */
const coerceEnumValues =
  (allowed: readonly string[]) =>
  (val: unknown): unknown =>
    typeof val === "string" && allowed.includes(val) ? val : undefined;

/**
 * Valid enum values for handler-side validation.
 * Required enums use z.string() in schema + handler validation against these.
 */
export const VALID_STAT_TYPES = ["sum", "avg", "min", "max", "count"] as const;
export const VALID_TEST_TYPES = ["ttest_one", "ttest_two", "chi_square"] as const;

// Re-export validateColumnExists from shared utility so existing consumers keep working
export { validateColumnExists } from "../column-validation.js";


/**
 * Numeric column types for validation.
 */
export const NUMERIC_TYPES = new Set([
  "integer",
  "int",
  "real",
  "float",
  "double",
  "numeric",
  "decimal",
  "number",
  "smallint",
  "bigint",
  "tinyint",
  "mediumint",
]);

/**
 * Check if a column type string matches a known numeric type.
 */
export function isNumericType(typeStr: string): boolean {
  const lower = typeStr.toLowerCase();
  return [...NUMERIC_TYPES].some((nt) => lower === nt || lower.startsWith(nt));
}

/**
 * Validate that a column is a numeric type.
 * Returns a structured error object if not numeric, or null if validation passes.
 */
export async function validateNumericColumn(
  adapter: SqliteAdapter,
  tableName: string,
  columnName: string,
): Promise<{
  success: false;
  error: string;
  code: string;
  category: string;
  suggestion: string;
  recoverable: false;
} | null> {
  const tableInfo = await adapter.describeTable(tableName);
  const columnMap = new Map(
    (tableInfo.columns ?? []).map((c) => [
      c.name.toLowerCase(),
      (c.type ?? "").toLowerCase(),
    ]),
  );
  const colType = columnMap.get(columnName.toLowerCase()) ?? "";

  if (!isNumericType(colType)) {
    return {
      success: false,
      error: `Column '${columnName}' is not numeric (type: ${colType || "unknown"}). This operation requires a numeric column.`,
      code: "INVALID_INPUT",
      category: "validation",
      suggestion:
        "Use numeric columns (INTEGER, REAL, FLOAT, etc.) for statistical analysis.",
      recoverable: false,
    };
  }

  return null;
}

// =============================================================================
// Input Schemas
// =============================================================================

export const BasicStatsSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column for statistics"),
  whereClause: z.string().optional(),
});

export const CountSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().optional().describe("Column to count (default: *)"),
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
  orderBy: z.preprocess(coerceEnumValues(["value", "group"]), z.enum(["value", "group"]).optional().default("group")),
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
  percentiles: z
    .array(z.number())
    .describe("Percentiles to compute"),
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
  n: z.preprocess(coerceNumber, z.number().optional().default(10).describe("Number of top values")),
  orderDirection: z.preprocess(coerceEnumValues(["asc", "desc"]), z.enum(["asc", "desc"]).optional().default("desc")),
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
  method: z.preprocess(coerceEnumValues(["iqr", "zscore"]), z.enum(["iqr", "zscore"]).optional().default("iqr")),
  threshold: z.preprocess(
    coerceNumber,
    z.number().optional().describe("IQR multiplier (default 1.5) or Z-score threshold (default 3)"),
  ),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
  maxOutliers: z.preprocess(
    coerceNumber,
    z.number().optional().default(50).describe(
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
  testType: z.string().describe("Test type: 'ttest_one', 'ttest_two', or 'chi_square'"),
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
