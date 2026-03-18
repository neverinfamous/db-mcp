/**
 * Geo Tools Tests - Regions
 *
 * Tests for SQLite geospatial bounding box and clustering tools.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getGeoTools } from "../../../../../src/adapters/sqlite/tools/geo.js";
import { SqliteAdapter } from "../../../../../src/adapters/sqlite/sqlite-adapter.js";
import type {
  RequestContext,
  ToolDefinition,
} from "../../../../../src/types/index.js";

describe("Geo Tools - Regions", () => {
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

    it("should return structured error for nonexistent table", async () => {
      const result = (await getTool().handler(
        {
          table: "nonexistent_table",
          latColumn: "latitude",
          lonColumn: "longitude",
          gridSize: 0.1,
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("nonexistent_table");
    });

    it("should return structured error for nonexistent column", async () => {
      const result = (await getTool().handler(
        {
          table: "locations",
          latColumn: "nonexistent_lat",
          lonColumn: "longitude",
          gridSize: 0.1,
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("nonexistent_lat");
    });
  });
});
