/**
 * E2E Tests: MCP Resource Reads via SDK Client
 *
 * Uses the official @modelcontextprotocol/sdk client to connect
 * via Legacy SSE transport and read resources end-to-end.
 */

import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("E2E Resource Reads (via MCP SDK Client)", () => {
  let client: Client;
  let resolvedBaseURL: string;

  test.beforeAll(async ({}, testInfo) => {
    resolvedBaseURL = testInfo.project.use.baseURL as string;
    const transport = new SSEClientTransport(
      new URL(`${resolvedBaseURL}/sse`),
    );
    client = new Client(
      { name: "playwright-resource-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("should list available resources", async () => {
    const listResponse = await client.listResources();

    expect(listResponse.resources).toBeDefined();
    expect(Array.isArray(listResponse.resources)).toBe(true);
    expect(listResponse.resources.length).toBeGreaterThan(0);

    const uris = listResponse.resources.map((r) => r.uri);
    expect(uris).toContain("sqlite://schema");
    expect(uris).toContain("sqlite://tables");
    expect(uris).toContain("sqlite://health");
  });

  test("should read sqlite://schema resource", async () => {
    const response = await client.readResource({ uri: "sqlite://schema" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    // Handler returns {contents: [{text: JSON.stringify(schema)}]}
    const schema = JSON.parse(wrapper.contents[0].text);
    expect(schema).toHaveProperty("tables");
    expect(Array.isArray(schema.tables)).toBe(true);
  });

  test("should read sqlite://tables resource", async () => {
    const response = await client.readResource({ uri: "sqlite://tables" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const tables = JSON.parse(wrapper.contents[0].text);
    // Tables response is an array of TableInfo objects
    expect(Array.isArray(tables)).toBe(true);
  });

  test("should read sqlite://health resource", async () => {
    const response = await client.readResource({ uri: "sqlite://health" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const health = JSON.parse(wrapper.contents[0].text);
    expect(health).toHaveProperty("connected");
    expect(health.connected).toBe(true);
  });

  test("should read sqlite://indexes resource", async () => {
    const response = await client.readResource({ uri: "sqlite://indexes" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const indexes = JSON.parse(wrapper.contents[0].text);
    // Indexes response should be valid JSON (may be empty object if no user indexes)
    expect(indexes).toBeDefined();
  });

  test("should read sqlite://views resource", async () => {
    const response = await client.readResource({ uri: "sqlite://views" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const views = JSON.parse(wrapper.contents[0].text);
    expect(views).toBeDefined();
  });

  test("should read sqlite://meta resource", async () => {
    const response = await client.readResource({ uri: "sqlite://meta" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const meta = JSON.parse(wrapper.contents[0].text);
    expect(meta).toHaveProperty("adapter");
  });

  test("should read memo://insights resource", async () => {
    const response = await client.readResource({ uri: "memo://insights" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    // Insights is text/plain, so the inner text is a plain string (not JSON)
    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    expect(wrapper).toHaveProperty("contents");
    expect(typeof wrapper.contents[0].text).toBe("string");
  });

  test("should list resource templates", async () => {
    const response = await client.listResourceTemplates();

    expect(response.resourceTemplates).toBeDefined();
    expect(Array.isArray(response.resourceTemplates)).toBe(true);
    expect(response.resourceTemplates.length).toBeGreaterThan(0);

    const uriTemplates = response.resourceTemplates.map((t) => t.uriTemplate);
    expect(uriTemplates).toContain("sqlite://table/{tableName}/schema");
  });
});
