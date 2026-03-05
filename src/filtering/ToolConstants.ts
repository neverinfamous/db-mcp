/**
 * db-mcp - Tool Constants
 *
 * Defines the tool groups and meta-groups used for filtering.
 *
 * Actual tool groups (from code audit):
 *   core: 9 tools (from core.ts)
 *   json: 23 tools (from json-helpers.ts + json-operations.ts)
 *   text: 13 WASM / 17 Native (text.ts + fts.ts)
 *   stats: 13 WASM / 19 Native (stats.ts + window.ts)
 *   vector: 11 tools (from vector.ts)
 *   admin: 26 WASM / 33 Native (admin.ts + virtual.ts + transactions.ts)
 *   geo: 4 WASM / 11 Native (geo.ts + spatialite.ts)
 *   codemode: 1 tool (from codemode.ts)
 *   Total: 100 WASM / 124 Native tools
 *
 * Note: 3 built-in server tools (server_info, server_health, list_adapters)
 * are always available regardless of filter settings.
 */

import type { ToolGroup, MetaGroup } from "../types/index.js";

/**
 * All valid tool groups
 */
export const ALL_TOOL_GROUPS: ToolGroup[] = [
  "core",
  "json",
  "text",
  "stats",
  "vector",
  "admin",
  "geo",
  "codemode",
];

/**
 * Tool groups - kept for backwards compatibility with scopes.ts
 * The actual filtering uses the tool's 'group' property, not these lists.
 */
export const TOOL_GROUPS: Record<ToolGroup, string[]> = {
  core: [
    "read_query",
    "write_query",
    "list_tables",
    "describe_table",
    "create_table",
    "drop_table",
    "get_indexes",
    "create_index",
    "drop_index",
  ],
  json: [
    // JSON Helper Tools (8)
    "json_insert",
    "json_update",
    "json_select",
    "json_query",
    "json_validate_path",
    "json_merge",
    "json_analyze_schema",
    "create_json_collection",
    // JSON Operation Tools (12)
    "json_valid",
    "json_extract",
    "json_set",
    "json_remove",
    "json_type",
    "json_array_length",
    "json_array_append",
    "json_keys",
    "json_each",
    "json_group_array",
    "json_group_object",
    "json_pretty",
    // JSONB Tools (3)
    "jsonb_convert",
    "json_storage_info",
    "json_normalize_column",
  ],
  text: [
    "regex_extract",
    "regex_match",
    "text_split",
    "text_concat",
    "text_replace",
    "text_trim",
    "text_case",
    "text_substring",
    "fts_create",
    "fts_insert",
    "fts_search",
    "fts_match",
  ],
  stats: [
    "stats_basic",
    "stats_count",
    "stats_group_by",
    "stats_histogram",
    "stats_percentile",
    "stats_regression",
    "stats_correlation",
    "stats_zscore",
    "stats_time_bucket",
    "stats_moving_avg",
    "geo_distance",
    "geo_bounding_box",
    "geo_point_in_radius",
    "geo_nearest",
    "geo_encode",
    "geo_decode",
  ],
  vector: [
    "vector_create_table",
    "vector_store",
    "vector_batch_store",
    "vector_search",
    "vector_get",
    "vector_delete",
    "vector_count",
    "vector_stats",
    "vector_dimensions",
    "vector_normalize",
    "vector_distance",
  ],
  admin: [
    "backup",
    "analyze",
    "integrity_check",
    "optimize",
    "generate_series",
    "create_view",
    "list_views",
    "drop_view",
    "dbstat",
    "vacuum",
    "transaction_begin",
    "transaction_commit",
    "transaction_rollback",
    "transaction_savepoint",
    "transaction_release",
    "transaction_rollback_to",
    "transaction_execute",
    "window_row_number",
    "window_rank",
    "window_lag_lead",
    "window_running_total",
  ],
  geo: [
    "geo_distance",
    "geo_nearby",
    "geo_bounding_box",
    "geo_cluster",
    "spatialite_load",
    "spatialite_create_table",
    "spatialite_query",
    "spatialite_analyze",
    "spatialite_index",
    "spatialite_transform",
    "spatialite_import",
  ],
  codemode: ["execute_code"],
};

/**
 * Meta-groups that expand to multiple tool groups.
 * These provide shortcuts for common use cases.
 */
export const META_GROUPS: Record<MetaGroup, ToolGroup[]> = {
  // General development - Core + JSON + Text + Codemode (46 WASM / 50 Native)
  starter: ["core", "json", "text", "codemode"],

  // Data analysis - Core + JSON + Stats + Codemode (46 WASM / 52 Native)
  analytics: ["core", "json", "stats", "codemode"],

  // Search workloads - Core + Text + Vector + Codemode (34 WASM / 38 Native)
  search: ["core", "text", "vector", "codemode"],

  // Geospatial workloads - Core + Geo + Vector + Codemode (25 WASM / 32 Native)
  spatial: ["core", "geo", "vector", "codemode"],

  // Bare minimum - Core + Codemode (10 tools)
  minimal: ["core", "codemode"],

  // All tools enabled (100 WASM / 124 Native)
  full: ["core", "json", "text", "stats", "vector", "admin", "geo", "codemode"],
};
