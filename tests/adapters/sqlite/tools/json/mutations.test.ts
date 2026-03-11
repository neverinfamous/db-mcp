/**
 * JSON Helper Tools Tests - Mutations
 *
 * Tests for SQLite JSON mutation tools:
 * insert, update, merge.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("JSON Mutation Tools", () => {
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

  describe("sqlite_json_insert", () => {
    it("should insert JSON data as object", async () => {
      const result = (await tools.get("sqlite_json_insert")?.({
        table: "documents",
        column: "data",
        data: { name: "Alice", age: 30 },
      })) as {
        success: boolean;
        message: string;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);

      // Verify inserted data
      const check = await adapter.executeReadQuery(
        "SELECT data FROM documents",
      );
      expect(check.rows?.length).toBe(1);
      const parsed = JSON.parse(check.rows?.[0]?.data as string);
      expect(parsed.name).toBe("Alice");
    });

    it("should insert JSON data as string", async () => {
      const result = (await tools.get("sqlite_json_insert")?.({
        table: "documents",
        column: "data",
        data: '{"product": "Widget", "price": 9.99}',
      })) as {
        success: boolean;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it("should insert with additional columns", async () => {
      // Add another column
      await adapter.executeWriteQuery(
        "ALTER TABLE documents ADD COLUMN type TEXT",
      );

      const result = (await tools.get("sqlite_json_insert")?.({
        table: "documents",
        column: "data",
        data: { value: 100 },
        additionalColumns: { type: "metric" },
      })) as {
        success: boolean;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);

      const check = await adapter.executeReadQuery(
        "SELECT type FROM documents",
      );
      expect(check.rows?.[0]?.type).toBe("metric");
    });
  });

  describe("sqlite_json_update", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery(
        `INSERT INTO documents (id, data) VALUES (1, '{"title": "Old", "count": 0}')`,
      );
    });

    it("should update a string value at JSON path", async () => {
      const result = (await tools.get("sqlite_json_update")?.({
        table: "documents",
        column: "data",
        path: "$.title",
        value: "New Title",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        message: string;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);

      const check = await adapter.executeReadQuery(
        "SELECT json_extract(data, '$.title') as title FROM documents WHERE id = 1",
      );
      expect(check.rows?.[0]?.title).toBe("New Title");
    });

    it("should update a numeric value", async () => {
      const result = (await tools.get("sqlite_json_update")?.({
        table: "documents",
        column: "data",
        path: "$.count",
        value: 42,
        whereClause: "id = 1",
      })) as {
        success: boolean;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);

      const check = await adapter.executeReadQuery(
        "SELECT json_extract(data, '$.count') as count FROM documents WHERE id = 1",
      );
      expect(check.rows?.[0]?.count).toBe(42);
    });

    it("should reject paths not starting with $", async () => {
      const result = (await tools.get("sqlite_json_update")?.({
        table: "documents",
        column: "data",
        path: "title",
        value: "Bad",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON path must start with $");
    });
  });

  describe("sqlite_json_merge", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery(
        `INSERT INTO documents (id, data) VALUES (1, '{"name": "Product", "price": 50}')`,
      );
    });

    it("should merge JSON data", async () => {
      const result = (await tools.get("sqlite_json_merge")?.({
        table: "documents",
        column: "data",
        mergeData: { price: 75, inStock: true },
        whereClause: "id = 1",
      })) as {
        success: boolean;
        message: string;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);

      const check = await adapter.executeReadQuery(
        "SELECT data FROM documents WHERE id = 1",
      );
      const parsed = JSON.parse(check.rows?.[0]?.data as string);
      expect(parsed.price).toBe(75);
      expect(parsed.inStock).toBe(true);
      expect(parsed.name).toBe("Product"); // unchanged
    });
  });
});
