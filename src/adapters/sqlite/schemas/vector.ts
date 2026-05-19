/**
 * Vector/Semantic Search Tool Output Schemas (11 tools + Legacy)
 */

import { z } from "zod";

const coerceNumberArray = (val: unknown): unknown => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return val;
};
const coerceArray = (val: unknown): unknown => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return val;
};


const coerceNumber = (val: unknown): unknown =>
  typeof val === "string"
    ? isNaN(Number(val))
      ? undefined
      : Number(val)
    : val;
import { ErrorFieldsMixin } from "./error-mixin.js";

// =============================================================================
// Vector/Semantic Search Tool Output Schemas (11 tools)
// =============================================================================

/**
 * sqlite_vector_store output
 */
export const VectorStoreOutputSchema = z
  .object({
    success: z.boolean(),
    id: z.union([z.string(), z.number()]).optional(),
    dimensions: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_batch_store output
 */
export const VectorBatchStoreOutputSchema = z
  .object({
    success: z.boolean(),
    stored: z.number().optional(),
    dimensions: z.number().optional(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_get output
 */
export const VectorGetOutputSchema = z
  .object({
    success: z.boolean(),
    id: z.union([z.string(), z.number()]).optional(),
    dimensions: z.number().optional(),
    vector: z.array(z.number()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Result item with _similarity for vector search
 */
const VectorSearchResultSchema = z
  .object({
    _similarity: z.number(),
  })
  .loose();

/**
 * sqlite_vector_search output
 */
export const VectorSearchOutputSchema = z
  .object({
    success: z.boolean(),
    metric: z.string().optional(),
    count: z.number().optional(),
    rows: z.array(VectorSearchResultSchema).optional(),
    skipped: z.number().optional(),
    warning: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_delete output
 */
export const VectorDeleteOutputSchema = z
  .object({
    success: z.boolean(),
    deleted: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_count output
 */
export const VectorCountOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Magnitude statistics for vector stats
 */
const MagnitudeStatsSchema = z.object({
  min: z.number(),
  max: z.number(),
  avg: z.number(),
});

/**
 * sqlite_vector_stats output
 */
export const VectorStatsOutputSchema = z
  .object({
    success: z.boolean(),
    sampleSize: z.number().optional(),
    dimensions: z.number().optional(),
    magnitudeStats: MagnitudeStatsSchema.optional(),
    count: z.number().optional(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_dimensions output
 */
export const VectorDimensionsOutputSchema = z
  .object({
    success: z.boolean(),
    dimensions: z.number().nullable().optional(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_normalize output
 */
export const VectorNormalizeOutputSchema = z
  .object({
    success: z.boolean(),
    original: z.array(z.number()).optional(),
    normalized: z.array(z.number()).optional(),
    originalMagnitude: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_distance output
 */
export const VectorDistanceOutputSchema = z
  .object({
    success: z.boolean(),
    metric: z.string().optional(),
    distance: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);


// =============================================================================
// Input Schemas
// =============================================================================

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
        vector: z.preprocess(coerceNumberArray, z.array(z.number())),
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
  sampleSize: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const VectorDimensionsSchema = z.object({
  table: z.string().describe("Table name"),
  vectorColumn: z.string().describe("Vector column name"),
});


// =============================================================================
// Types
// =============================================================================

export type VectorStoreInput = z.infer<typeof VectorStoreSchema>;
export type VectorSearchInput = z.infer<typeof VectorSearchSchema>;
export type VectorCreateTableInput = z.infer<typeof VectorCreateTableSchema>;
export type VectorNormalizeInput = z.infer<typeof VectorNormalizeSchema>;
export type VectorDistanceInput = z.infer<typeof VectorDistanceSchema>;
export type VectorBatchStoreInput = z.infer<typeof VectorBatchStoreSchema>;
export type VectorDeleteInput = z.infer<typeof VectorDeleteSchema>;
export type VectorGetInput = z.infer<typeof VectorGetSchema>;
export type VectorCountInput = z.infer<typeof VectorCountSchema>;
export type VectorStatsInput = z.infer<typeof VectorStatsSchema>;
export type VectorDimensionsInput = z.infer<typeof VectorDimensionsSchema>;
