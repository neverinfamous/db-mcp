/**
 * Vector/Semantic Search Tool Output Schemas (11 tools + Legacy)
 */

import { z } from "zod";
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
    results: z.array(VectorSearchResultSchema).optional(),
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
    value: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Legacy Vector Schemas (kept for compatibility)
// =============================================================================

/**
 * sqlite_vector_create output (legacy)
 */
export const VectorCreateOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    tableName: z.string(),
    dimensions: z.number(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_insert output (legacy)
 */
export const VectorInsertOutputSchema = z
  .object({
    success: z.boolean(),
    rowsAffected: z.number(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_upsert output (legacy)
 */
export const VectorUpsertOutputSchema = z
  .object({
    success: z.boolean(),
    inserted: z.number(),
    updated: z.number(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_cosine_similarity output (legacy)
 */
export const CosineSimilarityOutputSchema = z
  .object({
    success: z.boolean(),
    similarity: z.number(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_euclidean_distance output (legacy)
 */
export const EuclideanDistanceOutputSchema = z
  .object({
    success: z.boolean(),
    distance: z.number(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_dot_product output (legacy)
 */
export const DotProductOutputSchema = z
  .object({
    success: z.boolean(),
    product: z.number(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_vector_magnitude output (legacy)
 */
export const VectorMagnitudeOutputSchema = z
  .object({
    success: z.boolean(),
    magnitude: z.number(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Result item with hybrid scores
 */
const HybridResultSchema = z
  .object({
    vector_score: z.number().optional(),
    text_score: z.number().optional(),
    combined_score: z.number().optional(),
  })
  .loose();

/**
 * sqlite_hybrid_search output
 */
export const HybridSearchOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    results: z.array(HybridResultSchema),
  })
  .extend(ErrorFieldsMixin.shape);
