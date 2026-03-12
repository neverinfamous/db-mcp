/**
 * Geo Tools Tests - Spatial
 *
 * Tests for SQLite geospatial distance and nearby search tools.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getGeoTools } from "../../../../../src/adapters/sqlite/tools/geo.js";
import { SqliteAdapter } from "../../../../../src/adapters/sqlite/sqlite-adapter.js";
import type {
  RequestContext,
  ToolDefinition,
} from "../../../../../src/types/index.js";

describe("Geo Tools - Spatial", () => {
  let adapter: SqliteAdapter;
  let tools: ToolDefinition[];
  let mockContext: RequestContext;

  beforeEach(async () => {
    adapter = new SqliteAdapter();
    await adapter.connect({ type: "sqlite", database: ":memory:" });

    // Create test table with geographic data
    await adapter.executeWriteQuery(`
      CREATE TABLE locations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL
      )
    `);

    // Insert test locations (NYC area)
    await adapter.executeWriteQuery(`
      INSERT INTO locations (name, latitude, longitude) VALUES
        ('Times Square', 40.758, -73.985),
        ('Central Park', 40.785, -73.968),
        ('Brooklyn Bridge', 40.706, -73.997),
        ('Statue of Liberty', 40.689, -74.044),
        ('Empire State', 40.748, -73.986),
        ('JFK Airport', 40.641, -73.778)
    `);

    tools = getGeoTools(adapter);
    mockContext = {
      requestId: "test-req-1",
      timestamp: new Date(),
    };

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
    vi.restoreAllMocks();
  });

  describe("sqlite_geo_distance", () => {
    const getTool = () => tools.find((t) => t.name === "sqlite_geo_distance")!;

    it("should calculate distance in km", async () => {
      const result = (await getTool().handler(
        {
          lat1: 40.758,
          lon1: -73.985,
          lat2: 40.785,
          lon2: -73.968,
        },
        mockContext,
      )) as {
        success: boolean;
        distance: number;
        unit: string;
        from: { lat: number; lon: number };
        to: { lat: number; lon: number };
      };

      expect(result.success).toBe(true);
      expect(result.unit).toBe("km");
      // Distance between Times Square and Central Park is ~3.2km
      expect(result.distance).toBeGreaterThan(2.5);
      expect(result.distance).toBeLessThan(4);
      expect(result.from).toEqual({ lat: 40.758, lon: -73.985 });
      expect(result.to).toEqual({ lat: 40.785, lon: -73.968 });
    });

    it("should calculate distance in miles", async () => {
      const result = (await getTool().handler(
        {
          lat1: 40.758,
          lon1: -73.985,
          lat2: 40.785,
          lon2: -73.968,
          unit: "miles",
        },
        mockContext,
      )) as { success: boolean; distance: number; unit: string };

      expect(result.success).toBe(true);
      expect(result.unit).toBe("miles");
      // ~2 miles
      expect(result.distance).toBeGreaterThan(1.5);
      expect(result.distance).toBeLessThan(3);
    });

    it("should calculate distance in meters", async () => {
      const result = (await getTool().handler(
        {
          lat1: 40.758,
          lon1: -73.985,
          lat2: 40.785,
          lon2: -73.968,
          unit: "meters",
        },
        mockContext,
      )) as { success: boolean; distance: number; unit: string };

      expect(result.success).toBe(true);
      expect(result.unit).toBe("meters");
      // ~3200m
      expect(result.distance).toBeGreaterThan(2500);
      expect(result.distance).toBeLessThan(4000);
    });

    it("should return 0 for same point", async () => {
      const result = (await getTool().handler(
        {
          lat1: 40.758,
          lon1: -73.985,
          lat2: 40.758,
          lon2: -73.985,
        },
        mockContext,
      )) as { success: boolean; distance: number };

      expect(result.success).toBe(true);
      expect(result.distance).toBe(0);
    });
  });

  describe("sqlite_geo_nearby", () => {
    const getTool = () => tools.find((t) => t.name === "sqlite_geo_nearby")!;

    it("should find points within radius", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          centerLat: 40.758, // Times Square
          centerLon: -73.985,
          radius: 5, // 5km
        },
        mockContext,
      )) as {
        success: boolean;
        rowCount: number;
        results: { name: string; _distance: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBeGreaterThan(0);
      // Results should be sorted by distance
      expect(result.results[0].name).toBe("Times Square");
      expect(result.results[0]._distance).toBe(0);

      // All results should be within 5km
      for (const r of result.results) {
        expect(r._distance).toBeLessThanOrEqual(5);
      }
    });

    it("should filter by radius in miles", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          centerLat: 40.758,
          centerLon: -73.985,
          radius: 3, // 3 miles
          unit: "miles",
        },
        mockContext,
      )) as { success: boolean; results: { _distance: number }[] };

      expect(result.success).toBe(true);
      // All results should be within 3 miles
      for (const r of result.results) {
        expect(r._distance).toBeLessThanOrEqual(3);
      }
    });

    it("should respect limit parameter", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          centerLat: 40.758,
          centerLon: -73.985,
          radius: 100,
          limit: 2,
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBeLessThanOrEqual(2);
    });

    it("should support returnColumns", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          centerLat: 40.758,
          centerLon: -73.985,
          radius: 10,
          returnColumns: ["name"],
        },
        mockContext,
      )) as { success: boolean; results: Record<string, unknown>[] };

      expect(result.success).toBe(true);
      expect(result.results[0]).toHaveProperty("name");
      expect(result.results[0]).toHaveProperty("_distance");
      expect(result.results[0]).not.toHaveProperty("latitude");
      expect(result.results[0]).not.toHaveProperty("longitude");
    });
  });
});
