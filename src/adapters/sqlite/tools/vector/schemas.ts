/**
 * Vector Search Zod Schemas
 *
 * Input validation schemas for all vector tool parameters.
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

const VALID_METRICS = ["cosine", "euclidean", "dot"] as const;

/**
 * Coerce invalid metric values to undefined so the schema default kicks in.
 * Prevents raw MCP -32602 errors from enum validation.
 */
const coerceMetric = (val: unknown): unknown =>
  typeof val === "string" &&
  (VALID_METRICS as readonly string[]).includes(val)
    ? val
    : typeof val === "string"
      ? undefined
      : val;

export const VectorStoreSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  vectorColumn: z.string().describe("Vector column name"),
  id: z.union([z.string(), z.number()]).describe("Row identifier"),
  vector: z.array(z.number()).describe("Vector data as array of numbers"),
});

export const VectorSearchSchema = z.object({
  table: z.string().describe("Table name"),
  vectorColumn: z.string().describe("Vector column name"),
  queryVector: z.array(z.number()).describe("Query vector"),
  metric: z.preprocess(
    coerceMetric,
    z
      .enum(["cosine", "euclidean", "dot"])
      .optional()
      .default("cosine")
      .describe("Distance metric"),
  ),
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
  vector: z.array(z.number()).describe("Vector to normalize"),
});

export const VectorDistanceSchema = z.object({
  vector1: z.array(z.number()).describe("First vector"),
  vector2: z.array(z.number()).describe("Second vector"),
  metric: z.preprocess(
    coerceMetric,
    z.enum(["cosine", "euclidean", "dot"]).optional().default("cosine"),
  ),
});

export const VectorBatchStoreSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  vectorColumn: z.string().describe("Vector column name"),
  items: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      vector: z.array(z.number()),
    }),
  ),
});

export const VectorDeleteSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  ids: z.array(z.union([z.string(), z.number()])).describe("IDs to delete"),
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
