/**
 * db-mcp — Audit Logger Tests
 *
 * Validates the JSONL audit logger: buffered writes, rotation,
 * recent() tail-read, stderr mode, and graceful close.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuditLogger } from "./logger.js";
import { readFile, rm, stat, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AuditEntry, AuditConfig } from "./types.js";

/** Create a temporary directory for each test */
async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "db-mcp-audit-test-"));
}

/** Create a minimal audit entry */
function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    requestId: "req-1",
    tool: "sqlite_write_query",
    category: "write",
    scope: "write",
    user: null,
    scopes: [],
    durationMs: 42,
    success: true,
    ...overrides,
  };
}

/** Create a default test config */
function makeConfig(
  dir: string,
  overrides: Partial<AuditConfig> = {},
): AuditConfig {
  return {
    enabled: true,
    logPath: join(dir, "audit.jsonl"),
    redact: false,
    auditReads: false,
    maxSizeBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

describe("AuditLogger", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await tempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes JSONL entries to disk on flush", async () => {
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);

    logger.log(makeEntry({ tool: "sqlite_read_query" }));
    logger.log(makeEntry({ tool: "sqlite_write_query" }));
    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0] ?? "") as AuditEntry;
    expect(first.tool).toBe("sqlite_read_query");

    const second = JSON.parse(lines[1] ?? "") as AuditEntry;
    expect(second.tool).toBe("sqlite_write_query");
  });

  it("does not write when disabled", async () => {
    const config = makeConfig(dir, { enabled: false });
    const logger = new AuditLogger(config);

    logger.log(makeEntry());
    await logger.close();

    // File should not exist
    await expect(stat(config.logPath)).rejects.toThrow();
  });

  it("recent() returns the last N entries", async () => {
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);

    for (let i = 0; i < 10; i++) {
      logger.log(makeEntry({ requestId: `req-${String(i)}` }));
    }
    await logger.flush();

    const recent = await logger.recent(3);
    expect(recent).toHaveLength(3);
    expect(recent[0]?.requestId).toBe("req-7");
    expect(recent[2]?.requestId).toBe("req-9");

    await logger.close();
  });

  it("recent() returns empty for stderr mode", async () => {
    const config = makeConfig(dir, { logPath: "stderr" });
    const logger = new AuditLogger(config);

    logger.log(makeEntry());
    await logger.flush();

    const recent = await logger.recent();
    expect(recent).toHaveLength(0);

    await logger.close();
  });

  it("recent() returns empty when no file exists", async () => {
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);

    const recent = await logger.recent();
    expect(recent).toHaveLength(0);

    await logger.close();
  });

  it("rotates log file when exceeding maxSizeBytes", async () => {
    const config = makeConfig(dir, { maxSizeBytes: 200 });
    const logger = new AuditLogger(config);

    // Write enough entries to exceed 200 bytes
    for (let i = 0; i < 5; i++) {
      logger.log(makeEntry({ requestId: `req-${String(i)}` }));
    }
    await logger.flush();

    // Write more to trigger rotation
    for (let i = 5; i < 10; i++) {
      logger.log(makeEntry({ requestId: `req-${String(i)}` }));
    }
    await logger.flush();

    await logger.close();

    // The rotated file (.1) should exist
    const rotatedPath = `${config.logPath}.1`;
    const rotatedStat = await stat(rotatedPath).catch(() => null);
    expect(rotatedStat).not.toBeNull();
  });

  it("close() stops accepting new entries", async () => {
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);

    logger.log(makeEntry({ requestId: "before-close" }));
    await logger.close();

    // Entries after close are silently dropped
    logger.log(makeEntry({ requestId: "after-close" }));
    await logger.flush();

    const content = await readFile(config.logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? "") as AuditEntry;
    expect(entry.requestId).toBe("before-close");
  });

  it("handles concurrent flush calls safely", async () => {
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);

    for (let i = 0; i < 20; i++) {
      logger.log(makeEntry({ requestId: `req-${String(i)}` }));
    }

    // Fire multiple flushes concurrently
    await Promise.all([logger.flush(), logger.flush(), logger.flush()]);
    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(20);
  });
});
