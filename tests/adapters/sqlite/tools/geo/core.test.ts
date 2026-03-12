/**
 * Geo Tools Tests - Core
 *
 * Tests for SQLite geospatial tools metadata and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getGeoTools } from "../../../../../src/adapters/sqlite/tools/geo.js";
import { SqliteAdapter } from "../../../../../src/adapters/sqlite/sqlite-adapter.js";
import type {
  RequestContext,
  ToolDefinition,
} from "../../../../../src/types/index.js";

describe("Geo Tools - Core", () => {
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

  describe("error handling", () => {
    it("should return structured error for nearby with nonexistent table", async () => {
      const tool = tools.find((t) => t.name === "sqlite_geo_nearby")!;
      const result = (await tool.handler(
        {
          table: "nonexistent_table",
          latColumn: "latitude",
          lonColumn: "longitude",
          centerLat: 40.758,
          centerLon: -73.985,
          radius: 10,
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("nonexistent_table");
    });

    it("should return structured error for nearby with nonexistent column", async () => {
      const tool = tools.find((t) => t.name === "sqlite_geo_nearby")!;
      const result = (await tool.handler(
        {
          table: "locations",
          latColumn: "bad_col",
          lonColumn: "longitude",
          centerLat: 40.758,
          centerLon: -73.985,
          radius: 10,
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("bad_col");
    });

    it("should return structured error for bounding_box with nonexistent table", async () => {
      const tool = tools.find((t) => t.name === "sqlite_geo_bounding_box")!;
      const result = (await tool.handler(
        {
          table: "nonexistent_table",
          latColumn: "latitude",
          lonColumn: "longitude",
          minLat: 40,
          maxLat: 41,
          minLon: -75,
          maxLon: -73,
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("nonexistent_table");
    });

    it("should return structured error for bounding_box with nonexistent column", async () => {
      const tool = tools.find((t) => t.name === "sqlite_geo_bounding_box")!;
      const result = (await tool.handler(
        {
          table: "locations",
          latColumn: "bad_lat",
          lonColumn: "longitude",
          minLat: 40,
          maxLat: 41,
          minLon: -75,
          maxLon: -73,
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("bad_lat");
    });
  });
});
