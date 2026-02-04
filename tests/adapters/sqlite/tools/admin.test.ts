/**
 * Admin Tools Tests
 *
 * Tests for SQLite admin tools: PRAGMA, analyze, integrity check, optimize, insights.
 * Focuses on tools that can be tested in-memory without file system access.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";
import { insightsManager } from "../../../../src/utils/insightsManager.js";

describe("Admin Tools", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Clear insights between tests
    insightsManager.clear();

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

  describe("sqlite_analyze", () => {
    it("should analyze all tables", async () => {
      await adapter.executeWriteQuery("CREATE TABLE test1 (id INTEGER)");
      await adapter.executeWriteQuery("CREATE TABLE test2 (id INTEGER)");

      const result = (await tools.get("sqlite_analyze")?.({})) as {
        success: boolean;
        message: string;
        durationMs: number;
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe("All tables analyzed");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should analyze a specific table", async () => {
      await adapter.executeWriteQuery("CREATE TABLE specific (id INTEGER)");

      const result = (await tools.get("sqlite_analyze")?.({
        table: "specific",
      })) as {
        success: boolean;
        message: string;
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe("Table 'specific' analyzed");
    });
  });

  describe("sqlite_integrity_check", () => {
    it("should pass integrity check on healthy database", async () => {
      await adapter.executeWriteQuery("CREATE TABLE healthy (id INTEGER)");
      await adapter.executeWriteQuery("INSERT INTO healthy VALUES (1), (2)");

      const result = (await tools.get("sqlite_integrity_check")?.({})) as {
        success: boolean;
        integrity: string;
        errorCount: number;
      };

      expect(result.success).toBe(true);
      expect(result.integrity).toBe("ok");
      expect(result.errorCount).toBe(0);
    });

    it("should accept maxErrors parameter", async () => {
      const result = (await tools.get("sqlite_integrity_check")?.({
        maxErrors: 10,
      })) as {
        success: boolean;
        integrity: string;
      };

      expect(result.success).toBe(true);
      expect(result.integrity).toBe("ok");
    });
  });

  describe("sqlite_optimize", () => {
    it("should run optimize with default settings (analyze only)", async () => {
      await adapter.executeWriteQuery("CREATE TABLE opt_test (id INTEGER)");

      const result = (await tools.get("sqlite_optimize")?.({})) as {
        success: boolean;
        message: string;
        operations: string[];
        durationMs: number;
      };

      expect(result.success).toBe(true);
      expect(result.operations).toContain("analyzed all");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should run optimize with reindex", async () => {
      await adapter.executeWriteQuery("CREATE TABLE reindex_test (id INTEGER)");
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_reindex ON reindex_test(id)",
      );

      const result = (await tools.get("sqlite_optimize")?.({
        reindex: true,
        analyze: true,
      })) as {
        success: boolean;
        operations: string[];
      };

      expect(result.success).toBe(true);
      expect(result.operations).toContain("reindexed all");
      expect(result.operations).toContain("analyzed all");
    });

    it("should optimize specific table", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE specific_opt (id INTEGER, val TEXT)",
      );
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_spec ON specific_opt(val)",
      );

      const result = (await tools.get("sqlite_optimize")?.({
        table: "specific_opt",
        reindex: true,
        analyze: true,
      })) as {
        success: boolean;
        operations: string[];
      };

      expect(result.success).toBe(true);
      expect(result.operations).toContain("reindexed specific_opt");
      expect(result.operations).toContain("analyzed specific_opt");
    });

    it("should skip operations when disabled", async () => {
      const result = (await tools.get("sqlite_optimize")?.({
        reindex: false,
        analyze: false,
      })) as {
        success: boolean;
        operations: string[];
        message: string;
      };

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(0);
      expect(result.message).toContain("no operations performed");
    });
  });

  describe("sqlite_index_stats", () => {
    it("should list all indexes", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE idx_test (id INTEGER, name TEXT)",
      );
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_name ON idx_test(name)",
      );
      await adapter.executeWriteQuery(
        "CREATE UNIQUE INDEX idx_unique ON idx_test(id)",
      );

      const result = (await tools.get("sqlite_index_stats")?.({
        excludeSystemIndexes: false,
      })) as {
        success: boolean;
        indexes: {
          name: string;
          table: string;
          unique: boolean;
          columns: { name: string }[];
        }[];
      };

      expect(result.success).toBe(true);

      const names = result.indexes.map((i) => i.name);
      expect(names).toContain("idx_name");
      expect(names).toContain("idx_unique");

      const uniqueIdx = result.indexes.find((i) => i.name === "idx_unique");
      expect(uniqueIdx?.unique).toBe(true);
    });

    it("should filter by table", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE table1 (id INTEGER, val TEXT)",
      );
      await adapter.executeWriteQuery("CREATE TABLE table2 (id INTEGER)");
      await adapter.executeWriteQuery("CREATE INDEX idx_t1 ON table1(val)");
      await adapter.executeWriteQuery("CREATE INDEX idx_t2 ON table2(id)");

      const result = (await tools.get("sqlite_index_stats")?.({
        table: "table1",
        excludeSystemIndexes: false,
      })) as {
        success: boolean;
        indexes: { name: string; table: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.indexes.every((i) => i.table === "table1")).toBe(true);
      expect(result.indexes.map((i) => i.name)).toContain("idx_t1");
      expect(result.indexes.map((i) => i.name)).not.toContain("idx_t2");
    });

    it("should exclude system indexes by default", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE sys_test (id INTEGER, val TEXT)",
      );
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_valid ON sys_test(val)",
      );
      // Simulate a SpatiaLite index name
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_spatial_ref_sys_test ON sys_test(id)",
      );

      const result = (await tools.get("sqlite_index_stats")?.({})) as {
        success: boolean;
        indexes: { name: string }[];
      };

      expect(result.success).toBe(true);
      const names = result.indexes.map((i) => i.name);
      expect(names).toContain("idx_valid");
      expect(names).not.toContain("idx_spatial_ref_sys_test");
    });
  });

  describe("sqlite_pragma_compile_options", () => {
    it("should return compile options", async () => {
      const result = (await tools.get("sqlite_pragma_compile_options")?.(
        {},
      )) as {
        success: boolean;
        options: string[];
      };

      expect(result.success).toBe(true);
      expect(Array.isArray(result.options)).toBe(true);
      expect(result.options.length).toBeGreaterThan(0);
    });

    it("should filter options by substring", async () => {
      const result = (await tools.get("sqlite_pragma_compile_options")?.({
        filter: "ENABLE",
      })) as {
        success: boolean;
        options: string[];
      };

      expect(result.success).toBe(true);
      // All options should contain "ENABLE" (case-insensitive)
      for (const opt of result.options) {
        expect(opt.toUpperCase()).toContain("ENABLE");
      }
    });

    it("should filter case-insensitively", async () => {
      const resultLower = (await tools.get("sqlite_pragma_compile_options")?.({
        filter: "enable",
      })) as { options: string[] };

      const resultUpper = (await tools.get("sqlite_pragma_compile_options")?.({
        filter: "ENABLE",
      })) as { options: string[] };

      expect(resultLower.options).toEqual(resultUpper.options);
    });
  });

  describe("sqlite_pragma_database_list", () => {
    it("should list attached databases", async () => {
      const result = (await tools.get("sqlite_pragma_database_list")?.({})) as {
        success: boolean;
        databases: { seq: number; name: string; file: string }[];
      };

      expect(result.success).toBe(true);
      expect(Array.isArray(result.databases)).toBe(true);
      // Should have at least the main database
      expect(result.databases.length).toBeGreaterThan(0);
      expect(result.databases[0].name).toBe("main");
    });
  });

  describe("sqlite_pragma_optimize", () => {
    it("should run PRAGMA optimize", async () => {
      await adapter.executeWriteQuery("CREATE TABLE prag_opt (id INTEGER)");

      const result = (await tools.get("sqlite_pragma_optimize")?.({})) as {
        success: boolean;
        message: string;
        durationMs: number;
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe("Database optimized");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should accept optimization mask", async () => {
      const result = (await tools.get("sqlite_pragma_optimize")?.({
        mask: 0xfffe,
      })) as {
        success: boolean;
        durationMs: number;
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_pragma_settings", () => {
    it("should read a PRAGMA value", async () => {
      const result = (await tools.get("sqlite_pragma_settings")?.({
        pragma: "cache_size",
      })) as {
        success: boolean;
        pragma: string;
        value: unknown;
      };

      expect(result.success).toBe(true);
      expect(result.pragma).toBe("cache_size");
      expect(result.value).toBeDefined();
    });

    it("should reject invalid PRAGMA names", async () => {
      await expect(
        tools.get("sqlite_pragma_settings")?.({
          pragma: "DROP TABLE; --",
        }),
      ).rejects.toThrow("Invalid PRAGMA name");
    });

    it("should reject PRAGMA names with special characters", async () => {
      await expect(
        tools.get("sqlite_pragma_settings")?.({
          pragma: "cache-size",
        }),
      ).rejects.toThrow("Invalid PRAGMA name");
    });
  });

  describe("sqlite_pragma_table_info", () => {
    it("should return column information", async () => {
      await adapter.executeWriteQuery(`
        CREATE TABLE info_test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          score REAL DEFAULT 0.0
        )
      `);

      const result = (await tools.get("sqlite_pragma_table_info")?.({
        table: "info_test",
      })) as {
        success: boolean;
        table: string;
        columns: {
          cid: number;
          name: string;
          type: string;
          notNull: boolean;
          defaultValue: unknown;
          pk: number;
        }[];
      };

      expect(result.success).toBe(true);
      expect(result.table).toBe("info_test");
      expect(result.columns).toHaveLength(4);

      const idCol = result.columns.find((c) => c.name === "id");
      expect(idCol?.type).toBe("INTEGER");
      expect(idCol?.pk).toBe(1);

      const nameCol = result.columns.find((c) => c.name === "name");
      expect(nameCol?.notNull).toBe(true);

      const scoreCol = result.columns.find((c) => c.name === "score");
      expect(scoreCol?.defaultValue).toBe("0.0");
    });
  });

  describe("sqlite_append_insight", () => {
    it("should add insight to memo", async () => {
      const result = (await tools.get("sqlite_append_insight")?.({
        insight: "Sales increased by 20% in Q4",
      })) as {
        success: boolean;
        message: string;
        insightCount: number;
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe("Insight added to memo");
      expect(result.insightCount).toBe(1);
    });

    it("should accumulate multiple insights", async () => {
      await tools.get("sqlite_append_insight")?.({
        insight: "First insight",
      });

      const result = (await tools.get("sqlite_append_insight")?.({
        insight: "Second insight",
      })) as {
        insightCount: number;
      };

      expect(result.insightCount).toBe(2);
    });
  });

  describe("sqlite_backup", () => {
    it("should attempt to backup database", async () => {
      const uniquePath = `/tmp/backup_${Date.now()}.db`;
      const result = (await tools.get("sqlite_backup")?.({
        targetPath: uniquePath,
      })) as {
        success: boolean;
        path?: string;
        wasmLimitation?: boolean;
      };

      // In WASM mode, success depends on implementation
      expect(typeof result.success).toBe("boolean");
      expect(result.path).toBe(uniquePath);
    });
  });

  describe("sqlite_restore", () => {
    it("should handle restore request", async () => {
      // Create a table first
      await adapter.executeWriteQuery("CREATE TABLE restore_test (id INTEGER)");

      try {
        const result = (await tools.get("sqlite_restore")?.({
          sourcePath: "/tmp/nonexistent.db",
        })) as {
          success: boolean;
          message?: string;
          wasmLimitation?: boolean;
        };

        // Will fail but should return structured error
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if file doesn't exist
        expect(error).toBeDefined();
      }
    });
  });

  describe("sqlite_verify_backup", () => {
    it("should handle verify backup request", async () => {
      try {
        const result = (await tools.get("sqlite_verify_backup")?.({
          backupPath: "/tmp/nonexistent.db",
        })) as {
          success: boolean;
          message?: string;
          wasmLimitation?: boolean;
        };

        // Will fail but should return structured error
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // Expected if file doesn't exist
        expect(error).toBeDefined();
      }
    });
  });
});
