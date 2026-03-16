/**
 * Zod Validation Sweep
 *
 * Calls every tool that has REQUIRED parameters with empty args ({}).
 * Asserts the response is a structured handler error ({ success: false, error: "..." })
 * and NOT a raw MCP error frame (isError: true with -32602 code).
 *
 * This replaces the "Zod validation sweep" sections from test-group-tools.md.
 * Tools with no required params (e.g., sqlite_list_tables) are excluded — they succeed on {}.
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

    // If the SDK returned isError: true, the response is a raw MCP error.
    // We still parse the text to check if it's structured.
    const text = response.content[0]?.text;
    expect(text, `${toolName}: no response content`).toBeDefined();

    // The response must be valid JSON (not a raw exception string)
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      // If the response isn't JSON, it's a raw MCP error string
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
// Core Group (7 tools with required params)
// =============================================================================

test.describe("Zod Sweep: Core", () => {
  const tools = [
    "sqlite_read_query",
    "sqlite_write_query",
    "sqlite_create_table",
    "sqlite_describe_table",
    "sqlite_drop_table",
    "sqlite_create_index",
    "sqlite_drop_index",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// JSON Group (20 tools with required params)
// =============================================================================

test.describe("Zod Sweep: JSON", () => {
  const tools = [
    "sqlite_json_insert",
    "sqlite_json_update",
    "sqlite_json_select",
    "sqlite_json_query",
    "sqlite_json_validate_path",
    "sqlite_json_merge",
    "sqlite_json_analyze_schema",
    "sqlite_create_json_collection",
    "sqlite_json_valid",
    "sqlite_json_extract",
    "sqlite_json_set",
    "sqlite_json_remove",
    "sqlite_json_type",
    "sqlite_json_array_length",
    "sqlite_json_array_append",
    "sqlite_json_keys",
    "sqlite_json_each",
    "sqlite_json_group_array",
    "sqlite_json_group_object",
    "sqlite_json_pretty",
    "sqlite_jsonb_convert",
    "sqlite_json_storage_info",
    "sqlite_json_normalize_column",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Text Group (13 WASM tools with required params)
// =============================================================================

test.describe("Zod Sweep: Text", () => {
  const tools = [
    "sqlite_regex_extract",
    "sqlite_regex_match",
    "sqlite_text_split",
    "sqlite_text_concat",
    "sqlite_text_replace",
    "sqlite_text_trim",
    "sqlite_text_case",
    "sqlite_text_substring",
    "sqlite_fuzzy_match",
    "sqlite_phonetic_match",
    "sqlite_text_normalize",
    "sqlite_text_validate",
    "sqlite_advanced_search",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Stats Group (13 WASM tools with required params)
// =============================================================================

test.describe("Zod Sweep: Stats", () => {
  const tools = [
    "sqlite_stats_basic",
    "sqlite_stats_count",
    "sqlite_stats_group_by",
    "sqlite_stats_histogram",
    "sqlite_stats_percentile",
    "sqlite_stats_correlation",
    "sqlite_stats_top_n",
    "sqlite_stats_distinct",
    "sqlite_stats_summary",
    "sqlite_stats_frequency",
    "sqlite_stats_outliers",
    "sqlite_stats_regression",
    "sqlite_stats_hypothesis",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Vector Group (9 tools with required params)
// =============================================================================

test.describe("Zod Sweep: Vector", () => {
  const tools = [
    "sqlite_vector_create_table",
    "sqlite_vector_store",
    "sqlite_vector_batch_store",
    "sqlite_vector_search",
    "sqlite_vector_get",
    "sqlite_vector_delete",
    "sqlite_vector_count",
    "sqlite_vector_stats",
    "sqlite_vector_dimensions",
    "sqlite_vector_normalize",
    "sqlite_vector_distance",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Admin Group (tools with required params — many accept {})
// =============================================================================

test.describe("Zod Sweep: Admin", () => {
  const tools = [
    "sqlite_backup",
    "sqlite_restore",
    "sqlite_verify_backup",
    "sqlite_pragma_settings",
    "sqlite_pragma_table_info",
    "sqlite_append_insight",
    "sqlite_generate_series",
    "sqlite_create_view",
    "sqlite_drop_view",
    "sqlite_virtual_table_info",
    "sqlite_drop_virtual_table",
    "sqlite_create_csv_table",
    "sqlite_analyze_csv_schema",
    "sqlite_create_rtree_table",
    "sqlite_create_series_table",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Geo Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Geo", () => {
  const tools = [
    "sqlite_geo_distance",
    "sqlite_geo_nearby",
    "sqlite_geo_bounding_box",
    "sqlite_geo_cluster",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Introspection Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Introspection", () => {
  const tools = [
    "sqlite_cascade_simulator",
    "sqlite_migration_risks",
    "sqlite_query_plan",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Migration Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Migration", () => {
  const tools = [
    "sqlite_migration_record",
    "sqlite_migration_apply",
    "sqlite_migration_rollback",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(getBaseURL(testInfo), tool);
    });
  }
});

// =============================================================================
// Code Mode
// =============================================================================

test.describe("Zod Sweep: Code Mode", () => {
  test("sqlite_execute_code({}) → handler error", async ({}, testInfo) => {
    await assertZodHandlerError(getBaseURL(testInfo), "sqlite_execute_code");
  });
});
