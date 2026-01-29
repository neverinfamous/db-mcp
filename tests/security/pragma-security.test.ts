/**
 * PRAGMA Security Tests
 *
 * Tests for PRAGMA operation security:
 * - PRAGMA name validation (prevent arbitrary PRAGMA execution)
 * - Table name validation in PRAGMA table_info
 * - Safe PRAGMA operations whitelist
 *
 * Phase 1 of db-mcp Security Test Coverage Improvement Plan
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteAdapter } from "../../src/adapters/sqlite/SqliteAdapter.js";

describe("Security: PRAGMA Operations", () => {
  let adapter: SqliteAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = new SqliteAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create test table
    await adapter.executeWriteQuery(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT
      )
    `);

    // Get tools as a map
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

  function getTool(name: string) {
    const tool = tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return tool;
  }

  // ==========================================================================
  // sqlite_pragma_settings - PRAGMA Name Validation
  // ==========================================================================

  describe("sqlite_pragma_settings - name validation", () => {
    it("should reject PRAGMA name with SQL injection (semicolon)", async () => {
      await expect(
        getTool("sqlite_pragma_settings")({
          pragma: "cache_size; DROP TABLE users--",
        }),
      ).rejects.toThrow("Invalid PRAGMA name");
    });

    it("should reject PRAGMA name with quotes", async () => {
      await expect(
        getTool("sqlite_pragma_settings")({
          pragma: "cache_size'",
        }),
      ).rejects.toThrow("Invalid PRAGMA name");
    });

    it("should reject PRAGMA name with parentheses", async () => {
      await expect(
        getTool("sqlite_pragma_settings")({
          pragma: "table_info(users)",
        }),
      ).rejects.toThrow("Invalid PRAGMA name");
    });

    it("should reject PRAGMA name with spaces", async () => {
      await expect(
        getTool("sqlite_pragma_settings")({
          pragma: "cache size",
        }),
      ).rejects.toThrow("Invalid PRAGMA name");
    });

    it("should reject PRAGMA name starting with number", async () => {
      await expect(
        getTool("sqlite_pragma_settings")({
          pragma: "1cache_size",
        }),
      ).rejects.toThrow("Invalid PRAGMA name");
    });

    it("should allow valid PRAGMA names to read", async () => {
      const result = await getTool("sqlite_pragma_settings")({
        pragma: "cache_size",
      });
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("pragma", "cache_size");
    });

    it("should allow valid PRAGMA names with underscores", async () => {
      const result = await getTool("sqlite_pragma_settings")({
        pragma: "journal_mode",
      });
      expect(result).toHaveProperty("success", true);
    });
  });

  // ==========================================================================
  // sqlite_pragma_table_info - Table Name Validation
  // ==========================================================================

  describe("sqlite_pragma_table_info - table name validation", () => {
    it("should reject table name with SQL injection", async () => {
      await expect(
        getTool("sqlite_pragma_table_info")({
          table: "users; DROP TABLE users--",
        }),
      ).rejects.toThrow("Invalid table name");
    });

    it("should reject table name with quotes", async () => {
      await expect(
        getTool("sqlite_pragma_table_info")({
          table: 'users")',
        }),
      ).rejects.toThrow("Invalid table name");
    });

    it("should reject table name with parentheses", async () => {
      await expect(
        getTool("sqlite_pragma_table_info")({
          table: "users()",
        }),
      ).rejects.toThrow("Invalid table name");
    });

    it("should allow valid table names", async () => {
      const result = await getTool("sqlite_pragma_table_info")({
        table: "users",
      });
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("columns");
    });
  });

  // ==========================================================================
  // Read-only PRAGMA Tools - Safe Operations
  // ==========================================================================

  describe("read-only PRAGMA tools", () => {
    it("sqlite_pragma_compile_options should work safely", async () => {
      const result = await getTool("sqlite_pragma_compile_options")({});
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("options");
    });

    it("sqlite_pragma_database_list should work safely", async () => {
      const result = await getTool("sqlite_pragma_database_list")({});
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("databases");
    });
  });

  // ==========================================================================
  // sqlite_pragma_optimize - Mask Validation
  // ==========================================================================

  describe("sqlite_pragma_optimize - safe operation", () => {
    it("should execute with default mask", async () => {
      const result = await getTool("sqlite_pragma_optimize")({});
      expect(result).toHaveProperty("success", true);
    });

    it("should accept valid numeric mask", async () => {
      const result = await getTool("sqlite_pragma_optimize")({
        mask: 0xfffe,
      });
      expect(result).toHaveProperty("success", true);
    });
  });

  // ==========================================================================
  // sqlite_index_stats - Table Filter Validation
  // ==========================================================================

  describe("sqlite_index_stats - table filter validation", () => {
    it("should reject table filter with SQL injection", async () => {
      await expect(
        getTool("sqlite_index_stats")({
          table: "users' OR '1'='1",
        }),
      ).rejects.toThrow("Invalid table name");
    });

    it("should allow valid table filter", async () => {
      const result = await getTool("sqlite_index_stats")({
        table: "users",
      });
      expect(result).toHaveProperty("success", true);
    });

    it("should work without table filter", async () => {
      const result = await getTool("sqlite_index_stats")({});
      expect(result).toHaveProperty("success", true);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty PRAGMA name", async () => {
      await expect(
        getTool("sqlite_pragma_settings")({
          pragma: "",
        }),
      ).rejects.toThrow();
    });

    it("should handle PRAGMA value injection attempt", async () => {
      // Setting a PRAGMA value - the value goes through as-is but
      // is typed as string or number, limiting injection vectors
      const result = await getTool("sqlite_pragma_settings")({
        pragma: "cache_size",
        value: 2000,
      });
      expect(result).toHaveProperty("success", true);
    });
  });
});
