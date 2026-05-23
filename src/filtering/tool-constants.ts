/**
 * db-mcp - Tool Constants
 *
 * Defines the tool groups and meta-groups used for filtering.
 *
 * Actual tool groups (from code audit):
 *   core: 21 tools (core/queries.ts, core/tables.ts, core/indexes.ts, core/convenience.ts, core/triggers.ts, core/constraints.ts, core/datetime.ts, core/alter-table.ts)
 *   json: 25 tools (json-operations/crud+query+transform+security+diff.ts, json-helpers/read+write.ts)
 *   text: 14 WASM / 19 Native (text/regex+formatting+search+validate+sentiment.ts, fts.ts)
 *   stats: 17 WASM / 23 Native (stats/basic+advanced.ts, inference/, anomaly-detection.ts, schema-risks.ts, native: window.ts)
 *   vector: 11 tools (vector/storage+search+metadata.ts)
 *   admin: 31 WASM / 32 Native (admin/backup+verify+pragma+reindex+wal.ts, virtual/views+vtable+extensions+analysis.ts; dump.ts is NATIVE ONLY)
 *   transactions: 8 Native (native: transactions.ts)
 *   geo: 4 WASM / 11 Native (geo.ts, native: spatialite/tools+analysis.ts)
 *   introspection: 10 tools (introspection/graph/tools.ts, analysis/constraints+risks+snapshot+diff.ts, diagnostics/storage+indexes+query-plan.ts)
 *   migration: 6 tools (migration/tracking.ts) — opt-in
 *   codemode: 1 tool (codemode.ts)
 *   Total: 140 WASM / 167 Native tools
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
  "transactions",
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
    "upsert",
    "batch_insert",
    "count",
    "exists",
    "truncate",
    "list_triggers",
    "create_trigger",
    "drop_trigger",
    "list_constraints",
    "date_add",
    "date_diff",
    "alter_table",
  ],
  json: [
    // CRUD + Query + Collection (8: crud.ts, query.ts, write.ts)
    "json_insert",
    "json_update",
    "json_select",
    "json_query",
    "json_validate_path",
    "json_merge",
    "json_analyze_schema",
    "create_json_collection",
    // Transform + Read (12: transform.ts, read.ts)
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
    // JSONB + Storage (3: write.ts, read.ts)
    "jsonb_convert",
    "json_storage_info",
    "json_normalize_column",
    // Security (1: security.ts)
    "json_security_scan",
    // Diff (1: diff.ts)
    "json_diff",
  ],
  text: [
    // Text Tools (14 WASM)
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
    "text_sentiment",
    // FTS5 Tools (5 Native-only)
    "fts_create",
    "fts_search",
    "fts_rebuild",
    "fts_match_info",
    "fts_headline",
  ],
  stats: [
    // Stats Tools (16 WASM)
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
    // Anomaly Detection (3 WASM)
    "stats_detect_anomalies",
    "stats_detect_bloat",
    "stats_detect_schema_risks",
    // Window Tools (6 Native-only)
    "window_row_number",
    "window_rank",
    "window_lag_lead",
    "window_running_total",
    "window_moving_avg",
    "window_ntile",
    // Sampling (1 WASM)
    "stats_sample",
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
    // Admin Tools (15: backup.ts, verify.ts, pragma.ts, reindex.ts, wal.ts)
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
    // Virtual Table Tools (13: views.ts, vtable.ts, extensions.ts, analysis.ts)
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
    // Database management (5: pragma.ts, backup/create.ts, reindex.ts, wal.ts)
    "attach_database",
    "detach_database",
    "vacuum_into",
    "dump",
    "reindex",
    "wal",
  ],
  transactions: [
    // Transaction Tools (8 Native-only)
    "transaction_begin",
    "transaction_status",
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
    // Schema Analysis (4 from introspection/analysis.ts)
    "schema_snapshot",
    "schema_diff",
    "constraint_analysis",
    "migration_risks",
    // Diagnostics (3 from introspection/diagnostics.ts)
    "storage_analysis",
    "index_audit",
    "query_plan",
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
  // General development - Core + JSON + Text + Codemode (61 WASM / 66 Native)
  starter: ["core", "json", "text", "codemode"],

  // Data analysis - Core + JSON + Stats + Codemode (64 WASM / 70 Native)
  analytics: ["core", "json", "stats", "codemode"],

  // Search workloads - Core + Text + Vector + Codemode (47 WASM / 52 Native)
  search: ["core", "text", "vector", "codemode"],

  // Geospatial workloads - Core + Geo + Vector + Codemode (37 WASM / 44 Native)
  spatial: ["core", "geo", "vector", "codemode"],

  // Schema development - Core + Introspection + Migration + Codemode (38 tools)
  "dev-schema": ["core", "introspection", "migration", "codemode"],

  // Bare minimum - Core + Codemode (22 tools)
  minimal: ["core", "codemode"],

  // All tools enabled (140 WASM / 167 Native)
  full: [
    "core",
    "json",
    "text",
    "stats",
    "vector",
    "admin",
    "transactions",
    "geo",
    "introspection",
    "migration",
    "codemode",
  ],
};
