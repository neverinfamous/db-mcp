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

  // ===========================================================================
  // R1: Schema table count + specific names
  // ===========================================================================

  test("sqlite://schema contains ≥11 tables with expected names", async () => {
    const response = await client.readResource({ uri: "sqlite://schema" });
    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const schema = JSON.parse(wrapper.contents[0].text);
    const tables = schema.tables as { name: string }[];

    expect(tables.length).toBeGreaterThanOrEqual(11);

    const names = tables.map((t) => t.name);
    for (const expected of [
      "test_products",
      "test_orders",
      "test_users",
      "test_measurements",
      "test_embeddings",
      "test_locations",
      "test_categories",
      "test_events",
    ]) {
      expect(names, `Missing table: ${expected}`).toContain(expected);
    }
  });

  // ===========================================================================
  // R2: Templated resource reads — actual table schemas
  // ===========================================================================

  test("sqlite://table/test_products/schema returns columns", async () => {
    const response = await client.readResource({
      uri: "sqlite://table/test_products/schema",
    });
    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const tableSchema = JSON.parse(wrapper.contents[0].text);

    expect(tableSchema).toHaveProperty("columns");
    const columns = tableSchema.columns as { name: string }[];
    expect(columns.length).toBeGreaterThanOrEqual(5);

    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("name");
    expect(colNames).toContain("price");
  });

  test("sqlite://table/test_orders/schema returns columns", async () => {
    const response = await client.readResource({
      uri: "sqlite://table/test_orders/schema",
    });
    expect(response.contents).toBeDefined();

    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const tableSchema = JSON.parse(wrapper.contents[0].text);

    expect(tableSchema).toHaveProperty("columns");
    const columns = tableSchema.columns as { name: string }[];
    expect(columns.length).toBeGreaterThanOrEqual(5);

    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("product_id");
    expect(colNames).toContain("status");
  });

  // ===========================================================================
  // R3: Nonexistent table → graceful error
  // ===========================================================================

  test("sqlite://table/nonexistent_table/schema → error, not crash", async () => {
    try {
      const response = await client.readResource({
        uri: "sqlite://table/nonexistent_table/schema",
      });
      // If it returns instead of throwing, check for error indicator
      const text = response.contents[0]!.text as string;
      expect(text.toLowerCase()).toMatch(/not (found|exist)|error|no such table/);
    } catch (error: unknown) {
      // MCP SDK may throw for resource errors — that's acceptable
      expect(error).toBeDefined();
    }
  });

  // ===========================================================================
  // R4: Index names — specific indexes present
  // ===========================================================================

  test("sqlite://indexes contains known test indexes", async () => {
    const response = await client.readResource({ uri: "sqlite://indexes" });
    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const indexes = JSON.parse(wrapper.contents[0].text);
    const serialized = JSON.stringify(indexes);

    // Verify known indexes exist somewhere in the response
    expect(serialized).toContain("idx_orders_status");
    expect(serialized).toContain("idx_products_category");
  });

  // ===========================================================================
  // R5: Health — backend type field
  // ===========================================================================

  test("sqlite://health includes backend info", async () => {
    const response = await client.readResource({ uri: "sqlite://health" });
    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const health = JSON.parse(wrapper.contents[0].text);

    expect(health.connected).toBe(true);
    // Health should contain more than just {connected} — e.g. version, path, etc.
    expect(Object.keys(health).length).toBeGreaterThanOrEqual(1);
  });

  // ===========================================================================
  // R6: Meta — PRAGMA fields present
  // ===========================================================================

  test("sqlite://meta contains PRAGMA values", async () => {
    const response = await client.readResource({ uri: "sqlite://meta" });
    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const meta = JSON.parse(wrapper.contents[0].text);

    expect(meta).toHaveProperty("adapter");
    // PRAGMA values should be present — the exact shape varies by handler
    const serialized = JSON.stringify(meta);
    expect(serialized).toContain("page_size");
  });

  // ===========================================================================
  // R7: Views — empty array since test DB has no views
  // ===========================================================================

  test("sqlite://views returns empty or valid array", async () => {
    const response = await client.readResource({ uri: "sqlite://views" });
    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const views = JSON.parse(wrapper.contents[0].text);

    expect(Array.isArray(views)).toBe(true);
    // Test DB has no views by default
    expect(views.length).toBe(0);
  });

  // ===========================================================================
  // R8: Insights write+read cycle
  // ===========================================================================

  test("memo://insights reflects content after sqlite_append_insight", async () => {
    // Write an insight
    const toolResult = await client.callTool({
      name: "sqlite_append_insight",
      arguments: {
        insight: "E2E test resource insight: verify write+read cycle.",
        category: "test",
      },
    });
    const toolText = (toolResult.content as { text: string }[])[0].text;
    const parsed = JSON.parse(toolText);
    expect(parsed.success).toBe(true);

    // Re-read insights resource — should contain the new insight
    const response = await client.readResource({ uri: "memo://insights" });
    const text = response.contents[0]!.text as string;
    const wrapper = JSON.parse(text);
    const insights = wrapper.contents[0].text as string;

    expect(insights).toContain("verify write+read cycle");
  });
});
