/**
 * JSON Operations Helpers
 *
 * Shared schemas and types for JSON operation tools.
 */

/**
 * SQLite JSON Operation Tools
 *
 * Low-level JSON functions wrapping SQLite's JSON1 extension:
 * validate, extract, set, remove, type, array/object operations, etc.
 * 12 tools total.
 */

import { z } from "zod";

// Additional schemas for JSON operations
export const JsonTypeSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("JSON path (defaults to $)"),
  whereClause: z.string().optional(),
});

export const JsonArrayLengthSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Path to array (defaults to $)"),
  whereClause: z.string().optional(),
});

export const JsonArrayAppendSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("Path to array"),
  value: z.unknown().describe("Value to append"),
  whereClause: z.string().describe("WHERE clause"),
});

export const JsonKeysSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Path to object (defaults to $)"),
  whereClause: z.string().optional(),
});

export const JsonEachSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Path to expand (defaults to $)"),
  whereClause: z.string().optional(),
  limit: z.coerce.number().optional().default(100),
});

export const JsonGroupArraySchema = z.object({
  table: z.string().describe("Table name"),
  valueColumn: z
    .string()
    .describe(
      "Column to aggregate (or SQL expression if allowExpressions is true)",
    ),
  groupByColumn: z
    .string()
    .optional()
    .describe(
      "Column to group by. For JSON collection tables, use allowExpressions with json_extract(data, '$.field') instead.",
    ),
  whereClause: z.string().optional(),
  allowExpressions: z
    .boolean()
    .optional()
    .describe(
      "Allow SQL expressions like json_extract() instead of plain column names",
    ),
});

export const JsonGroupObjectSchema = z.object({
  table: z.string().describe("Table name"),
  keyColumn: z
    .string()
    .describe(
      "Column for object keys (or SQL expression if allowExpressions is true)",
    ),
  valueColumn: z
    .string()
    .optional()
    .describe(
      "Column for object values (or SQL expression if allowExpressions is true). For aggregates like COUNT(*), use aggregateFunction instead.",
    ),
  groupByColumn: z
    .string()
    .optional()
    .describe(
      "Column to group by. For JSON collection tables, use allowExpressions with json_extract(data, '$.field') instead.",
    ),
  whereClause: z.string().optional(),
  allowExpressions: z
    .boolean()
    .optional()
    .describe(
      "Allow SQL expressions like json_extract() instead of plain column names. NOTE: Does NOT support aggregate functions - use aggregateFunction parameter instead.",
    ),
  aggregateFunction: z
    .string()
    .optional()
    .describe(
      "Aggregate function to use for values (e.g., 'COUNT(*)', 'SUM(amount)', 'AVG(price)'). When provided, builds object from pre-aggregated subquery results.",
    ),
});

export const JsonPrettySchema = z.object({
  json: z.string().describe("JSON string to pretty print"),
});

// Additional schemas defined in the transform section
export const JsonbConvertSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to convert"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
});

// Schema for storage info tool
export const JsonStorageInfoSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to analyze"),
  sampleSize: z.coerce
    .number()
    .optional()
    .default(100)
    .describe("Number of rows to sample"),
});

// Schema for normalize column tool
export const JsonNormalizeColumnSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to normalize"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
  outputFormat: z
    .enum(["text", "jsonb", "preserve"])
    .optional()
    .default("preserve")
    .describe(
      "Output format: 'preserve' original format (default), 'text', or 'jsonb'",
    ),
});