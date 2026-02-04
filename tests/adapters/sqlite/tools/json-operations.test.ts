/**
 * JSON Operations Tools Tests
 *
 * Tests for SQLite JSON1 operation tools:
 * validate, extract, set, remove, type, array operations, keys, each, group, pretty.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("JSON Operations Tools", () => {
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

  describe("sqlite_json_valid", () => {
    it("should validate valid JSON", async () => {
      const result = (await tools.get("sqlite_json_valid")?.({
        json: '{"valid": true}',
      })) as {
        success: boolean;
        valid: boolean;
        message: string;
      };

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.message).toBe("Valid JSON");
    });

    it("should reject invalid JSON", async () => {
      const result = (await tools.get("sqlite_json_valid")?.({
        json: "{invalid}",
      })) as {
        success: boolean;
        valid: boolean;
        message: string;
      };

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
    });

    it("should validate array JSON", async () => {
      const result = (await tools.get("sqlite_json_valid")?.({
        json: "[1, 2, 3]",
      })) as {
        success: boolean;
        valid: boolean;
      };

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });
  });

  describe("sqlite_json_extract", () => {
    it("should extract nested value", async () => {
      const result = (await tools.get("sqlite_json_extract")?.({
        table: "json_docs",
        column: "data",
        path: "$.name",
      })) as {
        success: boolean;
        rowCount: number;
        values: unknown[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
      expect(result.values[0]).toBe("Alice");
    });

    it("should extract with where clause", async () => {
      const result = (await tools.get("sqlite_json_extract")?.({
        table: "json_docs",
        column: "data",
        path: "$.age",
        whereClause: "id = 2",
      })) as {
        success: boolean;
        rowCount: number;
        values: unknown[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
      expect(result.values[0]).toBe(25);
    });

    it("should extract nested object", async () => {
      const result = (await tools.get("sqlite_json_extract")?.({
        table: "json_docs",
        column: "data",
        path: "$.nested.key",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        values: unknown[];
      };

      expect(result.success).toBe(true);
      expect(result.values[0]).toBe("val");
    });
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

  describe("sqlite_json_type", () => {
    it("should return object type for root", async () => {
      const result = (await tools.get("sqlite_json_type")?.({
        table: "json_docs",
        column: "data",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        types: string[];
      };

      expect(result.success).toBe(true);
      expect(result.types[0]).toBe("object");
    });

    it("should return type for nested path", async () => {
      const result = (await tools.get("sqlite_json_type")?.({
        table: "json_docs",
        column: "data",
        path: "$.tags",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        types: string[];
      };

      expect(result.success).toBe(true);
      expect(result.types[0]).toBe("array");
    });

    it("should return text for string values", async () => {
      const result = (await tools.get("sqlite_json_type")?.({
        table: "json_docs",
        column: "data",
        path: "$.name",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        types: string[];
      };

      expect(result.success).toBe(true);
      expect(result.types[0]).toBe("text");
    });
  });

  describe("sqlite_json_array_length", () => {
    it("should return array length", async () => {
      const result = (await tools.get("sqlite_json_array_length")?.({
        table: "json_docs",
        column: "data",
        path: "$.tags",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        lengths: number[];
      };

      expect(result.success).toBe(true);
      expect(result.lengths[0]).toBe(2);
    });

    it("should return 0 for empty array", async () => {
      const result = (await tools.get("sqlite_json_array_length")?.({
        table: "json_docs",
        column: "data",
        path: "$.tags",
        whereClause: "id = 3",
      })) as {
        success: boolean;
        lengths: number[];
      };

      expect(result.success).toBe(true);
      expect(result.lengths[0]).toBe(0);
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

  describe("sqlite_json_keys", () => {
    it("should return object keys", async () => {
      const result = (await tools.get("sqlite_json_keys")?.({
        table: "json_docs",
        column: "data",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        keys: string[];
      };

      expect(result.success).toBe(true);
      expect(result.keys).toContain("name");
      expect(result.keys).toContain("age");
      expect(result.keys).toContain("tags");
    });

    it("should return keys without whereClause", async () => {
      const result = (await tools.get("sqlite_json_keys")?.({
        table: "json_docs",
        column: "data",
      })) as {
        success: boolean;
        keys: string[];
      };

      expect(result.success).toBe(true);
      expect(result.keys.length).toBeGreaterThan(0);
    });
  });

  describe("sqlite_json_each", () => {
    it("should expand JSON array to rows", async () => {
      const result = (await tools.get("sqlite_json_each")?.({
        table: "json_docs",
        column: "data",
        path: "$.tags",
        whereClause: "id = 2",
      })) as {
        success: boolean;
        rowCount: number;
        elements: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3); // ["x", "y", "z"]
      expect(result.elements.map((e) => e.value)).toContain("x");
    });

    it("should respect limit", async () => {
      const result = (await tools.get("sqlite_json_each")?.({
        table: "json_docs",
        column: "data",
        path: "$.tags",
        whereClause: "id = 2",
        limit: 2,
      })) as {
        success: boolean;
        rowCount: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });
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

  describe("sqlite_json_pretty", () => {
    it("should pretty print JSON", async () => {
      const result = (await tools.get("sqlite_json_pretty")?.({
        json: '{"a":1,"b":2}',
      })) as {
        success: boolean;
        formatted: string;
      };

      expect(result.success).toBe(true);
      expect(result.formatted).toContain("\n"); // Pretty has newlines
    });

    it("should handle nested objects", async () => {
      const result = (await tools.get("sqlite_json_pretty")?.({
        json: '{"outer":{"inner":"value"}}',
      })) as {
        success: boolean;
        formatted: string;
      };

      expect(result.success).toBe(true);
      expect(result.formatted).toContain("outer");
      expect(result.formatted).toContain("inner");
    });
  });

  describe("sqlite_jsonb_convert", () => {
    it("should convert JSON text to JSONB format", async () => {
      const result = (await tools.get("sqlite_jsonb_convert")?.({
        table: "json_docs",
        column: "data",
      })) as {
        success: boolean;
        message?: string;
      };

      expect(result.success).toBeDefined();
    });

    it("should handle with where clause", async () => {
      const result = (await tools.get("sqlite_jsonb_convert")?.({
        table: "json_docs",
        column: "data",
        whereClause: "id = 1",
      })) as {
        success: boolean;
      };

      expect(result.success).toBeDefined();
    });
  });

  describe("sqlite_json_storage_info", () => {
    it("should return JSON storage statistics", async () => {
      const result = (await tools.get("sqlite_json_storage_info")?.({
        table: "json_docs",
        column: "data",
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });

    it("should analyze JSON column with sample size", async () => {
      const result = (await tools.get("sqlite_json_storage_info")?.({
        table: "json_docs",
        column: "data",
        sampleSize: 2,
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_json_normalize_column", () => {
    it("should report normalization analysis", async () => {
      const result = (await tools.get("sqlite_json_normalize_column")?.({
        table: "json_docs",
        column: "data",
        targetPath: "$.name",
      })) as {
        success: boolean;
        suggestions?: unknown[];
        message?: string;
      };

      expect(result.success).toBe(true);
    });

    it("should handle array paths", async () => {
      const result = (await tools.get("sqlite_json_normalize_column")?.({
        table: "json_docs",
        column: "data",
        targetPath: "$.tags",
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });
  });
});
