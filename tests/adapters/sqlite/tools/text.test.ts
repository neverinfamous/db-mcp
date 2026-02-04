/**
 * Text Processing Tools Tests
 *
 * Tests for SQLite text tools:
 * regex, split, concat, replace, trim, case, substring,
 * fuzzy match, phonetic match, normalize, validate, advanced search.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Text Processing Tools", () => {
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

  describe("sqlite_regex_extract", () => {
    it("should extract email domains", async () => {
      const result = (await tools.get("sqlite_regex_extract")?.({
        table: "texts",
        column: "email",
        pattern: "@([a-z]+)",
      })) as {
        success: boolean;
        rowCount: number;
        matches: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBeGreaterThan(0);
    });

    it("should return empty for no matches", async () => {
      const result = (await tools.get("sqlite_regex_extract")?.({
        table: "texts",
        column: "name",
        pattern: "\\d{10}",
      })) as {
        success: boolean;
        rowCount: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
    });
  });

  describe("sqlite_regex_match", () => {
    it("should find rows matching pattern", async () => {
      const result = (await tools.get("sqlite_regex_match")?.({
        table: "texts",
        column: "email",
        pattern: "@example\\.com$",
      })) as {
        success: boolean;
        rowCount: number;
        matches: Record<string, unknown>[];
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3); // alice, allice, robert
    });

    it("should respect limit", async () => {
      const result = (await tools.get("sqlite_regex_match")?.({
        table: "texts",
        column: "email",
        pattern: "@",
        limit: 2,
      })) as {
        success: boolean;
        rowCount: number;
      };

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });
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
});
