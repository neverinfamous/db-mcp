/**
 * Migration Tools Tests
 *
 * Tests for SQLite migration lifecycle tools:
 * init, record, apply, rollback, history, status.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Migration Tools", () => {
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

  // ===========================================================================
  // Migration Init
  // ===========================================================================

  describe("sqlite_migration_init", () => {
    it("should create the migrations table", async () => {
      const result = (await tools.get("sqlite_migration_init")?.({})) as {
        success: boolean;
        tableCreated: boolean;
        tableName: string;
      };

      expect(result.success).toBe(true);
      expect(result.tableCreated).toBe(true);
      expect(result.tableName).toBe("_mcp_migrations");
    });

    it("should be idempotent", async () => {
      await tools.get("sqlite_migration_init")?.({});

      const result = (await tools.get("sqlite_migration_init")?.({})) as {
        success: boolean;
        tableCreated: boolean;
      };

      expect(result.success).toBe(true);
      expect(result.tableCreated).toBe(false);
    });
  });

  // ===========================================================================
  // Migration Record
  // ===========================================================================

  describe("sqlite_migration_record", () => {
    it("should record a migration without executing", async () => {
      await tools.get("sqlite_migration_init")?.({});

      const result = (await tools.get("sqlite_migration_record")?.({
        version: "1.0.0",
        description: "Initial schema",
        migrationSql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
        rollbackSql: "DROP TABLE users",
        sourceSystem: "test",
        appliedBy: "vitest",
      })) as {
        success: boolean;
        record: {
          id: number;
          version: string;
          migrationHash: string;
          status: string;
        };
      };

      expect(result.success).toBe(true);
      expect(result.record.version).toBe("1.0.0");
      expect(result.record.status).toBe("recorded");
      expect(result.record.migrationHash).toHaveLength(64);
    });

    it("should reject duplicate migrations by hash", async () => {
      await tools.get("sqlite_migration_init")?.({});

      await tools.get("sqlite_migration_record")?.({
        version: "1.0.0",
        migrationSql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
      });

      const result = (await tools.get("sqlite_migration_record")?.({
        version: "1.0.1",
        migrationSql: "CREATE TABLE users (id INTEGER PRIMARY KEY)", // Same SQL
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Duplicate");
    });

    it("should fail without init", async () => {
      const result = (await tools.get("sqlite_migration_record")?.({
        version: "1.0.0",
        migrationSql: "CREATE TABLE t (id INTEGER PRIMARY KEY)",
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // Migration Apply
  // ===========================================================================

  describe("sqlite_migration_apply", () => {
    it("should execute and record a migration", async () => {
      await tools.get("sqlite_migration_init")?.({});

      const result = (await tools.get("sqlite_migration_apply")?.({
        version: "1.0.0",
        description: "Create users table",
        migrationSql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
        rollbackSql: "DROP TABLE users",
      })) as {
        success: boolean;
        record: { version: string; status: string };
      };

      expect(result.success).toBe(true);
      expect(result.record.version).toBe("1.0.0");
      expect(result.record.status).toBe("applied");

      // Verify the table was actually created
      const tables = (await tools.get("sqlite_list_tables")?.({})) as {
        tables: { name: string }[];
      };
      expect(tables.tables.some((t) => t.name === "users")).toBe(true);
    });

    it("should record failure for invalid SQL", async () => {
      await tools.get("sqlite_migration_init")?.({});

      const result = (await tools.get("sqlite_migration_apply")?.({
        version: "1.0.0",
        migrationSql: "INVALID SQL STATEMENT",
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
    });

    it("should reject duplicate SQL hash", async () => {
      await tools.get("sqlite_migration_init")?.({});

      await tools.get("sqlite_migration_apply")?.({
        version: "1.0.0",
        migrationSql: "CREATE TABLE t1 (id INTEGER PRIMARY KEY)",
      });

      const result = (await tools.get("sqlite_migration_apply")?.({
        version: "1.0.1",
        migrationSql: "CREATE TABLE t1 (id INTEGER PRIMARY KEY)", // Same SQL
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Duplicate");
    });
  });

  // ===========================================================================
  // Migration Rollback
  // ===========================================================================

  describe("sqlite_migration_rollback", () => {
    it("should rollback by version", async () => {
      await tools.get("sqlite_migration_init")?.({});

      await tools.get("sqlite_migration_apply")?.({
        version: "1.0.0",
        migrationSql: "CREATE TABLE rollback_test (id INTEGER PRIMARY KEY)",
        rollbackSql: "DROP TABLE rollback_test",
      });

      const result = (await tools.get("sqlite_migration_rollback")?.({
        version: "1.0.0",
      })) as {
        success: boolean;
        record: { status: string };
      };

      expect(result.success).toBe(true);
      expect(result.record.status).toBe("rolled_back");

      // Verify the table was removed
      const tables = (await tools.get("sqlite_list_tables")?.({})) as {
        tables: { name: string }[];
      };
      expect(tables.tables.some((t) => t.name === "rollback_test")).toBe(false);
    });

    it("should support dry run", async () => {
      await tools.get("sqlite_migration_init")?.({});

      await tools.get("sqlite_migration_apply")?.({
        version: "2.0.0",
        migrationSql: "CREATE TABLE keep_table (id INTEGER PRIMARY KEY)",
        rollbackSql: "DROP TABLE keep_table",
      });

      const result = (await tools.get("sqlite_migration_rollback")?.({
        version: "2.0.0",
        dryRun: true,
      })) as {
        success: boolean;
        dryRun: boolean;
        rollbackSql: string;
      };

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.rollbackSql).toBe("DROP TABLE keep_table");

      // Table should still exist (dry run)
      const tables = (await tools.get("sqlite_list_tables")?.({})) as {
        tables: { name: string }[];
      };
      expect(tables.tables.some((t) => t.name === "keep_table")).toBe(true);
    });

    it("should fail when no rollback SQL exists", async () => {
      await tools.get("sqlite_migration_init")?.({});

      await tools.get("sqlite_migration_apply")?.({
        version: "3.0.0",
        migrationSql: "CREATE TABLE no_rollback (id INTEGER PRIMARY KEY)",
        // No rollbackSql provided
      });

      const result = (await tools.get("sqlite_migration_rollback")?.({
        version: "3.0.0",
      })) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("rollback");
    });

    it("should reject rolling back an already rolled-back migration", async () => {
      await tools.get("sqlite_migration_init")?.({});

      await tools.get("sqlite_migration_apply")?.({
        version: "4.0.0",
        migrationSql: "CREATE TABLE already_rolled (id INTEGER PRIMARY KEY)",
        rollbackSql: "DROP TABLE already_rolled",
      });

      // First rollback succeeds
      const first = (await tools.get("sqlite_migration_rollback")?.({
        version: "4.0.0",
      })) as { success: boolean };
      expect(first.success).toBe(true);

      // Second rollback should fail with ALREADY_ROLLED_BACK
      const second = (await tools.get("sqlite_migration_rollback")?.({
        version: "4.0.0",
      })) as {
        success: boolean;
        error: string;
        code: string;
      };
      expect(second.success).toBe(false);
      expect(second.code).toBe("ALREADY_ROLLED_BACK");
      expect(second.error).toContain("already rolled back");
    });
  });

  // ===========================================================================
  // Migration History
  // ===========================================================================

  describe("sqlite_migration_history", () => {
    it("should return migration history", async () => {
      await tools.get("sqlite_migration_init")?.({});

      await tools.get("sqlite_migration_apply")?.({
        version: "1.0.0",
        migrationSql: "CREATE TABLE h1 (id INTEGER PRIMARY KEY)",
        sourceSystem: "test",
      });
      await tools.get("sqlite_migration_apply")?.({
        version: "2.0.0",
        migrationSql: "CREATE TABLE h2 (id INTEGER PRIMARY KEY)",
        sourceSystem: "test",
      });

      const result = (await tools.get("sqlite_migration_history")?.({})) as {
        success: boolean;
        records: { version: string }[];
        total: number;
      };

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.records.length).toBe(2);
    });

    it("should filter by status", async () => {
      await tools.get("sqlite_migration_init")?.({});

      await tools.get("sqlite_migration_apply")?.({
        version: "1.0.0",
        migrationSql: "CREATE TABLE f1 (id INTEGER PRIMARY KEY)",
        rollbackSql: "DROP TABLE f1",
      });
      await tools.get("sqlite_migration_apply")?.({
        version: "2.0.0",
        migrationSql: "CREATE TABLE f2 (id INTEGER PRIMARY KEY)",
      });
      await tools.get("sqlite_migration_rollback")?.({
        version: "1.0.0",
      });

      const result = (await tools.get("sqlite_migration_history")?.({
        status: "rolled_back",
      })) as {
        success: boolean;
        records: { version: string; status: string }[];
        total: number;
      };

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.records[0]?.version).toBe("1.0.0");
    });

    it("should support pagination", async () => {
      await tools.get("sqlite_migration_init")?.({});

      for (let i = 1; i <= 5; i++) {
        await tools.get("sqlite_migration_apply")?.({
          version: `${String(i)}.0.0`,
          migrationSql: `CREATE TABLE p${String(i)} (id INTEGER PRIMARY KEY)`,
        });
      }

      const result = (await tools.get("sqlite_migration_history")?.({
        limit: 2,
        offset: 0,
      })) as {
        success: boolean;
        records: { version: string }[];
        total: number;
        limit: number;
        offset: number;
      };

      expect(result.success).toBe(true);
      expect(result.records.length).toBe(2);
      expect(result.total).toBe(5);
    });
  });

  // ===========================================================================
  // Migration Status
  // ===========================================================================

  describe("sqlite_migration_status", () => {
    it("should report uninitialized state", async () => {
      const result = (await tools.get("sqlite_migration_status")?.({})) as {
        success: boolean;
        initialized: boolean;
      };

      expect(result.success).toBe(true);
      expect(result.initialized).toBe(false);
    });

    it("should report initialized state with counts", async () => {
      await tools.get("sqlite_migration_init")?.({});

      await tools.get("sqlite_migration_apply")?.({
        version: "1.0.0",
        migrationSql: "CREATE TABLE s1 (id INTEGER PRIMARY KEY)",
        rollbackSql: "DROP TABLE s1",
      });
      await tools.get("sqlite_migration_apply")?.({
        version: "2.0.0",
        migrationSql: "CREATE TABLE s2 (id INTEGER PRIMARY KEY)",
      });
      await tools.get("sqlite_migration_rollback")?.({
        version: "1.0.0",
      });

      const result = (await tools.get("sqlite_migration_status")?.({})) as {
        success: boolean;
        initialized: boolean;
        latestVersion: string;
        counts: {
          total: number;
          applied: number;
          rolledBack: number;
          failed: number;
        };
      };

      expect(result.success).toBe(true);
      expect(result.initialized).toBe(true);
      expect(result.counts.total).toBe(2);
      expect(result.counts.applied).toBe(1);
      expect(result.counts.recorded).toBe(0);
      expect(result.counts.rolledBack).toBe(1);
      expect(result.counts.failed).toBe(0);
    });
  });

  // ===========================================================================
  // Full Lifecycle
  // ===========================================================================

  describe("full migration lifecycle", () => {
    it("should handle init → apply → rollback → status", async () => {
      // 1. Init
      const init = (await tools.get("sqlite_migration_init")?.({})) as {
        success: boolean;
      };
      expect(init.success).toBe(true);

      // 2. Apply
      const apply = (await tools.get("sqlite_migration_apply")?.({
        version: "1.0.0",
        description: "Add users",
        migrationSql:
          "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
        rollbackSql: "DROP TABLE users",
        sourceSystem: "vitest",
      })) as {
        success: boolean;
        record: { id: number };
      };
      expect(apply.success).toBe(true);

      // 3. Verify table exists
      const tables = (await tools.get("sqlite_list_tables")?.({})) as {
        tables: { name: string }[];
      };
      expect(tables.tables.some((t) => t.name === "users")).toBe(true);

      // 4. Rollback
      const rollback = (await tools.get("sqlite_migration_rollback")?.({
        id: apply.record.id,
      })) as {
        success: boolean;
        record: { status: string };
      };
      expect(rollback.success).toBe(true);
      expect(rollback.record.status).toBe("rolled_back");

      // 5. Verify table removed
      const tablesAfter = (await tools.get("sqlite_list_tables")?.({})) as {
        tables: { name: string }[];
      };
      expect(tablesAfter.tables.some((t) => t.name === "users")).toBe(false);

      // 6. Status reflects changes
      const status = (await tools.get("sqlite_migration_status")?.({})) as {
        success: boolean;
        counts: { total: number; applied: number; rolledBack: number };
      };
      expect(status.counts.total).toBe(1);
      expect(status.counts.rolledBack).toBe(1);
    });
  });
});
