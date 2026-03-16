/**
 * Core Tools Tests - Introspection
 *
 * Tests for SQLite core tools related to database introspection:
 * list_tables, describe_table, get_indexes, and SpatiaLite helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";
import {
  isSpatialiteSystemIndex,
  isSpatialiteSystemTable,
  isSpatialiteSystemView,
} from "../../../../src/adapters/sqlite/tools/core/index.js";

describe("Core Tools - Introspection", () => {
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

  describe("sqlite_list_tables", () => {
    it("should list tables", async () => {
      await adapter.executeWriteQuery("CREATE TABLE products (id INTEGER)");
      await adapter.executeWriteQuery("CREATE TABLE orders (id INTEGER)");

      const result = (await tools.get("sqlite_list_tables")?.({})) as {
        tables: { name: string }[];
      };

      expect(result.tables.map((t) => t.name)).toContain("products");
      expect(result.tables.map((t) => t.name)).toContain("orders");
    });

    it("should filter SpatiaLite system tables when excludeSystemTables is true", async () => {
      // Create a user table and simulate SpatiaLite metadata tables
      await adapter.executeWriteQuery("CREATE TABLE my_data (id INTEGER)");
      await adapter.executeWriteQuery(
        "CREATE TABLE geometry_columns (id INTEGER)",
      );
      await adapter.executeWriteQuery(
        "CREATE TABLE spatial_ref_sys (id INTEGER)",
      );

      // Without filter: should include all tables
      const allResult = (await tools.get("sqlite_list_tables")?.({
        excludeSystemTables: false,
      })) as {
        tables: { name: string }[];
      };
      expect(allResult.tables.map((t) => t.name)).toContain("geometry_columns");
      expect(allResult.tables.map((t) => t.name)).toContain("spatial_ref_sys");

      // With filter: should exclude SpatiaLite tables
      const filteredResult = (await tools.get("sqlite_list_tables")?.({
        excludeSystemTables: true,
      })) as {
        tables: { name: string }[];
      };
      expect(filteredResult.tables.map((t) => t.name)).toContain("my_data");
      expect(filteredResult.tables.map((t) => t.name)).not.toContain(
        "geometry_columns",
      );
      expect(filteredResult.tables.map((t) => t.name)).not.toContain(
        "spatial_ref_sys",
      );
    });
  });

  describe("sqlite_describe_table", () => {
    it("should describe table columns", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)",
      );

      const result = (await tools.get("sqlite_describe_table")?.({
        tableName: "items",
      })) as { columns: { name: string }[] };

      expect(result.columns.map((c) => c.name)).toContain("id");
      expect(result.columns.map((c) => c.name)).toContain("name");
    });

    it("should return TABLE_NOT_FOUND code for nonexistent table", async () => {
      const result = (await tools.get("sqlite_describe_table")?.({
        tableName: "nonexistent_table_xyz",
      })) as {
        success: boolean;
        error?: string;
        code?: string;
        suggestion?: string;
        columns: unknown[];
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
      expect(result.code).toBe("TABLE_NOT_FOUND");
      expect(result.suggestion).toBeDefined();
      expect(result.columns).toEqual([]);
    });
  });

  describe("sqlite_get_indexes", () => {
    it("should list indexes", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE indexed (id INTEGER, name TEXT)",
      );
      await adapter.executeWriteQuery("CREATE INDEX idx_test ON indexed(name)");

      const result = (await tools.get("sqlite_get_indexes")?.({
        tableName: "indexed",
      })) as { indexes: { name: string }[] };

      expect(result.indexes.length).toBeGreaterThan(0);
    });

    it("should filter system indexes when excludeSystemIndexes is true", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test_tbl (id INTEGER, name TEXT)",
      );
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_user ON test_tbl(name)",
      );
      // Simulate SpatiaLite system index
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_spatial_ref_sys_test ON test_tbl(id)",
      );

      // Without filter
      const allResult = (await tools.get("sqlite_get_indexes")?.({
        tableName: "test_tbl",
        excludeSystemIndexes: false,
      })) as { indexes: { name: string }[] };
      const allNames = allResult.indexes.map((i) => i.name);
      expect(allNames).toContain("idx_user");
      expect(allNames).toContain("idx_spatial_ref_sys_test");

      // With filter
      const filteredResult = (await tools.get("sqlite_get_indexes")?.({
        tableName: "test_tbl",
        excludeSystemIndexes: true,
      })) as { indexes: { name: string }[] };
      const filteredNames = filteredResult.indexes.map((i) => i.name);
      expect(filteredNames).toContain("idx_user");
      expect(filteredNames).not.toContain("idx_spatial_ref_sys_test");
    });

    it("should return TABLE_NOT_FOUND for nonexistent table", async () => {
      const result = (await tools.get("sqlite_get_indexes")?.({
        tableName: "nonexistent_table_xyz",
      })) as {
        success: boolean;
        error?: string;
        code?: string;
        indexes: unknown[];
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
      expect(result.code).toBe("TABLE_NOT_FOUND");
      expect(result.indexes).toEqual([]);
    });
  });
});

describe("SpatiaLite System Helpers", () => {
  describe("isSpatialiteSystemIndex", () => {
    it("should identify SpatiaLite system indexes", () => {
      expect(isSpatialiteSystemIndex("idx_spatial_ref_sys")).toBe(true);
      expect(isSpatialiteSystemIndex("idx_srid_geocols")).toBe(true);
      expect(isSpatialiteSystemIndex("idx_viewsjoin")).toBe(true);
      expect(isSpatialiteSystemIndex("idx_virtssrid")).toBe(true);
      expect(isSpatialiteSystemIndex("sqlite_autoindex_users_1")).toBe(true);
    });

    it("should identify indexes starting with system prefixes", () => {
      expect(isSpatialiteSystemIndex("idx_spatial_ref_sys_test")).toBe(true);
      expect(isSpatialiteSystemIndex("sqlite_autoindex_test")).toBe(true);
    });

    it("should not flag user indexes", () => {
      expect(isSpatialiteSystemIndex("idx_users_name")).toBe(false);
      expect(isSpatialiteSystemIndex("my_index")).toBe(false);
      expect(isSpatialiteSystemIndex("idx_custom")).toBe(false);
    });
  });

  describe("isSpatialiteSystemTable", () => {
    it("should identify SpatiaLite system tables", () => {
      expect(isSpatialiteSystemTable("geometry_columns")).toBe(true);
      expect(isSpatialiteSystemTable("spatial_ref_sys")).toBe(true);
      expect(isSpatialiteSystemTable("spatialite_history")).toBe(true);
    });

    it("should not flag user tables", () => {
      expect(isSpatialiteSystemTable("users")).toBe(false);
      expect(isSpatialiteSystemTable("my_geometry")).toBe(false);
    });
  });

  describe("isSpatialiteSystemView", () => {
    it("should identify SpatiaLite system views", () => {
      expect(isSpatialiteSystemView("geom_cols_ref_sys")).toBe(true);
      expect(isSpatialiteSystemView("spatial_ref_sys_all")).toBe(true);
      expect(isSpatialiteSystemView("vector_layers")).toBe(true);
      expect(isSpatialiteSystemView("vector_layers_auth")).toBe(true);
      expect(isSpatialiteSystemView("vector_layers_field_infos")).toBe(true);
      expect(isSpatialiteSystemView("vector_layers_statistics")).toBe(true);
    });

    it("should not flag user views", () => {
      expect(isSpatialiteSystemView("my_view")).toBe(false);
      expect(isSpatialiteSystemView("user_layers")).toBe(false);
    });
  });
});
