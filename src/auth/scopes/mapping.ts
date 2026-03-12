import type { ToolGroup } from "../../types/index.js";
import { SCOPES, type StandardScope } from "./constants.js";

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

/**
 * Read-only tools within the core group
 * (used when scope is 'read' to filter write operations)
 */
export const READ_ONLY_TOOLS = new Set([
  "execute_query", // If used with SELECT only
  "read_query",
  "list_tables",
  "describe_table",
  "list_schemas",
  "get_schema",
  "health_check",
  "connection_status",
  "database_stats",
  "active_queries",
  "resource_usage",
  "analyze_query",
  "explain_query",
  "query_plan",
]);

/**
 * Write tools that require 'write' scope
 */
export const WRITE_TOOLS = new Set([
  "write_query",
  "create_table",
  "drop_table",
  "json_insert",
  "json_replace",
  "json_remove",
  "json_set",
  "create_fts_index",
  "create_vector_index",
  "create_spatial_index",
  "create_index",
  "drop_index",
  "reindex",
]);

/**
 * Admin tools that require 'admin' scope
 */
export const ADMIN_TOOLS = new Set([
  "vacuum_database",
  "analyze_tables",
  "pragma_get",
  "pragma_set",
  "extension_list",
  "extension_install",
  "optimize",
  "backup_database",
  "restore_database",
  "backup_table",
  "export_data",
]);
