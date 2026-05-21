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

  it("should load database from existing file", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = { type: "sqlite", filePath: "existing.db" };
    
    vi.mock("fs", () => {
      return {
        existsSync: () => true,
        promises: {
          readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        }
      };
    });

    const result = await connectSqliteDatabase(adapter as never, config);
    expect(result.db).toBeDefined();
    vi.unmock("fs");
  });

  it("should create new database if file doesn't exist", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = { type: "sqlite", filePath: "new.db" };
    
    vi.mock("fs", () => {
      return {
        existsSync: () => false,
        promises: {
          readFile: vi.fn(),
        }
      };
    });

    const result = await connectSqliteDatabase(adapter as never, config);
    expect(result.db).toBeDefined();
    vi.unmock("fs");
  });

  it("should fallback to memory if fs throws error during connect", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = { type: "sqlite", filePath: "error.db" };
    
    vi.mock("fs", () => {
      return {
        existsSync: () => true,
        promises: {
          readFile: vi.fn().mockRejectedValue(new Error("File access error")),
        }
      };
    });

    const result = await connectSqliteDatabase(adapter as never, config);
    expect(result.db).toBeDefined();
    vi.unmock("fs");
  });

  it("should catch and wrap initial connection errors", async () => {
    const adapter = createMockAdapter();
    const config = { 
      type: "sqlite", 
      get filePath(): string {
        throw new Error("Simulated connection error");
      }
    } as unknown as SqliteConfig;
    
    await expect(
      connectSqliteDatabase(adapter as never, config),
    ).rejects.toThrow("SQLite connection failed: Simulated connection error");
  });
});

// =============================================================================
// disconnectSqliteDatabase
// =============================================================================

describe("disconnectSqliteDatabase", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

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

  it("should save database to file if path is not :memory:", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = { type: "sqlite", filePath: "test.db" };
    
    // We mock fs in a specific test so it doesn't leak
    vi.mock("fs", () => {
      return {
        existsSync: () => false,
        promises: {
          readFile: vi.fn(),
          writeFile: vi.fn().mockResolvedValue(undefined),
        }
      };
    });
    
    const { db } = await connectSqliteDatabase(adapter as never, config);
    // Overwrite the export method for testing
    db.export = vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
    
    await disconnectSqliteDatabase(db, config);
    
    // vitest unmock
    vi.unmock("fs");
  });

  it("should handle error when saving database to file", async () => {
    const adapter = createMockAdapter();
    const config: SqliteConfig = { type: "sqlite", filePath: "test.db" };
    
    vi.mock("fs", () => {
      return {
        existsSync: () => false,
        promises: {
          writeFile: vi.fn().mockRejectedValue(new Error("Save failed")),
        }
      };
    });
    
    const { db } = await connectSqliteDatabase(adapter as never, config);
    await disconnectSqliteDatabase(db, config); // Should log warning but not throw
    
    vi.unmock("fs");
  });
});
