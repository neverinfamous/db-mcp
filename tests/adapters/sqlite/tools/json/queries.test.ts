/**
 * JSON Helper Tools Tests - Queries
 *
 * Tests for SQLite JSON query tools:
 * select, query, validate path.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("JSON Query Tools", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create a test table with JSON column
    await adapter.executeWriteQuery(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY,
        data TEXT
      )
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

  describe("sqlite_json_select", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery(
        `INSERT INTO documents (id, data) VALUES
         (1, '{"user": {"name": "Alice", "email": "alice@test.com"}, "active": true}'),
         (2, '{"user": {"name": "Bob", "email": "bob@test.com"}, "active": false}')`,
      );
    });

    it("should select full JSON column", async () => {
      const result = (await tools.get("sqlite_json_select")?.({
        table: "documents",
        column: "data",
      })) as {
        success: boolean;
        rowCount: number;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it("should extract specific paths", async () => {
      const result = (await tools.get("sqlite_json_select")?.({
        table: "documents",
        column: "data",
        paths: ["$.user.name", "$.active"],
      })) as {
        success: boolean;
        rowCount: number;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
      // Should have extracted columns with unique names
      expect(result.rows[0]).toHaveProperty("name");
      expect(result.rows[0]).toHaveProperty("active");
    });

    it("should filter with where clause", async () => {
      const result = (await tools.get("sqlite_json_select")?.({
        table: "documents",
        column: "data",
        paths: ["$.user.name"],
        whereClause: "json_extract(data, '$.active') = true",
      })) as {
        success: boolean;
        rowCount: number;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]?.name).toBe("Alice");
    });

    it("should reject invalid paths", async () => {
      const result = (await tools.get("sqlite_json_select")?.({
        table: "documents",
        column: "data",
        paths: ["user.name"],
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON path must start with $");
    });

    it("should handle duplicate path column names", async () => {
      // Both paths extract 'name', should get name and name_2
      const result = (await tools.get("sqlite_json_select")?.({
        table: "documents",
        column: "data",
        paths: ["$.user.name", "$.user.name"],
      })) as {
        success: boolean;
        rowCount: number;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
      // Should have unique column names
      expect(result.rows[0]).toHaveProperty("name");
      expect(result.rows[0]).toHaveProperty("name_2");
    });

    it("should handle array index paths", async () => {
      // Insert data with array
      await adapter.executeWriteQuery(
        `INSERT INTO documents (id, data) VALUES
         (3, '{"items": [{"n": "first"}, {"n": "second"}]}')`,
      );

      const result = (await tools.get("sqlite_json_select")?.({
        table: "documents",
        column: "data",
        paths: ["$.items[0].n", "$[0]"],
        whereClause: "id = 3",
      })) as {
        success: boolean;
        rowCount: number;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_json_query", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery(
        `INSERT INTO documents (id, data) VALUES
         (1, '{"category": "tech", "price": 100}'),
         (2, '{"category": "books", "price": 25}'),
         (3, '{"category": "tech", "price": 200}')`,
      );
    });

    it("should query with filter paths", async () => {
      const result = (await tools.get("sqlite_json_query")?.({
        table: "documents",
        column: "data",
        filterPaths: { "$.category": "tech" },
      })) as {
        success: boolean;
        rowCount: number;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it("should select specific paths", async () => {
      const result = (await tools.get("sqlite_json_query")?.({
        table: "documents",
        column: "data",
        selectPaths: ["$.price"],
        filterPaths: { "$.category": "books" },
      })) as {
        success: boolean;
        rowCount: number;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]?.price).toBe(25);
    });

    it("should apply limit", async () => {
      const result = (await tools.get("sqlite_json_query")?.({
        table: "documents",
        column: "data",
        limit: 2,
      })) as {
        success: boolean;
        rowCount: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it("should reject invalid selectPaths", async () => {
      const result = (await tools.get("sqlite_json_query")?.({
        table: "documents",
        column: "data",
        selectPaths: ["price"], // missing $ prefix
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON path must start with $");
    });

    it("should reject invalid filterPaths", async () => {
      const result = (await tools.get("sqlite_json_query")?.({
        table: "documents",
        column: "data",
        filterPaths: { category: "tech" }, // missing $ prefix
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON path must start with $");
    });
  });

  describe("sqlite_json_validate_path", () => {
    it("should validate correct paths", async () => {
      const result = (await tools.get("sqlite_json_validate_path")?.({
        path: "$.user.name",
      })) as {
        success: boolean;
        path: string;
        valid: boolean;
      };

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it("should validate array index paths", async () => {
      const result = (await tools.get("sqlite_json_validate_path")?.({
        path: "$.items[0].price",
      })) as {
        success: boolean;
        valid: boolean;
      };

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it("should validate wildcard paths", async () => {
      const result = (await tools.get("sqlite_json_validate_path")?.({
        path: "$[*].name",
      })) as {
        success: boolean;
        valid: boolean;
      };

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it("should reject paths not starting with $", async () => {
      const result = (await tools.get("sqlite_json_validate_path")?.({
        path: "user.name",
      })) as {
        success: boolean;
        valid: boolean;
        issues: string[];
      };

      expect(result.success).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("Path must start with $");
    });

    it("should reject invalid syntax", async () => {
      const result = (await tools.get("sqlite_json_validate_path")?.({
        path: "$.user..name",
      })) as {
        success: boolean;
        valid: boolean;
        issues: string[];
      };

      expect(result.success).toBe(false);
      expect(result.valid).toBe(false);
    });
  });
});
