/**
 * JSON Tools Tests
 *
 * Tests for SQLite JSON1 tools.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../utils/test-adapter.js";

describe("JSON Tools", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    tools = new Map();
    const toolDefs = adapter.getToolDefinitions();
    const context = { scopes: ["read", "write", "admin"] };

    for (const tool of toolDefs) {
      tools.set(tool.name, (params) => tool.handler(params, context as never));
    }

    // Create test table with JSON data
    await adapter.executeWriteQuery(`
            CREATE TABLE profiles (
                id INTEGER PRIMARY KEY,
                data TEXT
            )
        `);
    await adapter.executeWriteQuery(`
            INSERT INTO profiles (data) VALUES 
            ('{"name": "Alice", "age": 30, "tags": ["developer", "gamer"]}'),
            ('{"name": "Bob", "age": 25, "tags": ["designer"]}')
        `);
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_json_valid", () => {
    it("should validate correct JSON", async () => {
      const result = (await tools.get("sqlite_json_valid")?.({
        json: '{"name": "test"}',
      })) as { valid: boolean };

      expect(result.valid).toBe(true);
    });

    it("should detect invalid JSON", async () => {
      const result = (await tools.get("sqlite_json_valid")?.({
        json: "{invalid json}",
      })) as { valid: boolean };

      expect(result.valid).toBe(false);
    });
  });

  describe("sqlite_json_extract", () => {
    it("should extract JSON values", async () => {
      const result = (await tools.get("sqlite_json_extract")?.({
        table: "profiles",
        column: "data",
        path: "$.name",
      })) as { values: unknown[] };

      expect(result.values).toContain("Alice");
      expect(result.values).toContain("Bob");
    });

    it("should extract nested JSON values", async () => {
      const result = (await tools.get("sqlite_json_extract")?.({
        table: "profiles",
        column: "data",
        path: "$.age",
      })) as { values: unknown[] };

      expect(result.values).toContain(30);
      expect(result.values).toContain(25);
    });
  });

  describe("sqlite_json_set", () => {
    it("should set JSON values", async () => {
      await tools.get("sqlite_json_set")?.({
        table: "profiles",
        column: "data",
        path: "$.country",
        value: "USA",
        whereClause: "id = 1",
      });

      const result = await adapter.executeReadQuery(
        "SELECT json_extract(data, '$.country') as country FROM profiles WHERE id = 1",
      );

      expect(result.rows?.[0]?.["country"]).toBe("USA");
    });

    it("should update existing JSON values", async () => {
      await tools.get("sqlite_json_set")?.({
        table: "profiles",
        column: "data",
        path: "$.age",
        value: 31,
        whereClause: "id = 1",
      });

      const result = await adapter.executeReadQuery(
        "SELECT json_extract(data, '$.age') as age FROM profiles WHERE id = 1",
      );

      expect(result.rows?.[0]?.["age"]).toBe(31);
    });
  });

  describe("sqlite_json_array_length", () => {
    it("should get array length", async () => {
      const result = (await tools.get("sqlite_json_array_length")?.({
        table: "profiles",
        column: "data",
        path: "$.tags",
      })) as { lengths: number[] };

      // Alice has 2 tags, Bob has 1
      expect(result.lengths).toContain(2);
      expect(result.lengths).toContain(1);
    });
  });

  describe("sqlite_json_insert", () => {
    it("should insert a new row with JSON data", async () => {
      const result = (await tools.get("sqlite_json_insert")?.({
        table: "profiles",
        column: "data",
        data: { name: "Charlie", age: 40 },
      })) as { success: boolean; rowsAffected: number; lastInsertRowid: number };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);

      const check = await adapter.executeReadQuery(
        `SELECT json_extract(data, '$.age') as age FROM profiles WHERE id = ${result.lastInsertRowid}`,
      );
      expect(check.rows?.[0]?.["age"]).toBe(40);
    });

    it("should fail validation if data is missing", async () => {
      const result = (await tools.get("sqlite_json_insert")?.({
        table: "profiles",
        column: "data",
      })) as { success: boolean; error: string; code: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("sqlite_json_validate_path", () => {
    it("should validate correct path", async () => {
      const result = (await tools.get("sqlite_json_validate_path")?.({
        path: "$.name",
      })) as { valid: boolean };

      expect(result.valid).toBe(true);
    });

    it("should reject invalid path", async () => {
      const result = (await tools.get("sqlite_json_validate_path")?.({
        path: "name", // Missing $
      })) as { valid: boolean; issues: string[] };

      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
    });
  });
});
