/**
 * JSON Operations Tools Tests - Core
 *
 * Tests for SQLite JSON1 core operation tools:
 * validate, extract, type.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("JSON Operations Tools - Core", () => {
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
});
