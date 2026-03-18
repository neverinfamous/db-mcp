/**
 * JSON Helper Tools Tests - Schema
 *
 * Tests for SQLite JSON schema tools:
 * analyze schema, create collection.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("JSON Schema Tools", () => {
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

  describe("sqlite_json_analyze_schema", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery(
        `INSERT INTO documents (id, data) VALUES
         (1, '{"name": "Alice", "age": 30, "tags": ["a", "b"]}'),
         (2, '{"name": "Bob", "age": 25, "email": "bob@test.com"}'),
         (3, '{"name": "Charlie", "age": null}')`,
      );
    });

    it("should analyze JSON schema", async () => {
      const result = (await tools.get("sqlite_json_analyze_schema")?.({
        table: "documents",
        column: "data",
        sampleSize: 10,
      })) as {
        success: boolean;
        schema: {
          type: string;
          properties: Record<
            string,
            { type: string; nullable: boolean; count: number }
          >;
          sampleSize: number;
        };
      };

      expect(result.success).toBe(true);
      expect(result.schema.type).toBe("object");
      expect(result.schema.sampleSize).toBe(3);

      // Check properties
      expect(result.schema.properties.name.type).toBe("string");
      expect(result.schema.properties.name.count).toBe(3);

      expect(result.schema.properties.age.nullable).toBe(true);

      expect(result.schema.properties.email.nullable).toBe(true);
      expect(result.schema.properties.email.count).toBe(1);

      expect(result.schema.properties.tags.type).toBe("array");
    });

    it("should handle mixed types in property values", async () => {
      await adapter.executeWriteQuery("DELETE FROM documents");
      // Insert data where 'value' has different types
      await adapter.executeWriteQuery(
        `INSERT INTO documents (id, data) VALUES
         (1, '{"value": "string"}'),
         (2, '{"value": 42}'),
         (3, '{"value": true}')`,
      );

      const result = (await tools.get("sqlite_json_analyze_schema")?.({
        table: "documents",
        column: "data",
        sampleSize: 10,
      })) as {
        success: boolean;
        schema: {
          properties: Record<string, { type: string }>;
        };
      };

      expect(result.success).toBe(true);
      // Should detect mixed types
      expect(result.schema.properties.value.type).toBe("mixed");
    });

    it("should handle null JSON data gracefully", async () => {
      await adapter.executeWriteQuery("DELETE FROM documents");
      // Null data and valid data
      await adapter.executeWriteQuery(
        `INSERT INTO documents (id, data) VALUES
         (1, null),
         (2, null),
         (3, '{"name": "Valid"}')`,
      );

      const result = (await tools.get("sqlite_json_analyze_schema")?.({
        table: "documents",
        column: "data",
        sampleSize: 10,
      })) as {
        success: boolean;
        schema: {
          sampleSize: number;
          nullCount: number;
        };
      };

      expect(result.success).toBe(true);
      expect(result.schema.nullCount).toBe(2);
    });
  });

  describe("sqlite_create_json_collection", () => {
    it("should create a JSON collection table", async () => {
      const result = (await tools.get("sqlite_create_json_collection")?.({
        tableName: "users",
      })) as {
        success: boolean;
        message: string;
        sql: string[];
        indexCount: number;
      };

      expect(result.success).toBe(true);
      expect(result.message).toContain("users");
      expect(result.sql.length).toBeGreaterThan(0);

      // Verify table exists
      const check = await adapter.executeReadQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
      );
      expect(check.rows?.length).toBe(1);
    });

    it("should create with timestamps", async () => {
      const result = (await tools.get("sqlite_create_json_collection")?.({
        tableName: "events",
        timestamps: true,
      })) as {
        success: boolean;
        sql: string[];
      };

      expect(result.success).toBe(true);
      expect(result.sql[0]).toContain("created_at");
      expect(result.sql[0]).toContain("updated_at");
    });

    it("should create with indexes", async () => {
      const result = (await tools.get("sqlite_create_json_collection")?.({
        tableName: "products",
        indexes: [
          { path: "$.name" },
          { path: "$.category", name: "idx_category" },
        ],
      })) as {
        success: boolean;
        indexCount: number;
        sql: string[];
      };

      expect(result.success).toBe(true);
      expect(result.indexCount).toBe(2);
      expect(result.sql.length).toBe(3); // CREATE TABLE + 2 indexes
    });

    it("should use custom column names", async () => {
      const result = (await tools.get("sqlite_create_json_collection")?.({
        tableName: "custom",
        idColumn: "doc_id",
        dataColumn: "content",
      })) as {
        success: boolean;
        sql: string[];
      };

      expect(result.success).toBe(true);
      expect(result.sql[0]).toContain("doc_id");
      expect(result.sql[0]).toContain("content");
    });

    it("should reject invalid index paths", async () => {
      const result = (await tools.get("sqlite_create_json_collection")?.({
        tableName: "bad",
        indexes: [{ path: "name" }],
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON path must start with $");
    });
  });
});
