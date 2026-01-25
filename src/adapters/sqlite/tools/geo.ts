/**
 * SQLite Geospatial Tools
 *
 * Basic geospatial operations using Haversine formula.
 * Works without SpatiaLite extension.
 * 4 tools total.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";

// Geo schemas
const GeoDistanceSchema = z.object({
  lat1: z.number().min(-90).max(90).describe("Latitude of point 1"),
  lon1: z.number().min(-180).max(180).describe("Longitude of point 1"),
  lat2: z.number().min(-90).max(90).describe("Latitude of point 2"),
  lon2: z.number().min(-180).max(180).describe("Longitude of point 2"),
  unit: z.enum(["km", "miles", "meters"]).optional().default("km"),
});

const GeoNearbySchema = z.object({
  table: z.string().describe("Table name"),
  latColumn: z.string().describe("Latitude column"),
  lonColumn: z.string().describe("Longitude column"),
  centerLat: z.number().min(-90).max(90).describe("Center latitude"),
  centerLon: z.number().min(-180).max(180).describe("Center longitude"),
  radius: z.number().describe("Radius"),
  unit: z.enum(["km", "miles", "meters"]).optional().default("km"),
  limit: z.number().optional().default(100),
  returnColumns: z.array(z.string()).optional(),
});

const GeoBoundingBoxSchema = z.object({
  table: z.string().describe("Table name"),
  latColumn: z.string().describe("Latitude column"),
  lonColumn: z.string().describe("Longitude column"),
  minLat: z.number().min(-90).max(90),
  maxLat: z.number().min(-90).max(90),
  minLon: z.number().min(-180).max(180),
  maxLon: z.number().min(-180).max(180),
  limit: z.number().optional().default(100),
  returnColumns: z.array(z.string()).optional(),
});

const GeoClusterSchema = z.object({
  table: z.string().describe("Table name"),
  latColumn: z.string().describe("Latitude column"),
  lonColumn: z.string().describe("Longitude column"),
  gridSize: z.number().optional().default(0.1).describe("Grid size in degrees"),
  whereClause: z.string().optional(),
});

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
    group: "admin",
    inputSchema: GeoDistanceSchema,
    requiredScopes: ["read"],
    handler: (params: unknown, _context: RequestContext) => {
      const input = GeoDistanceSchema.parse(params);

      const distance = haversineDistance(
        input.lat1,
        input.lon1,
        input.lat2,
        input.lon2,
        input.unit,
      );

      return Promise.resolve({
        success: true,
        distance: Math.round(distance * 1000) / 1000,
        unit: input.unit,
        from: { lat: input.lat1, lon: input.lon1 },
        to: { lat: input.lat2, lon: input.lon2 },
      });
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
    group: "admin",
    inputSchema: GeoNearbySchema,
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      const input = GeoNearbySchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.latColumn)) {
        throw new Error("Invalid latitude column name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.lonColumn)) {
        throw new Error("Invalid longitude column name");
      }

      // Build select
      let selectCols = "*";
      if (input.returnColumns && input.returnColumns.length > 0) {
        for (const col of input.returnColumns) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
            throw new Error(`Invalid column name: ${col}`);
          }
        }
        selectCols = [...input.returnColumns, input.latColumn, input.lonColumn]
          .map((c) => `"${c}"`)
          .join(", ");
      }

      // Calculate rough bounding box for pre-filtering
      const radiusKm =
        input.unit === "miles"
          ? input.radius * 1.60934
          : input.unit === "meters"
            ? input.radius / 1000
            : input.radius;
      const latDelta = radiusKm / 111; // ~111km per degree latitude
      const lonDelta =
        radiusKm / (111 * Math.cos((input.centerLat * Math.PI) / 180));

      const sql = `SELECT ${selectCols} FROM "${input.table}"
                WHERE "${input.latColumn}" BETWEEN ${input.centerLat - latDelta} AND ${input.centerLat + latDelta}
                AND "${input.lonColumn}" BETWEEN ${input.centerLon - lonDelta} AND ${input.centerLon + lonDelta}`;

      const result = await adapter.executeReadQuery(sql);

      // Filter by exact distance
      const nearby = (result.rows ?? [])
        .map((row) => {
          const lat = Number(row[input.latColumn]);
          const lon = Number(row[input.lonColumn]);
          const distance = haversineDistance(
            input.centerLat,
            input.centerLon,
            lat,
            lon,
            input.unit,
          );
          return { ...row, _distance: Math.round(distance * 1000) / 1000 };
        })
        .filter((r) => r._distance <= input.radius)
        .sort((a, b) => a._distance - b._distance)
        .slice(0, input.limit);

      return {
        success: true,
        center: { lat: input.centerLat, lon: input.centerLon },
        radius: input.radius,
        unit: input.unit,
        count: nearby.length,
        results: nearby,
      };
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
    group: "admin",
    inputSchema: GeoBoundingBoxSchema,
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      const input = GeoBoundingBoxSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.latColumn)) {
        throw new Error("Invalid latitude column name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.lonColumn)) {
        throw new Error("Invalid longitude column name");
      }

      // Build select
      let selectCols = "*";
      if (input.returnColumns && input.returnColumns.length > 0) {
        for (const col of input.returnColumns) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
            throw new Error(`Invalid column name: ${col}`);
          }
        }
        selectCols = input.returnColumns.map((c) => `"${c}"`).join(", ");
      }

      const sql = `SELECT ${selectCols} FROM "${input.table}"
                WHERE "${input.latColumn}" BETWEEN ${input.minLat} AND ${input.maxLat}
                AND "${input.lonColumn}" BETWEEN ${input.minLon} AND ${input.maxLon}
                LIMIT ${input.limit}`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        bounds: {
          minLat: input.minLat,
          maxLat: input.maxLat,
          minLon: input.minLon,
          maxLon: input.maxLon,
        },
        count: result.rows?.length ?? 0,
        results: result.rows,
      };
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
    group: "admin",
    inputSchema: GeoClusterSchema,
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      const input = GeoClusterSchema.parse(params);

      // Validate names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.latColumn)) {
        throw new Error("Invalid latitude column name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.lonColumn)) {
        throw new Error("Invalid longitude column name");
      }

      // Use ROUND to create grid cells
      const gridSize = input.gridSize;
      const sql = `SELECT 
                ROUND("${input.latColumn}" / ${gridSize}) * ${gridSize} as grid_lat,
                ROUND("${input.lonColumn}" / ${gridSize}) * ${gridSize} as grid_lon,
                COUNT(*) as point_count,
                AVG("${input.latColumn}") as center_lat,
                AVG("${input.lonColumn}") as center_lon
            FROM "${input.table}"
            ${input.whereClause ? `WHERE ${input.whereClause}` : ""}
            GROUP BY grid_lat, grid_lon
            ORDER BY point_count DESC`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        gridSize: input.gridSize,
        clusterCount: result.rows?.length ?? 0,
        clusters: result.rows,
      };
    },
  };
}
