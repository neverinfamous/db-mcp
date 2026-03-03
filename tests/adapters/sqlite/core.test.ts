/**
 * Core Tools Tests
 *
 * Tests for SQLite core tools.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../utils/test-adapter.js";
import {
  isSpatialiteSystemIndex,
  isSpatialiteSystemTable,
  isSpatialiteSystemView,
} from "../../../src/adapters/sqlite/tools/core.js";

describe("Core Tools", () => {
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

  describe("sqlite_create_table", () => {
    it("should create a table", async () => {
      const result = await tools.get("sqlite_create_table")?.({
        tableName: "users",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "name", type: "TEXT" },
        ],
      });

      expect(result).toHaveProperty("success", true);

      const tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).toContain("users");
    });

    it("should handle SQL expression default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        tableName: "events",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "created_at", type: "TEXT", defaultValue: "datetime('now')" },
          {
            name: "updated_at",
            type: "TEXT",
            defaultValue: "CURRENT_TIMESTAMP",
          },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      // SQL expressions should be wrapped in parentheses
      expect(result.sql).toContain("(datetime('now'))");
      expect(result.sql).toContain("(CURRENT_TIMESTAMP)");
    });

    it("should handle string literal default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        tableName: "configs",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "status", type: "TEXT", defaultValue: "pending" },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      // String literals should be quoted
      expect(result.sql).toContain("DEFAULT 'pending'");
    });

    it("should handle numeric default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        tableName: "limits",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "max_count", type: "INTEGER", defaultValue: 100 },
          { name: "ratio", type: "REAL", defaultValue: 0.5 },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 100");
      expect(result.sql).toContain("DEFAULT 0.5");
    });

    it("should handle boolean default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        tableName: "flags",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "enabled", type: "INTEGER", defaultValue: true },
          { name: "visible", type: "INTEGER", defaultValue: false },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT true");
      expect(result.sql).toContain("DEFAULT false");
    });

    it("should handle null default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        tableName: "optionals",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "optional_field", type: "TEXT", defaultValue: null },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT NULL");
    });

    it("should handle object default values as JSON", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        tableName: "jsondata",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "metadata", type: "TEXT", defaultValue: { key: "value" } },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      // Objects should be JSON stringified and quoted
      expect(result.sql).toContain('DEFAULT \'{"key":"value"}\'');
    });

    it("should escape quotes in string default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        tableName: "quoted",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "message", type: "TEXT", defaultValue: "it's working" },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      // Single quotes should be escaped
      expect(result.sql).toContain("DEFAULT 'it''s working'");
    });

    it("should report existing table when using IF NOT EXISTS", async () => {
      // Create table first
      await tools.get("sqlite_create_table")?.({
        tableName: "existing",
        columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
        ifNotExists: true,
      });

      // Try to create again with IF NOT EXISTS
      const result = (await tools.get("sqlite_create_table")?.({
        tableName: "existing",
        columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
        ifNotExists: true,
      })) as { success: boolean; message: string };

      expect(result.success).toBe(true);
      expect(result.message).toContain("already exists");
    });
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
      const allResult = (await tools.get("sqlite_list_tables")?.({})) as {
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
  });

  describe("sqlite_read_query", () => {
    it("should execute read queries", async () => {
      await adapter.executeWriteQuery("CREATE TABLE data (value INTEGER)");
      await adapter.executeWriteQuery("INSERT INTO data VALUES (1), (2), (3)");

      const result = (await tools.get("sqlite_read_query")?.({
        query: "SELECT SUM(value) as total FROM data",
      })) as { rows: Record<string, unknown>[] };

      expect(result.rows[0]?.["total"]).toBe(6);
    });

    it("should reject write queries", async () => {
      const result = (await tools.get("sqlite_read_query")?.({
        query: "DROP TABLE users",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("sqlite_write_query", () => {
    it("should execute write queries", async () => {
      await adapter.executeWriteQuery("CREATE TABLE counter (n INTEGER)");

      const result = (await tools.get("sqlite_write_query")?.({
        query: "INSERT INTO counter VALUES (42)",
      })) as { rowsAffected: number };

      expect(result.rowsAffected).toBe(1);
    });
  });

  describe("sqlite_create_index", () => {
    it("should create an index", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE indexed (id INTEGER, name TEXT)",
      );

      const result = await tools.get("sqlite_create_index")?.({
        indexName: "idx_name",
        tableName: "indexed",
        columns: ["name"],
      });

      expect(result).toHaveProperty("success", true);
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
  });

  describe("sqlite_drop_table", () => {
    it("should drop a table", async () => {
      await adapter.executeWriteQuery("CREATE TABLE todrop (id INTEGER)");

      let tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).toContain("todrop");

      await tools.get("sqlite_drop_table")?.({ tableName: "todrop" });

      tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).not.toContain("todrop");
    });
  });

  describe("sqlite_drop_index", () => {
    it("should drop an index", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE idx_test (id INTEGER, name TEXT)",
      );
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_to_drop ON idx_test(name)",
      );

      const result = (await tools.get("sqlite_drop_index")?.({
        indexName: "idx_to_drop",
      })) as { success: boolean; message: string };

      expect(result.success).toBe(true);
      expect(result.message).toContain("dropped successfully");

      // Verify index is gone
      const indexes = (await tools.get("sqlite_get_indexes")?.({
        tableName: "idx_test",
      })) as { indexes: { name: string }[] };
      expect(indexes.indexes.map((i) => i.name)).not.toContain("idx_to_drop");
    });
  });

  // =========================================================================
  // Error Path Tests
  // =========================================================================

  describe("error paths", () => {
    describe("sqlite_describe_table errors", () => {
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

    describe("sqlite_read_query errors", () => {
      it("should return structured error for nonexistent table", async () => {
        const result = (await tools.get("sqlite_read_query")?.({
          query: "SELECT * FROM nonexistent_table_xyz",
        })) as { success: boolean; error?: string; rows: unknown[] };

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.rows).toEqual([]);
      });
    });

    describe("sqlite_write_query errors", () => {
      it("should reject SELECT statements", async () => {
        const result = (await tools.get("sqlite_write_query")?.({
          query: "SELECT * FROM sqlite_master",
        })) as { success: boolean; error?: string; rowsAffected: number };

        expect(result.success).toBe(false);
        expect(result.error).toContain("SELECT");
        expect(result.rowsAffected).toBe(0);
      });

      it("should reject DDL statements", async () => {
        await adapter.executeWriteQuery("CREATE TABLE ddl_test (id INTEGER)");

        const result = (await tools.get("sqlite_write_query")?.({
          query: "DROP TABLE ddl_test",
        })) as { success: boolean; error?: string; rowsAffected: number };

        expect(result.success).toBe(false);
        expect(result.error).toContain("DROP");
        expect(result.rowsAffected).toBe(0);

        // Table should still exist
        const tables = await adapter.listTables();
        expect(tables.map((t) => t.name)).toContain("ddl_test");
      });

      it("should reject CREATE statements", async () => {
        const result = (await tools.get("sqlite_write_query")?.({
          query: "CREATE TABLE hack (id INTEGER)",
        })) as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toContain("CREATE");
      });

      it("should return structured error for invalid DML", async () => {
        const result = (await tools.get("sqlite_write_query")?.({
          query: "INSERT INTO nonexistent_xyz VALUES (1)",
        })) as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe("sqlite_create_index errors", () => {
      it("should return structured error for nonexistent table", async () => {
        const result = (await tools.get("sqlite_create_index")?.({
          indexName: "idx_bad",
          tableName: "nonexistent_table_xyz",
          columns: ["col"],
        })) as { success: boolean; message: string };

        expect(result.success).toBe(false);
        expect(result.message).toBeDefined();
      });
    });

    describe("sqlite_drop_table errors", () => {
      it("should return informative message when table does not exist with ifExists", async () => {
        const result = (await tools.get("sqlite_drop_table")?.({
          tableName: "nonexistent_table_xyz",
          ifExists: true,
        })) as { success: boolean; message: string };

        expect(result.success).toBe(true);
        expect(result.message).toContain("does not exist");
      });

      it("should return error when table does not exist without ifExists", async () => {
        const result = (await tools.get("sqlite_drop_table")?.({
          tableName: "nonexistent_table_xyz",
          ifExists: false,
        })) as { success: boolean; message: string };

        expect(result.success).toBe(false);
        expect(result.message).toContain("does not exist");
      });
    });

    describe("sqlite_get_indexes errors", () => {
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

    describe("sqlite_drop_index errors", () => {
      it("should return informative message when index does not exist with ifExists", async () => {
        const result = (await tools.get("sqlite_drop_index")?.({
          indexName: "nonexistent_index_xyz",
          ifExists: true,
        })) as { success: boolean; message: string };

        expect(result.success).toBe(true);
        expect(result.message).toContain("does not exist");
      });

      it("should return error when index does not exist without ifExists", async () => {
        const result = (await tools.get("sqlite_drop_index")?.({
          indexName: "nonexistent_index_xyz",
          ifExists: false,
        })) as { success: boolean; message: string };

        expect(result.success).toBe(false);
        expect(result.message).toContain("does not exist");
      });
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
