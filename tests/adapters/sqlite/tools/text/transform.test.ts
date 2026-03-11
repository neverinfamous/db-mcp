/**
 * Text Processing Tools Tests - Transform
 *
 * Tests for SQLite transform tools:
 * text_split, text_concat, text_replace, text_trim, text_case, text_substring
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("Text Transform Tools", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create test table with text data
    await adapter.executeWriteQuery(`
      CREATE TABLE texts (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        description TEXT
      )
    `);

    // Insert test data
    await adapter.executeWriteQuery(`
      INSERT INTO texts (id, name, email, description) VALUES
      (1, 'Alice Smith', 'alice@example.com', 'Hello World'),
      (2, 'Bob Johnson', 'bob@test.org', 'Testing 123'),
      (3, 'Charlie Brown', 'charlie@demo.net', 'Sample Text Here'),
      (4, 'Allice Smyth', 'allice@example.com', 'Similar Name'),
      (5, 'Robert Jones', 'robert@example.com', '  Needs Trimming  ')
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

  describe("sqlite_text_split", () => {
    it("should split text by delimiter", async () => {
      const result = (await tools.get("sqlite_text_split")?.({
        table: "texts",
        column: "email",
        delimiter: "@",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        rowCount: number;
        rows: { parts: string[] }[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]?.parts).toContain("alice");
      expect(result.rows[0]?.parts).toContain("example.com");
    });
  });

  describe("sqlite_text_concat", () => {
    it("should concatenate columns", async () => {
      const result = (await tools.get("sqlite_text_concat")?.({
        table: "texts",
        columns: ["name", "email"],
        separator: " - ",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        rowCount: number;
        values: string[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
      expect(result.values[0]).toContain("Alice Smith");
      expect(result.values[0]).toContain("alice@example.com");
    });
  });

  describe("sqlite_text_replace", () => {
    it("should replace text", async () => {
      const result = (await tools.get("sqlite_text_replace")?.({
        table: "texts",
        column: "description",
        searchPattern: "World",
        replaceWith: "Universe",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        rowsAffected: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);

      // Verify replacement
      const after = await adapter.executeReadQuery(
        "SELECT description FROM texts WHERE id = 1",
      );
      expect(after.rows?.[0]?.description).toBe("Hello Universe");
    });
  });

  describe("sqlite_text_trim", () => {
    it("should trim whitespace from both sides", async () => {
      const result = (await tools.get("sqlite_text_trim")?.({
        table: "texts",
        column: "description",
        mode: "both",
        whereClause: "id = 5",
      })) as {
        success: boolean;
        rowCount: number;
        results: { trimmed: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.results[0]?.trimmed).toBe("Needs Trimming");
    });

    it("should trim left only", async () => {
      const result = (await tools.get("sqlite_text_trim")?.({
        table: "texts",
        column: "description",
        mode: "left",
        whereClause: "id = 5",
      })) as {
        success: boolean;
        results: { trimmed: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.results[0]?.trimmed).toBe("Needs Trimming  ");
    });
  });

  describe("sqlite_text_case", () => {
    it("should convert to uppercase", async () => {
      const result = (await tools.get("sqlite_text_case")?.({
        table: "texts",
        column: "name",
        mode: "upper",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        results: { transformed: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.results[0]?.transformed).toBe("ALICE SMITH");
    });

    it("should convert to lowercase", async () => {
      const result = (await tools.get("sqlite_text_case")?.({
        table: "texts",
        column: "name",
        mode: "lower",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        results: { transformed: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.results[0]?.transformed).toBe("alice smith");
    });
  });

  describe("sqlite_text_substring", () => {
    it("should extract substring", async () => {
      const result = (await tools.get("sqlite_text_substring")?.({
        table: "texts",
        column: "email",
        start: 1,
        length: 5,
        whereClause: "id = 1",
      })) as {
        success: boolean;
        results: { substring: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.results[0]?.substring).toBe("alice");
    });
  });

  describe("Error path testing", () => {
    it("should return structured error for text_split on nonexistent table", async () => {
      const result = (await tools.get("sqlite_text_split")?.({
        table: "nonexistent_xyz",
        column: "x",
        delimiter: ",",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for text_concat on nonexistent table", async () => {
      const result = (await tools.get("sqlite_text_concat")?.({
        table: "nonexistent_xyz",
        columns: ["x", "y"],
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for text_replace on nonexistent table", async () => {
      const result = (await tools.get("sqlite_text_replace")?.({
        table: "nonexistent_xyz",
        column: "x",
        searchPattern: "a",
        replaceWith: "b",
        whereClause: "id = 1",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for text_trim on nonexistent table", async () => {
      const result = (await tools.get("sqlite_text_trim")?.({
        table: "nonexistent_xyz",
        column: "x",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for text_case on nonexistent table", async () => {
      const result = (await tools.get("sqlite_text_case")?.({
        table: "nonexistent_xyz",
        column: "x",
        mode: "upper",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for text_substring on nonexistent table", async () => {
      const result = (await tools.get("sqlite_text_substring")?.({
        table: "nonexistent_xyz",
        column: "x",
        start: 1,
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for text_split on nonexistent column", async () => {
      const result = (await tools.get("sqlite_text_split")?.({
        table: "texts",
        column: "nonexistent_col",
        delimiter: ",",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return structured error for text_concat on nonexistent column", async () => {
      const result = (await tools.get("sqlite_text_concat")?.({
        table: "texts",
        columns: ["name", "nonexistent_col"],
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return structured error for text_trim on nonexistent column", async () => {
      const result = (await tools.get("sqlite_text_trim")?.({
        table: "texts",
        column: "nonexistent_col",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return structured error for text_case on nonexistent column", async () => {
      const result = (await tools.get("sqlite_text_case")?.({
        table: "texts",
        column: "nonexistent_col",
        mode: "upper",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return structured error for text_substring on nonexistent column", async () => {
      const result = (await tools.get("sqlite_text_substring")?.({
        table: "texts",
        column: "nonexistent_col",
        start: 1,
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });
  });
});
