/**
 * Geospatial Tool Output Schemas (7 tools)
 */

import { z } from "zod";
import { RowRecordSchema } from "./common.js";
import { ErrorFieldsMixin } from "./error-mixin.js";

/**
 * sqlite_geo_distance output
 */
export const GeoDistanceOutputSchema = z
  .object({
    success: z.boolean(),
    distance: z.number().optional(),
    unit: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_geo_bounding_box output
 */
export const GeoBoundingBoxOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    results: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

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
export const GeoWithinRadiusOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    results: z.array(GeoDistanceResultSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_geo_cluster output
 */
export const GeoClusterOutputSchema = z
  .object({
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
  })
  .extend(ErrorFieldsMixin.shape);



