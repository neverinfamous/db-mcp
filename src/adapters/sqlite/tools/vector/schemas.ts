/**
 * Vector Search Zod Schemas
 *
 * Input validation schemas for all vector tool parameters.
 *
 * ## Split Schema Pattern
 *
 * The SDK applies `.partial()` on schemas, making keys optional but NOT
 * changing type constraints. For required array fields, `z.preprocess()`
 * coerces non-array inputs to an empty array `[]` (which passes `.partial()`
 * validation). The handler then rejects empty required arrays explicitly.
 *
 * Scalar numeric fields use coerceNumber + `.optional().default()`.
 */

import { z } from "zod";

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
 * Coerce non-array values to empty array so SDK's `.partial()` validation
 * passes. Also coerces arrays with non-numeric elements to empty array.
 * Handler-level checks reject empty required arrays with structured errors.
 */
const coerceNumberArray = (val: unknown): unknown =>
  Array.isArray(val)
    ? val.every((v) => typeof v === "number")
      ? val
      : []
    : Array.isArray(val)
      ? val
      : [];

/**
 * Coerce non-array values to empty array so SDK validation passes.
 */
const coerceArray = (val: unknown): unknown =>
  Array.isArray(val) ? val : [];




export const VectorStoreSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  vectorColumn: z.string().describe("Vector column name"),
  id: z.union([z.string(), z.number()]).describe("Row identifier"),
  vector: z.preprocess(
    coerceNumberArray,
    z.array(z.number()).describe("Vector data as array of numbers"),
  ),
});

export const VectorSearchSchema = z.object({
  table: z.string().describe("Table name"),
  vectorColumn: z.string().describe("Vector column name"),
  queryVector: z.preprocess(
    coerceNumberArray,
    z.array(z.number()).describe("Query vector"),
  ),
  metric: z.string().optional().default("cosine").describe("Distance metric"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(10).describe("Max results"),
  ),
  whereClause: z.string().optional().describe("Optional WHERE filter"),
  returnColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to return (default: all)"),
});

export const VectorCreateTableSchema = z.object({
  tableName: z.string().describe("Name of the vector table"),
  dimensions: z.number().describe("Number of dimensions for vectors"),
  additionalColumns: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
      }),
    )
    .optional()
    .default([])
    .describe("Additional columns"),
});

export const VectorNormalizeSchema = z.object({
  vector: z.preprocess(
    coerceNumberArray,
    z.array(z.number()).describe("Vector to normalize"),
  ),
});

export const VectorDistanceSchema = z.object({
  vector1: z.preprocess(
    coerceNumberArray,
    z.array(z.number()).describe("First vector"),
  ),
  vector2: z.preprocess(
    coerceNumberArray,
    z.array(z.number()).describe("Second vector"),
  ),
  metric: z.string().optional().default("cosine"),
});

export const VectorBatchStoreSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  vectorColumn: z.string().describe("Vector column name"),
  items: z.preprocess(
    coerceArray,
    z.array(
      z.object({
        id: z.union([z.string(), z.number()]),
        vector: z.preprocess(
          coerceNumberArray,
          z.array(z.number()),
        ),
      }),
    ),
  ),
});

export const VectorDeleteSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  ids: z.preprocess(
    coerceArray,
    z.array(z.union([z.string(), z.number()])).describe("IDs to delete"),
  ),
});

export const VectorGetSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  vectorColumn: z.string().describe("Vector column name"),
  id: z.union([z.string(), z.number()]).describe("Row identifier"),
});

export const VectorCountSchema = z.object({
  table: z.string().describe("Table name"),
  dimensions: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Filter by dimension count"),
  ),
});

export const VectorStatsSchema = z.object({
  table: z.string().describe("Table name"),
  vectorColumn: z.string().describe("Vector column name"),
  sampleSize: z.preprocess(
    coerceNumber,
    z.number().optional().default(100),
  ),
});

export const VectorDimensionsSchema = z.object({
  table: z.string().describe("Table name"),
  vectorColumn: z.string().describe("Vector column name"),
});
