/**
 * Transaction Tools Tests
 *
 * Tests for SQLite transaction control tools in native adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getTransactionTools } from "../../../../src/adapters/sqlite-native/tools/transactions.js";
import { NativeSqliteAdapter } from "../../../../src/adapters/sqlite-native/NativeSqliteAdapter.js";
import type {
  RequestContext,
  ToolDefinition,
} from "../../../../src/types/index.js";

describe("Transaction Tools", () => {
  let adapter: NativeSqliteAdapter;
  let tools: ToolDefinition[];
  let mockContext: RequestContext;

  beforeEach(async () => {
    adapter = new NativeSqliteAdapter();
    await adapter.connect({ type: "sqlite", database: ":memory:" });

    // Create test table
    await adapter.executeWriteQuery(
      "CREATE TABLE test_txn (id INTEGER PRIMARY KEY, value TEXT)",
    );

    tools = getTransactionTools(adapter);
    mockContext = {
      requestId: "test-req-1",
      timestamp: new Date(),
    };

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
    vi.restoreAllMocks();
  });

  describe("getTransactionTools", () => {
    it("should return 7 transaction tools", () => {
      expect(tools).toHaveLength(7);
    });

    it("should include all expected tools", () => {
      const names = tools.map((t) => t.name);
      expect(names).toContain("sqlite_transaction_begin");
      expect(names).toContain("sqlite_transaction_commit");
      expect(names).toContain("sqlite_transaction_rollback");
      expect(names).toContain("sqlite_transaction_savepoint");
      expect(names).toContain("sqlite_transaction_release");
      expect(names).toContain("sqlite_transaction_rollback_to");
      expect(names).toContain("sqlite_transaction_execute");
    });

    it("should assign all tools to admin group", () => {
      for (const tool of tools) {
        expect(tool.group).toBe("admin");
      }
    });

    it("should require write scope for all tools", () => {
      for (const tool of tools) {
        expect(tool.requiredScopes).toContain("write");
      }
    });
  });

  describe("sqlite_transaction_begin", () => {
    const getTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_begin")!;

    it("should begin a deferred transaction by default", async () => {
      const result = (await getTool().handler({}, mockContext)) as {
        success: boolean;
        mode: string;
        message: string;
      };
      expect(result).toMatchObject({
        success: true,
        mode: "deferred",
      });
      expect(result.message).toContain("deferred");
    });

    it("should begin an immediate transaction", async () => {
      const result = await getTool().handler(
        { mode: "immediate" },
        mockContext,
      );
      expect(result).toMatchObject({
        success: true,
        mode: "immediate",
      });
    });

    it("should begin an exclusive transaction", async () => {
      const result = await getTool().handler(
        { mode: "exclusive" },
        mockContext,
      );
      expect(result).toMatchObject({
        success: true,
        mode: "exclusive",
      });
    });
  });

  describe("sqlite_transaction_commit", () => {
    const getBeginTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_begin")!;
    const getCommitTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_commit")!;

    it("should commit a transaction", async () => {
      await getBeginTool().handler({}, mockContext);
      await adapter.executeWriteQuery(
        "INSERT INTO test_txn (value) VALUES ('test')",
      );

      const result = await getCommitTool().handler({}, mockContext);
      expect(result).toMatchObject({
        success: true,
        message: "Transaction committed",
      });
    });
  });

  describe("sqlite_transaction_rollback", () => {
    const getBeginTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_begin")!;
    const getRollbackTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_rollback")!;

    it("should rollback a transaction", async () => {
      await getBeginTool().handler({}, mockContext);
      await adapter.executeWriteQuery(
        "INSERT INTO test_txn (value) VALUES ('rollback_me')",
      );

      const result = await getRollbackTool().handler({}, mockContext);
      expect(result).toMatchObject({
        success: true,
        message: "Transaction rolled back",
      });

      // Verify data was rolled back
      const check = await adapter.executeReadQuery(
        "SELECT COUNT(*) as cnt FROM test_txn",
      );
      expect(check.rows?.[0]?.cnt).toBe(0);
    });
  });

  describe("sqlite_transaction_savepoint", () => {
    const getSavepointTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_savepoint")!;

    it("should create a savepoint with valid name", async () => {
      adapter.beginTransaction();

      const result = (await getSavepointTool().handler(
        { name: "sp1" },
        mockContext,
      )) as { success: boolean; savepoint: string; message: string };
      expect(result).toMatchObject({
        success: true,
        savepoint: "sp1",
      });
      expect(result.message).toContain("sp1");

      adapter.rollbackTransaction();
    });

    it("should accept underscored names", async () => {
      adapter.beginTransaction();

      const result = (await getSavepointTool().handler(
        { name: "my_savepoint_2" },
        mockContext,
      )) as { success: boolean; savepoint: string };
      expect(result.success).toBe(true);
      expect(result.savepoint).toBe("my_savepoint_2");

      adapter.rollbackTransaction();
    });

    it("should reject invalid savepoint names", () => {
      expect(() =>
        getSavepointTool().handler({ name: "123invalid" }, mockContext),
      ).toThrow("Invalid savepoint name");
    });

    it("should reject names with special characters", () => {
      expect(() =>
        getSavepointTool().handler({ name: "save-point" }, mockContext),
      ).toThrow("Invalid savepoint name");
    });
  });

  describe("sqlite_transaction_release", () => {
    const getSavepointTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_savepoint")!;
    const getReleaseTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_release")!;

    it("should release a savepoint", async () => {
      adapter.beginTransaction();
      await getSavepointTool().handler({ name: "sp_release" }, mockContext);

      const result = await getReleaseTool().handler(
        { name: "sp_release" },
        mockContext,
      );
      expect(result).toMatchObject({
        success: true,
        savepoint: "sp_release",
      });

      adapter.commitTransaction();
    });

    it("should reject invalid names", () => {
      expect(() =>
        getReleaseTool().handler({ name: "bad name" }, mockContext),
      ).toThrow("Invalid savepoint name");
    });
  });

  describe("sqlite_transaction_rollback_to", () => {
    const getSavepointTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_savepoint")!;
    const getRollbackToTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_rollback_to")!;

    it("should rollback to a savepoint", async () => {
      adapter.beginTransaction();
      await adapter.executeWriteQuery(
        "INSERT INTO test_txn (value) VALUES ('before')",
      );
      await getSavepointTool().handler({ name: "sp_rollback" }, mockContext);
      await adapter.executeWriteQuery(
        "INSERT INTO test_txn (value) VALUES ('after')",
      );

      const result = await getRollbackToTool().handler(
        { name: "sp_rollback" },
        mockContext,
      );
      expect(result).toMatchObject({
        success: true,
        savepoint: "sp_rollback",
      });

      // Only 'before' should remain
      const check = await adapter.executeReadQuery("SELECT * FROM test_txn");
      expect(check.rows).toHaveLength(1);
      expect(check.rows?.[0]?.value).toBe("before");

      adapter.rollbackTransaction();
    });

    it("should reject invalid names", () => {
      expect(() =>
        getRollbackToTool().handler({ name: "DROP TABLE" }, mockContext),
      ).toThrow("Invalid savepoint name");
    });
  });

  describe("sqlite_transaction_execute", () => {
    const getExecuteTool = () =>
      tools.find((t) => t.name === "sqlite_transaction_execute")!;

    it("should execute multiple statements in a transaction", async () => {
      const result = (await getExecuteTool().handler(
        {
          statements: [
            "INSERT INTO test_txn (value) VALUES ('one')",
            "INSERT INTO test_txn (value) VALUES ('two')",
          ],
        },
        mockContext,
      )) as {
        success: boolean;
        statementsExecuted: number;
        results: unknown[];
      };

      expect(result.success).toBe(true);
      expect(result.statementsExecuted).toBe(2);
      expect(result.results).toHaveLength(2);

      // Verify both were committed
      const check = await adapter.executeReadQuery(
        "SELECT COUNT(*) as cnt FROM test_txn",
      );
      expect(check.rows?.[0]?.cnt).toBe(2);
    });

    it("should handle SELECT statements and return rows", async () => {
      await adapter.executeWriteQuery(
        "INSERT INTO test_txn (value) VALUES ('existing')",
      );

      const result = (await getExecuteTool().handler(
        {
          statements: ["SELECT * FROM test_txn"],
        },
        mockContext,
      )) as {
        success: boolean;
        results: { rowCount: number; rows?: { value: string }[] }[];
      };

      expect(result.success).toBe(true);
      expect(result.results[0].rowCount).toBe(1);
      expect(result.results[0].rows).toBeDefined();
      expect(result.results[0].rows?.[0]?.value).toBe("existing");
    });

    it("should rollback on error when rollbackOnError is true", async () => {
      // First insert should work, second should fail, all should be rolled back
      const result = (await getExecuteTool().handler(
        {
          statements: [
            "INSERT INTO test_txn (value) VALUES ('will_rollback')",
            "INSERT INTO nonexistent_table (x) VALUES (1)",
          ],
          rollbackOnError: true,
        },
        mockContext,
      )) as { success: boolean; message: string };

      expect(result.success).toBe(false);
      expect(result.message).toContain("rolled back");

      // Verify nothing was committed
      const check = await adapter.executeReadQuery(
        "SELECT COUNT(*) as cnt FROM test_txn",
      );
      expect(check.rows?.[0]?.cnt).toBe(0);
    });

    it("should continue on error when rollbackOnError is false", async () => {
      const result = (await getExecuteTool().handler(
        {
          statements: [
            "INSERT INTO test_txn (value) VALUES ('success')",
            "INSERT INTO nonexistent_table (x) VALUES (1)",
            "INSERT INTO test_txn (value) VALUES ('also_success')",
          ],
          rollbackOnError: false,
        },
        mockContext,
      )) as {
        success: boolean;
        message: string;
        results: { error?: string }[];
      };

      expect(result.success).toBe(false);
      expect(result.message).toContain("completed with errors");
      expect(result.results).toHaveLength(3);
      expect(result.results[1].error).toBeDefined();

      // First and third should be committed
      const check = await adapter.executeReadQuery(
        "SELECT COUNT(*) as cnt FROM test_txn",
      );
      expect(check.rows?.[0]?.cnt).toBe(2);
    });

    it("should truncate long statement text in results", async () => {
      const longStatement =
        "INSERT INTO test_txn (value) VALUES ('" + "x".repeat(200) + "')";

      const result = (await getExecuteTool().handler(
        {
          statements: [longStatement],
        },
        mockContext,
      )) as { success: boolean; results: { statement: string }[] };

      expect(result.success).toBe(true);
      expect(result.results[0].statement.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(result.results[0].statement).toContain("...");
    });
  });
});
