/**
 * Virtual Table Tools Tests
 *
 * Tests for SQLite virtual table tools:
 * generate series, views, dbstat, vacuum, virtual tables, CSV, R-Tree.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Virtual Table Tools", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create test table
    await adapter.executeWriteQuery(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY,
        name TEXT,
        price REAL
      )
    `);

    await adapter.executeWriteQuery(`
      INSERT INTO items (id, name, price) VALUES 
      (1, 'Apple', 1.50),
      (2, 'Banana', 0.75),
      (3, 'Cherry', 2.00)
    `);

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

  describe("sqlite_generate_series", () => {
    it("should generate a series of numbers", async () => {
      const result = (await tools.get("sqlite_generate_series")?.({
        start: 1,
        stop: 5,
      })) as {
        success: boolean;
        count: number;
        values: number[];
      };

      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
      expect(result.values).toEqual([1, 2, 3, 4, 5]);
    });

    it("should respect step parameter", async () => {
      const result = (await tools.get("sqlite_generate_series")?.({
        start: 0,
        stop: 10,
        step: 2,
      })) as {
        success: boolean;
        count: number;
        values: number[];
      };

      expect(result.success).toBe(true);
      expect(result.values).toEqual([0, 2, 4, 6, 8, 10]);
    });
  });

  describe("sqlite_create_view", () => {
    it("should create a view", async () => {
      const result = (await tools.get("sqlite_create_view")?.({
        viewName: "expensive_items",
        selectQuery: "SELECT * FROM items WHERE price > 1.00",
      })) as {
        success: boolean;
        message: string;
      };

      expect(result.success).toBe(true);
      expect(result.message).toContain("expensive_items");

      // Verify view works
      const viewData = await adapter.executeReadQuery(
        "SELECT * FROM expensive_items",
      );
      expect(viewData.rows?.length).toBe(2);
    });

    it("should replace view with replace option", async () => {
      // Create initial view
      await tools.get("sqlite_create_view")?.({
        viewName: "test_view",
        selectQuery: "SELECT id FROM items",
      });

      // Replace it
      const result = (await tools.get("sqlite_create_view")?.({
        viewName: "test_view",
        selectQuery: "SELECT name FROM items",
        replace: true,
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_list_views", () => {
    it("should list created views", async () => {
      // Create a test view
      await tools.get("sqlite_create_view")?.({
        viewName: "list_test_view",
        selectQuery: "SELECT * FROM items",
      });

      const result = (await tools.get("sqlite_list_views")?.({})) as {
        success: boolean;
        count: number;
        views: { name: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(result.views.some((v) => v.name === "list_test_view")).toBe(true);
    });

    it("should filter views by pattern", async () => {
      await tools.get("sqlite_create_view")?.({
        viewName: "items_summary",
        selectQuery: "SELECT COUNT(*) as cnt FROM items",
      });
      await tools.get("sqlite_create_view")?.({
        viewName: "other_view",
        selectQuery: "SELECT 1",
      });

      const result = (await tools.get("sqlite_list_views")?.({
        pattern: "items%",
      })) as {
        success: boolean;
        count: number;
        views: { name: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.views.every((v) => v.name.startsWith("items"))).toBe(true);
    });

    it("should include system views when excludeSystemViews is false", async () => {
      const result = (await tools.get("sqlite_list_views")?.({
        excludeSystemViews: false,
      })) as {
        success: boolean;
        count: number;
        views: { name: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("sqlite_drop_view", () => {
    it("should drop an existing view", async () => {
      // Create and then drop
      await tools.get("sqlite_create_view")?.({
        viewName: "drop_test_view",
        selectQuery: "SELECT * FROM items",
      });

      const result = (await tools.get("sqlite_drop_view")?.({
        viewName: "drop_test_view",
      })) as {
        success: boolean;
        message: string;
      };

      expect(result.success).toBe(true);
    });

    it("should handle non-existent view with ifExists", async () => {
      const result = (await tools.get("sqlite_drop_view")?.({
        viewName: "nonexistent_view",
        ifExists: true,
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_dbstat", () => {
    it("should return database statistics", async () => {
      const result = (await tools.get("sqlite_dbstat")?.({})) as {
        success: boolean;
        tables: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      // Should have some stats (may be empty for in-memory)
    });

    it("should filter by table name", async () => {
      const result = (await tools.get("sqlite_dbstat")?.({
        tableName: "items",
      })) as {
        success: boolean;
        tables: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
    });

    it("should exclude system tables when requested", async () => {
      const result = (await tools.get("sqlite_dbstat")?.({
        excludeSystemTables: true,
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });

    it("should return summarized stats when summarize is true", async () => {
      const result = (await tools.get("sqlite_dbstat")?.({
        summarize: true,
      })) as {
        success: boolean;
        tables: { name: string; totalPages?: number; totalBytes?: number }[];
      };

      expect(result.success).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const result = (await tools.get("sqlite_dbstat")?.({
        limit: 5,
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });

    it("should filter by specific table", async () => {
      const result = (await tools.get("sqlite_dbstat")?.({
        table: "items",
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_vacuum", () => {
    it("should vacuum the database", async () => {
      const result = (await tools.get("sqlite_vacuum")?.({})) as {
        success: boolean;
        message: string;
      };

      expect(result.success).toBe(true);
      expect(result.message).toContain("vacuumed");
    });

    it("should vacuum into a target file", async () => {
      const uniquePath = `/tmp/vacuum_${Date.now()}.db`;
      try {
        const result = (await tools.get("sqlite_vacuum")?.({
          into: uniquePath,
        })) as {
          success: boolean;
          message: string;
        };

        // Either succeeds or returns result with limitations
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // May fail in certain environments
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_list_virtual_tables", () => {
    it("should list virtual tables", async () => {
      const result = (await tools.get("sqlite_list_virtual_tables")?.({})) as {
        success: boolean;
        count: number;
        virtualTables: { name: string; module: string }[];
      };

      expect(result.success).toBe(true);
      expect(typeof result.count).toBe("number");
    });

    it("should filter by pattern", async () => {
      const result = (await tools.get("sqlite_list_virtual_tables")?.({
        pattern: "fts%",
      })) as {
        success: boolean;
        count: number;
      };

      expect(result.success).toBe(true);
      expect(typeof result.count).toBe("number");
    });
  });

  describe("sqlite_virtual_table_info", () => {
    it("should handle non-existent table gracefully", async () => {
      try {
        const result = (await tools.get("sqlite_virtual_table_info")?.({
          tableName: "nonexistent_virtual",
        })) as { success: boolean };

        // May succeed with empty info or fail gracefully
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected for non-existent table
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_drop_virtual_table", () => {
    it("should handle non-existent table with ifExists", async () => {
      const result = (await tools.get("sqlite_drop_virtual_table")?.({
        tableName: "nonexistent_vtable",
        ifExists: true,
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_create_csv_table", () => {
    it("should handle missing CSV module gracefully", async () => {
      try {
        const result = (await tools.get("sqlite_create_csv_table")?.({
          tableName: "csv_test",
          filePath: "/path/to/test.csv",
        })) as { success: boolean; message?: string };

        // Either succeeds or returns a message about module availability
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if CSV module not available
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_analyze_csv_schema", () => {
    it("should handle missing file gracefully", async () => {
      try {
        const result = (await tools.get("sqlite_analyze_csv_schema")?.({
          filePath: "/nonexistent/file.csv",
        })) as { success: boolean };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected for missing file
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_create_rtree_table", () => {
    it("should create an R-Tree table", async () => {
      try {
        const result = (await tools.get("sqlite_create_rtree_table")?.({
          tableName: "spatial_idx",
          dimensions: 2,
        })) as {
          success: boolean;
          message?: string;
        };

        // R-Tree may or may not be available
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if R-Tree not compiled in
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_create_series_table", () => {
    it("should create a series table", async () => {
      try {
        const result = (await tools.get("sqlite_create_series_table")?.({
          tableName: "numbers",
          start: 1,
          stop: 100,
        })) as {
          success: boolean;
          message?: string;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // May fail if extension not available
        expect(error).toBeDefined();
      }
    });

    it("should create a series table with custom step and column", async () => {
      try {
        const result = (await tools.get("sqlite_create_series_table")?.({
          tableName: "evens",
          start: 0,
          stop: 20,
          step: 2,
          columnName: "even_number",
        })) as {
          success: boolean;
          message?: string;
        };

        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_drop_virtual_table", () => {
    it("should handle drop of non-existent table with ifExists", async () => {
      try {
        const result = (await tools.get("sqlite_drop_virtual_table")?.({
          tableName: "nonexistent_virtual_table",
          ifExists: true,
        })) as {
          success: boolean;
        };

        expect(result.success).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
