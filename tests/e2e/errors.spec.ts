/**
 * E2E Tests: Structured Error Responses
 *
 * Validates that tools return structured { success: false, code, error }
 * responses for common error conditions, rather than raw MCP exceptions.
 */

import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("Structured Error Responses", () => {
  async function createClient(baseURL: string) {
    const transport = new SSEClientTransport(new URL(`${baseURL}/sse`));
    const client = new Client(
      { name: "playwright-error-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  }

  test("should return structured error for nonexistent table", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_read_query",
        arguments: { query: "SELECT * FROM nonexistent_table_xyz" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as { text: string }).text);
      expect(parsed.success).toBe(false);
      expect(typeof parsed.code).toBe("string");
      expect(parsed.error).toMatch(/nonexistent_table_xyz|no such table/i);
    } finally {
      await client.close();
    }
  });

  test("should return COLUMN_NOT_FOUND for nonexistent column", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_stats_basic",
        arguments: { table: "test_products", column: "nonexistent_col_xyz" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as { text: string }).text);
      expect(parsed.success).toBe(false);
      expect(parsed.code).toBe("COLUMN_NOT_FOUND");
    } finally {
      await client.close();
    }
  });

  test("should reject SELECT in sqlite_write_query", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_write_query",
        arguments: { query: "SELECT * FROM test_products" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as { text: string }).text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toMatch(/not allowed|not a DML/i);
    } finally {
      await client.close();
    }
  });

  test("should reject INSERT in sqlite_read_query", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_read_query",
        arguments: {
          query: "INSERT INTO test_products (name, price) VALUES ('x', 1)",
        },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as { text: string }).text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toMatch(/not allowed|not a SELECT/i);
    } finally {
      await client.close();
    }
  });

  test("should return structured error for invalid geo coordinates", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_geo_distance",
        arguments: { lat1: 91, lon1: 0, lat2: 0, lon2: 0 },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as { text: string }).text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toMatch(/lat1|latitude|invalid/i);
    } finally {
      await client.close();
    }
  });

  test("should return INVALID_INPUT for non-numeric stats column", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_stats_basic",
        arguments: { table: "test_products", column: "name" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as { text: string }).text);
      expect(parsed.success).toBe(false);
      expect(parsed.code).toBe("INVALID_INPUT");
    } finally {
      await client.close();
    }
  });
});
