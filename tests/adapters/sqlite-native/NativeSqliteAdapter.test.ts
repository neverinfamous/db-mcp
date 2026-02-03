/**
 * NativeSqliteAdapter Tests
 *
 * Tests for the native better-sqlite3 adapter implementation.
 * Target: 49% → 70%+ coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NativeSqliteAdapter } from "../../../src/adapters/sqlite-native/NativeSqliteAdapter.js";
import type { SqliteConfig } from "../../../src/adapters/sqlite/types.js";

describe("NativeSqliteAdapter", () => {
  let adapter: NativeSqliteAdapter;

  beforeEach(() => {
    adapter = new NativeSqliteAdapter();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
    vi.restoreAllMocks();
  });

  describe("Basic Properties", () => {
    it("should return correct type", () => {
      expect(adapter.type).toBe("sqlite");
    });

    it("should return correct name", () => {
      expect(adapter.name).toBe("Native SQLite Adapter (better-sqlite3)");
    });

    it("should return version", () => {
      expect(adapter.version).toBe("1.0.0");
    });

    it("should identify as native backend", () => {
      expect(adapter.isNativeBackend()).toBe(true);
    });

    it("should return :memory: as default configured path", () => {
      expect(adapter.getConfiguredPath()).toBe(":memory:");
    });
  });

  describe("Connection", () => {
    it("should connect to in-memory database", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
      };

      await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);
    });

    it("should reject non-sqlite config type", () => {
      const invalidConfig = {
        type: "postgres",
        connectionString: "postgres://localhost",
      };

      // connect() throws synchronously for invalid config type
      expect(() => adapter.connect(invalidConfig as never)).toThrow(
        "Invalid database type",
      );
    });

    it("should use connectionString if filePath not provided", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        connectionString: ":memory:",
      };

      await adapter.connect(config);
      expect(adapter.getConfiguredPath()).toBe(":memory:");
    });

    it("should default to :memory: if neither path provided", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
      };

      await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);
    });

    it("should disconnect successfully", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
      };

      await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);

      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it("should handle disconnect when not connected", async () => {
      // Should not throw
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("Options", () => {
    it("should apply walMode option", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
        options: {
          walMode: true,
        },
      };

      await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);
    });

    it("should apply foreignKeys option", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
        options: {
          foreignKeys: true,
        },
      };

      await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);
    });

    it("should apply busyTimeout option", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
        options: {
          busyTimeout: 5000,
        },
      };

      await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);
    });

    it("should apply cacheSize option", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
        options: {
          cacheSize: 10000,
        },
      };

      await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);
    });
  });

  describe("Health", () => {
    it("should return healthy status when connected", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
      };

      await adapter.connect(config);
      const health = await adapter.getHealth();

      expect(health.connected).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.details?.backend).toBe("better-sqlite3");
    });

    it("should return unhealthy status when not connected", async () => {
      const health = await adapter.getHealth();

      expect(health.connected).toBe(false);
      expect(health.latencyMs).toBe(0);
    });
  });

  describe("Query Execution", () => {
    beforeEach(async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
      };
      await adapter.connect(config);
    });

    it("should execute read query", async () => {
      const result = await adapter.executeReadQuery("SELECT 1 as value");
      expect(result.rows).toHaveLength(1);
      expect(result.rows?.[0]).toEqual({ value: 1 });
    });

    it("should execute read query with parameters", async () => {
      const result = await adapter.executeReadQuery(
        "SELECT ? as a, ? as b",
        [10, 20],
      );
      expect(result.rows?.[0]).toEqual({ a: 10, b: 20 });
    });

    it("should convert boolean params to integers", async () => {
      const result = await adapter.executeReadQuery("SELECT ? as t, ? as f", [
        true,
        false,
      ]);
      expect(result.rows?.[0]).toEqual({ t: 1, f: 0 });
    });

    it("should execute write query", async () => {
      await adapter.executeWriteQuery(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)",
      );
      const result = await adapter.executeWriteQuery(
        "INSERT INTO test (name) VALUES (?)",
        ["Alice"],
      );
      expect(result.rowsAffected).toBe(1);
    });

    it("should route SELECT to read query via executeQuery", async () => {
      const result = await adapter.executeQuery("SELECT 42 as answer");
      expect(result.rows?.[0]).toEqual({ answer: 42 });
    });

    it("should route PRAGMA to read query via executeQuery", async () => {
      const result = await adapter.executeQuery("PRAGMA table_list");
      expect(result.rows).toBeDefined();
    });

    it("should route EXPLAIN to read query via executeQuery", async () => {
      const result = await adapter.executeQuery("EXPLAIN SELECT 1");
      expect(result.rows).toBeDefined();
    });

    it("should route INSERT to write query via executeQuery", async () => {
      await adapter.executeQuery("CREATE TABLE test2 (id INTEGER PRIMARY KEY)");
      const result = await adapter.executeQuery(
        "INSERT INTO test2 DEFAULT VALUES",
      );
      expect(result.rowsAffected).toBe(1);
    });

    it("should throw for query when not connected", async () => {
      await adapter.disconnect();
      // ensureConnected throws synchronously
      expect(() => adapter.executeQuery("SELECT 1")).toThrow("Not connected");
    });
  });

  describe("Schema Operations", () => {
    beforeEach(async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
      };
      await adapter.connect(config);

      // Create test tables
      await adapter.executeWriteQuery(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )
      `);
      await adapter.executeWriteQuery(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          title TEXT
        )
      `);
      await adapter.executeWriteQuery(
        "CREATE INDEX idx_posts_user ON posts(user_id)",
      );
    });

    it("should list tables", async () => {
      const tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).toContain("users");
      expect(tables.map((t) => t.name)).toContain("posts");
    });

    it("should describe a table", async () => {
      const tableInfo = await adapter.describeTable("users");
      expect(tableInfo.name).toBe("users");
      expect(tableInfo.columns).toHaveLength(3);
      expect(tableInfo.columns?.map((c) => c.name)).toEqual([
        "id",
        "name",
        "email",
      ]);
    });

    it("should throw for non-existent table", () => {
      // describeTable throws synchronously before returning Promise
      expect(() => adapter.describeTable("nonexistent")).toThrow(
        "does not exist",
      );
    });

    it("should get all indexes", () => {
      const indexes = adapter.getAllIndexes();
      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain("idx_posts_user");
    });

    it("should list schemas (returns main)", async () => {
      const schemas = await adapter.listSchemas();
      expect(schemas).toEqual(["main"]);
    });

    it("should get schema info", async () => {
      const schema = await adapter.getSchema();
      expect(schema.tables.map((t) => t.name)).toContain("users");
    });
  });

  describe("Capabilities", () => {
    it("should return full capabilities", () => {
      const caps = adapter.getCapabilities();
      expect(caps.json).toBe(true);
      expect(caps.fullTextSearch).toBe(true);
      expect(caps.vector).toBe(true);
      expect(caps.transactions).toBe(true);
      expect(caps.windowFunctions).toBe(true);
      expect(caps.connectionPooling).toBe(false); // better-sqlite3 is single-connection
    });

    it("should return supported tool groups", () => {
      const groups = adapter.getSupportedToolGroups();
      expect(groups).toContain("core");
      expect(groups).toContain("json");
      expect(groups).toContain("text");
      expect(groups).toContain("stats");
      expect(groups).toContain("admin");
    });
  });

  describe("Tool and Resource Definitions", () => {
    beforeEach(async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
      };
      await adapter.connect(config);
    });

    it("should return tool definitions", () => {
      const tools = adapter.getToolDefinitions();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some((t) => t.name === "sqlite_read_query")).toBe(true);
    });

    it("should return resource definitions", () => {
      const resources = adapter.getResourceDefinitions();
      expect(resources.length).toBeGreaterThan(0);
    });

    it("should return prompt definitions", () => {
      const prompts = adapter.getPromptDefinitions();
      expect(prompts.length).toBeGreaterThan(0);
    });
  });

  describe("FTS5 Detection", () => {
    it("should detect FTS5 availability in health details", async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
      };
      await adapter.connect(config);

      const health = await adapter.getHealth();
      // FTS5 is typically available in better-sqlite3
      expect(typeof health.details?.fts5).toBe("boolean");
    });
  });

  describe("FTS Shadow Table Filtering", () => {
    beforeEach(async () => {
      const config: SqliteConfig = {
        type: "sqlite",
        filePath: ":memory:",
      };
      await adapter.connect(config);

      // Create a table and FTS index
      await adapter.executeWriteQuery(
        "CREATE TABLE articles (id INTEGER PRIMARY KEY, title TEXT, body TEXT)",
      );
      await adapter.executeWriteQuery(
        "CREATE VIRTUAL TABLE articles_fts USING fts5(title, body, content=articles)",
      );
    });

    it("should filter out FTS virtual tables from listTables", async () => {
      const tables = await adapter.listTables();
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain("articles");
      expect(tableNames).not.toContain("articles_fts");
      expect(tableNames).not.toContain("articles_fts_data");
      expect(tableNames).not.toContain("articles_fts_config");
    });
  });
});
