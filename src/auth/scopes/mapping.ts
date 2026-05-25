import type { ToolGroup } from "../../types/index.js";
import { SCOPES, type StandardScope } from "./constants.js";
import { TOOL_GROUPS } from "../../filtering/tool-constants.js";

/**
 * Declarative mapping from tool group to required minimum scope.
 * Single source of truth — all other scope-group arrays derive from this.
 */
export const TOOL_GROUP_SCOPES: Record<ToolGroup, StandardScope> = {
  core: SCOPES.READ,
  json: SCOPES.READ,
  text: SCOPES.READ,
  stats: SCOPES.READ,
  vector: SCOPES.READ,
  geo: SCOPES.READ,
  introspection: SCOPES.READ,
  migration: SCOPES.WRITE,
  transactions: SCOPES.WRITE,
  admin: SCOPES.ADMIN,
  codemode: SCOPES.ADMIN,
};

/**
 * Get the required scope for a tool group.
 */
export function getScopeForToolGroup(group: ToolGroup): StandardScope {
  return TOOL_GROUP_SCOPES[group] ?? SCOPES.READ;
}

// Derived arrays for backward compatibility
const groupsForScope = (maxScope: StandardScope): ToolGroup[] => {
  const hierarchy: Record<StandardScope, number> = {
    read: 0,
    write: 1,
    admin: 2,
    full: 3,
  };
  const maxLevel = hierarchy[maxScope];
  return (Object.entries(TOOL_GROUP_SCOPES) as [ToolGroup, StandardScope][])
    .filter(([, scope]) => hierarchy[scope] <= maxLevel)
    .map(([group]) => group);
};

/**
 * Tool groups accessible with read scope (read-only operations)
 */
export const READ_SCOPE_GROUPS: ToolGroup[] = groupsForScope(SCOPES.READ);

/**
 * Tool groups accessible with write scope (read + write operations)
 */
export const WRITE_SCOPE_GROUPS: ToolGroup[] = groupsForScope(SCOPES.WRITE);

/**
 * Tool groups accessible with admin scope (all operations)
 */
export const ADMIN_SCOPE_GROUPS: ToolGroup[] = groupsForScope(SCOPES.ADMIN);

// =============================================================================
// Per-Tool Scope Sets
// =============================================================================

/**
 * Create a set containing both bare and sqlite_-prefixed tool names.
 * MCP runtime registers tools with the `sqlite_` prefix, but internal
 * references use bare names. Both must match for scope enforcement.
 */
function withSqlitePrefix(names: Iterable<string>): ReadonlySet<string> {
  const set = new Set<string>();
  for (const name of names) {
    set.add(name);
    set.add(`sqlite_${name}`);
  }
  return set;
}

/**
 * Admin tools: derived from all tools in groups that require admin scope.
 * Automatically includes new tools added to admin/codemode groups.
 *
 * Includes both bare (`execute_code`) and prefixed (`sqlite_execute_code`)
 * names so that the live HTTP scope enforcement middleware matches regardless
 * of how the JSON-RPC `tools/call` body names the tool.
 */
const adminToolNames: string[] = [];
for (const [group, scope] of Object.entries(TOOL_GROUP_SCOPES)) {
  if (scope === SCOPES.ADMIN) {
    const tools = TOOL_GROUPS[group as ToolGroup];
    adminToolNames.push(...tools);
  }
}
// Audit tools are registered outside TOOL_GROUPS but require admin scope.
// Without this, write-scoped tokens could invoke destructive audit operations.
adminToolNames.push(
  "audit_list_backups",
  "audit_get_backup",
  "audit_cleanup",
  "audit_diff_backup",
  "audit_restore_backup",
  "drop_table", // explicitly admin since it is destructive, despite being in core
);
export const ADMIN_TOOLS: ReadonlySet<string> = withSqlitePrefix(adminToolNames);

/**
 * Read-only tools: tools that only read data (SELECT, metadata, pure functions).
 * Used by `read` scope to allowlist tool access. Fail-closed: unlisted = denied.
 *
 * Sourced from actual tool names in TOOL_GROUPS (tool-constants.ts).
 */
export const READ_ONLY_TOOLS: ReadonlySet<string> = withSqlitePrefix([
  // Core read operations
  "read_query",
  "list_tables",
  "describe_table",
  "get_indexes",
  "count",
  "exists",
  "list_triggers",
  "list_constraints",
  "date_add",
  "date_diff",
  // JSON read operations
  "json_valid",
  "json_extract",
  "json_type",
  "json_array_length",
  "json_keys",
  "json_each",
  "json_group_array",
  "json_group_object",
  "json_pretty",
  "json_query",
  "json_select",
  "json_validate_path",
  "json_analyze_schema",
  "json_storage_info",
  "json_diff",
  "json_security_scan",
  // Text read operations
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
  "fts_search",
  "fts_match_info",
  "fts_headline",
  // Stats (all read-only)
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
  "stats_detect_anomalies",
  "stats_detect_bloat",
  "stats_detect_schema_risks",
  "stats_sample",
  "window_row_number",
  "window_rank",
  "window_lag_lead",
  "window_running_total",
  "window_moving_avg",
  "window_ntile",
  // Vector read operations
  "vector_search",
  "vector_get",
  "vector_count",
  "vector_stats",
  "vector_dimensions",
  "vector_normalize",
  "vector_distance",
  // Geo read operations
  "geo_distance",
  "geo_nearby",
  "geo_bounding_box",
  "geo_cluster",
  // Introspection (all read-only)
  "dependency_graph",
  "topological_sort",
  "cascade_simulator",
  "schema_snapshot",
  "schema_diff",
  "constraint_analysis",
  "migration_risks",
  "storage_analysis",
  "index_audit",
  "query_plan",
]);

/**
 * Write tools: tools that modify data but don't require admin scope.
 * Used by `getRequiredScopeForTool()` for per-tool scope reporting.
 *
 * Sourced from actual tool names in TOOL_GROUPS (tool-constants.ts).
 */
export const WRITE_TOOLS: ReadonlySet<string> = withSqlitePrefix([
  // Core write operations
  "write_query",
  "create_table",
  "create_index",
  "drop_index",
  "upsert",
  "batch_insert",
  "truncate",
  "create_trigger",
  "drop_trigger",
  "alter_table",
  // JSON write operations
  "json_insert",
  "json_update",
  "json_set",
  "json_remove",
  "json_array_append",
  "json_merge",
  "create_json_collection",
  "jsonb_convert",
  "json_normalize_column",
  // Text write operations
  "fts_create",
  "fts_rebuild",
  // Vector write operations
  "vector_create_table",
  "vector_store",
  "vector_batch_store",
  "vector_delete",
  // Geo write operations
  "spatialite_load",
  "spatialite_create_table",
  "spatialite_query",
  "spatialite_analyze",
  "spatialite_index",
  "spatialite_transform",
  "spatialite_import",
  // Migration (write scope group)
  "migration_init",
  "migration_record",
  "migration_apply",
  "migration_rollback",
  "migration_history",
  "migration_status",
  // Transactions (write scope group)
  "transaction_begin",
  "transaction_status",
  "transaction_commit",
  "transaction_rollback",
  "transaction_savepoint",
  "transaction_release",
  "transaction_rollback_to",
  "transaction_execute",
]);
