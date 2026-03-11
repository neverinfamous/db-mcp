/**
 * Text Processing Tools Tests - Regex
 *
 * Tests for SQLite regex tools:
 * regex_extract, regex_match
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("Text Regex Tools", () => {
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

  describe("Error path testing", () => {
    it("should return structured error for regex_match on nonexistent table", async () => {
      const result = (await tools.get("sqlite_regex_match")?.({
        table: "nonexistent_xyz",
        column: "x",
        pattern: ".",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for regex_extract on nonexistent table", async () => {
      const result = (await tools.get("sqlite_regex_extract")?.({
        table: "nonexistent_xyz",
        column: "x",
        pattern: ".",
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for regex_match on nonexistent column", async () => {
      const result = (await tools.get("sqlite_regex_match")?.({
        table: "texts",
        column: "nonexistent_col",
        pattern: ".",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });

    it("should return structured error for regex_extract on nonexistent column", async () => {
      const result = (await tools.get("sqlite_regex_extract")?.({
        table: "texts",
        column: "nonexistent_col",
        pattern: ".",
      })) as { success: boolean; error?: string; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("COLUMN_NOT_FOUND");
    });
  });
});
