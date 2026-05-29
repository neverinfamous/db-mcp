import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("Introspection Tools - Schema Diff", () => {
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
    
    // Set up initial schema for diffing
    await adapter.executeWriteQuery("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);");
    await adapter.executeWriteQuery("CREATE INDEX idx_users_name ON users(name);");
    await adapter.executeWriteQuery("CREATE VIEW v_users AS SELECT * FROM users;");
    await adapter.executeWriteQuery("CREATE TRIGGER trig_users AFTER INSERT ON users BEGIN SELECT 1; END;");
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_schema_diff", () => {
    it("should require baseline and target", async () => {
      const res = await tools.get("sqlite_schema_diff")?.({}) as { success: boolean, error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("are required");
    });

    it("should detect no changes if schema is unmodified", async () => {
      const res = await tools.get("sqlite_schema_diff")?.({
        baseline: "current",
        target: "current"
      }) as { success: boolean, summary: any };
      expect(res.success).toBe(true);
      expect(res.summary.totalChanges).toBe(0);
      expect(res.summary.severity).toBe("none");
    });

    it("should detect added table and modified severity", async () => {
      const baselineSnapshot = await tools.get("sqlite_schema_snapshot")?.({}) as any;
      
      // Modify schema
      await adapter.executeWriteQuery("CREATE TABLE new_table (id INTEGER)");
      
      const targetSnapshot = await tools.get("sqlite_schema_snapshot")?.({}) as any;

      const res = await tools.get("sqlite_schema_diff")?.({
        baseline: baselineSnapshot.snapshot,
        target: targetSnapshot.snapshot
      }) as { success: boolean, summary: any, sections: any };
      
      expect(res.success).toBe(true);
      expect(res.summary.totalChanges).toBeGreaterThan(0);
      expect(res.summary.added).toBeGreaterThan(0);
      expect(res.summary.severity).toBe("low"); // backward compatible addition
      expect(res.sections.tables.added.map((t: any) => t.name)).toContain("new_table");
    });

    it("should detect removed view and index, severity high", async () => {
      const baselineSnapshot = await tools.get("sqlite_schema_snapshot")?.({}) as any;
      
      await adapter.executeWriteQuery("DROP VIEW v_users");
      await adapter.executeWriteQuery("DROP INDEX idx_users_name");
      
      const targetSnapshot = await tools.get("sqlite_schema_snapshot")?.({}) as any;

      const res = await tools.get("sqlite_schema_diff")?.({
        baseline: baselineSnapshot.snapshot,
        target: targetSnapshot.snapshot
      }) as { success: boolean, summary: any, sections: any };
      
      expect(res.success).toBe(true);
      expect(res.summary.removed).toBeGreaterThan(0);
      expect(res.summary.severity).toBe("high"); // breaking changes
      expect(res.sections.views.removed.map((v: any) => v.name)).toContain("v_users");
      expect(res.sections.indexes.removed.map((i: any) => i.name)).toContain("idx_users_name");
    });

    it("should detect modified table column", async () => {
      const baselineSnapshot = await tools.get("sqlite_schema_snapshot")?.({}) as any;
      
      // SQLite altering columns isn't fully supported via ALTER TABLE type changes, 
      // but we can simulate a drop/recreate or just add a column to test 'modified'
      await adapter.executeWriteQuery("ALTER TABLE users ADD COLUMN age INTEGER");
      
      const targetSnapshot = await tools.get("sqlite_schema_snapshot")?.({}) as any;

      const res = await tools.get("sqlite_schema_diff")?.({
        baseline: baselineSnapshot.snapshot,
        target: targetSnapshot.snapshot
      }) as { success: boolean, summary: any, sections: any };
      
      expect(res.success).toBe(true);
      expect(res.summary.modified).toBeGreaterThan(0); // The table itself is modified
      
      const usersTableChange = res.sections.tables.modified.find((t: any) => t.name === "users");
      expect(usersTableChange).toBeDefined();
      expect(usersTableChange.changes.find((c: any) => c.type === "column_added" && c.column === "age")).toBeDefined();
    });

    it("should allow partial section diffs", async () => {
      const baselineSnapshot = await tools.get("sqlite_schema_snapshot")?.({}) as any;
      await adapter.executeWriteQuery("CREATE TABLE partial_test (id INTEGER)");
      await adapter.executeWriteQuery("CREATE INDEX idx_partial ON partial_test(id)");
      
      const res = await tools.get("sqlite_schema_diff")?.({
        baseline: baselineSnapshot.snapshot,
        target: "current",
        sections: ["indexes"]
      }) as { success: boolean, sections: any };
      
      expect(res.success).toBe(true);
      expect(res.sections.tables).toBeUndefined(); // tables wasn't requested
      expect(res.sections.indexes).toBeDefined();
      expect(res.sections.indexes.added.map((i: any) => i.name)).toContain("idx_partial");
    });
  });
});
