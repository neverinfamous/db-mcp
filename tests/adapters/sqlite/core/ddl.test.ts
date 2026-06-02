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

    it("should return validation error for invalid table name", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "1invalid",
        columns: [{ name: "id", type: "INTEGER" }],
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid table name");
    });

    it("should return validation error for empty columns array", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "empty_cols",
        columns: [],
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("At least one column definition is required");
    });

    it("should create table with foreign keys", async () => {
      await adapter.executeWriteQuery("CREATE TABLE parent (id INTEGER PRIMARY KEY)");
      
      const result = (await tools.get("sqlite_create_table")?.({
        table: "child",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "parent_id", type: "INTEGER" }
        ],
        foreignKeys: [{
          column: "parent_id",
          targetTable: "parent",
          targetColumn: "id",
          onDelete: "CASCADE",
          onUpdate: "RESTRICT"
        }]
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("FOREIGN KEY");
      expect(result.sql).toContain("REFERENCES");
      expect(result.sql).toContain("ON DELETE CASCADE");
    });

    it("should create table with check constraints", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "checked_table",
        columns: [
          { name: "age", type: "INTEGER" }
        ],
        checkConstraints: ["age >= 18"]
      })) as { success: boolean; sql: string };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("CHECK (age >= 18)");
    });

    it("should reject table creation with invalid check constraint syntax", async () => {
      const result = (await tools.get("sqlite_create_table")?.({
        table: "bad_check",
        columns: [
          { name: "age", type: "INTEGER" }
        ],
        checkConstraints: ["age >= "]
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      // SQLite throws a syntax error when it encounters an invalid expression inside CHECK()
      expect(result.error).toMatch(/syntax error|Write query failed/i);
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

    it("should return validation error for invalid table name", async () => {
      const result = (await tools.get("sqlite_drop_table")?.({
        table: "1invalid",
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid table name");
    });

    it("should clean up FTS triggers on drop", async () => {
      await adapter.executeWriteQuery("CREATE TABLE search_data (id INTEGER, text TEXT)");
      // Create a dummy trigger simulating an FTS5 trigger that inserts into the table
      await adapter.executeWriteQuery(`
        CREATE TRIGGER search_data_ai AFTER INSERT ON search_data
        BEGIN
          INSERT INTO "search_data" (id) VALUES (new.id);
        END;
      `);

      const result = (await tools.get("sqlite_drop_table")?.({
        table: "search_data",
      })) as { success: boolean };

      expect(result.success).toBe(true);
      
      const triggers = await adapter.executeReadQuery("SELECT name FROM sqlite_master WHERE type='trigger'");
      expect(triggers.rows?.map(r => r.name)).not.toContain("search_data_ai");
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
