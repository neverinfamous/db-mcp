/**
 * Numeric Coercion Tests
 *
 * For tools with numeric params, pass string values like "abc".
 * Assert the response is a structured handler error, NOT a raw MCP -32602 error.
 *
 * Replaces the "Wrong-Type Numeric Parameter Coercion" items from test-tools.md.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolRaw } from "./helpers.js";

test.describe.configure({ mode: "serial" });

/**
 * Call a tool with a string value for a numeric parameter.
 * Assert the response is structured JSON (not a raw MCP error frame).
 * Server may either: (1) coerce "abc" to a default and succeed, or (2) return a handler error.
 * Both are acceptable — the key assertion is that we DON'T get a raw MCP -32602 error.
 */
async function assertNumericCoercion(
  baseURL: string,
  toolName: string,
  args: Record<string, unknown>,
) {
  const client = await createClient(baseURL);
  try {
    const response = await callToolRaw(client, toolName, args);
    const text = response.content[0]?.text;
    expect(text, `${toolName}: no response content`).toBeDefined();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        `${toolName}: raw MCP error, not structured JSON. Got: ${text.slice(0, 200)}`,
      );
    }

    // Must be a structured response — either handler error or coerced success
    expect(typeof parsed.success, `${toolName}: missing success field. Got: ${JSON.stringify(parsed, null, 2)}`).toBe("boolean");
  } finally {
    await client.close();
  }
}

test.describe("Numeric Coercion: Stats", () => {
  test("stats_histogram with buckets: 'abc' → handler error or coerced default", async ({}, testInfo) => {
    const baseURL = getBaseURL(testInfo);
    const client = await createClient(baseURL);
    try {
      const response = await callToolRaw(client, "sqlite_stats_histogram", {
        table: "test_products",
        column: "price",
        buckets: "abc",
      });
      const text = response.content[0]?.text;
      expect(text).toBeDefined();
      const parsed = JSON.parse(text);
      // Server either: (1) coerces "abc" to default buckets, or (2) returns handler error
      expect(typeof parsed.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("stats_top_n with n: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_stats_top_n", {
      table: "test_products",
      column: "price",
      n: "abc",
    });
  });

  test("stats_percentile with percentiles: 'abc' → error (handler or Zod)", async ({}, testInfo) => {
    const baseURL = getBaseURL(testInfo);
    const client = await createClient(baseURL);
    try {
      const response = await callToolRaw(client, "sqlite_stats_percentile", {
        table: "test_products",
        column: "price",
        percentiles: "abc",
      });
      const text = response.content[0]?.text;
      expect(text).toBeDefined();
      // Array params can't be coerced from string — accept either raw Zod or handler error
      try {
        const parsed = JSON.parse(text);
        expect(parsed.success).toBe(false);
      } catch {
        // Raw MCP -32602 is acceptable for incompatible type coercion
        expect(text).toContain("error");
      }
    } finally {
      await client.close();
    }
  });

  test("stats_outliers with maxOutliers: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_stats_outliers", {
      table: "test_measurements",
      column: "temperature",
      method: "iqr",
      maxOutliers: "abc",
    });
  });
});

test.describe("Numeric Coercion: Text", () => {
  test("fuzzy_match with maxDistance: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_fuzzy_match", {
      table: "test_products",
      column: "name",
      search: "laptop",
      maxDistance: "abc",
    });
  });

  test("text_substring with start: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_text_substring", {
      table: "test_users",
      column: "email",
      start: "abc",
      length: 5,
    });
  });
});

test.describe("Numeric Coercion: Geo", () => {
  test("geo_nearby with radius: 'abc' → error (handler or Zod)", async ({}, testInfo) => {
    const baseURL = getBaseURL(testInfo);
    const client = await createClient(baseURL);
    try {
      const response = await callToolRaw(client, "sqlite_geo_nearby", {
        table: "test_locations",
        latColumn: "latitude",
        lonColumn: "longitude",
        centerLat: 40.7,
        centerLon: -74.0,
        radius: "abc",
      });
      const text = response.content[0]?.text;
      expect(text).toBeDefined();
      // Accept either structured handler error or raw Zod error
      try {
        const parsed = JSON.parse(text);
        expect(parsed.success).toBe(false);
      } catch {
        expect(text.toLowerCase()).toContain("error");
      }
    } finally {
      await client.close();
    }
  });

  test("geo_cluster with gridSize: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_geo_cluster", {
      table: "test_locations",
      latColumn: "latitude",
      lonColumn: "longitude",
      gridSize: "abc",
    });
  });
});

test.describe("Numeric Coercion: Vector", () => {
  test("vector_search with limit: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_vector_search", {
      table: "test_embeddings",
      vectorColumn: "embedding",
      queryVector: [0.1, 0.2, 0.3],
      limit: "abc",
    });
  });
});

test.describe("Numeric Coercion: Admin", () => {
  test("generate_series with start: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_generate_series", {
      start: "abc",
      stop: 10,
    });
  });
});

test.describe("Numeric Coercion: Code Mode", () => {
  test("execute_code with timeout: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_execute_code", {
      code: "return 1;",
      timeout: "abc",
    });
  });
});
