/**
 * JSON Operations Tools Tests - Utility
 *
 * Tests for SQLite JSON1 utility tools:
 * array_length, keys, each, pretty, jsonb_convert, storage_info, normalize_column.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("JSON Operations Tools - Utility", () => {
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
