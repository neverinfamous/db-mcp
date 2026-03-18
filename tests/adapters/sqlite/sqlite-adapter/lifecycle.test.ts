/**
 * WASM SQLite Lifecycle Tests
 *
 * Tests for the connect/disconnect lifecycle of the WASM (sql.js) adapter,
 * including file path handling, option application, and error wrapping.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  connectSqliteDatabase,
  disconnectSqliteDatabase,
} from "../../../../src/adapters/sqlite/sqlite-adapter/lifecycle.js";
import type { SqliteConfig } from "../../../../src/adapters/sqlite/types.js";

// =============================================================================
// Helpers
// =============================================================================

function createMockAdapter() {
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
    executeQuery: vi.fn(),
    listTables: vi.fn().mockResolvedValue([]),
    describeTable: vi.fn(),
    getSchema: vi.fn(),
    isNativeBackend: vi.fn().mockReturnValue(false),
    getConfiguredPath: vi.fn().mockReturnValue(":memory:"),
  };
}

// =============================================================================
// connectSqliteDatabase
// =============================================================================

describe("connectSqliteDatabase", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should connect to an in-memory database", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = {
      type: "sqlite",
      filePath: ":memory:",
    };

    const result = await connectSqliteDatabase(adapter as never, config);

    expect(result.db).toBeDefined();
    expect(result.sqlJsInstance).toBeDefined();
    expect(result.schemaManager).toBeDefined();
  });

  it("should use connectionString when filePath is not provided", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = {
      type: "sqlite",
      connectionString: ":memory:",
    };

    const result = await connectSqliteDatabase(adapter as never, config);
    expect(result.db).toBeDefined();
  });

  it("should default to :memory: when no path is provided", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = {
      type: "sqlite",
    };

    const result = await connectSqliteDatabase(adapter as never, config);
    expect(result.db).toBeDefined();
  });

  it("should reject non-sqlite config type", async () => {
    const adapter = createMockAdapter();
    const config = {
      type: "postgres",
      connectionString: "postgres://localhost",
    };

    await expect(
      connectSqliteDatabase(adapter as never, config as never),
    ).rejects.toThrow("Invalid database type");
  });

  it("should apply options when provided", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = {
      type: "sqlite",
      filePath: ":memory:",
      options: {
        foreignKeys: true,
        busyTimeout: 5000,
      },
    };

    const result = await connectSqliteDatabase(adapter as never, config);
    expect(result.db).toBeDefined();
  });
});

// =============================================================================
// disconnectSqliteDatabase
// =============================================================================

describe("disconnectSqliteDatabase", () => {
  it("should close in-memory database without saving", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = { type: "sqlite", filePath: ":memory:" };
    const { db } = await connectSqliteDatabase(adapter as never, config);

    // Should not throw
    await disconnectSqliteDatabase(db, config);
  });

  it("should close database when config has no filePath", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = { type: "sqlite" };
    const { db } = await connectSqliteDatabase(adapter as never, config);

    // Should not throw; no save attempt since filePath is undefined
    await disconnectSqliteDatabase(db, config);
  });

  it("should close database when config is null", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = { type: "sqlite" };
    const { db } = await connectSqliteDatabase(adapter as never, config);

    // Should not throw
    await disconnectSqliteDatabase(db, null);
  });
});
