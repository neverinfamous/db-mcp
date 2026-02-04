/**
 * Geo Tools Tests
 *
 * Tests for SQLite geospatial tools (Haversine-based).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getGeoTools } from "../../../../src/adapters/sqlite/tools/geo.js";
import { SqliteAdapter } from "../../../../src/adapters/sqlite/SqliteAdapter.js";
import type {
  RequestContext,
  ToolDefinition,
} from "../../../../src/types/index.js";

describe("Geo Tools", () => {
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

  describe("getGeoTools", () => {
    it("should return 4 geo tools", () => {
      expect(tools).toHaveLength(4);
    });

    it("should include all expected tools", () => {
      const names = tools.map((t) => t.name);
      expect(names).toContain("sqlite_geo_distance");
      expect(names).toContain("sqlite_geo_nearby");
      expect(names).toContain("sqlite_geo_bounding_box");
      expect(names).toContain("sqlite_geo_cluster");
    });

    it("should assign all tools to geo group", () => {
      for (const tool of tools) {
        expect(tool.group).toBe("geo");
      }
    });

    it("should require read scope for all tools", () => {
      for (const tool of tools) {
        expect(tool.requiredScopes).toContain("read");
      }
    });
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
      expect(result.results[0]).toHaveProperty("latitude");
      expect(result.results[0]).toHaveProperty("longitude");
    });
  });

  describe("sqlite_geo_bounding_box", () => {
    const getTool = () =>
      tools.find((t) => t.name === "sqlite_geo_bounding_box")!;

    it("should find points in bounding box", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          minLat: 40.7,
          maxLat: 40.8,
          minLon: -74.0,
          maxLon: -73.9,
        },
        mockContext,
      )) as { success: boolean; rowCount: number; results: { name: string }[] };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBeGreaterThan(0);
      // All points should be within bounds
      for (const r of result.results) {
        expect(r).toHaveProperty("latitude");
        expect(r).toHaveProperty("longitude");
      }
    });

    it("should respect limit parameter", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          minLat: 40.0,
          maxLat: 41.0,
          minLon: -75.0,
          maxLon: -73.0,
          limit: 3,
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBeLessThanOrEqual(3);
    });

    it("should support returnColumns", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          minLat: 40.0,
          maxLat: 41.0,
          minLon: -75.0,
          maxLon: -73.0,
          returnColumns: ["id", "name"],
        },
        mockContext,
      )) as { success: boolean; results: Record<string, unknown>[] };

      expect(result.success).toBe(true);
      expect(result.results[0]).toHaveProperty("id");
      expect(result.results[0]).toHaveProperty("name");
    });

    it("should return empty for non-matching box", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          minLat: 0,
          maxLat: 1,
          minLon: 0,
          maxLon: 1,
        },
        mockContext,
      )) as { success: boolean; rowCount: number };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
    });
  });

  describe("sqlite_geo_cluster", () => {
    const getTool = () => tools.find((t) => t.name === "sqlite_geo_cluster")!;

    it("should cluster points by grid", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          gridSize: 0.1,
        },
        mockContext,
      )) as {
        success: boolean;
        clusters: {
          clusterId: number;
          center: { latitude: number; longitude: number };
          pointCount: number;
        }[];
      };

      expect(result.success).toBe(true);
      expect(result.clusters).toBeDefined();
      expect(result.clusters.length).toBeGreaterThan(0);

      // Check cluster structure
      for (const cluster of result.clusters) {
        expect(cluster).toHaveProperty("clusterId");
        expect(cluster).toHaveProperty("center");
        expect(cluster).toHaveProperty("pointCount");
        expect(cluster.center).toHaveProperty("latitude");
        expect(cluster.center).toHaveProperty("longitude");
        expect(cluster.pointCount).toBeGreaterThan(0);
      }
    });

    it("should use larger grid size for fewer clusters", async () => {
      const smallGrid = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          gridSize: 0.01,
        },
        mockContext,
      )) as {
        clusters: { pointCount: number }[];
      };

      const largeGrid = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          gridSize: 1.0,
        },
        mockContext,
      )) as {
        clusters: { pointCount: number }[];
      };

      // Larger grid should have fewer clusters
      expect(largeGrid.clusters.length).toBeLessThanOrEqual(
        smallGrid.clusters.length,
      );
    });

    it("should support whereClause filtering", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          gridSize: 0.1,
          whereClause: "name != 'JFK Airport'",
        },
        mockContext,
      )) as {
        success: boolean;
        clusters: { pointCount: number }[];
      };

      expect(result.success).toBe(true);
      // Total points should be 5 (excluded JFK)
      const totalPoints = result.clusters.reduce(
        (sum, c) => sum + c.pointCount,
        0,
      );
      expect(totalPoints).toBe(5);
    });

    it("should order clusters by point count descending", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "latitude",
          lonColumn: "longitude",
          gridSize: 0.05,
        },
        mockContext,
      )) as {
        success: boolean;
        clusters: { pointCount: number }[];
      };

      expect(result.success).toBe(true);

      // Verify descending order
      for (let i = 1; i < result.clusters.length; i++) {
        expect(result.clusters[i - 1].pointCount).toBeGreaterThanOrEqual(
          result.clusters[i].pointCount,
        );
      }
    });
  });
});
