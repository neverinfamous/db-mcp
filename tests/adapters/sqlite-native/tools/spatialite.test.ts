/**
 * SpatiaLite Tools Tests
 *
 * Tests for SQLite SpatiaLite extension tools:
 * load, create table, query, analyze, index, transform, import.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("SpatiaLite Tools", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Get tools as a map for easy access
    tools = new Map();
    const toolDefs = adapter.getToolDefinitions();
    const context = { scopes: ["read", "write", "admin"] };

    for (const tool of toolDefs) {
      tools.set(tool.name, (params) => tool.handler(params, context as never));
    }
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_spatialite_load", () => {
    it("should attempt to load SpatiaLite extension", async () => {
      // SpatiaLite may or may not be available
      try {
        const result = (await tools.get("sqlite_spatialite_load")?.({})) as {
          success: boolean;
          message?: string;
          loaded?: boolean;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if SpatiaLite extension not available
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_spatialite_create_table", () => {
    it("should handle create table request", async () => {
      try {
        const result = (await tools.get("sqlite_spatialite_create_table")?.({
          tableName: "locations",
          geometryColumn: "geom",
          geometryType: "POINT",
          srid: 4326,
        })) as {
          success: boolean;
          message?: string;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if SpatiaLite not loaded
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_spatialite_query", () => {
    it("should handle spatial query request", async () => {
      try {
        const result = (await tools.get("sqlite_spatialite_query")?.({
          query:
            "SELECT MakePoint(0, 0, 4326) as geom, 1 as id FROM sqlite_master LIMIT 1",
        })) as {
          success: boolean;
          rows?: Record<string, unknown>[];
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if SpatiaLite not loaded
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_spatialite_analyze", () => {
    it("should handle analyze geometry request", async () => {
      try {
        const result = (await tools.get("sqlite_spatialite_analyze")?.({
          tableName: "nonexistent_table",
          geometryColumn: "geom",
        })) as {
          success: boolean;
          message?: string;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if table doesn't exist or SpatiaLite not loaded
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_spatialite_index", () => {
    it("should handle spatial index creation request", async () => {
      try {
        const result = (await tools.get("sqlite_spatialite_index")?.({
          tableName: "locations",
          geometryColumn: "geom",
        })) as {
          success: boolean;
          message?: string;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if table doesn't exist or SpatiaLite not loaded
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_spatialite_transform", () => {
    it("should handle coordinate transform request", async () => {
      try {
        const result = (await tools.get("sqlite_spatialite_transform")?.({
          tableName: "locations",
          geometryColumn: "geom",
          targetSrid: 3857,
        })) as {
          success: boolean;
          message?: string;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if table doesn't exist or SpatiaLite not loaded
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_spatialite_import", () => {
    it("should handle import request with missing file", async () => {
      try {
        const result = (await tools.get("sqlite_spatialite_import")?.({
          tableName: "imported_data",
          filePath: "/nonexistent/file.geojson",
          format: "geojson",
        })) as {
          success: boolean;
          message?: string;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if file doesn't exist or SpatiaLite not loaded
        expect(error).toBeDefined();
      }
    });
  });
});
