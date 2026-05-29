import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Core Tools - Triggers", () => {
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

  describe("sqlite_list_triggers", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery("CREATE TABLE test_table (id INTEGER, val TEXT)");
      await adapter.executeWriteQuery(`
        CREATE TRIGGER update_val AFTER UPDATE ON test_table
        BEGIN
          UPDATE test_table SET val = 'updated' WHERE id = NEW.id;
        END;
      `);
      await adapter.executeWriteQuery(`
        CREATE TRIGGER insert_val BEFORE INSERT ON test_table
        BEGIN
          SELECT 1;
        END;
      `);
    });

    it("should list all triggers", async () => {
      const res = await tools.get("sqlite_list_triggers")?.({}) as { success: boolean, triggers: any[] };
      expect(res.success).toBe(true);
      expect(res.triggers.length).toBeGreaterThanOrEqual(2);
      
      const names = res.triggers.map((t: any) => t.name);
      expect(names).toContain("update_val");
      expect(names).toContain("insert_val");
      
      const updateTrigger = res.triggers.find((t: any) => t.name === "update_val");
      expect(updateTrigger.event).toBe("UPDATE");
      expect(updateTrigger.timing).toBe("AFTER");
    });

    it("should list triggers for specific table", async () => {
      await adapter.executeWriteQuery("CREATE TABLE other_table (id INTEGER)");
      await adapter.executeWriteQuery("CREATE TRIGGER other_trig AFTER DELETE ON other_table BEGIN SELECT 1; END;");
      
      const res = await tools.get("sqlite_list_triggers")?.({ table: "test_table" }) as { success: boolean, triggers: any[] };
      expect(res.success).toBe(true);
      expect(res.triggers).toHaveLength(2);
      const names = res.triggers.map((t: any) => t.name);
      expect(names).not.toContain("other_trig");
    });

    it("should handle nonexistent table", async () => {
      const res = await tools.get("sqlite_list_triggers")?.({ table: "nonexistent" }) as { success: boolean, error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("does not exist");
    });
  });

  describe("sqlite_create_trigger", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery("CREATE TABLE test_create (id INTEGER, ts TEXT)");
      await adapter.executeWriteQuery("CREATE VIEW test_view AS SELECT * FROM test_create");
    });

    it("should require name, table, event, timing, body", async () => {
      const res = await tools.get("sqlite_create_trigger")?.({
        table: "test_create",
        event: "INSERT",
        timing: "AFTER",
        body: "SELECT 1;"
      }) as { success: boolean };
      expect(res.success).toBe(false); // missing name
    });

    it("should validate trigger name", async () => {
      const res = await tools.get("sqlite_create_trigger")?.({
        name: "",
        table: "test_create",
        event: "INSERT",
        timing: "AFTER",
        body: "SELECT 1;"
      }) as { success: boolean, error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid trigger name");
    });

    it("should reject INSTEAD OF on tables", async () => {
      const res = await tools.get("sqlite_create_trigger")?.({
        name: "test_trig",
        table: "test_create",
        event: "INSERT",
        timing: "INSTEAD OF",
        body: "SELECT 1;"
      }) as { success: boolean, error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("only be created on views");
    });

    it("should allow INSTEAD OF on views", async () => {
      const res = await tools.get("sqlite_create_trigger")?.({
        name: "test_trig_view",
        table: "test_view",
        event: "INSERT",
        timing: "INSTEAD OF",
        body: "INSERT INTO test_create (id) VALUES (NEW.id);"
      }) as { success: boolean };
      expect(res.success).toBe(true);
    });

    it("should reject columns on non-UPDATE events", async () => {
      const res = await tools.get("sqlite_create_trigger")?.({
        name: "test_trig",
        table: "test_create",
        event: "INSERT",
        timing: "AFTER",
        columns: ["ts"],
        body: "SELECT 1;"
      }) as { success: boolean, error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("only be specified for UPDATE");
    });

    it("should create trigger successfully", async () => {
      const res = await tools.get("sqlite_create_trigger")?.({
        name: "test_trig_success",
        table: "test_create",
        event: "UPDATE",
        timing: "AFTER",
        columns: ["ts"],
        whenClause: "NEW.ts IS NOT NULL",
        forEachRow: true,
        body: "SELECT 1;"
      }) as { success: boolean, sql: string };
      expect(res.success).toBe(true);
      expect(res.sql).toContain("UPDATE OF");
      expect(res.sql).toContain("FOR EACH ROW");
      expect(res.sql).toContain("WHEN NEW.ts IS NOT NULL");
    });
  });

  describe("sqlite_drop_trigger", () => {
    beforeEach(async () => {
      await adapter.executeWriteQuery("CREATE TABLE test_drop (id INTEGER)");
      await adapter.executeWriteQuery("CREATE TRIGGER to_drop AFTER DELETE ON test_drop BEGIN SELECT 1; END;");
    });

    it("should require name", async () => {
      const res = await tools.get("sqlite_drop_trigger")?.({}) as { success: boolean };
      expect(res.success).toBe(false);
    });

    it("should handle nonexistent trigger", async () => {
      const res = await tools.get("sqlite_drop_trigger")?.({ name: "nonexistent" }) as { success: boolean, error: string };
      expect(res.success).toBe(false);
      expect(res.error).toContain("does not exist");
    });

    it("should handle nonexistent trigger with ifExists", async () => {
      const res = await tools.get("sqlite_drop_trigger")?.({ name: "nonexistent", ifExists: true }) as { success: boolean, message: string };
      expect(res.success).toBe(true);
      expect(res.message).toContain("no changes made");
    });

    it("should drop trigger successfully", async () => {
      const res = await tools.get("sqlite_drop_trigger")?.({ name: "to_drop" }) as { success: boolean };
      expect(res.success).toBe(true);

      const triggerCheck = await adapter.executeReadQuery("SELECT * FROM sqlite_master WHERE type='trigger' AND name='to_drop'");
      expect(triggerCheck.rows).toHaveLength(0);
    });
  });
});
