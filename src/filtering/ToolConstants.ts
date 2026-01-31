/**
 * db-mcp - Tool Constants
 *
 * Defines the tool groups and meta-groups used for filtering.
 *
 * Actual tool groups (from code audit):
 *   core: 8 tools (from core.ts)
 *   json: 23 tools (from json-helpers.ts + json-operations.ts)
 *   text: 17 tools (from text.ts + fts.ts)
 *   stats: 19 tools (from stats.ts + window.ts)
 *   vector: 11 tools (from vector.ts)
 *   admin: 33 tools (from admin.ts + virtual.ts + transactions.ts)
 *   geo: 11 tools (from geo.ts + spatialite.ts) - Native: 11, WASM: 4
 *   Total: 122 Native / 102 WASM tools
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
  ],
  json: [
    // JSON Helper Tools (8)
    "json_insert",
    "json_update",
    "json_select",
    "json_query",
    "json_validate_path",
    "json_merge",
    "analyze_json_schema",
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
};

/**
 * Meta-groups that expand to multiple tool groups.
 * These provide shortcuts for common use cases.
 */
export const META_GROUPS: Record<MetaGroup, ToolGroup[]> = {
  // General development - Core + JSON + Text (48 tools)
  starter: ["core", "json", "text"],

  // Data analysis - Core + JSON + Stats (50 tools Native, 44 WASM)
  analytics: ["core", "json", "stats"],

  // Search workloads - Core + Text + Vector (36 tools)
  search: ["core", "text", "vector"],

  // Geospatial workloads - Core + Geo + Vector (30 tools Native, 23 WASM)
  spatial: ["core", "geo", "vector"],

  // Bare minimum - Core only (8 tools)
  minimal: ["core"],

  // All tools enabled (122 Native / 102 WASM tools)
  full: ["core", "json", "text", "stats", "vector", "admin", "geo"],
};
