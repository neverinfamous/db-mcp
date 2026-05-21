/**
 * SQLite Resource Integration Tests
 *
 * Tests for MCP resource handlers.
 * Priority 4 of db-mcp Test Coverage Improvement Plan
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../utils/test-adapter.js";
import type { RequestContext } from "../../../src/types/index.js";

// Create a mock request context for testing
function createMockContext(): RequestContext {
  return {
    timestamp: new Date(),
    requestId: "test-request-id",
  };
}

describe("SQLite Resources", () => {
  let adapter: TestAdapter;
  let ctx: RequestContext;

  beforeEach(async () => {
    adapter = createTestAdapter();
    ctx = createMockContext();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create test data
    await adapter.executeWriteQuery(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      )
    `);
    await adapter.executeWriteQuery(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total REAL
      )
    `);
    await adapter.executeWriteQuery(`
      CREATE INDEX idx_users_email ON users(email)
    `);
    await adapter.executeWriteQuery(`
      CREATE VIEW active_users AS SELECT * FROM users WHERE id > 0
    `);
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("getResourceDefinitions", () => {
    it("should return 10 resource definitions", () => {
      const resources = adapter.getResourceDefinitions();
      expect(resources.length).toBe(10);
    });

    it("should include all expected resources", () => {
      const resources = adapter.getResourceDefinitions();
      const names = resources.map((r) => r.name);

      expect(names).toContain("sqlite_schema");
      expect(names).toContain("sqlite_tables");
      expect(names).toContain("sqlite_table_schema");
      expect(names).toContain("sqlite_indexes");
      expect(names).toContain("sqlite_views");
      expect(names).toContain("sqlite_health");
      expect(names).toContain("sqlite_meta");
      expect(names).toContain("sqlite_insights");
    });
  });

  describe("sqlite_schema resource", () => {
    it("should return full database schema", async () => {
      const resources = adapter.getResourceDefinitions();
      const schemaResource = resources.find((r) => r.name === "sqlite_schema");
      expect(schemaResource).toBeDefined();

      const result = (await schemaResource!.handler(
        "sqlite://schema",
        ctx,
      )) as {
        contents: { mimeType: string; text: string }[];
      };
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");

      const schema = JSON.parse(result.contents[0].text);
      expect(schema.tables).toBeDefined();
    });
  });

  describe("sqlite_tables resource", () => {
    it("should return list of all tables", async () => {
      const resources = adapter.getResourceDefinitions();
      const tablesResource = resources.find((r) => r.name === "sqlite_tables");
      expect(tablesResource).toBeDefined();

      const result = (await tablesResource!.handler(
        "sqlite://tables",
        ctx,
      )) as {
        contents: { text: string }[];
      };
      expect(result.contents).toHaveLength(1);

      const tables = JSON.parse(result.contents[0].text);
      expect(tables.length).toBeGreaterThanOrEqual(2);
      expect(tables.some((t: { name: string }) => t.name === "users")).toBe(
        true,
      );
    });
  });

  describe("sqlite_table_schema resource", () => {
    it("should return schema for specific table", async () => {
      const resources = adapter.getResourceDefinitions();
      const tableSchemaResource = resources.find(
        (r) => r.name === "sqlite_table_schema",
      );
      expect(tableSchemaResource).toBeDefined();

      const result = (await tableSchemaResource!.handler(
        "sqlite://table/users/schema",
        ctx,
      )) as { contents: { text: string }[] };
      expect(result.contents).toHaveLength(1);

      const tableInfo = JSON.parse(result.contents[0].text);
      expect(tableInfo.name).toBe("users");
      expect(tableInfo.columns).toBeDefined();
    });

    it("should throw for invalid URI format", async () => {
      const resources = adapter.getResourceDefinitions();
      const tableSchemaResource = resources.find(
        (r) => r.name === "sqlite_table_schema",
      );
      expect(tableSchemaResource).toBeDefined();

      await expect(
        tableSchemaResource!.handler("invalid://uri", ctx),
      ).rejects.toThrow(/Invalid table URI format/);
    });

    it("should handle error when describeTable throws", async () => {
      const resources = adapter.getResourceDefinitions();
      const tableSchemaResource = resources.find((r) => r.name === "sqlite_table_schema");
      
      vi.spyOn(adapter, "describeTable").mockRejectedValueOnce(new Error("Table not found"));
      
      const result = (await tableSchemaResource!.handler(
        "sqlite://table/missing/schema",
        ctx,
      )) as { contents: { text: string }[] };
      
      const response = JSON.parse(result.contents[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe("Table not found");
    });
  });

  describe("sqlite_indexes resource", () => {
    it("should return all indexes grouped by table", async () => {
      const resources = adapter.getResourceDefinitions();
      const indexesResource = resources.find(
        (r) => r.name === "sqlite_indexes",
      );
      expect(indexesResource).toBeDefined();

      const result = (await indexesResource!.handler(
        "sqlite://indexes",
        ctx,
      )) as { contents: { text: string }[] };
      expect(result.contents).toHaveLength(1);

      const indexes = JSON.parse(result.contents[0].text);
      // Should have indexes grouped by table
      expect(typeof indexes).toBe("object");
      expect(indexes.users).toBeDefined();
    });
  });

  describe("sqlite_views resource", () => {
    it("should return all views", async () => {
      const resources = adapter.getResourceDefinitions();
      const viewsResource = resources.find((r) => r.name === "sqlite_views");
      expect(viewsResource).toBeDefined();

      const result = (await viewsResource!.handler("sqlite://views", ctx)) as {
        contents: { text: string }[];
      };
      expect(result.contents).toHaveLength(1);

      const views = JSON.parse(result.contents[0].text);
      expect(
        views.some((v: { name: string }) => v.name === "active_users"),
      ).toBe(true);
    });
  });

  describe("sqlite_health resource", () => {
    it("should return health status", async () => {
      const resources = adapter.getResourceDefinitions();
      const healthResource = resources.find((r) => r.name === "sqlite_health");
      expect(healthResource).toBeDefined();

      const result = (await healthResource!.handler(
        "sqlite://health",
        ctx,
      )) as { contents: { text: string }[] };
      expect(result.contents).toHaveLength(1);

      const health = JSON.parse(result.contents[0].text);
      expect(health.connected).toBe(true);
    });
  });

  describe("sqlite_meta resource", () => {
    it("should return database metadata", async () => {
      const resources = adapter.getResourceDefinitions();
      const metaResource = resources.find((r) => r.name === "sqlite_meta");
      expect(metaResource).toBeDefined();

      const result = (await metaResource!.handler("sqlite://meta", ctx)) as {
        contents: { text: string }[];
      };
      expect(result.contents).toHaveLength(1);

      const meta = JSON.parse(result.contents[0].text);
      expect(meta.adapter).toBeDefined();
      expect(meta.page_size).toBeDefined();
    });

    it("should handle errors when querying pragmas", async () => {
      const resources = adapter.getResourceDefinitions();
      const metaResource = resources.find((r) => r.name === "sqlite_meta");
      
      vi.spyOn(adapter, "executeReadQuery").mockRejectedValueOnce(new Error("Query failed"));
      
      const result = (await metaResource!.handler("sqlite://meta", ctx)) as {
        contents: { text: string }[];
      };
      
      const meta = JSON.parse(result.contents[0].text);
      expect(meta.database_list).toBeNull();
    });
  });

  describe("sqlite_insights resource", () => {
    it("should return insights memo", async () => {
      const resources = adapter.getResourceDefinitions();
      const insightsResource = resources.find(
        (r) => r.name === "sqlite_insights",
      );
      expect(insightsResource).toBeDefined();

      const result = (await insightsResource!.handler(
        "memo://insights",
        ctx,
      )) as { contents: { mimeType: string; text: string }[] };
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("text/plain");
      expect(typeof result.contents[0].text).toBe("string");
    });
  });

  describe("sqlite_compile_options resource", () => {
    it("should return compile options with highlights", async () => {
      const resources = adapter.getResourceDefinitions();
      const compileOptionsResource = resources.find((r) => r.name === "sqlite_compile_options");
      expect(compileOptionsResource).toBeDefined();

      const result = (await compileOptionsResource!.handler("sqlite://compile_options", ctx)) as {
        contents: { text: string }[];
      };
      
      const data = JSON.parse(result.contents[0].text);
      expect(data.options).toBeDefined();
      expect(data.count).toBeDefined();
      expect(data.highlights).toBeDefined();
    });
  });

  describe("sqlite_pragma resource", () => {
    it("should return curated pragma snapshot", async () => {
      const resources = adapter.getResourceDefinitions();
      const pragmaResource = resources.find((r) => r.name === "sqlite_pragma");
      expect(pragmaResource).toBeDefined();

      const result = (await pragmaResource!.handler("sqlite://pragma", ctx)) as {
        contents: { text: string }[];
      };
      
      const data = JSON.parse(result.contents[0].text);
      expect(data.settings).toBeDefined();
      expect(data.settingsCount).toBeGreaterThan(0);
    });
    
    it("should handle pragma query failures", async () => {
      const resources = adapter.getResourceDefinitions();
      const pragmaResource = resources.find((r) => r.name === "sqlite_pragma");
      
      vi.spyOn(adapter, "executeReadQuery").mockRejectedValueOnce(new Error("Pragma failed"));
      
      const result = (await pragmaResource!.handler("sqlite://pragma", ctx)) as {
        contents: { text: string }[];
      };
      
      const data = JSON.parse(result.contents[0].text);
      expect(data.settings.page_size.value).toBeNull(); // Falls back to null on error
    });
  });
});
