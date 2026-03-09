/**
 * Geospatial Tool Output Schemas (7 tools)
 */

import { z } from "zod";
import { RowRecordSchema } from "./common.js";

/**
 * sqlite_geo_distance output
 */
export const GeoDistanceOutputSchema = z.object({
  success: z.boolean(),
  distance: z.number(),
  unit: z.string(),
});

/**
 * sqlite_geo_bounding_box output
 */
export const GeoBoundingBoxOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number().optional(),
  results: z.array(RowRecordSchema).optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  suggestion: z.string().optional(),
});

/**
 * Result item with distance for geo queries
 */
const GeoDistanceResultSchema = z
  .object({
    distance: z.number().optional(),
  })
  .loose();

/**
 * sqlite_geo_within_radius output
 */
export const GeoWithinRadiusOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number().optional(),
  results: z.array(GeoDistanceResultSchema).optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  suggestion: z.string().optional(),
});

/**
 * sqlite_geo_cluster output
 */
export const GeoClusterOutputSchema = z.object({
  success: z.boolean(),
  clusters: z
    .array(
      z.object({
        clusterId: z.number(),
        center: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        pointCount: z.number(),
        points: z.array(RowRecordSchema).optional(),
      }),
    )
    .optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  suggestion: z.string().optional(),
});

/**
 * Result item with required distance for nearest
 */
const GeoNearestResultSchema = z
  .object({
    distance: z.number(),
  })
  .loose();

/**
 * sqlite_geo_nearest output
 */
export const GeoNearestOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(GeoNearestResultSchema),
});

/**
 * sqlite_geo_polygon_contains output
 */
export const GeoPolygonContainsOutputSchema = z.object({
  success: z.boolean(),
  contains: z.boolean(),
});

/**
 * sqlite_geo_encode output
 */
export const GeoEncodeOutputSchema = z.object({
  success: z.boolean(),
  geohash: z.string(),
  precision: z.number(),
});
