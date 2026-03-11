/**
 * E2E Tests: Streamable HTTP Transport (MCP 2025-03-26)
 *
 * Validates that the modern Streamable HTTP transport works alongside
 * the Legacy SSE transport. All other specs use SSE; this spec proves
 * the primary modern transport is fully functional.
 */

import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test.describe.configure({ mode: "serial" });

test.describe("Streamable HTTP Transport (MCP 2025-03-26)", () => {
  async function createClient(baseURL: string) {
    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseURL}/mcp`),
    );
    const client = new Client(
      { name: "playwright-streamable-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  }

  test("should initialize via Streamable HTTP", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      // Connection succeeded — Streamable HTTP handshake works
      const tools = await client.listTools();
      expect(tools.tools.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("should list tools via Streamable HTTP", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const listResponse = await client.listTools();

      expect(listResponse.tools).toBeDefined();
      expect(Array.isArray(listResponse.tools)).toBe(true);
      expect(listResponse.tools.length).toBeGreaterThan(0);

      const names = listResponse.tools.map((t) => t.name);
      expect(names).toContain("sqlite_read_query");
      expect(names).toContain("sqlite_write_query");
    } finally {
      await client.close();
    }
  });

  test("should call a read tool via Streamable HTTP", async ({}, testInfo) => {
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
    } finally {
      await client.close();
    }
  });

  test("should call a write tool via Streamable HTTP", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_write_query",
        arguments: {
          query:
            "CREATE TABLE IF NOT EXISTS e2e_streamable_test (id INTEGER PRIMARY KEY)",
        },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("should list and read resources via Streamable HTTP", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const listResponse = await client.listResources();
      expect(listResponse.resources.length).toBeGreaterThan(0);

      const schemaResource = await client.readResource({
        uri: "sqlite://schema",
      });
      expect(schemaResource.contents).toBeDefined();
      expect(schemaResource.contents.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("should list and get prompts via Streamable HTTP", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const listResponse = await client.listPrompts();
      expect(listResponse.prompts.length).toBe(10);

      const prompt = await client.getPrompt({
        name: "sqlite_explain_schema",
        arguments: {},
      });
      expect(prompt.messages).toBeDefined();
      expect(prompt.messages.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });
});
