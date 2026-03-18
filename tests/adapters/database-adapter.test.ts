/**
 * DatabaseAdapter Tests
 *
 * Tests for the abstract DatabaseAdapter base class.
 * Uses NativeSqliteAdapter as a concrete implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, type TestAdapter } from "../utils/test-adapter.js";

describe("DatabaseAdapter", () => {
  let adapter: TestAdapter;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create a table for testing
    await adapter.executeWriteQuery(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY,
        name TEXT
      )
    `);
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("isConnected", () => {
    it("should return true when connected", () => {
      expect(adapter.isConnected()).toBe(true);
    });

    it("should return false after disconnect", async () => {
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("getInfo", () => {
    it("should return adapter info", () => {
      const info = adapter.getInfo();

      expect(info.type).toBe("sqlite");
      expect(info.name).toBeDefined();
      expect(info.version).toBeDefined();
      expect(info.connected).toBe(true);
      expect("capabilities" in info).toBe(true);
      expect("toolGroups" in info).toBe(true);
    });
  });

  describe("getCapabilities", () => {
    it("should return capability object", () => {
      const caps = adapter.getCapabilities();

      expect(typeof caps.json).toBe("boolean");
      expect(typeof caps.fullTextSearch).toBe("boolean");
      expect(typeof caps.transactions).toBe("boolean");
    });
  });

  describe("getSupportedToolGroups", () => {
    it("should return array of tool groups", () => {
      const groups = adapter.getSupportedToolGroups();

      expect(Array.isArray(groups)).toBe(true);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups).toContain("core");
    });
  });

  describe("getToolDefinitions", () => {
    it("should return array of tool definitions", () => {
      const tools = adapter.getToolDefinitions();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).toHaveProperty("name");
      expect(tools[0]).toHaveProperty("handler");
    });
  });

  describe("getResourceDefinitions", () => {
    it("should return array of resource definitions", () => {
      const resources = adapter.getResourceDefinitions();

      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0]).toHaveProperty("uri");
      expect(resources[0]).toHaveProperty("handler");
    });
  });

  describe("getPromptDefinitions", () => {
    it("should return array of prompt definitions", () => {
      const prompts = adapter.getPromptDefinitions();

      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);
      expect(prompts[0]).toHaveProperty("name");
      expect(prompts[0]).toHaveProperty("handler");
    });
  });

  describe("getSchema", () => {
    it("should return schema info", async () => {
      const schema = await adapter.getSchema();

      expect(schema).toHaveProperty("tables");
      expect(Array.isArray(schema.tables)).toBe(true);
    });
  });

  describe("listTables", () => {
    it("should return list of tables", async () => {
      const tables = await adapter.listTables();

      expect(Array.isArray(tables)).toBe(true);
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain("test_table");
    });
  });

  describe("describeTable", () => {
    it("should describe a table", async () => {
      const tableInfo = await adapter.describeTable("test_table");

      expect(tableInfo.name).toBe("test_table");
      expect(tableInfo.columns?.length).toBe(2);
      expect(tableInfo.columns?.[0]?.name).toBe("id");
    });

    it("should handle non-existent table", async () => {
      try {
        const result = await adapter.describeTable("nonexistent_table");
        // If it doesn't throw, columns should be empty
        expect(result.columns?.length ?? 0).toBe(0);
      } catch {
        // Expected to throw for non-existent table
        expect(true).toBe(true);
      }
    });
  });

  describe("listSchemas", () => {
    it("should return list of schemas", async () => {
      const schemas = await adapter.listSchemas();

      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas).toContain("main");
    });
  });
});
