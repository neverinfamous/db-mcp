import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AuditLogger } from "../../src/audit/logger.js";
import { SystemDb } from "../../src/observability/system-db.js";
import { AuditEntry } from "../../src/audit/types.js";

describe("AuditLogger", () => {
  let systemDb: SystemDb;
  let logger: AuditLogger;

  beforeEach(async () => {
    systemDb = new SystemDb({ dbPath: ":memory:" });
    await systemDb.init();
  });

  afterEach(async () => {
    if (logger) {
      await logger.close();
    }
    if (systemDb) {
      systemDb.close();
    }
    vi.restoreAllMocks();
  });

  it("should initialize and respect stderr mode", async () => {
    logger = new AuditLogger({ enabled: true, logPath: "stderr", logRetentionDays: 1 });
    await logger.init(); // Shouldn't do anything for stderr
    
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.log({
      timestamp: new Date().toISOString(),
      requestId: "req-1",
      tool: "test_tool",
      category: "operation",
      scope: "read",
      durationMs: 100,
      success: true,
      scopes: []
    } as AuditEntry);
    
    await logger.flush();
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("should write logs to systemDb", async () => {
    logger = new AuditLogger({ enabled: true, logPath: "db", logRetentionDays: 1 }, systemDb);
    
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      requestId: "req-2",
      tool: "test_tool2",
      category: "security",
      scope: "write",
      durationMs: 150,
      success: false,
      error: "test error",
      scopes: ["write"],
      args: { test: 123 },
      user: "user1"
    };

    logger.log(entry);
    await logger.flush();

    const recent = await logger.recent();
    expect(recent.length).toBe(1);
    expect(recent[0].tool).toBe("test_tool2");
    expect(recent[0].success).toBe(false);
    expect(recent[0].error).toBe("test error");
    expect(recent[0].scopes).toEqual(["write"]);
    expect(recent[0].args).toEqual({ test: 123 });
    expect(recent[0].user).toBe("user1");
  });

  it("should handle search with filters", async () => {
    logger = new AuditLogger({ enabled: true, logPath: "db", logRetentionDays: 1 }, systemDb);
    
    logger.log({
      timestamp: "2024-01-01T10:00:00Z",
      requestId: "req-1",
      tool: "tool_a",
      category: "operation",
      scope: "read",
      durationMs: 10,
      success: true,
      scopes: []
    } as AuditEntry);

    logger.log({
      timestamp: "2024-01-01T11:00:00Z",
      requestId: "req-2",
      tool: "tool_b",
      category: "security",
      scope: "write",
      durationMs: 20,
      success: false,
      scopes: []
    } as AuditEntry);

    await logger.flush();

    // Search by tool
    let searchRes = await logger.search({ tool: "tool_a" });
    expect(searchRes.entries.length).toBe(1);
    expect(searchRes.entries[0].tool).toBe("tool_a");
    expect(searchRes.totalCount).toBe(1);

    // Search by category
    searchRes = await logger.search({ category: "security" });
    expect(searchRes.entries.length).toBe(1);
    expect(searchRes.entries[0].category).toBe("security");

    // Search by success
    searchRes = await logger.search({ success: false });
    expect(searchRes.entries.length).toBe(1);
    expect(searchRes.entries[0].success).toBe(false);

    // Search by requestId
    searchRes = await logger.search({ requestId: "req-2" });
    expect(searchRes.entries.length).toBe(1);
    expect(searchRes.entries[0].requestId).toBe("req-2");

    // Search by timestamp range
    searchRes = await logger.search({ 
      fromTimestamp: "2024-01-01T09:00:00Z",
      toTimestamp: "2024-01-01T10:30:00Z"
    });
    expect(searchRes.entries.length).toBe(1);
    expect(searchRes.entries[0].tool).toBe("tool_a");
  });

  it("should not throw on DB write failure", async () => {
    logger = new AuditLogger({ enabled: true, logPath: "db", logRetentionDays: 1 }, systemDb);
    
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    
    // Break the DB to simulate failure
    systemDb.getDb().exec("DROP TABLE audit_logs");
    
    logger.log({
      timestamp: new Date().toISOString(),
      requestId: "req-fail",
      tool: "tool",
      category: "operation",
      scope: "read",
      durationMs: 10,
      success: true,
      scopes: []
    } as AuditEntry);

    // This should not throw, but it should log to stderr
    await expect(logger.flush()).resolves.not.toThrow();
    
    expect(stderrSpy).toHaveBeenCalled();
    const callStr = stderrSpy.mock.calls.map(c => c.join(" ")).join(" ");
    expect(callStr).toContain("[AUDIT] Write failed");

    stderrSpy.mockRestore();
  });

  it("should handle empty systemDb for recent and search", async () => {
    logger = new AuditLogger({ enabled: true, logPath: "db", logRetentionDays: 1 }, null);
    
    const recent = await logger.recent();
    expect(recent).toEqual([]);

    const searchRes = await logger.search({ tool: "foo" });
    expect(searchRes.entries).toEqual([]);
    expect(searchRes.totalCount).toBe(0);
  });

  it("should safely close", async () => {
    logger = new AuditLogger({ enabled: true, logPath: "db", logRetentionDays: 1 }, systemDb);
    logger.log({
      timestamp: new Date().toISOString(),
      requestId: "req-1",
      tool: "test_tool",
      category: "operation",
      scope: "read",
      durationMs: 10,
      success: true,
      scopes: []
    } as AuditEntry);
    
    await logger.close();
    
    const recent = await logger.recent();
    expect(recent.length).toBe(1);
  });
});
