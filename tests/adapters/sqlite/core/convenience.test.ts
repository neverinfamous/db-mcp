import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Core Tools - Convenience", () => {
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

  describe("sqlite_batch_insert", () => {
    it("should insert multiple rows successfully", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE batch_test (id INTEGER PRIMARY KEY, name TEXT)",
      );

      const result = (await tools.get("sqlite_batch_insert")?.({
        table: "batch_test",
        rows: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
      })) as { success: boolean; rowsAffected: number };

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(2);

      const selectResult = await adapter.executeReadQuery(
        "SELECT * FROM batch_test ORDER BY id",
      );
      expect(selectResult.rows?.length).toBe(2);
      expect(selectResult.rows?.[0]?.["name"]).toBe("Alice");
    });
  });

  describe("sqlite_upsert", () => {
    it("should fallback to INSERT OR REPLACE if no conflict columns provided", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE upsert_test (id INTEGER PRIMARY KEY, name TEXT)",
      );

      await tools.get("sqlite_upsert")?.({
        table: "upsert_test",
        data: { id: 1, name: "Alice" },
      });

      const result = (await tools.get("sqlite_upsert")?.({
        table: "upsert_test",
        data: { id: 1, name: "Alice Updated" },
      })) as { success: boolean; rowsAffected: number };

      expect(result.success).toBe(true);
      // Depending on SQLite version/internal state, rowsAffected can be 1 or 2 on REPLACE
      expect(result.rowsAffected).toBeGreaterThan(0);

      const selectResult = await adapter.executeReadQuery(
        "SELECT name FROM upsert_test WHERE id = 1",
      );
      expect(selectResult.rows?.[0]?.["name"]).toBe("Alice Updated");
    });

    it("should use ON CONFLICT DO UPDATE when conflict columns provided", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE upsert_conflict (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)",
      );

      await adapter.executeWriteQuery(
        "INSERT INTO upsert_conflict VALUES (1, 'Alice', 30)",
      );

      const result = (await tools.get("sqlite_upsert")?.({
        table: "upsert_conflict",
        data: { id: 1, name: "Alice Updated", age: 31 },
        conflictColumns: ["id"],
        updateColumns: ["name"],
      })) as { success: boolean; rowsAffected: number };

      expect(result.success).toBe(true);

      const selectResult = await adapter.executeReadQuery(
        "SELECT * FROM upsert_conflict WHERE id = 1",
      );
      expect(selectResult.rows?.[0]?.["name"]).toBe("Alice Updated");
      expect(selectResult.rows?.[0]?.["age"]).toBe(30); // age should not be updated
    });
  });

  describe("sqlite_count", () => {
    it("should count all rows", async () => {
      await adapter.executeWriteQuery("CREATE TABLE count_test (id INTEGER)");
      await adapter.executeWriteQuery(
        "INSERT INTO count_test VALUES (1), (2), (3)",
      );

      const result = (await tools.get("sqlite_count")?.({
        table: "count_test",
      })) as { success: boolean; count: number };

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });

    it("should count rows with condition", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE count_cond (id INTEGER, val INTEGER)",
      );
      await adapter.executeWriteQuery(
        "INSERT INTO count_cond VALUES (1, 10), (2, 20), (3, 10)",
      );

      const result = (await tools.get("sqlite_count")?.({
        table: "count_cond",
        conditions: [{ column: "val", operator: "=", value: 10 }],
      })) as { success: boolean; count: number };

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe("sqlite_exists", () => {
    it("should return true when rows exist", async () => {
      await adapter.executeWriteQuery("CREATE TABLE exists_test (id INTEGER)");
      await adapter.executeWriteQuery("INSERT INTO exists_test VALUES (1)");

      const result = (await tools.get("sqlite_exists")?.({
        table: "exists_test",
      })) as { success: boolean; exists: boolean };

      expect(result.success).toBe(true);
      expect(result.exists).toBe(true);
    });

    it("should return false when rows do not exist", async () => {
      await adapter.executeWriteQuery("CREATE TABLE exists_empty (id INTEGER)");

      const result = (await tools.get("sqlite_exists")?.({
        table: "exists_empty",
      })) as { success: boolean; exists: boolean };

      expect(result.success).toBe(true);
      expect(result.exists).toBe(false);
    });
  });

  describe("sqlite_truncate", () => {
    it("should delete all rows from a table", async () => {
      await adapter.executeWriteQuery("CREATE TABLE trunc_test (id INTEGER)");
      await adapter.executeWriteQuery("INSERT INTO trunc_test VALUES (1), (2)");

      const result = (await tools.get("sqlite_truncate")?.({
        table: "trunc_test",
      })) as { success: boolean; rowsAffected: number };

      expect(result.success).toBe(true);
      // DELETE FROM returns rows affected
      expect(result.rowsAffected).toBe(2);

      const selectResult = await adapter.executeReadQuery(
        "SELECT * FROM trunc_test",
      );
      expect(selectResult.rows?.length).toBe(0);
    });
  });
});
