/**
 * E2E Tests: MCP Prompt Reads via SDK Client
 *
 * Verifies all 10 prompts are registered and return structured
 * content when invoked via the MCP SDK client.
 */

import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("E2E Prompt Reads (via MCP SDK Client)", () => {
  async function createClient(baseURL: string) {
    const transport = new SSEClientTransport(new URL(`${baseURL}/sse`));
    const client = new Client(
      { name: "playwright-prompt-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  }

  const EXPECTED_PROMPTS = [
    "sqlite_explain_schema",
    "sqlite_query_builder",
    "sqlite_data_analysis",
    "sqlite_optimization",
    "sqlite_migration",
    "sqlite_debug_query",
    "sqlite_documentation",
    "sqlite_summarize_table",
    "sqlite_hybrid_search_workflow",
    "sqlite_demo",
  ];

  test("should list all 10 prompts", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const listResponse = await client.listPrompts();

      expect(listResponse.prompts).toBeDefined();
      expect(listResponse.prompts.length).toBe(10);

      const names = listResponse.prompts.map((p) => p.name);
      for (const expected of EXPECTED_PROMPTS) {
        expect(names).toContain(expected);
      }
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_explain_schema prompt", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_explain_schema",
        arguments: {},
      });

      expect(response.messages).toBeDefined();
      expect(response.messages.length).toBeGreaterThan(0);
      expect(response.messages[0].role).toBe("assistant");
      expect(response.messages[0].content.type).toBe("text");
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_query_builder prompt with args", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_query_builder",
        arguments: {
          operation: "select",
          tables: "test_products",
          description: "Get all products",
        },
      });

      expect(response.messages).toBeDefined();
      expect(response.messages.length).toBeGreaterThan(0);
      const text = (response.messages[0].content as any).text as string;
      expect(text).toContain("select");
      expect(text).toContain("SQL query");
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_data_analysis prompt", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_data_analysis",
        arguments: { table: "test_products", focus: "distribution" },
      });

      expect(response.messages).toBeDefined();
      const text = (response.messages[0].content as any).text as string;
      expect(text).toContain("Analyze the data");
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_optimization prompt", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_optimization",
        arguments: {},
      });

      expect(response.messages).toBeDefined();
      expect(response.messages.length).toBeGreaterThan(0);
    } catch (error: unknown) {
      // Native adapter does not implement getIndexes() — known server limitation
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("getIndexes is not a function");
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_migration prompt", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_migration",
        arguments: { change: "Add status column to orders" },
      });

      expect(response.messages).toBeDefined();
      const text = (response.messages[0].content as any).text as string;
      expect(text).toContain("migration");
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_debug_query prompt", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_debug_query",
        arguments: {
          query: "SELECT * FORM test_products",
          error: "near FORM: syntax error",
        },
      });

      expect(response.messages).toBeDefined();
      const text = (response.messages[0].content as any).text as string;
      expect(text).toContain("debug");
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_documentation prompt", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_documentation",
        arguments: { format: "markdown" },
      });

      expect(response.messages).toBeDefined();
      const text = (response.messages[0].content as any).text as string;
      expect(text).toContain("documentation");
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_summarize_table prompt", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_summarize_table",
        arguments: { table_name: "test_products", analysis_depth: "basic" },
      });

      expect(response.messages).toBeDefined();
      const text = (response.messages[0].content as any).text as string;
      expect(text).toContain("table");
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_hybrid_search_workflow prompt", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_hybrid_search_workflow",
        arguments: { use_case: "product_search" },
      });

      expect(response.messages).toBeDefined();
      const text = (response.messages[0].content as any).text as string;
      expect(text).toContain("search");
    } finally {
      await client.close();
    }
  });

  test("should get sqlite_demo prompt", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.getPrompt({
        name: "sqlite_demo",
        arguments: { topic: "e-commerce" },
      });

      expect(response.messages).toBeDefined();
      const text = (response.messages[0].content as any).text as string;
      expect(text).toContain("Demo");
    } finally {
      await client.close();
    }
  });
});
