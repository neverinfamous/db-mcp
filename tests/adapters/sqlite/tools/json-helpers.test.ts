/**
 * JSON Helper Tools Tests
 *
 * Tests for SQLite JSON helper tools:
 * insert, update, select, query, validate path, merge, analyze schema, create collection.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("JSON Helper Tools", () => {
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
      await expect(
        tools.get("sqlite_json_update")?.({
          table: "documents",
          column: "data",
          path: "title",
          value: "Bad",
          whereClause: "id = 1",
        }),
      ).rejects.toThrow("JSON path must start with $");
    });
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
      await expect(
        tools.get("sqlite_json_select")?.({
          table: "documents",
          column: "data",
          paths: ["user.name"],
        }),
      ).rejects.toThrow("JSON path must start with $");
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
      await expect(
        tools.get("sqlite_json_query")?.({
          table: "documents",
          column: "data",
          selectPaths: ["price"], // missing $ prefix
        }),
      ).rejects.toThrow("JSON path must start with $");
    });

    it("should reject invalid filterPaths", async () => {
      await expect(
        tools.get("sqlite_json_query")?.({
          table: "documents",
          column: "data",
          filterPaths: { category: "tech" }, // missing $ prefix
        }),
      ).rejects.toThrow("JSON path must start with $");
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
      await expect(
        tools.get("sqlite_create_json_collection")?.({
          tableName: "bad",
          indexes: [{ path: "name" }],
        }),
      ).rejects.toThrow("JSON path must start with $");
    });
  });
});
