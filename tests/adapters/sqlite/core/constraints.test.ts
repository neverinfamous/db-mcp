import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Core Tools - Constraints", () => {
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

  describe("sqlite_list_constraints", () => {
    it("should require table name", async () => {
      const res = (await tools.get("sqlite_list_constraints")?.({})) as {
        success: boolean;
      };
      expect(res.success).toBe(false);
    });

    it("should handle nonexistent table", async () => {
      const res = (await tools.get("sqlite_list_constraints")?.({
        table: "nonexistent",
      })) as { success: boolean; error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("does not exist");
    });

    it("should list primary key constraints", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test_pk (id INTEGER, name TEXT, PRIMARY KEY(id, name))",
      );
      const res = (await tools.get("sqlite_list_constraints")?.({
        table: "test_pk",
      })) as { success: boolean; primaryKey: string[] };
      expect(res.success).toBe(true);
      expect(res.primaryKey).toEqual(["id", "name"]);
    });

    it("should list foreign key constraints", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE parent (id INTEGER PRIMARY KEY)",
      );
      await adapter.executeWriteQuery(`
        CREATE TABLE child (
          id INTEGER PRIMARY KEY,
          parent_id INTEGER,
          FOREIGN KEY (parent_id) REFERENCES parent(id) ON DELETE CASCADE ON UPDATE RESTRICT
        )
      `);
      const res = (await tools.get("sqlite_list_constraints")?.({
        table: "child",
      })) as { success: boolean; foreignKeys: any[] };
      expect(res.success).toBe(true);
      expect(res.foreignKeys).toHaveLength(1);
      expect(res.foreignKeys[0]).toMatchObject({
        table: "parent",
        from: "parent_id",
        to: "id",
        onDelete: "CASCADE",
        onUpdate: "RESTRICT",
      });
    });

    it("should list unique index constraints", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test_uniq (id INTEGER, email TEXT UNIQUE, username TEXT)",
      );
      await adapter.executeWriteQuery(
        "CREATE UNIQUE INDEX idx_username ON test_uniq(username)",
      );

      const res = (await tools.get("sqlite_list_constraints")?.({
        table: "test_uniq",
      })) as { success: boolean; uniqueIndexes: any[] };
      expect(res.success).toBe(true);

      // Should have 2 unique indexes: one for email (auto-generated), one for username
      expect(res.uniqueIndexes.length).toBeGreaterThanOrEqual(2);

      const cols = res.uniqueIndexes.map((idx) => idx.columns.join(","));
      expect(cols).toContain("email");
      expect(cols).toContain("username");
    });

    it("should parse CHECK constraints", async () => {
      await adapter.executeWriteQuery(`
        CREATE TABLE test_check (
          id INTEGER,
          age INTEGER CHECK (age >= 18),
          status TEXT,
          CHECK (status IN ('active', 'inactive'))
        )
      `);
      const res = (await tools.get("sqlite_list_constraints")?.({
        table: "test_check",
      })) as { success: boolean; checkConstraints: string[] };
      expect(res.success).toBe(true);

      // Output could format them slightly differently, but should contain the inner texts
      expect(res.checkConstraints).toHaveLength(2);
      expect(res.checkConstraints).toContain("age >= 18");
      expect(res.checkConstraints).toContain(
        "status IN ('active', 'inactive')",
      );
    });

    it("should parse nested parenthesis in CHECK constraints", async () => {
      await adapter.executeWriteQuery(`
        CREATE TABLE test_check_nested (
          val INTEGER CHECK ((val > 0) AND (val < 10))
        )
      `);
      const res = (await tools.get("sqlite_list_constraints")?.({
        table: "test_check_nested",
      })) as { success: boolean; checkConstraints: string[] };
      expect(res.success).toBe(true);
      expect(res.checkConstraints).toContain("(val > 0) AND (val < 10)");
    });
  });
});
