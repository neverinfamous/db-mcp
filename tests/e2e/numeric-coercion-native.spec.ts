/**
 * Numeric Coercion Tests: Native-Only Tools
 *
 * For native-only tools with numeric params, pass string values like "abc".
 * Assert the response is a structured handler error, NOT a raw MCP -32602 error.
 *
 * Extends numeric-coercion.spec.ts to cover window functions and FTS5 tools
 * that are excluded from the WASM project.
 *
 * This file is ignored by the WASM project via the /native\./ testIgnore pattern.
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
    expect(
      typeof parsed.success,
      `${toolName}: missing success field. Got: ${JSON.stringify(parsed, null, 2)}`,
    ).toBe("boolean");
  } finally {
    await client.close();
  }
}

// =============================================================================
// Window Functions — Numeric Parameters
// =============================================================================

test.describe("Numeric Coercion Native: Window Functions", () => {
  test("window_moving_avg with windowSize: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(
      getBaseURL(testInfo),
      "sqlite_window_moving_avg",
      {
        table: "test_measurements",
        column: "temperature",
        orderBy: "measured_at",
        windowSize: "abc",
      },
    );
  });

  test("window_ntile with buckets: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_window_ntile", {
      table: "test_measurements",
      orderBy: "temperature",
      buckets: "abc",
    });
  });

  test("window_lag_lead with offset: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(
      getBaseURL(testInfo),
      "sqlite_window_lag_lead",
      {
        table: "test_measurements",
        column: "temperature",
        orderBy: "measured_at",
        direction: "lag",
        offset: "abc",
      },
    );
  });

  test("window_row_number with limit: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(
      getBaseURL(testInfo),
      "sqlite_window_row_number",
      {
        table: "test_measurements",
        orderBy: "temperature",
        limit: "abc",
      },
    );
  });

  test("window_rank with limit: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_window_rank", {
      table: "test_measurements",
      orderBy: "temperature",
      limit: "abc",
    });
  });
});

// =============================================================================
// FTS5 — Numeric Parameters
// =============================================================================

test.describe("Numeric Coercion Native: FTS5", () => {
  test("fts_search with limit: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_fts_search", {
      table: "test_articles_fts",
      query: "database",
      limit: "abc",
    });
  });

  test("fts_match_info with limit: 'abc' → handler error", async ({}, testInfo) => {
    await assertNumericCoercion(getBaseURL(testInfo), "sqlite_fts_match_info", {
      table: "test_articles_fts",
      query: "database",
      limit: "abc",
    });
  });
});

// =============================================================================
// Transactions — Numeric/Enum Parameters
// =============================================================================

test.describe("Numeric Coercion Native: Transactions", () => {
  test("transaction_begin with invalid mode → handler error or coerced default", async ({}, testInfo) => {
    const baseURL = getBaseURL(testInfo);
    const client = await createClient(baseURL);
    try {
      const response = await callToolRaw(client, "sqlite_transaction_begin", {
        mode: "invalid_mode",
      });
      const text = response.content[0]?.text;
      expect(text).toBeDefined();

      // Accept either structured handler error or raw Zod error for invalid enum
      try {
        const parsed = JSON.parse(text);
        expect(typeof parsed.success).toBe("boolean");
        // Clean up any accidentally opened transaction
        if (parsed.success) {
          await callToolRaw(client, "sqlite_transaction_rollback", {});
        }
      } catch {
        // Raw MCP -32602 is acceptable for invalid enum values
        expect(text.toLowerCase()).toContain("error");
      }
    } finally {
      await client.close();
    }
  });
});
