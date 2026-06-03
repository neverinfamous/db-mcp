import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";
import { ConflictError } from "../../../../src/utils/errors/index.js";

describe("Core Tools - Versioning", () => {
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
    // Use scopes that cover both DML (write) and DDL (admin)
    const context = { scopes: ["read", "write", "admin"] };

    for (const tool of toolDefs) {
      tools.set(tool.name, (params) => tool.handler(params, context as never));
    }
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_enable_versioning", () => {
    it("should add _version column and trigger to table", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
      );

      const result = (await tools.get("sqlite_enable_versioning")?.({
        table: "users",
      })) as { success: boolean };

      expect(result.success).toBe(true);

      // Verify column exists
      const tableInfo = await adapter.executeReadQuery(
        "PRAGMA table_info(users)",
      );
      const hasVersionColumn = tableInfo.rows?.some(
        (r) => r.name === "_version",
      );
      expect(hasVersionColumn).toBe(true);

      // Verify trigger exists
      const triggerInfo = await adapter.executeReadQuery(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='users'",
      );
      expect(
        triggerInfo.rows?.some((r) => r.name === "_mcp_version_users"),
      ).toBe(true);
    });
  });

  describe("sqlite_check_version", () => {
    it("should return the current version of a row", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)",
      );
      await tools.get("sqlite_enable_versioning")?.({ table: "items" });
      await adapter.executeWriteQuery(
        "INSERT INTO items (id, value) VALUES (1, 'A')",
      );

      const result = (await tools.get("sqlite_check_version")?.({
        table: "items",
        rowId: 1,
      })) as { success: boolean; version: number | null };

      expect(result.success).toBe(true);
      expect(result.version).toBe(1);
    });

    it("should return null for non-existent row", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)",
      );
      await tools.get("sqlite_enable_versioning")?.({ table: "items" });

      const result = (await tools.get("sqlite_check_version")?.({
        table: "items",
        rowId: 999,
      })) as { success: boolean; code?: string };

      expect(result.success).toBe(false);
      expect(result.code).toBe("RESOURCE_NOT_FOUND");
    });
  });

  describe("sqlite_conditional_update", () => {
    it("should succeed and increment version when expectedVersion matches", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE tasks (id INTEGER PRIMARY KEY, status TEXT)",
      );
      await tools.get("sqlite_enable_versioning")?.({ table: "tasks" });
      await adapter.executeWriteQuery(
        "INSERT INTO tasks (id, status) VALUES (1, 'pending')",
      );

      const result = (await tools.get("sqlite_conditional_update")?.({
        table: "tasks",
        conditions: [{ column: "id", operator: "=", value: 1 }],
        expectedVersion: 1,
        data: { status: "done" },
      })) as { success: boolean; rowsAffected: number; currentVersion: number };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
      expect(result.currentVersion).toBe(2);

      const check = await adapter.executeReadQuery(
        "SELECT status, _version FROM tasks WHERE id = 1",
      );
      expect(check.rows?.[0]?.status).toBe("done");
      expect(check.rows?.[0]?._version).toBe(2);
    });

    it("should fail when expectedVersion does not match", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE tasks (id INTEGER PRIMARY KEY, status TEXT)",
      );
      await tools.get("sqlite_enable_versioning")?.({ table: "tasks" });
      await adapter.executeWriteQuery(
        "INSERT INTO tasks (id, status) VALUES (1, 'pending')",
      );
      // Simulate another update
      await adapter.executeWriteQuery(
        "UPDATE tasks SET status = 'in_progress', _version = 2 WHERE id = 1",
      );

      const toolCall = tools.get("sqlite_conditional_update")?.({
        table: "tasks",
        conditions: [{ column: "id", operator: "=", value: 1 }],
        expectedVersion: 1, // Stale version
        data: { status: "done" },
      });

      // The handler wrapper formatHandlerError returns { success: false, code: "CONFLICT_ERROR" }
      const res = (await toolCall) as { success: boolean; code: string };
      expect(res.success).toBe(false);
      expect(res.code).toBe("CONFLICT_ERROR");
    });
  });

  describe("expectedVersion guards in existing tools", () => {
    it("sqlite_write_query should enforce expectedVersion on versioned tables", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE logs (id INTEGER PRIMARY KEY, msg TEXT)",
      );
      await tools.get("sqlite_enable_versioning")?.({ table: "logs" });
      await adapter.executeWriteQuery(
        "INSERT INTO logs (id, msg) VALUES (1, 'start')",
      );

      // Attempt UPDATE without expectedVersion
      const updateCall = tools.get("sqlite_write_query")?.({
        query: "UPDATE logs SET msg = 'mid' WHERE id = 1",
      });

      const resUpdate = (await updateCall) as {
        success: boolean;
        code: string;
      };
      expect(resUpdate.success).toBe(false);
      expect(resUpdate.code).toBe("CONFLICT_ERROR");

      // Attempt UPDATE with expectedVersion
      const validUpdateCall = tools.get("sqlite_write_query")?.({
        query: "UPDATE logs SET msg = 'mid' WHERE id = 1",
        expectedVersion: 1,
      });

      const validUpdateRes = (await validUpdateCall) as { success: boolean };
      expect(validUpdateRes.success).toBe(true);

      // Verify it incremented
      const check = (await tools.get("sqlite_check_version")?.({
        table: "logs",
        rowId: 1,
      })) as { version: number };
      expect(check.version).toBe(2);
    });

    it("sqlite_upsert should enforce expectedVersion on versioned tables", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE cache (id INTEGER PRIMARY KEY, val TEXT)",
      );
      await tools.get("sqlite_enable_versioning")?.({ table: "cache" });
      await adapter.executeWriteQuery(
        "INSERT INTO cache (id, val) VALUES (1, 'hit')",
      );

      // Attempt UPSERT without expectedVersion
      const upsertCall = tools.get("sqlite_upsert")?.({
        table: "cache",
        conflictColumns: ["id"],
        data: { id: 1, val: "miss" },
      });

      const resUpsert = (await upsertCall) as {
        success: boolean;
        code: string;
      };
      expect(resUpsert.success).toBe(false);
      expect(resUpsert.code).toBe("CONFLICT_ERROR");

      // Attempt UPSERT with valid expectedVersion
      const validUpsertCall = tools.get("sqlite_upsert")?.({
        table: "cache",
        conflictColumns: ["id"],
        data: { id: 1, val: "miss" },
        expectedVersion: 1,
      });

      const validUpsertRes = (await validUpsertCall) as { success: boolean };
      expect(validUpsertRes.success).toBe(true);
    });
  });

  describe("sqlite_disable_versioning", () => {
    it("should remove _version column and trigger from table", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE records (id INTEGER PRIMARY KEY, data TEXT)",
      );
      await tools.get("sqlite_enable_versioning")?.({ table: "records" });

      const result = (await tools.get("sqlite_disable_versioning")?.({
        table: "records",
      })) as { success: boolean };

      expect(result.success).toBe(true);

      // Verify column is removed
      const tableInfo = await adapter.executeReadQuery(
        "PRAGMA table_info(records)",
      );
      const hasVersionColumn = tableInfo.rows?.some(
        (r) => r.name === "_version",
      );
      expect(hasVersionColumn).toBe(false);

      // Verify trigger is removed
      const triggerInfo = await adapter.executeReadQuery(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='records'",
      );
      expect(
        triggerInfo.rows?.some((r) => r.name === "_mcp_version_records"),
      ).toBe(false);
    });
  });
});
