import { z } from "zod";
import { WhereConditionSchema } from "../../../sqlite/schemas/where.js";
import { coerceNumber, coerceEnumValues } from "./helpers.js";

// Schemas
export const RowNumberSchema = z.object({
  table: z.string().describe("Table name"),
  orderBy: z.string().describe("Column(s) to order by"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE clause conditions"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

export const RankSchema = z.object({
  table: z.string().describe("Table name"),
  orderBy: z.string().describe("Column(s) to order by (determines rank)"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  rankType: z.preprocess(
    coerceEnumValues(["rank", "dense_rank", "percent_rank"]),
    z
      .enum(["rank", "dense_rank", "percent_rank"])
      .optional()
      .default("rank")
      .describe("Rank function type"),
  ),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE clause conditions"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

export const LagLeadSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to get lag/lead value from"),
  orderBy: z.string().describe("Column(s) to order by"),
  direction: z.string().describe("LAG (previous) or LEAD (next) row"),
  offset: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(1)
      .describe("Number of rows to look back/ahead"),
  ),
  defaultValue: z
    .string()
    .optional()
    .describe("Default value if no row exists"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE clause conditions"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

export const RunningTotalSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to sum"),
  orderBy: z.string().describe("Column(s) to order by"),
  partitionBy: z
    .string()
    .optional()
    .describe("Reset running total for each partition"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE clause conditions"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

export const MovingAverageSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to average"),
  orderBy: z.string().describe("Column(s) to order by"),
  windowSize: z.preprocess(
    coerceNumber,
    z.number().describe("Number of rows in the moving window"),
  ),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE clause conditions"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

export const NtileSchema = z.object({
  table: z.string().describe("Table name"),
  orderBy: z.string().describe("Column(s) to order by"),
  buckets: z.preprocess(
    coerceNumber,
    z.number().describe("Number of buckets (e.g., 4 for quartiles)"),
  ),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE clause conditions"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

