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


// =============================================================================
// Input Schemas
// =============================================================================


/**
 * Coerce string-typed numbers to actual numbers.
 */
const coerceNumber = (val: unknown): unknown =>
  typeof val === "string"
    ? isNaN(Number(val))
      ? undefined
      : Number(val)
    : val;

const VALID_UNITS = ["km", "miles", "meters"] as const;

/**
 * Coerce invalid unit values to undefined
 */
const coerceUnit = (val: unknown): unknown =>
  typeof val === "string" && (VALID_UNITS as readonly string[]).includes(val)
    ? val
    : typeof val === "string"
      ? undefined
      : val;

export const GeoDistanceSchema = z.object({
  lat1: z.preprocess(coerceNumber, z.number().optional().describe("Latitude of point 1")),
  lon1: z.preprocess(coerceNumber, z.number().optional().describe("Longitude of point 1")),
  lat2: z.preprocess(coerceNumber, z.number().optional().describe("Latitude of point 2")),
  lon2: z.preprocess(coerceNumber, z.number().optional().describe("Longitude of point 2")),
  unit: z.preprocess(coerceUnit, z.enum(["km", "miles", "meters"]).optional().default("km")),
});
export type GeoDistanceInput = z.infer<typeof GeoDistanceSchema>;

export const GeoNearbySchema = z.object({
  table: z.string().describe("Table name"),
  latColumn: z.string().describe("Latitude column"),
  lonColumn: z.string().describe("Longitude column"),
  centerLat: z.preprocess(coerceNumber, z.number().optional().describe("Center latitude")),
  centerLon: z.preprocess(coerceNumber, z.number().optional().describe("Center longitude")),
  radius: z.preprocess(coerceNumber, z.number().optional().describe("Radius")),
  unit: z.preprocess(coerceUnit, z.enum(["km", "miles", "meters"]).optional().default("km")),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
  returnColumns: z.array(z.string()).optional(),
});
export type GeoNearbyInput = z.infer<typeof GeoNearbySchema>;

export const GeoBoundingBoxSchema = z.object({
  table: z.string().describe("Table name"),
  latColumn: z.string().describe("Latitude column"),
  lonColumn: z.string().describe("Longitude column"),
  minLat: z.preprocess(coerceNumber, z.number().optional()),
  maxLat: z.preprocess(coerceNumber, z.number().optional()),
  minLon: z.preprocess(coerceNumber, z.number().optional()),
  maxLon: z.preprocess(coerceNumber, z.number().optional()),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
  returnColumns: z.array(z.string()).optional(),
});
export type GeoBoundingBoxInput = z.infer<typeof GeoBoundingBoxSchema>;

export const GeoClusterSchema = z.object({
  table: z.string().describe("Table name"),
  latColumn: z.string().describe("Latitude column"),
  lonColumn: z.string().describe("Longitude column"),
  gridSize: z.preprocess(coerceNumber, z.number().optional().default(0.1).describe("Grid size in degrees")),
  whereClause: z.string().optional(),
});
export type GeoClusterInput = z.infer<typeof GeoClusterSchema>;
