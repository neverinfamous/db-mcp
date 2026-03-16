/**
 * Core Tools Tests - DDL
 *
 * Tests for SQLite core tools related to Data Definition Language:
 * create_table, drop_table, create_index, drop_index.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Core Tools - DDL", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

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

  describe("sqlite_create_table", () => {
    it("should create a table", async () => {
      const result = await tools.get("sqlite_create_table")?.({
        table: "users",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "name", type: "TEXT" },
        ],
      });

      expect(result).toHaveProperty("success", true);

      const tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).toContain("users");
    });

    it("should handle SQL expression default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "events",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "created_at", type: "TEXT", defaultValue: "datetime('now')" },
          {
            name: "updated_at",
            type: "TEXT",
            defaultValue: "CURRENT_TIMESTAMP",
          },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("(datetime('now'))");
      expect(result.sql).toContain("(CURRENT_TIMESTAMP)");
    });

    it("should handle string literal default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "configs",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "status", type: "TEXT", defaultValue: "pending" },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'pending'");
    });

    it("should handle numeric default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "limits",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "max_count", type: "INTEGER", defaultValue: 100 },
          { name: "ratio", type: "REAL", defaultValue: 0.5 },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 100");
      expect(result.sql).toContain("DEFAULT 0.5");
    });

    it("should handle boolean default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "flags",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "enabled", type: "INTEGER", defaultValue: true },
          { name: "visible", type: "INTEGER", defaultValue: false },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT true");
      expect(result.sql).toContain("DEFAULT false");
    });

    it("should handle null default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "optionals",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "optional_field", type: "TEXT", defaultValue: null },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT NULL");
    });

    it("should handle object default values as JSON", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "jsondata",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "metadata", type: "TEXT", defaultValue: { key: "value" } },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DEFAULT \'{"key":"value"}\'');
    });

    it("should escape quotes in string default values", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "quoted",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "message", type: "TEXT", defaultValue: "it's working" },
        ],
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'it''s working'");
    });

    it("should report existing table when using IF NOT EXISTS", async () => {
      await tools.get("sqlite_create_table")?.({
        table: "existing",
        columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
        ifNotExists: true,
      });

      const result = (await tools.get("sqlite_create_table")?.({
        table: "existing",
        columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
        ifNotExists: true,
      })) as { success: boolean; message: string };

      expect(result.success).toBe(true);
      expect(result.message).toContain("already exists");
    });
  });

  describe("sqlite_create_index", () => {
    it("should create an index", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE indexed (id INTEGER, name TEXT)",
      );

      const result = await tools.get("sqlite_create_index")?.({
        indexName: "idx_name",
        table: "indexed",
        columns: ["name"],
      });

      expect(result).toHaveProperty("success", true);
    });

    it("should return structured error for nonexistent table", async () => {
      const result = (await tools.get("sqlite_create_index")?.({
        indexName: "idx_bad",
        table: "nonexistent_table_xyz",
        columns: ["col"],
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("sqlite_drop_table", () => {
    it("should drop a table", async () => {
      await adapter.executeWriteQuery("CREATE TABLE todrop (id INTEGER)");

      let tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).toContain("todrop");

      await tools.get("sqlite_drop_table")?.({ table: "todrop" });

      tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).not.toContain("todrop");
    });

    it("should return informative message when table does not exist with ifExists", async () => {
      const result = (await tools.get("sqlite_drop_table")?.({
        table: "nonexistent_table_xyz",
        ifExists: true,
      })) as { success: boolean; message: string };

      expect(result.success).toBe(true);
      expect(result.message).toContain("does not exist");
    });

    it("should return error when table does not exist without ifExists", async () => {
      const result = (await tools.get("sqlite_drop_table")?.({
        table: "nonexistent_table_xyz",
        ifExists: false,
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });
  });

  describe("sqlite_drop_index", () => {
    it("should drop an index", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE idx_test (id INTEGER, name TEXT)",
      );
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_to_drop ON idx_test(name)",
      );

      const result = (await tools.get("sqlite_drop_index")?.({
        indexName: "idx_to_drop",
      })) as { success: boolean; message: string };

      expect(result.success).toBe(true);
      expect(result.message).toContain("dropped successfully");

      const indexes = (await tools.get("sqlite_get_indexes")?.({
        table: "idx_test",
      })) as { indexes: { name: string }[] };
      expect(indexes.indexes.map((i) => i.name)).not.toContain("idx_to_drop");
    });

    it("should return informative message when index does not exist with ifExists", async () => {
      const result = (await tools.get("sqlite_drop_index")?.({
        indexName: "nonexistent_index_xyz",
        ifExists: true,
      })) as { success: boolean; message: string };

      expect(result.success).toBe(true);
      expect(result.message).toContain("does not exist");
    });

    it("should return error when index does not exist without ifExists", async () => {
      const result = (await tools.get("sqlite_drop_index")?.({
        indexName: "nonexistent_index_xyz",
        ifExists: false,
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });
  });
});
