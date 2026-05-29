import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Core Tools - Alter Table", () => {
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
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_alter_table", () => {
    it("should handle invalid inputs", async () => {
      // Invalid alias resolution / parse error
      const result1 = await tools.get("sqlite_alter_table")?.({
        table: 123,
      }) as { success: boolean, error: string };
      expect(result1.success).toBe(false);

      // Invalid table name
      const result2 = await tools.get("sqlite_alter_table")?.({
        table: "",
        operation: "add_column"
      }) as { success: boolean, error: string };
      expect(result2.success).toBe(false);

      // Nonexistent table
      const result3 = await tools.get("sqlite_alter_table")?.({
        table: "nonexistent",
        operation: "add_column"
      }) as { success: boolean, error: string };
      expect(result3.success).toBe(false);
      expect(result3.error).toContain("does not exist");
    });

    describe("add_column", () => {
      beforeEach(async () => {
        await adapter.executeWriteQuery("CREATE TABLE test_add (id INTEGER PRIMARY KEY)");
      });

      it("should require column and type", async () => {
        const res1 = await tools.get("sqlite_alter_table")?.({
          table: "test_add",
          operation: "add_column"
        }) as { success: boolean };
        expect(res1.success).toBe(false);

        const res2 = await tools.get("sqlite_alter_table")?.({
          table: "test_add",
          operation: "add_column",
          column: "new_col"
        }) as { success: boolean };
        expect(res2.success).toBe(false);
      });

      it("should prevent adding existing column", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_add",
          operation: "add_column",
          column: "id",
          type: "INTEGER"
        }) as { success: boolean, error: string };
        expect(res.success).toBe(false);
        expect(res.error).toContain("already exists");
      });

      it("should prevent adding PRIMARY KEY or UNIQUE columns", async () => {
        const res1 = await tools.get("sqlite_alter_table")?.({
          table: "test_add",
          operation: "add_column",
          column: "pk",
          type: "INTEGER PRIMARY KEY"
        }) as { success: boolean, error: string };
        expect(res1.success).toBe(false);
        expect(res1.error).toContain("PRIMARY KEY");

        const res2 = await tools.get("sqlite_alter_table")?.({
          table: "test_add",
          operation: "add_column",
          column: "unq",
          type: "INTEGER UNIQUE"
        }) as { success: boolean, error: string };
        expect(res2.success).toBe(false);
        expect(res2.error).toContain("UNIQUE");
      });

      it("should prevent adding NOT NULL column without default", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_add",
          operation: "add_column",
          column: "nn",
          type: "INTEGER",
          nullable: false
        }) as { success: boolean, error: string };
        expect(res.success).toBe(false);
        expect(res.error).toContain("without a default value");
      });

      it("should add a column successfully", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_add",
          operation: "add_column",
          column: "new_col",
          type: "TEXT",
          nullable: false,
          defaultValue: "default_string"
        }) as { success: boolean };
        expect(res.success).toBe(true);

        const colCheck = await adapter.executeReadQuery("PRAGMA table_info(test_add)");
        const cols = colCheck.rows?.map((r: any) => r.name) || [];
        expect(cols).toContain("new_col");
      });
    });

    describe("rename_column", () => {
      beforeEach(async () => {
        await adapter.executeWriteQuery("CREATE TABLE test_rename (id INTEGER PRIMARY KEY, old_name TEXT)");
      });

      it("should require column and newName", async () => {
        const res1 = await tools.get("sqlite_alter_table")?.({
          table: "test_rename",
          operation: "rename_column"
        }) as { success: boolean };
        expect(res1.success).toBe(false);

        const res2 = await tools.get("sqlite_alter_table")?.({
          table: "test_rename",
          operation: "rename_column",
          column: "old_name"
        }) as { success: boolean };
        expect(res2.success).toBe(false);
      });

      it("should handle nonexistent source column", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_rename",
          operation: "rename_column",
          column: "nonexistent",
          newName: "new_name"
        }) as { success: boolean, error: string };
        expect(res.success).toBe(false);
        expect(res.error).toContain("does not exist in table");
      });

      it("should handle existing target column", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_rename",
          operation: "rename_column",
          column: "old_name",
          newName: "id"
        }) as { success: boolean, error: string };
        expect(res.success).toBe(false);
        expect(res.error).toContain("already exists in table");
      });

      it("should rename column successfully", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_rename",
          operation: "rename_column",
          column: "old_name",
          newName: "new_name"
        }) as { success: boolean };
        expect(res.success).toBe(true);

        const colCheck = await adapter.executeReadQuery("PRAGMA table_info(test_rename)");
        const cols = colCheck.rows?.map((r: any) => r.name) || [];
        expect(cols).toContain("new_name");
        expect(cols).not.toContain("old_name");
      });
    });

    describe("drop_column", () => {
      beforeEach(async () => {
        await adapter.executeWriteQuery("CREATE TABLE test_drop (id INTEGER PRIMARY KEY, to_drop TEXT)");
      });

      it("should require column", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_drop",
          operation: "drop_column"
        }) as { success: boolean };
        expect(res.success).toBe(false);
      });

      it("should handle nonexistent column", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_drop",
          operation: "drop_column",
          column: "nonexistent"
        }) as { success: boolean, error: string };
        expect(res.success).toBe(false);
        expect(res.error).toContain("does not exist in table");
      });

      it("should prevent dropping the last column", async () => {
        await adapter.executeWriteQuery("CREATE TABLE test_single (id INTEGER)");
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_single",
          operation: "drop_column",
          column: "id"
        }) as { success: boolean, error: string };
        expect(res.success).toBe(false);
        expect(res.error).toContain("Cannot drop the only column");
      });

      it("should drop column successfully", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_drop",
          operation: "drop_column",
          column: "to_drop"
        }) as { success: boolean };
        expect(res.success).toBe(true);

        const colCheck = await adapter.executeReadQuery("PRAGMA table_info(test_drop)");
        const cols = colCheck.rows?.map((r: any) => r.name) || [];
        expect(cols).not.toContain("to_drop");
      });
    });

    describe("rename_table", () => {
      beforeEach(async () => {
        await adapter.executeWriteQuery("CREATE TABLE test_rename_tbl (id INTEGER PRIMARY KEY)");
      });

      it("should require newName", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_rename_tbl",
          operation: "rename_table"
        }) as { success: boolean };
        expect(res.success).toBe(false);
      });

      it("should validate newName format", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_rename_tbl",
          operation: "rename_table",
          newName: "123invalid"
        }) as { success: boolean, error: string };
        expect(res.success).toBe(false);
        expect(res.error).toContain("Invalid new table name");
      });

      it("should handle existing target table", async () => {
        await adapter.executeWriteQuery("CREATE TABLE existing_tbl (id INTEGER)");
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_rename_tbl",
          operation: "rename_table",
          newName: "existing_tbl"
        }) as { success: boolean, error: string };
        expect(res.success).toBe(false);
        expect(res.error).toContain("already exists");
      });

      it("should rename table successfully", async () => {
        const res = await tools.get("sqlite_alter_table")?.({
          table: "test_rename_tbl",
          operation: "rename_table",
          newName: "renamed_tbl"
        }) as { success: boolean };
        expect(res.success).toBe(true);

        const tables = await adapter.listTables();
        const names = tables.map((t: any) => t.name);
        expect(names).toContain("renamed_tbl");
        expect(names).not.toContain("test_rename_tbl");
      });
    });
  });
});
