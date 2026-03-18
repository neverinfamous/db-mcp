/**
 * SQLite Adapter Integration Tests
 *
 * Tests the SqliteAdapter class methods that were previously uncovered:
 * getHealth, getCapabilities, getSupportedToolGroups, listSchemas,
 * getIndexes, clearSchemaCache, isNativeBackend, getConfiguredPath,
 * ensureConnected, ensureDb, getDatabase, rawQuery.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  SqliteAdapter,
  createSqliteAdapter,
} from "../../../src/adapters/sqlite/sqlite-adapter.js";

// =============================================================================
// Factory
// =============================================================================

describe("createSqliteAdapter", () => {
  it("should create an adapter instance", () => {
    const adapter = createSqliteAdapter();
    expect(adapter).toBeInstanceOf(SqliteAdapter);
    expect(adapter.type).toBe("sqlite");
    expect(adapter.name).toBe("SQLite Adapter");
  });
});

// =============================================================================
// Pre-connection checks
// =============================================================================

describe("SqliteAdapter - not connected", () => {
  it("isNativeBackend should return false", () => {
    const adapter = createSqliteAdapter();
    expect(adapter.isNativeBackend()).toBe(false);
  });

  it("getConfiguredPath should return :memory: by default", () => {
    const adapter = createSqliteAdapter();
    expect(adapter.getConfiguredPath()).toBe(":memory:");
  });

  it("getHealth should report not connected", async () => {
    const adapter = createSqliteAdapter();
    const health = await adapter.getHealth();
    expect(health.connected).toBe(false);
  });

  it("executeReadQuery should throw when not connected", () => {
    const adapter = createSqliteAdapter();
    // ensureConnected() throws synchronously before any promise is returned
    expect(() => adapter.executeReadQuery("SELECT 1")).toThrow();
  });

  it("getDatabase should throw when not connected", () => {
    const adapter = createSqliteAdapter();
    expect(() => adapter.getDatabase()).toThrow();
  });
});

// =============================================================================
// Connected state
// =============================================================================

describe("SqliteAdapter - connected (in-memory)", () => {
  let adapter: SqliteAdapter;

  afterEach(async () => {
    if (adapter) {
      try {
        await adapter.disconnect();
      } catch {
        /* already disconnected */
      }
    }
  });

  it("should connect to in-memory database", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });
    expect(adapter.isConnected()).toBe(true);
  });

  it("getHealth should report connected with version", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const health = await adapter.getHealth();
    expect(health.connected).toBe(true);
    expect(health.version).toBeDefined();
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("getCapabilities should return correct flags", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const caps = adapter.getCapabilities();
    expect(caps.json).toBe(true);
    expect(caps.fullTextSearch).toBe(false);
    expect(caps.vector).toBe(true);
    expect(caps.geospatial).toBe(false);
    expect(caps.transactions).toBe(true);
    expect(caps.connectionPooling).toBe(false);
  });

  it("getSupportedToolGroups should include all groups", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const groups = adapter.getSupportedToolGroups();
    expect(groups).toContain("core");
    expect(groups).toContain("json");
    expect(groups).toContain("stats");
    expect(groups).toContain("admin");
    expect(groups).toContain("migration");
  });

  it("listSchemas should return ['main']", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const schemas = await adapter.listSchemas();
    expect(schemas).toEqual(["main"]);
  });

  it("executeReadQuery should work", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const result = await adapter.executeReadQuery("SELECT 1 as n");
    expect(result.rows).toBeDefined();
  });

  it("executeWriteQuery should work", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    await adapter.executeWriteQuery(
      "CREATE TABLE test_sa (id INTEGER PRIMARY KEY)",
    );
    const result = await adapter.executeWriteQuery(
      "INSERT INTO test_sa VALUES (1)",
    );
    expect(result.rowsAffected).toBe(1);
  });

  it("executeWriteQuery should invalidate schema cache on DDL", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    await adapter.executeWriteQuery("CREATE TABLE cache_test (id INTEGER)");
    const result = await adapter.executeReadQuery(
      "SELECT name FROM sqlite_master WHERE name = 'cache_test'",
    );
    expect(result.rows).toHaveLength(1);
  });

  it("executeQuery should work for PRAGMA", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const result = await adapter.executeQuery("PRAGMA table_list");
    expect(result).toBeDefined();
  });

  it("getSchema should return schema info", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    await adapter.executeWriteQuery("CREATE TABLE gs_test (id INTEGER)");
    const schema = await adapter.getSchema();
    expect(schema.tables).toBeDefined();
  });

  it("listTables should return tables", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    await adapter.executeWriteQuery("CREATE TABLE lt_test (id INTEGER)");
    const tables = await adapter.listTables();
    expect(tables.length).toBeGreaterThan(0);
  });

  it("describeTable should return table info", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    await adapter.executeWriteQuery(
      "CREATE TABLE dt_test (id INTEGER PRIMARY KEY, name TEXT)",
    );
    const info = await adapter.describeTable("dt_test");
    expect(info.name).toBe("dt_test");
    expect(info.columns.length).toBeGreaterThan(0);
  });

  it("getIndexes should return indexes", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    await adapter.executeWriteQuery(
      "CREATE TABLE idx_test (id INTEGER, name TEXT)",
    );
    await adapter.executeWriteQuery("CREATE INDEX idx_name ON idx_test(name)");

    const indexes = await adapter.getIndexes("idx_test");
    expect(indexes.length).toBeGreaterThan(0);
  });

  it("getAllIndexes should work", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const indexes = await adapter.getAllIndexes();
    expect(Array.isArray(indexes)).toBe(true);
  });

  it("clearSchemaCache should not throw", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    expect(() => adapter.clearSchemaCache()).not.toThrow();
  });

  it("getDatabase should return Database instance", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const db = adapter.getDatabase();
    expect(db).toBeDefined();
    expect(typeof db.exec).toBe("function");
  });

  it("rawQuery should work", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const result = await adapter.rawQuery("SELECT sqlite_version()");
    expect(result).toBeDefined();
  });

  it("getToolDefinitions should return tools", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const tools = adapter.getToolDefinitions();
    expect(tools.length).toBeGreaterThan(50);
  });

  it("getResourceDefinitions should return resources", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const resources = adapter.getResourceDefinitions();
    expect(resources.length).toBeGreaterThan(0);
  });

  it("getPromptDefinitions should return prompts", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });

    const prompts = adapter.getPromptDefinitions();
    expect(prompts.length).toBeGreaterThan(0);
  });

  it("disconnect should close connection", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });
    await adapter.disconnect();

    const health = await adapter.getHealth();
    expect(health.connected).toBe(false);
  });

  it("disconnect should be safe when already disconnected", async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite" });
    await adapter.disconnect();
    await adapter.disconnect();
  });
});
