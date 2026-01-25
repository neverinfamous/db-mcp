/**
 * db-mcp - Tool Constants
 *
 * Defines the tool groups and meta-groups used for filtering.
 * Follows postgres-mcp patterns for consistency.
 */

import type { ToolGroup, MetaGroup } from "../types/index.js";

/**
 * Default tool groups and their member tools.
 * This serves as the canonical mapping of tools to groups.
 */
export const TOOL_GROUPS: Record<ToolGroup, string[]> = {
  core: [
    "execute_query",
    "read_query",
    "write_query",
    "list_tables",
    "describe_table",
    "list_schemas",
    "create_table",
    "drop_table",
    "get_schema",
  ],
  json: [
    "json_extract",
    "json_insert",
    "json_replace",
    "json_remove",
    "json_set",
    "json_array",
    "json_object",
    "json_valid",
    "json_type",
    "json_query",
    "json_merge",
  ],
  text: [
    "fuzzy_search",
    "regex_match",
    "text_similarity",
    "phonetic_search",
    "tokenize_text",
    "highlight_match",
  ],
  fts5: ["fts_search", "create_fts_index", "fts_match_info", "fts_rebuild"],
  stats: [
    "describe_stats",
    "percentile",
    "correlation",
    "regression",
    "histogram",
    "time_series_analysis",
    "moving_average",
    "outlier_detection",
  ],
  performance: [
    "analyze_query",
    "explain_query",
    "index_recommendations",
    "query_plan",
    "slow_queries",
    "workload_analysis",
  ],
  vector: [
    "vector_search",
    "cosine_similarity",
    "euclidean_distance",
    "create_vector_index",
    "hybrid_search",
    "vector_cluster",
    "nearest_neighbors",
    "embedding_stats",
  ],
  geo: [
    "distance_calc",
    "spatial_query",
    "create_spatial_index",
    "point_in_polygon",
    "buffer_query",
    "intersection_query",
    "bounding_box",
  ],
  backup: [
    "backup_database",
    "restore_database",
    "backup_table",
    "export_data",
  ],
  monitoring: [
    "health_check",
    "connection_status",
    "database_stats",
    "active_queries",
    "resource_usage",
  ],
  admin: [
    "vacuum_database",
    "analyze_tables",
    "pragma_get",
    "pragma_set",
    "extension_list",
    "extension_install",
    "create_index",
    "drop_index",
    "reindex",
    "optimize",
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
 * Tool counts:
 *   starter:   ~26 (core:9 + json:11 + text:6)
 *   analytics: ~34 (core:9 + json:11 + stats:8 + window:6)
 *   search:    ~27 (core:9 + text:6 + fts5:4 + vector:8)
 *   spatial:   ~27 (core:9 + json:11 + geo:7)
 *   minimal:   ~9  (core:9)
 *   full:      all tools
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
