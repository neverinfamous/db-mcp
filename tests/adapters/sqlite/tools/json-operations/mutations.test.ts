/**
 * JSON Operations Tools Tests - Mutations
 *
 * Tests for SQLite JSON1 mutation tools:
 * set, remove, array_append.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("JSON Operations Tools - Mutations", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create test tables
    await adapter.executeWriteQuery(`
      CREATE TABLE json_docs (
        id INTEGER PRIMARY KEY,
        data TEXT
      )
    `);

    // Insert test data
    await adapter.executeWriteQuery(`
      INSERT INTO json_docs (id, data) VALUES 
      (1, '{"name": "Alice", "age": 30, "tags": ["a", "b"], "nested": {"key": "val"}}'),
      (2, '{"name": "Bob", "age": 25, "tags": ["x", "y", "z"], "nested": {"key": "other"}}'),
      (3, '{"name": "Charlie", "age": 35, "tags": []}')
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

  describe("sqlite_json_set", () => {
    it("should set a value at path", async () => {
      const result = (await tools.get("sqlite_json_set")?.({
        table: "json_docs",
        column: "data",
        path: "$.status",
        value: "active",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);

      // Verify
      const check = await adapter.executeReadQuery(
        "SELECT json_extract(data, '$.status') as status FROM json_docs WHERE id = 1",
      );
      expect(check.rows?.[0]?.status).toBe("active");
    });

    it("should update existing value", async () => {
      const result = (await tools.get("sqlite_json_set")?.({
        table: "json_docs",
        column: "data",
        path: "$.age",
        value: 31,
        whereClause: "id = 1",
      })) as {
        success: boolean;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);

      const check = await adapter.executeReadQuery(
        "SELECT json_extract(data, '$.age') as age FROM json_docs WHERE id = 1",
      );
      expect(check.rows?.[0]?.age).toBe(31);
    });
  });

  describe("sqlite_json_remove", () => {
    it("should remove a key from JSON", async () => {
      const result = (await tools.get("sqlite_json_remove")?.({
        table: "json_docs",
        column: "data",
        path: "$.age",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);

      // Verify key is removed
      const check = await adapter.executeReadQuery(
        "SELECT json_extract(data, '$.age') as age FROM json_docs WHERE id = 1",
      );
      expect(check.rows?.[0]?.age).toBeNull();
    });
  });

  describe("sqlite_json_array_append", () => {
    it("should append value to array", async () => {
      const result = (await tools.get("sqlite_json_array_append")?.({
        table: "json_docs",
        column: "data",
        path: "$.tags",
        value: "new",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);

      // Verify
      const check = await adapter.executeReadQuery(
        "SELECT json_array_length(data, '$.tags') as len FROM json_docs WHERE id = 1",
      );
      expect(check.rows?.[0]?.len).toBe(3);
    });
  });
});
