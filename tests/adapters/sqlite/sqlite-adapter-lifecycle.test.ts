/**
 * SQLite Adapter Lifecycle Unit Tests
 *
 * Tests connect and disconnect functions for the WASM adapter.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  connectSqliteDatabase,
  disconnectSqliteDatabase,
} from "../../../src/adapters/sqlite/sqlite-adapter/lifecycle.js";
import { ConfigurationError } from "../../../src/utils/errors/index.js";

// =============================================================================
// Helpers
// =============================================================================

function createMockAdapter() {
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
    executeRawQuery: vi.fn(),
  };
}

// =============================================================================
// connectSqliteDatabase
// =============================================================================

describe("connectSqliteDatabase", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw ConfigurationError for non-sqlite type", async () => {
    const adapter = createMockAdapter();

    await expect(
      connectSqliteDatabase(adapter as any, {
        type: "postgres" as any,
        connectionString: "test",
      }),
    ).rejects.toThrow(ConfigurationError);
  });

  it("should connect to in-memory database", async () => {
    const adapter = createMockAdapter();

    const result = await connectSqliteDatabase(adapter as any, {
      type: "sqlite",
      connectionString: ":memory:",
    });

    expect(result.db).toBeDefined();
    expect(result.sqlJsInstance).toBeDefined();
    expect(result.schemaManager).toBeDefined();

    result.db.close();
  });

  it("should default to :memory: when no file path given", async () => {
    const adapter = createMockAdapter();

    const result = await connectSqliteDatabase(
      adapter as any,
      {
        type: "sqlite",
      } as any,
    );

    expect(result.db).toBeDefined();

    result.db.close();
  });

  it("should apply pragma options", async () => {
    const adapter = createMockAdapter();

    const result = await connectSqliteDatabase(
      adapter as any,
      {
        type: "sqlite",
        connectionString: ":memory:",
        options: {
          foreignKeys: true,
        },
      } as any,
    );

    expect(result.db).toBeDefined();

    result.db.close();
  });

  it("should execute initializationSql on connect", async () => {
    const adapter = createMockAdapter();

    const result = await connectSqliteDatabase(
      adapter as any,
      {
        type: "sqlite",
        connectionString: ":memory:",
        initializationSql: [
          "CREATE TABLE init_test (id INTEGER PRIMARY KEY, val TEXT)",
          "INSERT INTO init_test (id, val) VALUES (1, 'initialized')",
        ],
      } as any,
    );

    const queryResult = result.db.exec(
      "SELECT val FROM init_test WHERE id = 1",
    );
    expect(queryResult[0]?.values[0]?.[0]).toBe("initialized");

    result.db.close();
  });
});

// =============================================================================
// disconnectSqliteDatabase
// =============================================================================

describe("disconnectSqliteDatabase", () => {
  it("should close the database", async () => {
    const adapter = createMockAdapter();
    const { db } = await connectSqliteDatabase(adapter as any, {
      type: "sqlite",
      connectionString: ":memory:",
    });

    await disconnectSqliteDatabase(db, null);

    // After close, operations should throw
    expect(() => db.run("SELECT 1")).toThrow();
  });

  it("should close memory database with null config", async () => {
    const adapter = createMockAdapter();
    const { db } = await connectSqliteDatabase(adapter as any, {
      type: "sqlite",
      connectionString: ":memory:",
    });

    await expect(disconnectSqliteDatabase(db, null)).resolves.not.toThrow();
  });
});
