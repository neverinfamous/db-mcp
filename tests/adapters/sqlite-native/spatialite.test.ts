/**
 * SpatiaLite Tool Tests (Mock-based)
 *
 * Tests all 7 SpatiaLite tool creators from tools.ts and analysis.ts
 * using a mock adapter. Instead of mocking the loader module (fragile with ESM),
 * we mock getDatabase() to return a mock DB whose exec() succeeds,
 * which naturally satisfies isSpatialiteLoaded() and ensureSpatialite().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  createLoadSpatialiteTool,
  createSpatialTableTool,
  createSpatialQueryTool,
  createSpatialIndexTool,
} from "../../../src/adapters/sqlite-native/tools/spatialite/tools.js";
import {
  createSpatialAnalysisTool,
  createGeometryTransformTool,
  createSpatialImportTool,
} from "../../../src/adapters/sqlite-native/tools/spatialite/analysis.js";

const ctx = { timestamp: new Date(), requestId: "test" };

/**
 * Create a mock adapter with a mock DB object that satisfies spatialite checks.
 * The key: db.exec() doesn't throw → isSpatialiteLoaded() returns true
 * → ensureSpatialite() is effectively a no-op.
 */
function createMockAdapter() {
  const mockDb = {
    exec: vi.fn(), // doesn't throw = spatialite "loaded"
    loadExtension: vi.fn(), // for tryLoadSpatialite
  };
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
    getDatabase: vi.fn().mockReturnValue(mockDb),
    isNativeBackend: vi.fn().mockReturnValue(true),
    _mockDb: mockDb,
  } as any;
}

/**
 * Create a mock adapter where spatialite is NOT loaded.
 */
function createUnloadedAdapter() {
  const mockDb = {
    exec: vi.fn().mockImplementation(() => {
      throw new Error("no such function: spatialite_version");
    }),
    loadExtension: vi.fn().mockImplementation(() => {
      throw new Error("extension not found");
    }),
  };
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
    getDatabase: vi.fn().mockReturnValue(mockDb),
    isNativeBackend: vi.fn().mockReturnValue(true),
    _mockDb: mockDb,
  } as any;
}

// =============================================================================
// sqlite_spatialite_load
// =============================================================================

describe("createLoadSpatialiteTool", () => {
  it("should return correct metadata", () => {
    const tool = createLoadSpatialiteTool(createMockAdapter());
    expect(tool.name).toBe("sqlite_spatialite_load");
    expect(tool.group).toBe("geo");
  });

  it("should return already-loaded when loaded (forceReload=false)", async () => {
    const adapter = createMockAdapter();
    const tool = createLoadSpatialiteTool(adapter);
    // With mock DB where exec() doesn't throw, spatialite appears loaded
    const result = (await tool.handler({}, ctx)) as any;
    expect(result.success).toBe(true);
    expect(result.alreadyLoaded).toBe(true);
  });

  it("should force reload even when already loaded", async () => {
    const adapter = createMockAdapter();
    const tool = createLoadSpatialiteTool(adapter);
    const result = (await tool.handler({ forceReload: true }, ctx)) as any;
    expect(result.success).toBe(true);
    // Should have called loadExtension
    expect(result.alreadyLoaded).toBeUndefined();
  });

  it("should return error when load fails", async () => {
    const adapter = createUnloadedAdapter();
    const tool = createLoadSpatialiteTool(adapter);
    const result = (await tool.handler({ forceReload: true }, ctx)) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("SPATIALITE_LOAD_FAILED");
  });
});

// =============================================================================
// sqlite_spatialite_create_table
// =============================================================================

describe("createSpatialTableTool", () => {
  it("should create spatial table", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("sqlite_master")) return Promise.resolve({ rows: [] });
      if (sql.includes("AddGeometryColumn"))
        return Promise.resolve({ rows: [{ result: 1 }] });
      if (sql.includes("pragma_table_info"))
        return Promise.resolve({ rows: [{ name: "geom" }] });
      return Promise.resolve({ rows: [] });
    });
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });

    const tool = createSpatialTableTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "locations",
        geometryColumn: "geom",
        geometryType: "POINT",
        srid: 4326,
        additionalColumns: [{ name: "label", type: "TEXT" }],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.tableName).toBe("locations");
  });

  it("should return already-exists", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ name: "locations" }],
    });
    const tool = createSpatialTableTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "locations",
        geometryColumn: "geom",
        geometryType: "POINT",
        srid: 4326,
        additionalColumns: [],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.alreadyExists).toBe(true);
  });

  it("should reject invalid table name", async () => {
    const tool = createSpatialTableTool(createMockAdapter());
    const result = (await tool.handler(
      {
        tableName: "bad table!",
        geometryColumn: "geom",
        geometryType: "POINT",
        srid: 4326,
        additionalColumns: [],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("VALIDATION_ERROR");
  });

  it("should reject invalid column name", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createSpatialTableTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "mytable",
        geometryColumn: "geom",
        geometryType: "POINT",
        srid: 4326,
        additionalColumns: [{ name: "bad col!", type: "TEXT" }],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should handle failed geometry column creation", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("sqlite_master")) return Promise.resolve({ rows: [] });
      if (sql.includes("AddGeometryColumn"))
        return Promise.resolve({ rows: [{ result: 0 }] });
      if (sql.includes("pragma_table_info"))
        return Promise.resolve({ rows: [] }); // column NOT found
      return Promise.resolve({ rows: [] });
    });
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });

    const tool = createSpatialTableTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "mytable",
        geometryColumn: "geom",
        geometryType: "POINT",
        srid: 4326,
        additionalColumns: [],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("SPATIALITE_CREATE_FAILED");
  });
});

// =============================================================================
// sqlite_spatialite_query
// =============================================================================

describe("createSpatialQueryTool", () => {
  it("should execute spatial query", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ distance: 1.23 }, { distance: 4.56 }],
    });
    const tool = createSpatialQueryTool(adapter);
    const result = (await tool.handler(
      {
        query:
          "SELECT ST_Distance(a.geom, b.geom) as distance FROM places a, places b",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
  });

  it("should reject non-SELECT queries", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(
      new Error("does not return data"),
    );
    const tool = createSpatialQueryTool(adapter);
    const result = (await tool.handler(
      { query: "INSERT INTO places VALUES (1, 'test')" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("QUERY_NOT_SELECT");
  });
});

// =============================================================================
// sqlite_spatialite_index
// =============================================================================

describe("createSpatialIndexTool", () => {
  it("should create spatial index", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("sqlite_master") && sql.includes("name='idx_"))
        return Promise.resolve({ rows: [] }); // Index doesn't exist
      if (sql.includes("sqlite_master"))
        return Promise.resolve({ rows: [{ name: "places" }] }); // Table exists
      if (sql.includes("CreateSpatialIndex"))
        return Promise.resolve({ rows: [{ result: 1 }] });
      return Promise.resolve({ rows: [] });
    });
    const tool = createSpatialIndexTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", geometryColumn: "geom", action: "create" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.action).toBe("create");
  });

  it("should return already-exists for create", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("sqlite_master"))
        return Promise.resolve({ rows: [{ name: "idx" }] }); // both table & index exist
      return Promise.resolve({ rows: [] });
    });
    const tool = createSpatialIndexTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", geometryColumn: "geom", action: "create" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.alreadyExists).toBe(true);
  });

  it("should drop spatial index", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("name='idx_"))
        return Promise.resolve({ rows: [{ name: "idx_places_geom" }] });
      if (sql.includes("sqlite_master"))
        return Promise.resolve({ rows: [{ name: "places" }] });
      if (sql.includes("DisableSpatialIndex"))
        return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });
    const tool = createSpatialIndexTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", geometryColumn: "geom", action: "drop" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.action).toBe("drop");
  });

  it("should return already-dropped for drop", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("name='idx_")) return Promise.resolve({ rows: [] }); // No index
      if (sql.includes("sqlite_master"))
        return Promise.resolve({ rows: [{ name: "places" }] });
      return Promise.resolve({ rows: [] });
    });
    const tool = createSpatialIndexTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", geometryColumn: "geom", action: "drop" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.alreadyDropped).toBe(true);
  });

  it("should check valid index (returns 1)", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("name='idx_"))
        return Promise.resolve({ rows: [{ name: "idx_places_geom" }] });
      if (sql.includes("sqlite_master"))
        return Promise.resolve({ rows: [{ name: "places" }] });
      if (sql.includes("CheckSpatialIndex"))
        return Promise.resolve({ rows: [{ CheckSpatialIndex: 1 }] });
      return Promise.resolve({ rows: [] });
    });
    const tool = createSpatialIndexTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", geometryColumn: "geom", action: "check" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.indexed).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("should check invalid index (returns 0)", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("name='idx_"))
        return Promise.resolve({ rows: [{ name: "idx_places_geom" }] });
      if (sql.includes("sqlite_master"))
        return Promise.resolve({ rows: [{ name: "places" }] });
      if (sql.includes("CheckSpatialIndex"))
        return Promise.resolve({ rows: [{ CheckSpatialIndex: 0 }] });
      return Promise.resolve({ rows: [] });
    });
    const tool = createSpatialIndexTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", geometryColumn: "geom", action: "check" },
      ctx,
    )) as any;
    expect(result.indexed).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("should check inconclusive index (returns null)", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("name='idx_"))
        return Promise.resolve({ rows: [{ name: "idx_places_geom" }] });
      if (sql.includes("sqlite_master"))
        return Promise.resolve({ rows: [{ name: "places" }] });
      if (sql.includes("CheckSpatialIndex"))
        return Promise.resolve({ rows: [{ CheckSpatialIndex: null }] });
      return Promise.resolve({ rows: [] });
    });
    const tool = createSpatialIndexTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", geometryColumn: "geom", action: "check" },
      ctx,
    )) as any;
    expect(result.indexed).toBe(true);
    expect(result.valid).toBeNull();
  });

  it("should check no-index case", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("name='idx_")) return Promise.resolve({ rows: [] });
      if (sql.includes("sqlite_master"))
        return Promise.resolve({ rows: [{ name: "places" }] });
      return Promise.resolve({ rows: [] });
    });
    const tool = createSpatialIndexTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", geometryColumn: "geom", action: "check" },
      ctx,
    )) as any;
    expect(result.indexed).toBe(false);
  });

  it("should reject invalid table name", async () => {
    const tool = createSpatialIndexTool(createMockAdapter());
    const result = (await tool.handler(
      { tableName: "bad table!", geometryColumn: "geom", action: "create" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should reject invalid action", async () => {
    const tool = createSpatialIndexTool(createMockAdapter());
    const result = (await tool.handler(
      { tableName: "places", geometryColumn: "geom", action: "invalid" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Invalid action");
  });

  it("should reject when table not found", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createSpatialIndexTool(adapter);
    const result = (await tool.handler(
      { tableName: "nonexistent", geometryColumn: "geom", action: "create" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("TABLE_NOT_FOUND");
  });
});

// =============================================================================
// sqlite_spatialite_analyze
// =============================================================================

describe("createSpatialAnalysisTool", () => {
  it("should perform spatial_extent analysis", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ min_x: 0, min_y: 0, max_x: 10, max_y: 10, feature_count: 5 }],
    });
    const tool = createSpatialAnalysisTool(adapter);
    const result = (await tool.handler(
      {
        analysisType: "spatial_extent",
        sourceTable: "places",
        geometryColumn: "geom",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.analysisType).toBe("spatial_extent");
  });

  it("should perform nearest_neighbor analysis", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ source_id: 1, target_id: 2, distance: 1.5 }],
    });
    const tool = createSpatialAnalysisTool(adapter);
    const result = (await tool.handler(
      {
        analysisType: "nearest_neighbor",
        sourceTable: "places",
        targetTable: "shops",
        geometryColumn: "geom",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(1);
  });

  it("should handle nearest_neighbor self-exclusion with geometry", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createSpatialAnalysisTool(adapter);
    const result = (await tool.handler(
      {
        analysisType: "nearest_neighbor",
        sourceTable: "places",
        targetTable: "places",
        geometryColumn: "geom",
        excludeSelf: true,
        includeGeometry: true,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject nearest_neighbor without targetTable", async () => {
    const tool = createSpatialAnalysisTool(createMockAdapter());
    const result = (await tool.handler(
      {
        analysisType: "nearest_neighbor",
        sourceTable: "places",
        geometryColumn: "geom",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should perform point_in_polygon with geometry", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ source_id: 1, target_id: 2 }],
    });
    const tool = createSpatialAnalysisTool(adapter);
    const result = (await tool.handler(
      {
        analysisType: "point_in_polygon",
        sourceTable: "points",
        targetTable: "polygons",
        geometryColumn: "geom",
        includeGeometry: true,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject point_in_polygon without targetTable", async () => {
    const tool = createSpatialAnalysisTool(createMockAdapter());
    const result = (await tool.handler(
      {
        analysisType: "point_in_polygon",
        sourceTable: "points",
        geometryColumn: "geom",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should perform distance_matrix analysis", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ id1: 1, id2: 2, distance: 3.14 }],
    });
    const tool = createSpatialAnalysisTool(adapter);
    const result = (await tool.handler(
      {
        analysisType: "distance_matrix",
        sourceTable: "places",
        geometryColumn: "geom",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject invalid analysisType", async () => {
    const tool = createSpatialAnalysisTool(createMockAdapter());
    const result = (await tool.handler(
      {
        analysisType: "bogus",
        sourceTable: "places",
        geometryColumn: "geom",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should reject invalid source table name", async () => {
    const tool = createSpatialAnalysisTool(createMockAdapter());
    const result = (await tool.handler(
      {
        analysisType: "spatial_extent",
        sourceTable: "bad table!",
        geometryColumn: "geom",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should reject invalid target table name", async () => {
    const tool = createSpatialAnalysisTool(createMockAdapter());
    const result = (await tool.handler(
      {
        analysisType: "nearest_neighbor",
        sourceTable: "good",
        targetTable: "bad table!",
        geometryColumn: "geom",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_spatialite_transform
// =============================================================================

describe("createGeometryTransformTool", () => {
  it("should perform buffer operation", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ result: "POLYGON((...))" }],
    });
    const tool = createGeometryTransformTool(adapter);
    const result = (await tool.handler(
      {
        operation: "buffer",
        geometry1: "POINT(0 0)",
        distance: 10,
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.operation).toBe("buffer");
  });

  it("should perform centroid operation", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ result: "POINT(5 5)" }],
    });
    const tool = createGeometryTransformTool(adapter);
    const result = (await tool.handler(
      {
        operation: "centroid",
        geometry1: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))",
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.result).toBe("POINT(5 5)");
  });

  it("should perform envelope operation", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ result: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))" }],
    });
    const tool = createGeometryTransformTool(adapter);
    const result = (await tool.handler(
      {
        operation: "envelope",
        geometry1: "LINESTRING(0 0, 10 10)",
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should perform simplify operation", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ result: "POLYGON((0 0, 10 0, 10 10, 0 0))" }],
    });
    const tool = createGeometryTransformTool(adapter);
    const result = (await tool.handler(
      {
        operation: "simplify",
        geometry1: "POLYGON((0 0, 5 1, 10 0, 10 10, 5 9, 0 10, 0 0))",
        distance: 2,
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should perform intersection operation", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ result: "POLYGON((5 0, 10 0, 10 10, 5 10, 5 0))" }],
    });
    const tool = createGeometryTransformTool(adapter);
    const result = (await tool.handler(
      {
        operation: "intersection",
        geometry1: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))",
        geometry2: "POLYGON((5 0, 15 0, 15 10, 5 10, 5 0))",
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject intersection without geometry2", async () => {
    const tool = createGeometryTransformTool(createMockAdapter());
    const result = (await tool.handler(
      { operation: "intersection", geometry1: "POINT(0 0)", srid: 4326 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should perform union operation", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ result: "POLYGON((0 0, 15 0, 15 10, 0 10, 0 0))" }],
    });
    const tool = createGeometryTransformTool(adapter);
    const result = (await tool.handler(
      {
        operation: "union",
        geometry1: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))",
        geometry2: "POLYGON((5 0, 15 0, 15 10, 5 10, 5 0))",
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject union without geometry2", async () => {
    const tool = createGeometryTransformTool(createMockAdapter());
    const result = (await tool.handler(
      { operation: "union", geometry1: "POINT(0 0)", srid: 4326 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should perform difference operation", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ result: "POLYGON((0 0, 5 0, 5 10, 0 10, 0 0))" }],
    });
    const tool = createGeometryTransformTool(adapter);
    const result = (await tool.handler(
      {
        operation: "difference",
        geometry1: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))",
        geometry2: "POLYGON((5 0, 15 0, 15 10, 5 10, 5 0))",
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject difference without geometry2", async () => {
    const tool = createGeometryTransformTool(createMockAdapter());
    const result = (await tool.handler(
      { operation: "difference", geometry1: "POINT(0 0)", srid: 4326 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should reject invalid operation", async () => {
    const tool = createGeometryTransformTool(createMockAdapter());
    const result = (await tool.handler(
      { operation: "bogus", geometry1: "POINT(0 0)", srid: 4326 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should handle null result (invalid geometry)", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [{ result: null }] });
    const tool = createGeometryTransformTool(adapter);
    const result = (await tool.handler(
      { operation: "centroid", geometry1: "NOT_WKT", srid: 4326 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Invalid geometry");
  });
});

// =============================================================================
// sqlite_spatialite_import
// =============================================================================

describe("createSpatialImportTool", () => {
  it("should import WKT geometry", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ geom: "blob-data" }],
    });
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });

    const tool = createSpatialImportTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", data: "POINT(0 0)", format: "wkt", srid: 4326 },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowsAffected).toBe(1);
  });

  it("should import WKT with additional data", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ geom: "blob" }],
    });
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });

    const tool = createSpatialImportTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "places",
        data: "POINT(0 0)",
        format: "wkt",
        srid: 4326,
        additionalData: { name: "Test Place", value: 42 },
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject invalid WKT", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [{ geom: null }] });
    const tool = createSpatialImportTool(adapter);
    const result = (await tool.handler(
      { tableName: "places", data: "NOT_WKT", format: "wkt", srid: 4326 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Invalid WKT");
  });

  it("should import GeoJSON geometry", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createSpatialImportTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "places",
        data: '{"type":"Point","coordinates":[0,0]}',
        format: "geojson",
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowsAffected).toBe(1);
  });

  it("should import GeoJSON with additional data", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createSpatialImportTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "places",
        data: '{"type":"Point","coordinates":[0,0]}',
        format: "geojson",
        srid: 4326,
        additionalData: { label: "Test" },
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject invalid GeoJSON", async () => {
    const tool = createSpatialImportTool(createMockAdapter());
    const result = (await tool.handler(
      { tableName: "places", data: "not json", format: "geojson", srid: 4326 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Invalid GeoJSON");
  });

  it("should reject invalid format", async () => {
    const tool = createSpatialImportTool(createMockAdapter());
    const result = (await tool.handler(
      {
        tableName: "places",
        data: "POINT(0 0)",
        format: "invalid",
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Invalid format");
  });

  it("should reject invalid table name", async () => {
    const tool = createSpatialImportTool(createMockAdapter());
    const result = (await tool.handler(
      {
        tableName: "bad table!",
        data: "POINT(0 0)",
        format: "wkt",
        srid: 4326,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should reject invalid column names in additionalData (GeoJSON)", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createSpatialImportTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "places",
        data: '{"type":"Point","coordinates":[0,0]}',
        format: "geojson",
        srid: 4326,
        additionalData: { "bad col!": "x" },
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should reject invalid column names in additionalData (WKT)", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [{ geom: "blob" }] });
    const tool = createSpatialImportTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "places",
        data: "POINT(0 0)",
        format: "wkt",
        srid: 4326,
        additionalData: { "bad col!": "x" },
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});
