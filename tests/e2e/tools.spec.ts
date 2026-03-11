import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("E2E Tool Execution (via MCP SDK Client)", () => {
  async function createClient(baseURL: string) {
    const transport = new SSEClientTransport(
      new URL(`${baseURL}/sse`),
    );
    const client = new Client(
      { name: "playwright-test-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  }

  test("should list available tools", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const listResponse = await client.listTools();

      expect(listResponse.tools).toBeDefined();
      expect(Array.isArray(listResponse.tools)).toBe(true);
      expect(listResponse.tools.length).toBeGreaterThan(0);

      const toolNames = listResponse.tools.map((t) => t.name);
      expect(toolNames).toContain("sqlite_list_tables");
      expect(toolNames).toContain("sqlite_read_query");
    } finally {
      await client.close();
    }
  });

  test("should execute a read tool successfully (sqlite_list_tables)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_list_tables",
        arguments: {},
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content[0].type).toBe("text");
      const textOutput = (response.content[0] as any).text as string;
      // Verify structured response format
      const parsed = JSON.parse(textOutput);
      expect(parsed).toHaveProperty("tables");
      expect(Array.isArray(parsed.tables)).toBe(true);
      expect(parsed).toHaveProperty("count");
      expect(typeof parsed.count).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("should return formatted MCP error for validation failures (sqlite_read_query)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_read_query",
        arguments: {},
      });

      // db-mcp may return errors via either:
      // 1. isError: true with error content (SDK Zod validation)
      // 2. P154 structured JSON with { success: false } (handler-level errors)
      expect(Array.isArray(response.content)).toBe(true);
      if (response.content.length > 0) {
        expect(response.content[0].type).toBe("text");
        const errorText = (response.content[0] as any).text as string;
        expect(errorText.toLowerCase()).toContain("required");
      }
    } catch (error: any) {
      // If the SDK throws on tool error instead of returning it
      expect(error.message.toLowerCase()).toContain("required");
    } finally {
      await client.close();
    }
  });

  test("should execute a write tool successfully (sqlite_write_query)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      // Create a temporary table
      const createResponse = await client.callTool({
        name: "sqlite_write_query",
        arguments: {
          query:
            "CREATE TABLE IF NOT EXISTS _e2e_test_write (id INTEGER PRIMARY KEY, name TEXT)",
        },
      });

      expect(createResponse.isError).toBeUndefined();
      expect(Array.isArray(createResponse.content)).toBe(true);

      // Clean up
      await client.callTool({
        name: "sqlite_write_query",
        arguments: { query: "DROP TABLE IF EXISTS _e2e_test_write" },
      });
    } finally {
      await client.close();
    }
  });

  test("should execute code mode (sqlite_execute_code)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_execute_code",
        arguments: {
          code: 'const tables = await sqlite.core.listTables(); return tables;',
        },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content[0].type).toBe("text");

      const textOutput = (response.content[0] as any).text as string;
      const parsed = JSON.parse(textOutput);
      expect(parsed).toHaveProperty("result");
      expect(parsed.result).toHaveProperty("tables");
    } finally {
      await client.close();
    }
  });

  // --- Cross-group tool coverage (all groups via --tool-filter +all) ---

  test("should describe a table (core: sqlite_describe_table)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_describe_table",
        arguments: { table: "test_products" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as any).text);
      expect(parsed).toHaveProperty("columns");
      expect(Array.isArray(parsed.columns)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("should get indexes (core: sqlite_get_indexes)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_get_indexes",
        arguments: { table: "test_products" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as any).text);
      expect(parsed).toHaveProperty("indexes");
      expect(Array.isArray(parsed.indexes)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("should extract JSON (json: sqlite_json_extract)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_json_extract",
        arguments: {
          table: "test_jsonb_docs",
          column: "doc",
          path: "$.type",
        },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content[0].type).toBe("text");
    } finally {
      await client.close();
    }
  });

  test("should search with fuzzy match (text: sqlite_fuzzy_match)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_fuzzy_match",
        arguments: {
          table: "test_products",
          column: "name",
          searchTerm: "Laptop",
          threshold: 50,
        },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content[0].type).toBe("text");
    } finally {
      await client.close();
    }
  });

  test("should compute basic stats (stats: sqlite_stats_basic)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_stats_basic",
        arguments: { table: "test_products", column: "price" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("should run integrity check (admin: sqlite_integrity_check)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_integrity_check",
        arguments: {},
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("should run analyze (admin: sqlite_analyze)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_analyze",
        arguments: {},
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("should list views (admin: sqlite_list_views)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_list_views",
        arguments: {},
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("should analyze storage (introspection: sqlite_storage_analysis)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_storage_analysis",
        arguments: {},
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("should check migration status (migration: sqlite_migration_status)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_migration_status",
        arguments: {},
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("should calculate geo distance (geo: sqlite_geo_distance)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_geo_distance",
        arguments: {
          lat1: 40.7128,
          lon1: -74.006,
          lat2: 34.0522,
          lon2: -118.2437,
        },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("should count vectors (vector: sqlite_vector_count)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_vector_count",
        arguments: { table: "test_embeddings" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });
});
