/**
 * SQLite Geospatial Tools
 *
 * Basic geospatial operations using Haversine formula.
 * Works without SpatiaLite extension.
 * 4 tools total.
 */

import { z } from "zod";

/**
 * Coerce string-typed numbers to actual numbers.
 * Returns undefined for non-numeric strings so the schema default kicks in
 * (for optional params) or so the handler can catch it with a structured
 * error (for required params using `.optional()` at the schema level).
 */
const coerceNumber = (val: unknown): unknown =>
  typeof val === "string"
    ? isNaN(Number(val))
      ? undefined
      : Number(val)
    : val;

const VALID_UNITS = ["km", "miles", "meters"] as const;

/**
 * Coerce invalid unit values to undefined so the schema default kicks in.
 * Prevents raw MCP -32602 errors from enum validation.
 */
const coerceUnit = (val: unknown): unknown =>
  typeof val === "string" &&
  (VALID_UNITS as readonly string[]).includes(val)
    ? val
    : typeof val === "string"
      ? undefined
      : val;
import type { SqliteAdapter } from "../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { readOnly } from "../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
  createColumnList,
} from "../../../utils/index.js";
import { formatHandlerError, DbMcpError, ErrorCategory } from "../../../utils/errors/index.js";
import {
  GeoDistanceOutputSchema,
  GeoWithinRadiusOutputSchema,
  GeoBoundingBoxOutputSchema,
  GeoClusterOutputSchema,
} from "../output-schemas/index.js";
import { validateColumnExists } from "./column-validation.js";

// Geo schemas
// Required numeric params use `.optional()` at schema level so the SDK
// doesn't reject coerced-undefined values at the boundary.  The handler
// validates presence and range via validateCoordinates().
const GeoDistanceSchema = z.object({
  lat1: z.preprocess(coerceNumber, z.number().optional().describe("Latitude of point 1")),
  lon1: z.preprocess(coerceNumber, z.number().optional().describe("Longitude of point 1")),
  lat2: z.preprocess(coerceNumber, z.number().optional().describe("Latitude of point 2")),
  lon2: z.preprocess(coerceNumber, z.number().optional().describe("Longitude of point 2")),
  unit: z.preprocess(coerceUnit, z.enum(["km", "miles", "meters"]).optional().default("km")),
});

const GeoNearbySchema = z.object({
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

const GeoBoundingBoxSchema = z.object({
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

const GeoClusterSchema = z.object({
  table: z.string().describe("Table name"),
  latColumn: z.string().describe("Latitude column"),
  lonColumn: z.string().describe("Longitude column"),
  gridSize: z.preprocess(coerceNumber, z.number().optional().default(0.1).describe("Grid size in degrees")),
  whereClause: z.string().optional(),
});



/**
 * Validate and narrow a numeric coordinate/parameter.
 * Returns the validated number (narrowing `number | undefined` → `number`)
 * so callers get a type-safe value without needing assertions.
 */
function requireCoordinate(
  value: number | undefined,
  name: string,
  min: number,
  max: number,
): number {
  if (value === undefined || isNaN(value)) {
    throw new DbMcpError(
      `Invalid ${name}: value is not a valid number.`,
      "GEO_INVALID_COORDINATES",
      ErrorCategory.VALIDATION
    );
  }
  if (value < min || value > max) {
    throw new DbMcpError(
      `Invalid ${name}: ${String(value)}. Must be between ${String(min)} and ${String(max)}.`,
      "GEO_INVALID_COORDINATES",
      ErrorCategory.VALIDATION
    );
  }
  return value;
}

/**
 * Validate and narrow a required numeric parameter (no range check).
 */
function requireNumber(value: number | undefined, name: string): number {
  if (value === undefined || isNaN(value)) {
    throw new DbMcpError(
      `Invalid ${name}: value is not a valid number.`,
      "GEO_INVALID_COORDINATES",
      ErrorCategory.VALIDATION
    );
  }
  return value;
}

/**
 * Get all geo tools
 */
export function getGeoTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createGeoDistanceTool(),
    createGeoNearbyTool(adapter),
    createGeoBoundingBoxTool(adapter),
    createGeoClusterTool(adapter),
  ];
}

// Earth radius in different units
const EARTH_RADIUS = {
  km: 6371,
  miles: 3959,
  meters: 6371000,
};

/** Approximate km per degree of latitude */
const KM_PER_DEGREE_LAT = 111;

/**
 * Haversine formula for distance calculation
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: "km" | "miles" | "meters",
): number {
  const R = EARTH_RADIUS[unit];
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance between two points
 */
function createGeoDistanceTool(): ToolDefinition {
  return {
    name: "sqlite_geo_distance",
    description:
      "Calculate the distance between two geographic points using Haversine formula.",
    group: "geo",
    inputSchema: GeoDistanceSchema,
    outputSchema: GeoDistanceOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Geo Distance"),
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = GeoDistanceSchema.parse(params);

        const lat1 = requireCoordinate(input.lat1, "lat1", -90, 90);
        const lon1 = requireCoordinate(input.lon1, "lon1", -180, 180);
        const lat2 = requireCoordinate(input.lat2, "lat2", -90, 90);
        const lon2 = requireCoordinate(input.lon2, "lon2", -180, 180);

        const distance = haversineDistance(lat1, lon1, lat2, lon2, input.unit);

        return Promise.resolve({
          success: true,
          distance: Math.round(distance * 1000) / 1000,
          unit: input.unit,
        });
      } catch (error) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}

/**
 * Find points within radius
 */
function createGeoNearbyTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_geo_nearby",
    description: "Find points within a radius of a center point.",
    group: "geo",
    inputSchema: GeoNearbySchema,
    outputSchema: GeoWithinRadiusOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Geo Nearby"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = GeoNearbySchema.parse(params);

        // Validate radius is a valid number
        const radius = requireNumber(input.radius, "radius");

        const centerLat = requireCoordinate(input.centerLat, "centerLat", -90, 90);
        const centerLon = requireCoordinate(input.centerLon, "centerLon", -180, 180);

        // Validate columns exist
        await validateColumnExists(adapter, input.table, input.latColumn);
        await validateColumnExists(adapter, input.table, input.lonColumn);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const latColumn = sanitizeIdentifier(input.latColumn);
        const lonColumn = sanitizeIdentifier(input.lonColumn);

        // Build select
        let selectCols = "*";
        if (input.returnColumns && input.returnColumns.length > 0) {
          const allCols = [
            ...input.returnColumns,
            input.latColumn,
            input.lonColumn,
          ];
          selectCols = createColumnList(allCols);
        }

        // Calculate rough bounding box for pre-filtering
        const radiusKm =
          input.unit === "miles"
            ? radius * 1.60934
            : input.unit === "meters"
              ? radius / 1000
              : radius;
        const latDelta = radiusKm / KM_PER_DEGREE_LAT;
        const lonDelta =
          radiusKm / (KM_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180));

        const sql = `SELECT ${selectCols} FROM ${table}
                  WHERE ${latColumn} BETWEEN ${centerLat - latDelta} AND ${centerLat + latDelta}
                  AND ${lonColumn} BETWEEN ${centerLon - lonDelta} AND ${centerLon + lonDelta}`;

        const result = await adapter.executeReadQuery(sql);

        // Filter by exact distance
        const nearby = (result.rows ?? [])
          .map((row) => {
            const lat = Number(row[input.latColumn]);
            const lon = Number(row[input.lonColumn]);
            const distance = haversineDistance(
              centerLat,
              centerLon,
              lat,
              lon,
              input.unit,
            );
            return { ...row, distance: Math.round(distance * 1000) / 1000 };
          })
          .filter((r) => r.distance <= radius)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, input.limit);

        // Strip internally-added lat/lon columns when returnColumns was specified
        // and user didn't explicitly request them
        let results = nearby;
        if (input.returnColumns && input.returnColumns.length > 0) {
          const requested = new Set(input.returnColumns);
          const stripLat = !requested.has(input.latColumn);
          const stripLon = !requested.has(input.lonColumn);
          if (stripLat || stripLon) {
            const keysToStrip = new Set<string>();
            if (stripLat) keysToStrip.add(input.latColumn);
            if (stripLon) keysToStrip.add(input.lonColumn);
            results = nearby.map(
              (row) =>
                Object.fromEntries(
                  Object.entries(row).filter(([k]) => !keysToStrip.has(k)),
                ) as (typeof nearby)[number],
            );
          }
        }

        return {
          success: true,
          rowCount: results.length,
          results,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Find points within bounding box
 */
function createGeoBoundingBoxTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_geo_bounding_box",
    description: "Find points within a rectangular bounding box.",
    group: "geo",
    inputSchema: GeoBoundingBoxSchema,
    outputSchema: GeoBoundingBoxOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Geo Bounding Box"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = GeoBoundingBoxSchema.parse(params);

        const minLat = requireCoordinate(input.minLat, "minLat", -90, 90);
        const maxLat = requireCoordinate(input.maxLat, "maxLat", -90, 90);
        const minLon = requireCoordinate(input.minLon, "minLon", -180, 180);
        const maxLon = requireCoordinate(input.maxLon, "maxLon", -180, 180);

        // Validate columns exist
        await validateColumnExists(adapter, input.table, input.latColumn);
        await validateColumnExists(adapter, input.table, input.lonColumn);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const latColumn = sanitizeIdentifier(input.latColumn);
        const lonColumn = sanitizeIdentifier(input.lonColumn);

        // Build select
        let selectCols = "*";
        if (input.returnColumns && input.returnColumns.length > 0) {
          selectCols = createColumnList(input.returnColumns);
        }

        const sql = `SELECT ${selectCols} FROM ${table}
                  WHERE ${latColumn} BETWEEN ${minLat} AND ${maxLat}
                  AND ${lonColumn} BETWEEN ${minLon} AND ${maxLon}
                  LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          results: result.rows ?? [],
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Cluster points by grid
 */
function createGeoClusterTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_geo_cluster",
    description: "Cluster geographic points into grid cells.",
    group: "geo",
    inputSchema: GeoClusterSchema,
    outputSchema: GeoClusterOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Geo Cluster"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = GeoClusterSchema.parse(params);

        // Validate columns exist
        await validateColumnExists(adapter, input.table, input.latColumn);
        await validateColumnExists(adapter, input.table, input.lonColumn);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const latColumn = sanitizeIdentifier(input.latColumn);
        const lonColumn = sanitizeIdentifier(input.lonColumn);

        // Security: Validate WHERE clause if provided
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
        }

        // Use ROUND to create grid cells
        const gridSize = input.gridSize;
        const sql = `SELECT
                  ROUND(${latColumn} / ${gridSize}) * ${gridSize} as grid_lat,
                  ROUND(${lonColumn} / ${gridSize}) * ${gridSize} as grid_lon,
                  COUNT(*) as point_count,
                  AVG(${latColumn}) as center_lat,
                  AVG(${lonColumn}) as center_lon
              FROM ${table}
              ${input.whereClause ? `WHERE ${input.whereClause}` : ""}
              GROUP BY grid_lat, grid_lon
              ORDER BY point_count DESC`;

        const result = await adapter.executeReadQuery(sql);

        // Transform raw SQL results to match output schema
        const clusters = (result.rows ?? []).map((row, index) => ({
          clusterId: index + 1,
          center: {
            latitude: Number(row["center_lat"]) || 0,
            longitude: Number(row["center_lon"]) || 0,
          },
          pointCount: Number(row["point_count"]) || 0,
        }));

        return {
          success: true,
          clusters,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
