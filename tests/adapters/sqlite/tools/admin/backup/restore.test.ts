/**
 * Restore Tool Tests (Mock-based)
 *
 * Tests createRestoreTool with mocked adapter and fs.
 * The restore handler has the most uncovered lines in the backup module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";

// Mock fs.existsSync
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
    },
  };
});

import { createRestoreTool } from "../../../../../../src/adapters/sqlite/tools/admin/backup/restore.js";

const ctx = { timestamp: new Date(), requestId: "test" };

function createMockAdapter(isNative = true) {
  return {
    executeReadQuery: vi.fn().mockResolvedValue({ rows: [] }),
    executeWriteQuery: vi.fn().mockResolvedValue({ rows: [] }),
    executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
    isNativeBackend: vi.fn().mockReturnValue(isNative),
  } as any;
}

// =============================================================================
// Metadata & basic validation
// =============================================================================

describe("createRestoreTool", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return correct metadata", () => {
    const tool = createRestoreTool(createMockAdapter());
    expect(tool.name).toBe("sqlite_restore");
    expect(tool.group).toBe("admin");
  });

  it("should reject in WASM mode", async () => {
    const adapter = createMockAdapter(false);
    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "/tmp/backup.db" }, ctx) as any;
    expect(result.success).toBe(false);
    expect(result.wasmLimitation).toBe(true);
  });

  it("should reject empty sourcePath", async () => {
    const adapter = createMockAdapter();
    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "  " }, ctx) as any;
    expect(result.success).toBe(false);
  });

  it("should reject when file not found", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const adapter = createMockAdapter();
    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "/tmp/missing.db" }, ctx) as any;
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("not found");
  });

  it("should handle ATTACH failure", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [{ integrity_check: "ok" }] });
    adapter.executeWriteQuery.mockRejectedValueOnce(new Error("ATTACH failed"));

    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "/tmp/backup.db" }, ctx) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Successful restore flow
// =============================================================================

describe("restore - successful flow", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should restore database from backup (native)", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter(true);

    // Track which SQL queries are made
    const queries: string[] = [];
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      queries.push(sql);
      // integrity check
      if (sql.includes("integrity_check")) {
        return Promise.resolve({ rows: [{ integrity_check: "ok" }] });
      }
      // virtual tables in main
      if (sql.includes("sqlite_master") && sql.includes("VIRTUAL TABLE") && !sql.includes("backup_source")) {
        return Promise.resolve({ rows: [] });
      }
      // tables from backup
      if (sql.includes("backup_source.sqlite_master") && sql.includes("NOT LIKE") && sql.includes("VIRTUAL TABLE")) {
        return Promise.resolve({ rows: [] }); // no virtual tables in backup
      }
      if (sql.includes("backup_source.sqlite_master") && sql.includes("type='table'")) {
        return Promise.resolve({
          rows: [
            { name: "users", sql: 'CREATE TABLE "users" (id INTEGER PRIMARY KEY, name TEXT)' },
            { name: "orders", sql: 'CREATE TABLE "orders" (id INTEGER PRIMARY KEY, user_id INTEGER)' },
          ],
        });
      }
      // indexes
      if (sql.includes("type='index'")) {
        return Promise.resolve({
          rows: [{ name: "idx_user_name", sql: 'CREATE INDEX idx_user_name ON users(name)' }],
        });
      }
      // views
      if (sql.includes("type='view'")) {
        return Promise.resolve({
          rows: [{ name: "user_view", sql: 'CREATE VIEW user_view AS SELECT * FROM users' }],
        });
      }
      // triggers
      if (sql.includes("type='trigger'")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });

    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "/tmp/backup.db" }, ctx) as any;
    expect(result.success).toBe(true);
    expect(result.sourcePath).toBe("/tmp/backup.db");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should handle skipped virtual tables", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter(true);

    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("integrity_check")) {
        return Promise.resolve({ rows: [{ integrity_check: "ok" }] });
      }
      // Virtual tables in main (cleanup step)
      if (sql.includes("sqlite_master") && sql.includes("VIRTUAL TABLE") && !sql.includes("backup_source")) {
        return Promise.resolve({ rows: [] });
      }
      // Regular tables from backup (has "sql NOT LIKE 'CREATE VIRTUAL TABLE%'")
      if (sql.includes("backup_source.sqlite_master") && sql.includes("sql NOT LIKE 'CREATE VIRTUAL")) {
        return Promise.resolve({ rows: [] });
      }
      // Virtual tables from backup (has "sql LIKE 'CREATE VIRTUAL TABLE%'" without NOT)
      if (sql.includes("backup_source.sqlite_master") && sql.includes("sql LIKE 'CREATE VIRTUAL")) {
        return Promise.resolve({
          rows: [
            { name: "fts_index", sql: "CREATE VIRTUAL TABLE fts_index USING fts5(content)" },
          ],
        });
      }
      // indexes/views/triggers
      if (sql.includes("type='index'") || sql.includes("type='view'") || sql.includes("type='trigger'")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    // Make the virtual table creation fail (module not available)
    let writeCallCount = 0;
    adapter.executeWriteQuery.mockImplementation((sql: string) => {
      writeCallCount++;
      if (sql.includes("CREATE VIRTUAL TABLE fts_index")) {
        return Promise.reject(new Error("no such module: fts5"));
      }
      return Promise.resolve({ rows: [] });
    });

    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "/tmp/backup.db" }, ctx) as any;
    expect(result.success).toBe(true);
    expect(result.skippedTables).toBeDefined();
    expect(result.skippedTables.length).toBeGreaterThan(0);
    expect(result.note).toContain("virtual tables");
  });

  it("should handle tables with no createSql", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter(true);

    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("integrity_check")) return Promise.resolve({ rows: [{ integrity_check: "ok" }] });
      if (sql.includes("VIRTUAL TABLE") && !sql.includes("backup_source")) return Promise.resolve({ rows: [] });
      if (sql.includes("backup_source") && sql.includes("VIRTUAL TABLE")) return Promise.resolve({ rows: [] });
      if (sql.includes("backup_source.sqlite_master") && sql.includes("type='table'")) {
        return Promise.resolve({
          rows: [
            { name: "tbl", sql: null }, // null createSql, should be skipped
          ],
        });
      }
      if (sql.includes("type='index'") || sql.includes("type='view'") || sql.includes("type='trigger'")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });

    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "/tmp/backup.db" }, ctx) as any;
    expect(result.success).toBe(true);
  });

  it("should restore views and handle view errors gracefully", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter(true);

    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("integrity_check")) return Promise.resolve({ rows: [{ integrity_check: "ok" }] });
      if (sql.includes("VIRTUAL TABLE")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='table'")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='index'")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='view'")) {
        return Promise.resolve({
          rows: [
            { name: "my_view", sql: "CREATE VIEW my_view AS SELECT * FROM missing_table" },
          ],
        });
      }
      if (sql.includes("type='trigger'")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    // View creation will fail (missing table) — should be gracefully handled
    adapter.executeWriteQuery.mockImplementation((sql: string) => {
      if (sql === "CREATE VIEW my_view AS SELECT * FROM missing_table") {
        return Promise.reject(new Error("no such table: missing_table"));
      }
      return Promise.resolve({ rows: [] });
    });

    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "/tmp/backup.db" }, ctx) as any;
    // Should not fail even if view creation fails
    expect(result.success).toBe(true);
  });

  it("should restore triggers and handle trigger errors gracefully", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter(true);

    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("integrity_check")) return Promise.resolve({ rows: [{ integrity_check: "ok" }] });
      if (sql.includes("VIRTUAL TABLE")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='table'")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='index'")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='view'")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='trigger'")) {
        return Promise.resolve({
          rows: [
            { name: "trg", sql: "CREATE TRIGGER trg AFTER INSERT ON missing_table BEGIN END" },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    adapter.executeWriteQuery.mockImplementation((sql: string) => {
      if (sql.includes("CREATE TRIGGER")) {
        return Promise.reject(new Error("no such table"));
      }
      return Promise.resolve({ rows: [] });
    });

    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "/tmp/backup.db" }, ctx) as any;
    expect(result.success).toBe(true);
  });

  it("should restore indexes and handle index errors gracefully", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter(true);

    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("integrity_check")) return Promise.resolve({ rows: [{ integrity_check: "ok" }] });
      if (sql.includes("VIRTUAL TABLE")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='table'")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='index'")) {
        return Promise.resolve({
          rows: [
            { name: "idx_test", sql: "CREATE INDEX idx_test ON missing_table(col)" },
            { name: "idx_null", sql: null }, // null sql, should skip
          ],
        });
      }
      if (sql.includes("type='view'")) return Promise.resolve({ rows: [] });
      if (sql.includes("type='trigger'")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    adapter.executeWriteQuery.mockImplementation((sql: string) => {
      if (sql.includes("CREATE INDEX")) {
        return Promise.reject(new Error("no such table"));
      }
      return Promise.resolve({ rows: [] });
    });

    const tool = createRestoreTool(adapter);
    const result = await tool.handler({ sourcePath: "/tmp/backup.db" }, ctx) as any;
    expect(result.success).toBe(true);
  });
});
