/**
 * db-mcp - OAuth Scopes
 *
 * Scope definitions and enforcement utilities for
 * granular access control.
 *
 * Scope Patterns:
 *   - read      : Read-only access to all databases
 *   - write     : Read and write access to all databases
 *   - admin     : Full administrative access
 *   - db:{name} : Access to specific database only
 *   - table:{db}:{table} : Access to specific table only
 */

import type { ToolGroup } from "../types/index.js";
import { TOOL_GROUPS } from "../filtering/ToolFilter.js";

// =============================================================================
// Scope Constants
// =============================================================================

/**
 * Base scopes supported by the server
 */
export const BASE_SCOPES = ["read", "write", "admin"] as const;

/**
 * Scope patterns (regex patterns for validation)
 */
export const SCOPE_PATTERNS = {
  /** Read-only access */
  READ: "read",
  /** Read and write access */
  WRITE: "write",
  /** Full admin access */
  ADMIN: "admin",
  /** Database-specific access pattern */
  DATABASE: /^db:([a-zA-Z0-9_-]+)$/,
  /** Table-specific access pattern */
  TABLE: /^table:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)$/,
} as const;

/**
 * All supported scope patterns for metadata
 */
export const SUPPORTED_SCOPES = [
  "read",
  "write",
  "admin",
  "db:{database}",
  "table:{database}:{table}",
] as const;

// =============================================================================
// Scope to Tool Group Mapping
// =============================================================================

/**
 * Tool groups accessible with read scope (read-only operations)
 */
export const READ_SCOPE_GROUPS: ToolGroup[] = [
  "core", // read_query, list_tables, describe_table, etc.
  "monitoring", // health_check, connection_status, etc.
];

/**
 * Tool groups accessible with write scope (read + write operations)
 */
export const WRITE_SCOPE_GROUPS: ToolGroup[] = [
  ...READ_SCOPE_GROUPS,
  "json", // JSON operations
  "text", // Text processing
  "stats", // Statistical analysis
  "performance", // Performance optimization
  "vector", // Vector operations
  "geo", // Geospatial operations
];

/**
 * Tool groups accessible with admin scope (all operations)
 */
export const ADMIN_SCOPE_GROUPS: ToolGroup[] = [
  ...WRITE_SCOPE_GROUPS,
  "backup", // Backup & recovery
  "admin", // Administration
];

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

// =============================================================================
// Scope Parsing
// =============================================================================

/**
 * Parse a scope string (space-delimited) into an array
 */
export function parseScopes(scopeString: string): string[] {
  return scopeString
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse a database-specific scope
 * @returns The database name or null if not a database scope
 */
export function parseDatabaseScope(scope: string): string | null {
  const match = SCOPE_PATTERNS.DATABASE.exec(scope);
  return match?.[1] ?? null;
}

/**
 * Parse a table-specific scope
 * @returns Object with database and table names, or null if not a table scope
 */
export function parseTableScope(
  scope: string,
): { database: string; table: string } | null {
  const match = SCOPE_PATTERNS.TABLE.exec(scope);
  const database = match?.[1];
  const table = match?.[2];
  if (database !== undefined && table !== undefined) {
    return { database, table };
  }
  return null;
}

// =============================================================================
// Scope Validation
// =============================================================================

/**
 * Check if a scope is valid (matches known patterns)
 */
export function isValidScope(scope: string): boolean {
  // Check base scopes
  if ((BASE_SCOPES as readonly string[]).includes(scope)) {
    return true;
  }

  // Check database pattern
  if (SCOPE_PATTERNS.DATABASE.test(scope)) {
    return true;
  }

  // Check table pattern
  if (SCOPE_PATTERNS.TABLE.test(scope)) {
    return true;
  }

  return false;
}

/**
 * Check if scopes include admin access
 */
export function hasAdminScope(scopes: string[]): boolean {
  return scopes.includes("admin");
}

/**
 * Check if scopes include write access
 */
export function hasWriteScope(scopes: string[]): boolean {
  return scopes.includes("write") || hasAdminScope(scopes);
}

/**
 * Check if scopes include read access
 */
export function hasReadScope(scopes: string[]): boolean {
  return scopes.includes("read") || hasWriteScope(scopes);
}

// =============================================================================
// Scope Enforcement
// =============================================================================

/**
 * Check if a scope grants access to a specific tool
 */
export function scopeGrantsToolAccess(
  scope: string,
  toolName: string,
): boolean {
  // Admin scope grants access to all tools
  if (scope === "admin") {
    return true;
  }

  // Write scope grants access to write tools and below
  if (scope === "write") {
    if (ADMIN_TOOLS.has(toolName)) {
      return false;
    }
    return true;
  }

  // Read scope only grants read-only tools
  if (scope === "read") {
    return READ_ONLY_TOOLS.has(toolName);
  }

  // Database/table scopes don't directly affect tool access
  // They are used for filtering data, not tools
  return false;
}

/**
 * Check if any of the scopes grants access to a tool
 */
export function scopesGrantToolAccess(
  scopes: string[],
  toolName: string,
): boolean {
  return scopes.some((scope) => scopeGrantsToolAccess(scope, toolName));
}

/**
 * Check if a scope grants access to a specific database
 */
export function scopeGrantsDatabaseAccess(
  scope: string,
  databaseName: string,
): boolean {
  // Admin and write scopes grant access to all databases
  if (scope === "admin" || scope === "write" || scope === "read") {
    return true;
  }

  // Check database-specific scope
  const dbName = parseDatabaseScope(scope);
  if (dbName && dbName === databaseName) {
    return true;
  }

  // Check table scope (grants access to the database of the table)
  const tableScope = parseTableScope(scope);
  if (tableScope?.database === databaseName) {
    return true;
  }

  return false;
}

/**
 * Check if any of the scopes grants access to a database
 */
export function scopesGrantDatabaseAccess(
  scopes: string[],
  databaseName: string,
): boolean {
  return scopes.some((scope) => scopeGrantsDatabaseAccess(scope, databaseName));
}

/**
 * Check if a scope grants access to a specific table
 */
export function scopeGrantsTableAccess(
  scope: string,
  databaseName: string,
  tableName: string,
): boolean {
  // Admin and write scopes grant access to all tables
  if (scope === "admin" || scope === "write" || scope === "read") {
    return true;
  }

  // Database scope grants access to all tables in that database
  const dbName = parseDatabaseScope(scope);
  if (dbName && dbName === databaseName) {
    return true;
  }

  // Check table-specific scope
  const tableScope = parseTableScope(scope);
  if (tableScope?.database === databaseName && tableScope.table === tableName) {
    return true;
  }

  return false;
}

/**
 * Check if any of the scopes grants access to a table
 */
export function scopesGrantTableAccess(
  scopes: string[],
  databaseName: string,
  tableName: string,
): boolean {
  return scopes.some((scope) =>
    scopeGrantsTableAccess(scope, databaseName, tableName),
  );
}

// =============================================================================
// Tool Group Utilities
// =============================================================================

/**
 * Get the required minimum scope for a tool group
 */
export function getRequiredScopeForGroup(group: ToolGroup): string {
  if (
    ADMIN_SCOPE_GROUPS.includes(group) &&
    !WRITE_SCOPE_GROUPS.includes(group)
  ) {
    return "admin";
  }
  if (
    WRITE_SCOPE_GROUPS.includes(group) &&
    !READ_SCOPE_GROUPS.includes(group)
  ) {
    return "write";
  }
  return "read";
}

/**
 * Get the required minimum scope for a tool
 */
export function getRequiredScopeForTool(toolName: string): string {
  if (ADMIN_TOOLS.has(toolName)) {
    return "admin";
  }
  if (WRITE_TOOLS.has(toolName)) {
    return "write";
  }
  return "read";
}

/**
 * Get tool groups accessible with given scopes
 */
export function getAccessibleToolGroups(scopes: string[]): ToolGroup[] {
  if (hasAdminScope(scopes)) {
    return [...ADMIN_SCOPE_GROUPS];
  }
  if (hasWriteScope(scopes)) {
    return [...WRITE_SCOPE_GROUPS];
  }
  if (hasReadScope(scopes)) {
    return [...READ_SCOPE_GROUPS];
  }
  return [];
}

/**
 * Get all tools accessible with given scopes
 */
export function getAccessibleTools(scopes: string[]): string[] {
  const groups = getAccessibleToolGroups(scopes);
  const allTools: string[] = [];

  for (const group of groups) {
    const groupTools = TOOL_GROUPS[group] ?? [];
    for (const tool of groupTools) {
      // For read scope, only include read-only tools
      if (hasReadScope(scopes) && !hasWriteScope(scopes)) {
        if (READ_ONLY_TOOLS.has(tool)) {
          allTools.push(tool);
        }
      } else {
        allTools.push(tool);
      }
    }
  }

  return [...new Set(allTools)];
}
