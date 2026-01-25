/**
 * db-mcp - Tool Constants
 *
 * Defines the tool groups and meta-groups used for filtering.
 * Follows postgres-mcp patterns for consistency.
 *
 * Tool names here are base names (without sqlite_ prefix).
 * The adapter matches both full names (sqlite_read_query) and base names (read_query).
 */

import type { ToolGroup, MetaGroup } from "../types/index.js";

/**
 * Default tool groups and their member tools.
 * This serves as the canonical mapping of tools to groups.
 *
 * Actual tool counts (native SQLite backend):
 *   core: 8 (from core.ts)
 *   json: 18 (from json-helpers.ts + json-operations.ts)
 *   text: 8 (from text.ts)
 *   fts5: 4 (from fts.ts)
 *   stats: 10 (from stats.ts)
 *   performance: 0 (no separate file, covered by stats/admin)
 *   vector: 11 (from vector.ts)
 *   geo: 7 (from geo.ts)
 *   backup: 1 (sqlite_backup in admin.ts)
 *   monitoring: 1 (sqlite_integrity_check in admin.ts)
 *   admin: 4 + 6 virtual = 10 (from admin.ts + virtual.ts)
 *   transactions: 7 (from transactions.ts - native only)
 *   window: 6 (from window.ts - native only)
 *
 * Note: These lists are for filtering by group name. The actual
 * filtering uses the tool's 'group' property, not these lists.
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
    // json-helpers.ts (6 tools)
    "json_get",
    "json_set",
    "json_insert",
    "json_replace",
    "json_remove",
    "json_array_append",
    // json-operations.ts (12 tools)
    "json_extract",
    "json_extract_all",
    "json_keys",
    "json_length",
    "json_type",
    "json_valid",
    "json_array",
    "json_object",
    "json_group",
    "json_patch",
    "json_query",
    "json_table",
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
  ],
  fts5: ["fts_create", "fts_insert", "fts_search", "fts_match"],
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
  ],
  performance: [
    // Performance tools are included in stats group
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
  geo: [
    "geo_distance",
    "geo_bounding_box",
    "geo_point_in_radius",
    "geo_nearest",
    "geo_encode",
    "geo_decode",
    "geo_cluster",
  ],
  backup: ["backup"],
  monitoring: ["integrity_check"],
  admin: [
    // admin.ts (4 tools)
    "backup",
    "analyze",
    "integrity_check",
    "optimize",
    // virtual.ts (6 tools)
    "generate_series",
    "create_view",
    "list_views",
    "drop_view",
    "dbstat",
    "vacuum",
  ],
  transactions: [
    "transaction_begin",
    "transaction_commit",
    "transaction_rollback",
    "transaction_savepoint",
    "transaction_release",
    "transaction_rollback_to",
    "transaction_execute",
  ],
  window: [
    "window_row_number",
    "window_rank",
    "window_lag_lead",
    "window_running_total",
    "window_moving_avg",
    "window_ntile",
  ],
};

/**
 * Meta-groups that expand to multiple tool groups.
 * These provide shortcuts for common use cases.
 *
 * Tool counts based on actual implementations:
 *   starter:   18 (core:8 + json:18 + text:8 = 34... but json/text overlap with groups)
 *   analytics: (core:8 + json:18 + stats:10 + window:6 = 42)
 *   search:    (core:8 + text:8 + fts5:4 + vector:11 = 31)
 *   spatial:   (core:8 + json:18 + geo:7 = 33)
 *   minimal:   8 (core only)
 *   full:      all tools
 *
 * Note: Actual counts may vary based on the backend (WASM vs native).
 */
export const META_GROUPS: Record<MetaGroup, ToolGroup[]> = {
  // General development - Core + JSON + Text
  starter: ["core", "json", "text"],

  // Data analysis - Core + JSON + Stats + Window
  analytics: ["core", "json", "stats", "window"],

  // Search workloads - Core + Text + FTS5 + Vector
  search: ["core", "text", "fts5", "vector"],

  // Geospatial - Core + JSON + Geo
  spatial: ["core", "json", "geo"],

  // Bare minimum - Core only
  minimal: ["core"],

  // All tools enabled
  full: [
    "core",
    "json",
    "text",
    "fts5",
    "stats",
    "performance",
    "vector",
    "geo",
    "backup",
    "monitoring",
    "admin",
    "transactions",
    "window",
  ],
};
