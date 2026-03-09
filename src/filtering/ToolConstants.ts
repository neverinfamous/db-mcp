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
 *   introspection: 6 tools (from introspection/graph.ts + introspection/analysis.ts)
 *   migration: 6 tools (from migration/tracking.ts) — opt-in
 *   codemode: 1 tool (from codemode.ts)
 *   Total: 112 WASM / 136 Native tools
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
  "introspection",
  "migration",
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
    // Text Tools (13 WASM)
    "regex_extract",
    "regex_match",
    "text_split",
    "text_concat",
    "text_replace",
    "text_trim",
    "text_case",
    "text_substring",
    "fuzzy_match",
    "phonetic_match",
    "text_normalize",
    "text_validate",
    "advanced_search",
    // FTS5 Tools (4 Native-only)
    "fts_create",
    "fts_search",
    "fts_rebuild",
    "fts_match_info",
  ],
  stats: [
    // Stats Tools (13 WASM)
    "stats_basic",
    "stats_count",
    "stats_group_by",
    "stats_histogram",
    "stats_percentile",
    "stats_correlation",
    "stats_top_n",
    "stats_distinct",
    "stats_summary",
    "stats_frequency",
    "stats_outliers",
    "stats_regression",
    "stats_hypothesis",
    // Window Tools (6 Native-only)
    "window_row_number",
    "window_rank",
    "window_lag_lead",
    "window_running_total",
    "window_moving_avg",
    "window_ntile",
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
    // Admin Tools (13 from admin.ts)
    "backup",
    "analyze",
    "integrity_check",
    "optimize",
    "restore",
    "verify_backup",
    "index_stats",
    "pragma_compile_options",
    "pragma_database_list",
    "pragma_optimize",
    "pragma_settings",
    "pragma_table_info",
    "append_insight",
    // Virtual Table Tools (13 from virtual.ts)
    "generate_series",
    "create_view",
    "list_views",
    "drop_view",
    "dbstat",
    "vacuum",
    "list_virtual_tables",
    "virtual_table_info",
    "drop_virtual_table",
    "create_csv_table",
    "analyze_csv_schema",
    "create_rtree_table",
    "create_series_table",
    // Transaction Tools (7 Native-only)
    "transaction_begin",
    "transaction_commit",
    "transaction_rollback",
    "transaction_savepoint",
    "transaction_release",
    "transaction_rollback_to",
    "transaction_execute",
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
  introspection: [
    // Graph Analysis (3 from introspection/graph.ts)
    "dependency_graph",
    "topological_sort",
    "cascade_simulator",
    // Schema Analysis (3 from introspection/analysis.ts)
    "schema_snapshot",
    "constraint_analysis",
    "migration_risks",
  ],
  migration: [
    // Migration Tracking (6 from migration/tracking.ts) — opt-in
    "migration_init",
    "migration_record",
    "migration_apply",
    "migration_rollback",
    "migration_history",
    "migration_status",
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

  // Schema development - Core + Introspection + Migration + Codemode (22 tools)
  "dev-schema": ["core", "introspection", "migration", "codemode"],

  // Bare minimum - Core + Codemode (10 tools)
  minimal: ["core", "codemode"],

  // All tools enabled (112 WASM / 136 Native)
  full: [
    "core",
    "json",
    "text",
    "stats",
    "vector",
    "admin",
    "geo",
    "introspection",
    "migration",
    "codemode",
  ],
};
