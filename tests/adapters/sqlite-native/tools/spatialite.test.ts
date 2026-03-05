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
      const result = (await tools.get("sqlite_spatialite_load")?.({})) as {
        success: boolean;
        message?: string;
        loaded?: boolean;
      };

      // Whether load succeeds or fails depends on SpatiaLite availability,
      // but it should always return a structured response
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("sqlite_spatialite_create_table", () => {
    it("should handle create table request", async () => {
      const result = (await tools.get("sqlite_spatialite_create_table")?.({
        tableName: "locations",
        geometryColumn: "geom",
        geometryType: "POINT",
        srid: 4326,
      })) as {
        success: boolean;
        message?: string;
      };

      // Returns structured response whether SpatiaLite is loaded or not
      expect(typeof result.success).toBe("boolean");
    });

    it("should return structured error for invalid table name", async () => {
      const result = (await tools.get("sqlite_spatialite_create_table")?.({
        tableName: "invalid-name!",
        geometryColumn: "geom",
        geometryType: "POINT",
        srid: 4326,
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
    });
  });

  describe("sqlite_spatialite_query", () => {
    it("should return structured error for nonexistent table", async () => {
      const result = (await tools.get("sqlite_spatialite_query")?.({
        query: "SELECT * FROM nonexistent_table",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("sqlite_spatialite_analyze", () => {
    it("should return structured error for nonexistent table", async () => {
      const result = (await tools.get("sqlite_spatialite_analyze")?.({
        analysisType: "spatial_extent",
        sourceTable: "nonexistent_table",
        geometryColumn: "geom",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for invalid table name", async () => {
      const result = (await tools.get("sqlite_spatialite_analyze")?.({
        analysisType: "spatial_extent",
        sourceTable: "invalid-name!",
        geometryColumn: "geom",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
    });
  });

  describe("sqlite_spatialite_index", () => {
    it("should return structured error for nonexistent table", async () => {
      const result = (await tools.get("sqlite_spatialite_index")?.({
        tableName: "nonexistent_table",
        geometryColumn: "geom",
        action: "create",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for invalid table name", async () => {
      const result = (await tools.get("sqlite_spatialite_index")?.({
        tableName: "invalid-name!",
        geometryColumn: "geom",
        action: "create",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
    });
  });

  describe("sqlite_spatialite_transform", () => {
    it("should return structured error for invalid geometry", async () => {
      const result = (await tools.get("sqlite_spatialite_transform")?.({
        operation: "centroid",
        geometry1: "INVALID_GEOMETRY",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("sqlite_spatialite_import", () => {
    it("should return structured error for nonexistent table", async () => {
      const result = (await tools.get("sqlite_spatialite_import")?.({
        tableName: "nonexistent_spatial_table",
        format: "wkt",
        data: "POINT(0 0)",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for invalid WKT", async () => {
      // First need a table to import into — the WKT validation should fail
      // before reaching the insert, so the table doesn't need to exist
      // for this specific test path
      const result = (await tools.get("sqlite_spatialite_import")?.({
        tableName: "nonexistent_spatial_table",
        format: "wkt",
        data: "INVALID_WKT_DATA",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
