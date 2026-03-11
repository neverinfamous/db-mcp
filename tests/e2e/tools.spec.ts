import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("E2E Tool Execution (via MCP SDK Client)", () => {
  async function createClient() {
    const transport = new SSEClientTransport(
      new URL("http://localhost:3000/sse"),
    );
    const client = new Client(
      { name: "playwright-test-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  }

  test("should list available tools", async () => {
    const client = await createClient();
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

  test("should execute a read tool successfully (sqlite_list_tables)", async () => {
    const client = await createClient();
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

  test("should return formatted MCP error for validation failures (sqlite_read_query)", async () => {
    const client = await createClient();
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

  test("should execute a write tool successfully (sqlite_write_query)", async () => {
    const client = await createClient();
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

  test("should execute code mode (sqlite_execute_code)", async () => {
    const client = await createClient();
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
});
