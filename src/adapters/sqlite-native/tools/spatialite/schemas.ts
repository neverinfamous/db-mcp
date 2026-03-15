/**
 * SpatiaLite Zod Schemas
 *
 * Input validation schemas for all SpatiaLite tool parameters.
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
 * Coerce string-typed booleans to actual booleans.
 * Returns undefined for non-boolean strings so the schema default kicks in.
 */
const coerceBoolean = (val: unknown): unknown =>
  typeof val === "string"
    ? val === "true"
      ? true
      : val === "false"
        ? false
        : undefined
    : val;

/**
 * Generic enum coercion factory.
 * Returns undefined for invalid enum values so the schema default kicks in.
 * Prevents raw MCP -32602 errors from enum validation.
 */
function createEnumCoercer(validValues: readonly string[]) {
  return (val: unknown): unknown =>
    typeof val === "string" && validValues.includes(val)
      ? val
      : typeof val === "string"
        ? undefined
        : val;
}

const VALID_GEOMETRY_TYPES = ["POINT", "LINESTRING", "POLYGON", "MULTIPOINT", "MULTILINESTRING", "MULTIPOLYGON", "GEOMETRY"] as const;
const VALID_ANALYSIS_TYPES = ["nearest_neighbor", "point_in_polygon", "distance_matrix", "spatial_extent"] as const;
const VALID_INDEX_ACTIONS = ["create", "drop", "check"] as const;
const VALID_FORMATS = ["wkt", "geojson"] as const;
const VALID_OPERATIONS = ["buffer", "intersection", "union", "difference", "centroid", "envelope", "simplify"] as const;

const coerceGeometryType = createEnumCoercer(VALID_GEOMETRY_TYPES);

// Required enum constants exported for handler-level validation.
// Required enums can't use z.preprocess coercion because the SDK's .partial()
// wraps the preprocess in .optional(), but the inner z.enum() still rejects
// undefined — producing raw MCP -32602 errors. Instead, use z.string() in
// the schema and validate in the handler's try/catch.
export { VALID_ANALYSIS_TYPES, VALID_INDEX_ACTIONS, VALID_FORMATS, VALID_OPERATIONS };

export const LoadSpatialiteSchema = z.object({
  extensionPath: z
    .string()
    .optional()
    .describe("Custom path to mod_spatialite extension"),
  forceReload: z.preprocess(
    coerceBoolean,
    z.boolean()
      .optional()
      .default(false)
      .describe("Force reload if already loaded"),
  ),
}).strict();

export const CreateSpatialTableSchema = z.object({
  tableName: z.string().describe("Name of the spatial table to create"),
  geometryColumn: z
    .string()
    .optional()
    .default("geom")
    .describe("Name of the geometry column"),
  geometryType: z.preprocess(
    coerceGeometryType,
    z.enum([
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
  ),
  srid: z.preprocess(
    coerceNumber,
    z.number()
      .optional()
      .default(4326)
      .describe("Spatial Reference System ID (4326 for WGS84)"),
  ),
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
}).strict();

export const SpatialQuerySchema = z.object({
  query: z.string().describe("Spatial SQL query using SpatiaLite functions"),
  params: z
    .array(z.unknown())
    .optional()
    .default([])
    .describe("Query parameters"),
}).strict();

export const SpatialAnalysisSchema = z.object({
  analysisType: z.string().describe(
    "Type of spatial analysis: nearest_neighbor, point_in_polygon, distance_matrix, spatial_extent",
  ),
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
  limit: z.preprocess(coerceNumber, z.number().optional().default(100).describe("Limit results")),
  excludeSelf: z.preprocess(
    coerceBoolean,
    z.boolean()
      .optional()
      .default(true)
      .describe(
        "For nearest_neighbor: exclude self-matches when source and target tables are the same (default: true)",
      ),
  ),
  includeGeometry: z.preprocess(
    coerceBoolean,
    z.boolean()
      .optional()
      .default(false)
      .describe(
        "Include full WKT geometry in results (default: false to reduce payload size)",
      ),
  ),
}).strict();

export const SpatialIndexSchema = z.object({
  tableName: z.string().describe("Name of the spatial table"),
  geometryColumn: z
    .string()
    .optional()
    .default("geom")
    .describe("Geometry column name"),
  action: z.string()
    .optional()
    .default("create")
    .describe("Action to perform: create, drop, check"),
}).strict();

export const GeometryTransformSchema = z.object({
  operation: z.string().describe(
    "Geometry operation: buffer, intersection, union, difference, centroid, envelope, simplify",
  ),
  geometry1: z.string().describe("First geometry (WKT format)"),
  geometry2: z.string().optional().describe("Second geometry for binary ops"),
  distance: z.preprocess(
    coerceNumber,
    z.number()
      .optional()
      .default(0.001)
      .describe("Distance for buffer or simplify tolerance"),
  ),
  srid: z.preprocess(coerceNumber, z.number().optional().default(4326).describe("SRID for result")),
  simplifyTolerance: z.preprocess(
    coerceNumber,
    z.number()
      .optional()
      .describe(
        "For buffer operation: apply ST_Simplify to reduce vertices in output polygon. Recommended: 0.0001-0.001 for lat/lon",
      ),
  ),
}).strict();

export const SpatialImportSchema = z.object({
  tableName: z.string().describe("Target table name"),
  format: z.string().describe("Input format: wkt or geojson"),
  data: z.string().describe("Geometry data (WKT string or GeoJSON)"),
  srid: z.preprocess(coerceNumber, z.number().optional().default(4326).describe("SRID of input data")),
  additionalData: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional column values"),
}).strict();
