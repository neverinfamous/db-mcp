/**
 * db-mcp — Audit Interceptor Tests
 *
 * Validates audit interception: around() wrapping, scope-based filtering,
 * token estimate injection, error handling, and read audit opt-in.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createAuditInterceptor } from "./interceptor.js";
import { AuditLogger } from "./logger.js";
import { rm, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AuditConfig, AuditEntry } from "./types.js";

/** Create a temporary directory for each test */
function tempDir(): string {
  return join(
    tmpdir(),
    `db-mcp-interceptor-test-${Date.now()}-${String(Math.random()).slice(2, 8)}`,
  );
}

/** Create a default test config */
function makeConfig(dir: string, overrides: Partial<AuditConfig> = {}): AuditConfig {
  return {
    enabled: true,
    logPath: join(dir, "audit.jsonl"),
    redact: false,
    auditReads: false,
    maxSizeBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

describe("AuditInterceptor", () => {
  let dir: string;

  beforeEach(async () => {
    dir = tempDir();
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("logs write tool invocations with around()", async () => {
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    const result = await interceptor.around(
      "migration_apply",
      { sql: "CREATE TABLE test (id INTEGER)" },
      "req-1",
      async () => ({ success: true, rowsAffected: 1 }),
    );

    expect(result).toEqual({ success: true, rowsAffected: 1 });
    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0] ?? "") as AuditEntry;
    expect(entry.tool).toBe("migration_apply");
    expect(entry.category).toBe("write");
    expect(entry.success).toBe(true);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry.tokenEstimate).toBeGreaterThan(0);
  });

  it("does not log read tools when auditReads is false", async () => {
    const config = makeConfig(dir, { auditReads: false });
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    await interceptor.around(
      "read_query",
      { sql: "SELECT 1" },
      "req-1",
      async () => ({ rows: [{ value: 1 }] }),
    );

    await logger.close();

    // File should not exist or be empty — read tools are skipped
    try {
      const content = await readFile(config.logPath, "utf-8");
      expect(content.trim()).toBe("");
    } catch {
      // File doesn't exist — that's fine
    }
  });

  it("logs read tools when auditReads is true", async () => {
    const config = makeConfig(dir, { auditReads: true });
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    await interceptor.around(
      "read_query",
      { sql: "SELECT 1" },
      "req-1",
      async () => ({ rows: [{ value: 1 }] }),
    );

    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0] ?? "") as AuditEntry;
    expect(entry.tool).toBe("read_query");
    expect(entry.category).toBe("read");
  });

  it("records errors and re-throws", async () => {
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    await expect(
      interceptor.around(
        "migration_apply",
        { sql: "INVALID" },
        "req-1",
        async () => {
          throw new Error("syntax error");
        },
      ),
    ).rejects.toThrow("syntax error");

    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const entry = JSON.parse(content.trim()) as AuditEntry;
    expect(entry.success).toBe(false);
    expect(entry.error).toBe("syntax error");
    expect(entry.tokenEstimate).toBeGreaterThan(0);
  });

  it("redacts args when redact is enabled", async () => {
    const config = makeConfig(dir, { redact: true });
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    await interceptor.around(
      "migration_apply",
      { sql: "INSERT INTO secrets VALUES ('password123')" },
      "req-1",
      async () => ({ success: true }),
    );

    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const entry = JSON.parse(content.trim()) as AuditEntry;
    expect(entry.args).toBeUndefined();
  });

  it("includes args when redact is disabled", async () => {
    const config = makeConfig(dir, { redact: false });
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    await interceptor.around(
      "migration_apply",
      { sql: "INSERT INTO test VALUES (1)" },
      "req-1",
      async () => ({ success: true }),
    );

    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const entry = JSON.parse(content.trim()) as AuditEntry;
    expect(entry.args).toBeDefined();
    expect(entry.args?.["sql"]).toBe("INSERT INTO test VALUES (1)");
  });

  it("always logs admin tools regardless of auditReads setting", async () => {
    const config = makeConfig(dir, { auditReads: false });
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    await interceptor.around(
      "vacuum",
      {},
      "req-1",
      async () => ({ success: true }),
    );

    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0] ?? "") as AuditEntry;
    expect(entry.tool).toBe("vacuum");
    expect(entry.category).toBe("admin");
  });

  it("captures null user/scopes when no auth context is active", async () => {
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    await interceptor.around(
      "migration_apply",
      { sql: "INSERT INTO t VALUES (1)" },
      "req-1",
      async () => ({ success: true }),
    );

    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const entry = JSON.parse(content.trim()) as AuditEntry;
    expect(entry.user).toBeNull();
    expect(entry.scopes).toEqual([]);
  });

  it("captures OAuth identity from AsyncLocalStorage", async () => {
    const { runWithAuthContext } = await import("../auth/auth-context.js");
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    const authCtx = {
      authenticated: true as const,
      claims: {
        sub: "user-42",
        scopes: ["read", "write"],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
      scopes: ["read", "write"],
    };

    await runWithAuthContext(authCtx, async () => {
      await interceptor.around(
        "migration_apply",
        { sql: "INSERT INTO t VALUES (1)" },
        "req-1",
        async () => ({ success: true }),
      );
    });

    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const entry = JSON.parse(content.trim()) as AuditEntry;
    expect(entry.user).toBe("user-42");
    expect(entry.scopes).toEqual(["read", "write"]);
  });

  it("captures partial auth context (authenticated but no sub)", async () => {
    const { runWithAuthContext } = await import("../auth/auth-context.js");
    const config = makeConfig(dir);
    const logger = new AuditLogger(config);
    const interceptor = createAuditInterceptor(logger);

    const authCtx = {
      authenticated: true as const,
      claims: {
        sub: undefined as unknown as string,
        scopes: ["read"],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
      scopes: ["read"],
    };

    await runWithAuthContext(authCtx, async () => {
      await interceptor.around(
        "migration_apply",
        { sql: "INSERT INTO t VALUES (1)" },
        "req-1",
        async () => ({ success: true }),
      );
    });

    await logger.close();

    const content = await readFile(config.logPath, "utf-8");
    const entry = JSON.parse(content.trim()) as AuditEntry;
    expect(entry.user).toBeNull();
    expect(entry.scopes).toEqual(["read"]);
  });
});
