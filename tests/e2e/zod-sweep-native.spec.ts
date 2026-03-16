/**
 * Zod Validation Sweep: Native-Only Tools
 *
 * Calls every native-only tool that has REQUIRED parameters with empty args ({}).
 * Asserts the response is a structured handler error ({ success: false, error: "..." })
 * and NOT a raw MCP error frame (isError: true with -32602 code).
 *
 * Extends zod-sweep.spec.ts to cover FTS5, window functions, transactions,
 * and SpatiaLite tools that are excluded from the WASM project.
 *
 * This file is ignored by the WASM project via the /native\./ testIgnore pattern.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolRaw } from "./helpers.js";

test.describe.configure({ mode: "serial" });

/**
 * Send {} to a tool and assert we get a structured handler error,
 * not a raw MCP error frame.
 */
async function assertZodHandlerError(baseURL: string, toolName: string) {
  const client = await createClient(baseURL);
  try {
    const response = await callToolRaw(client, toolName, {});

    const text = response.content[0]?.text;
    expect(text, `${toolName}: no response content`).toBeDefined();

    // The response must be valid JSON (not a raw exception string)
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        `${toolName}: raw MCP error, not structured JSON. Got: ${text.slice(0, 200)}`,
      );
    }

    // Check: must be { success: false, error: "..." }
    expect(parsed.success, `${toolName}: expected success: false, got: ${JSON.stringify(parsed, null, 2)}`).toBe(false);
    expect(typeof parsed.error, `${toolName}: missing error string in: ${JSON.stringify(parsed, null, 2)}`).toBe("string");
  } finally {
    await client.close();
  }
}

// =============================================================================
// FTS5 Group (4 tools with required params)
// =============================================================================

test.describe("Zod Sweep Native: FTS5", () => {
  const tools = [
    "sqlite_fts_create",
    "sqlite_fts_search",
    "sqlite_fts_rebuild",
    "sqlite_fts_match_info",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Window Functions Group (6 tools with required params)
// =============================================================================

test.describe("Zod Sweep Native: Window Functions", () => {
  const tools = [
    "sqlite_window_row_number",
    "sqlite_window_rank",
    "sqlite_window_lag_lead",
    "sqlite_window_running_total",
    "sqlite_window_moving_avg",
    "sqlite_window_ntile",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Transaction Group (tools with required params)
// transaction_begin, transaction_commit, transaction_rollback accept {}
// =============================================================================

test.describe("Zod Sweep Native: Transactions", () => {
  const tools = [
    "sqlite_transaction_execute",
    "sqlite_transaction_savepoint",
    "sqlite_transaction_release",
    "sqlite_transaction_rollback_to",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// SpatiaLite Group (6 tools with required params)
// spatialite_load accepts {} — excluded
// =============================================================================

test.describe("Zod Sweep Native: SpatiaLite", () => {
  const tools = [
    "sqlite_spatialite_create_table",
    "sqlite_spatialite_query",
    "sqlite_spatialite_analyze",
    "sqlite_spatialite_index",
    "sqlite_spatialite_transform",
    "sqlite_spatialite_import",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});
