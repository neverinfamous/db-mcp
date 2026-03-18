/**
 * Admin Verify Tool Tests
 *
 * Tests createVerifyBackupTool and createIndexStatsTool
 * using a mock adapter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";

// Mock fs.existsSync for file existence checks
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

import {
  createVerifyBackupTool,
  createIndexStatsTool,
} from "../../../../../src/adapters/sqlite/tools/admin/verify.js";

const ctx = { timestamp: new Date(), requestId: "test" };

function createMockAdapter(isNative = true) {
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
    executeQuery: vi.fn(),
    isNativeBackend: vi.fn().mockReturnValue(isNative),
  } as any;
}

// =============================================================================
// sqlite_verify_backup
// =============================================================================

describe("createVerifyBackupTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return metadata", () => {
    const tool = createVerifyBackupTool(createMockAdapter());
    expect(tool.name).toBe("sqlite_verify_backup");
    expect(tool.group).toBe("admin");
  });

  it("should reject in WASM mode", async () => {
    const adapter = createMockAdapter(false);
    const tool = createVerifyBackupTool(adapter);
    const result = (await tool.handler(
      { backupPath: "/tmp/backup.db" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.wasmLimitation).toBe(true);
  });

  it("should reject empty backupPath", async () => {
    const adapter = createMockAdapter();
    const tool = createVerifyBackupTool(adapter);
    const result = (await tool.handler({ backupPath: "  " }, ctx)) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("VALIDATION_ERROR");
  });

  it("should reject when file not found", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const adapter = createMockAdapter();
    const tool = createVerifyBackupTool(adapter);
    const result = (await tool.handler(
      { backupPath: "/tmp/missing.db" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("FILE_NOT_FOUND");
  });

  it("should verify valid backup", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter();
    adapter.executeQuery.mockResolvedValue({ rows: [] }); // ATTACH/DETACH
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("page_count"))
        return Promise.resolve({ rows: [{ page_count: 100 }] });
      if (sql.includes("page_size"))
        return Promise.resolve({ rows: [{ page_size: 4096 }] });
      if (sql.includes("integrity_check"))
        return Promise.resolve({ rows: [{ integrity_check: "ok" }] });
      return Promise.resolve({ rows: [] });
    });

    const tool = createVerifyBackupTool(adapter);
    const result = (await tool.handler(
      { backupPath: "/tmp/backup.db" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.integrity).toBe("ok");
    expect(result.pageCount).toBe(100);
  });

  it("should detect invalid backup", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter();
    adapter.executeQuery.mockResolvedValue({ rows: [] });
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("page_count"))
        return Promise.resolve({ rows: [{ page_count: 50 }] });
      if (sql.includes("page_size"))
        return Promise.resolve({ rows: [{ page_size: 4096 }] });
      if (sql.includes("integrity_check")) {
        return Promise.resolve({
          rows: [
            { integrity_check: "*** in table test: row 1 wrong" },
            { integrity_check: "*** in table test: row 2 wrong" },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const tool = createVerifyBackupTool(adapter);
    const result = (await tool.handler(
      { backupPath: "/tmp/backup.db" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.integrity).toBe("errors_found");
    expect(result.messages).toHaveLength(2);
  });

  it("should handle ATTACH failure", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const adapter = createMockAdapter();
    adapter.executeQuery.mockRejectedValueOnce(
      new Error("ATTACH failed: locked"),
    );

    const tool = createVerifyBackupTool(adapter);
    const result = (await tool.handler(
      { backupPath: "/tmp/backup.db" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("ATTACH_FAILED");
  });
});

// =============================================================================
// sqlite_index_stats
// =============================================================================

describe("createIndexStatsTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return metadata", () => {
    const tool = createIndexStatsTool(createMockAdapter());
    expect(tool.name).toBe("sqlite_index_stats");
    expect(tool.group).toBe("admin");
  });

  it("should return index statistics", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("sqlite_master")) {
        return Promise.resolve({
          rows: [
            {
              name: "idx_name",
              table: "users",
              sql: "CREATE INDEX idx_name ON users(name)",
            },
            {
              name: "idx_email",
              table: "users",
              sql: "CREATE UNIQUE INDEX idx_email ON users(email)",
            },
          ],
        });
      }
      if (sql.includes("PRAGMA index_info")) {
        return Promise.resolve({
          rows: [{ name: "name", seqno: 0 }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const tool = createIndexStatsTool(adapter);
    const result = (await tool.handler({}, ctx)) as any;
    expect(result.success).toBe(true);
    expect(result.indexes).toHaveLength(2);
    expect(result.indexes[1].unique).toBe(true);
  });

  it("should filter by table", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createIndexStatsTool(adapter);
    const result = (await tool.handler({ table: "users" }, ctx)) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("users"),
    );
  });

  it("should detect partial indexes", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("sqlite_master")) {
        return Promise.resolve({
          rows: [
            {
              name: "idx_active",
              table: "users",
              sql: "CREATE INDEX idx_active ON users(active) WHERE active = 1",
            },
          ],
        });
      }
      if (sql.includes("PRAGMA index_info")) {
        return Promise.resolve({ rows: [{ name: "active", seqno: 0 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const tool = createIndexStatsTool(adapter);
    const result = (await tool.handler({}, ctx)) as any;
    expect(result.indexes[0].partial).toBe(true);
  });
});
