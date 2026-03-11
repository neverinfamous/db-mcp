/**
 * Text Processing Tools Tests - Search
 *
 * Tests for SQLite text search tools:
 * fuzzy_match, phonetic_match, text_normalize, text_validate, advanced_search
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("Text Search Tools", () => {
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

  describe("sqlite_fuzzy_match", () => {
    it("should find similar names with tokenize", async () => {
      const result = (await tools.get("sqlite_fuzzy_match")?.({
        table: "texts",
        column: "name",
        search: "Alice",
        maxDistance: 2,
        tokenize: true,
      })) as {
        success: boolean;
        matchCount: number;
        tokenized: boolean;
        matches: { value: string; distance: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.tokenized).toBe(true);
      expect(result.matchCount).toBeGreaterThan(0);
    });

    it("should work without tokenize", async () => {
      const result = (await tools.get("sqlite_fuzzy_match")?.({
        table: "texts",
        column: "name",
        search: "Alice Smith",
        maxDistance: 3,
        tokenize: false,
      })) as {
        success: boolean;
        matchCount: number;
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_phonetic_match", () => {
    it("should find phonetically similar names with soundex", async () => {
      const result = (await tools.get("sqlite_phonetic_match")?.({
        table: "texts",
        column: "name",
        search: "Jon",
        algorithm: "soundex",
      })) as {
        success: boolean;
        matchCount: number;
        matches: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      // Should find Johnson, Jones
    });

    it("should use metaphone algorithm", async () => {
      const result = (await tools.get("sqlite_phonetic_match")?.({
        table: "texts",
        column: "name",
        search: "Alyce",
        algorithm: "metaphone",
      })) as {
        success: boolean;
        matches: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_text_normalize", () => {
    it("should normalize with NFC", async () => {
      const result = (await tools.get("sqlite_text_normalize")?.({
        table: "texts",
        column: "description",
        mode: "nfc",
        whereClause: "id = 1",
      })) as {
        success: boolean;
        rowCount: number;
        results: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });

    it("should strip accents", async () => {
      // Insert accented text
      await adapter.executeWriteQuery(`
        INSERT INTO texts (id, name, email, description) VALUES
        (6, 'Café', 'cafe@test.com', 'Résumé')
      `);

      const result = (await tools.get("sqlite_text_normalize")?.({
        table: "texts",
        column: "name",
        mode: "strip_accents",
        whereClause: "id = 6",
      })) as {
        success: boolean;
        rows: { normalized: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.rows[0]?.normalized).toBe("Cafe");
    });
  });

  describe("sqlite_text_validate", () => {
    it("should validate email pattern", async () => {
      const result = (await tools.get("sqlite_text_validate")?.({
        table: "texts",
        column: "email",
        pattern: "email",
      })) as {
        success: boolean;
        totalRows: number;
        validCount: number;
        invalidCount: number;
      };

      expect(result.success).toBe(true);
      expect(result.validCount).toBe(result.totalRows); // All emails should be valid
    });

    it("should validate with custom pattern", async () => {
      const result = (await tools.get("sqlite_text_validate")?.({
        table: "texts",
        column: "email",
        pattern: "custom",
        customPattern: "^[a-z]+@",
      })) as {
        success: boolean;
        validCount: number;
      };

      expect(result.success).toBe(true);
      expect(result.validCount).toBeGreaterThan(0);
    });
  });

  describe("sqlite_advanced_search", () => {
    it("should perform multi-technique search", async () => {
      const result = (await tools.get("sqlite_advanced_search")?.({
        table: "texts",
        column: "name",
        searchTerm: "Alice",
        techniques: ["exact", "fuzzy"],
      })) as {
        success: boolean;
        matchCount: number;
        matches: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.matchCount).toBeGreaterThan(0);
    });
  });

  describe("Error path testing", () => {
    it("should return structured error for fuzzy_match on nonexistent table", async () => {
      const result = (await tools.get("sqlite_fuzzy_match")?.({
        table: "nonexistent_xyz",
        column: "x",
        search: "test",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for phonetic_match on nonexistent table", async () => {
      const result = (await tools.get("sqlite_phonetic_match")?.({
        table: "nonexistent_xyz",
        column: "x",
        search: "test",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for text_normalize on nonexistent table", async () => {
      const result = (await tools.get("sqlite_text_normalize")?.({
        table: "nonexistent_xyz",
        column: "x",
        mode: "nfc",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for text_validate on nonexistent table", async () => {
      const result = (await tools.get("sqlite_text_validate")?.({
        table: "nonexistent_xyz",
        column: "x",
        pattern: "email",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for advanced_search on nonexistent table", async () => {
      const result = (await tools.get("sqlite_advanced_search")?.({
        table: "nonexistent_xyz",
        column: "x",
        searchTerm: "test",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for fuzzy_match on nonexistent column", async () => {
      const result = (await tools.get("sqlite_fuzzy_match")?.({
        table: "texts",
        column: "nonexistent_col",
        search: "test",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return structured error for phonetic_match on nonexistent column", async () => {
      const result = (await tools.get("sqlite_phonetic_match")?.({
        table: "texts",
        column: "nonexistent_col",
        search: "test",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return structured error for text_normalize on nonexistent column", async () => {
      const result = (await tools.get("sqlite_text_normalize")?.({
        table: "texts",
        column: "nonexistent_col",
        mode: "nfc",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return structured error for text_validate on nonexistent column", async () => {
      const result = (await tools.get("sqlite_text_validate")?.({
        table: "texts",
        column: "nonexistent_col",
        pattern: "email",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return structured error for advanced_search on nonexistent column", async () => {
      const result = (await tools.get("sqlite_advanced_search")?.({
        table: "texts",
        column: "nonexistent_col",
        searchTerm: "test",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });
  });
});
