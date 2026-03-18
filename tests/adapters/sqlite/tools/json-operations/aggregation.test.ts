/**
 * JSON Operations Tools Tests - Aggregation
 *
 * Tests for SQLite JSON1 aggregation tools:
 * group_array, group_object.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("JSON Operations Tools - Aggregation", () => {
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

  describe("sqlite_json_group_array", () => {
    it("should aggregate values into array", async () => {
      const result = (await tools.get("sqlite_json_group_array")?.({
        table: "json_docs",
        valueColumn: "id",
      })) as {
        success: boolean;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rows.length).toBe(1);

      const arr = JSON.parse(result.rows[0]?.array_result as string);
      expect(arr).toContain(1);
      expect(arr).toContain(2);
      expect(arr).toContain(3);
    });

    it("should group by column with expressions", async () => {
      // Add more data for grouping
      await adapter.executeWriteQuery(`
        INSERT INTO json_docs (id, data) VALUES 
        (4, '{"name": "Dave", "age": 30}')
      `);

      const result = (await tools.get("sqlite_json_group_array")?.({
        table: "json_docs",
        valueColumn: "id",
        groupByColumn: "json_extract(data, '$.age')",
        allowExpressions: true,
      })) as {
        success: boolean;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      // Should have groups for each unique age
      expect(result.rows.length).toBeGreaterThan(1);
    });
  });

  describe("sqlite_json_group_object", () => {
    it("should create object from key-value columns", async () => {
      // Create a simple key-value table
      await adapter.executeWriteQuery(`
        CREATE TABLE settings (key TEXT, value TEXT)
      `);
      await adapter.executeWriteQuery(`
        INSERT INTO settings (key, value) VALUES 
        ('theme', 'dark'),
        ('lang', 'en'),
        ('timezone', 'UTC')
      `);

      const result = (await tools.get("sqlite_json_group_object")?.({
        table: "settings",
        keyColumn: "key",
        valueColumn: "value",
      })) as {
        success: boolean;
        rows: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rows.length).toBe(1);

      const obj = JSON.parse(result.rows[0]?.object_result as string);
      expect(obj.theme).toBe("dark");
      expect(obj.lang).toBe("en");
    });
  });
});
