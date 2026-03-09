/**
 * SpatiaLite Zod Schemas
 *
 * Input validation schemas for all SpatiaLite tool parameters.
 */

import { z } from "zod";

export const LoadSpatialiteSchema = z.object({
  extensionPath: z
    .string()
    .optional()
    .describe("Custom path to mod_spatialite extension"),
  forceReload: z
    .boolean()
    .optional()
    .default(false)
    .describe("Force reload if already loaded"),
});

export const CreateSpatialTableSchema = z.object({
  tableName: z.string().describe("Name of the spatial table to create"),
  geometryColumn: z
    .string()
    .optional()
    .default("geom")
    .describe("Name of the geometry column"),
  geometryType: z
    .enum([
      "POINT",
      "LINESTRING",
      "POLYGON",
      "MULTIPOINT",
      "MULTILINESTRING",
      "MULTIPOLYGON",
      "GEOMETRY",
    ])
    .optional()
    .default("POINT")
    .describe("Type of geometry to store"),
  srid: z
    .number()
    .optional()
    .default(4326)
    .describe("Spatial Reference System ID (4326 for WGS84)"),
  additionalColumns: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
      }),
    )
    .optional()
    .default([])
    .describe("Additional non-spatial columns"),
});

export const SpatialQuerySchema = z.object({
  query: z.string().describe("Spatial SQL query using SpatiaLite functions"),
  params: z
    .array(z.unknown())
    .optional()
    .default([])
    .describe("Query parameters"),
});

export const SpatialAnalysisSchema = z.object({
  analysisType: z
    .enum([
      "nearest_neighbor",
      "point_in_polygon",
      "distance_matrix",
      "spatial_extent",
    ])
    .describe("Type of spatial analysis"),
  sourceTable: z.string().describe("Source table for analysis"),
  targetTable: z
    .string()
    .optional()
    .describe(
      "Target table for operations. For point_in_polygon, this should contain POLYGON geometries while sourceTable contains POINTs",
    ),
  geometryColumn: z
    .string()
    .optional()
    .default("geom")
    .describe("Geometry column name"),
  limit: z.number().optional().default(100).describe("Limit results"),
  excludeSelf: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "For nearest_neighbor: exclude self-matches when source and target tables are the same (default: true)",
    ),
  includeGeometry: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Include full WKT geometry in results (default: false to reduce payload size)",
    ),
});

export const SpatialIndexSchema = z.object({
  tableName: z.string().describe("Name of the spatial table"),
  geometryColumn: z
    .string()
    .optional()
    .default("geom")
    .describe("Geometry column name"),
  action: z
    .enum(["create", "drop", "check"])
    .optional()
    .default("create")
    .describe("Action to perform"),
});

export const GeometryTransformSchema = z.object({
  operation: z
    .enum([
      "buffer",
      "intersection",
      "union",
      "difference",
      "centroid",
      "envelope",
      "simplify",
    ])
    .describe("Geometry operation to perform"),
  geometry1: z.string().describe("First geometry (WKT format)"),
  geometry2: z.string().optional().describe("Second geometry for binary ops"),
  distance: z
    .number()
    .optional()
    .default(0.001)
    .describe("Distance for buffer or simplify tolerance"),
  srid: z.number().optional().default(4326).describe("SRID for result"),
  simplifyTolerance: z
    .number()
    .optional()
    .describe(
      "For buffer operation: apply ST_Simplify to reduce vertices in output polygon. Recommended: 0.0001-0.001 for lat/lon",
    ),
});

export const SpatialImportSchema = z.object({
  tableName: z.string().describe("Target table name"),
  format: z.enum(["wkt", "geojson"]).describe("Input format"),
  data: z.string().describe("Geometry data (WKT string or GeoJSON)"),
  srid: z.number().optional().default(4326).describe("SRID of input data"),
  additionalData: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional column values"),
});
