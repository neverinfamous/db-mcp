/**
 * E2E Tests: Native-Only Tools
 *
 * Tests tools that require the native better-sqlite3 adapter:
 * transactions, FTS5, and window functions.
 * Skipped by the WASM project via testIgnore in playwright.config.ts.
 */

import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("Native-Only Tools (via MCP SDK Client)", () => {
  async function createClient(baseURL: string) {
    const transport = new SSEClientTransport(new URL(`${baseURL}/sse`));
    const client = new Client(
      { name: "playwright-native-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  }

  test("should begin and rollback transaction (admin: transactions)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const beginResponse = await client.callTool({
        name: "sqlite_transaction_begin",
        arguments: {},
      });

      expect(beginResponse.isError).toBeUndefined();
      const beginParsed = JSON.parse((beginResponse.content[0] as any).text);
      expect(beginParsed).toHaveProperty("success", true);
      expect(beginParsed).toHaveProperty("mode");

      const rollbackResponse = await client.callTool({
        name: "sqlite_transaction_rollback",
        arguments: {},
      });

      expect(rollbackResponse.isError).toBeUndefined();
    } finally {
      await client.close();
    }
  });

  test("should search FTS5 index (text: sqlite_fts_search)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_fts_search",
        arguments: {
          table: "test_articles_fts",
          query: "database",
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

  test("should compute window row numbers (stats: sqlite_window_row_number)", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_window_row_number",
        arguments: {
          table: "test_products",
          orderBy: "price",
        },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });
});
