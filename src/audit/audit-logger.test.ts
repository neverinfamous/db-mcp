/**
 * db-mcp — Audit Logger Tests
 *
 * Validates the SystemDb audit logger: batched writes,
 * recent() queries, stderr mode, and graceful close.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuditLogger } from "./logger.js";
import { SystemDb } from "../observability/system-db.js";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AuditEntry, AuditConfig } from "./types.js";

/** Create a temporary directory for each test */
function tempDir(): string {
  return join(
    tmpdir(),
    `db-mcp-audit-test-${Date.now()}-${String(Math.random()).slice(2, 8)}`,
  );
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
    logPath: join(dir, "system.db"),
    redact: false,
    auditReads: false,
    maxSizeBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

describe("AuditLogger", () => {
  let dir: string;
  let systemDb: SystemDb | null;

  beforeEach(async () => {
    dir = tempDir();
    await mkdir(dir, { recursive: true });
    systemDb = null;
  });

  afterEach(async () => {
    if (systemDb) {
      systemDb.close();
    }
    await rm(dir, { recursive: true, force: true });
  });

  it("writes entries to SystemDb on flush", async () => {
    const config = makeConfig(dir);
    systemDb = new SystemDb({ dbPath: config.logPath });
    await systemDb.init();
    const logger = new AuditLogger(config, systemDb);

    logger.log(makeEntry({ tool: "sqlite_read_query" }));
    logger.log(makeEntry({ tool: "sqlite_write_query" }));
    await logger.close();

    const recent = await logger.recent(10);
    expect(recent).toHaveLength(2);
    const tools = recent.map((r) => r.tool);
    expect(tools).toContain("sqlite_read_query");
    expect(tools).toContain("sqlite_write_query");
  });

  it("does not write when disabled", async () => {
    const config = makeConfig(dir, { enabled: false });
    systemDb = new SystemDb({ dbPath: config.logPath });
    await systemDb.init();
    const logger = new AuditLogger(config, systemDb);

    logger.log(makeEntry());
    await logger.close();

    const recent = await logger.recent(10);
    expect(recent).toHaveLength(0);
  });

  it("recent() returns the last N entries", async () => {
    const config = makeConfig(dir);
    systemDb = new SystemDb({ dbPath: config.logPath });
    await systemDb.init();
    const logger = new AuditLogger(config, systemDb);

    for (let i = 0; i < 10; i++) {
      logger.log(makeEntry({ requestId: `req-${String(i)}` }));
      await new Promise((r) => setTimeout(r, 2));
    }
    await logger.flush();

    const recent = await logger.recent(3);
    expect(recent).toHaveLength(3);
    expect(recent[0]?.requestId).toBe("req-9");
    expect(recent[2]?.requestId).toBe("req-7");

    await logger.close();
  });

  it("recent() returns empty for stderr mode", async () => {
    const config = makeConfig(dir, { logPath: "stderr" });
    const logger = new AuditLogger(config, null);

    logger.log(makeEntry());
    await logger.flush();

    const recent = await logger.recent();
    expect(recent).toHaveLength(0);

    await logger.close();
  });

  it("recent() returns empty when no file exists", async () => {
    const config = makeConfig(dir);
    systemDb = new SystemDb({ dbPath: config.logPath });
    await systemDb.init();
    const logger = new AuditLogger(config, systemDb);

    const recent = await logger.recent();
    expect(recent).toHaveLength(0);

    await logger.close();
  });

  it("close() stops accepting new entries", async () => {
    const config = makeConfig(dir);
    systemDb = new SystemDb({ dbPath: config.logPath });
    await systemDb.init();
    const logger = new AuditLogger(config, systemDb);

    logger.log(makeEntry({ requestId: "before-close" }));
    await logger.close();

    logger.log(makeEntry({ requestId: "after-close" }));
    await logger.flush();

    const recent = await logger.recent(10);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.requestId).toBe("before-close");
  });

  it("handles concurrent flush calls safely", async () => {
    const config = makeConfig(dir);
    systemDb = new SystemDb({ dbPath: config.logPath });
    await systemDb.init();
    const logger = new AuditLogger(config, systemDb);

    for (let i = 0; i < 20; i++) {
      logger.log(makeEntry({ requestId: `req-${String(i)}` }));
    }

    await Promise.all([logger.flush(), logger.flush(), logger.flush()]);
    await logger.close();

    const recent = await logger.recent(100);
    expect(recent).toHaveLength(20);
  });
});
