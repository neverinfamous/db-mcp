/**
 * db-mcp — Tool Scope Map
 *
 * Builds a reverse lookup from tool name to required OAuth scope
 * by inverting TOOL_GROUPS × TOOL_GROUP_SCOPES. Computed once at
 * module load for O(1) per-call lookup.
 */

import { SCOPES } from "./scopes/index.js";

/**
 * Map from tool name to required minimum scope.
 * Dynamically populated during tool registration.
 */
const toolScopeMap = new Map<string, string>();

/**
 * Register a tool's required scope dynamically.
 * Replaces the old static group derivation.
 */
export function registerToolScope(toolName: string, scope: string): void {
  toolScopeMap.set(toolName, scope);
  if (!toolName.startsWith("sqlite_")) {
    toolScopeMap.set(`sqlite_${toolName}`, scope);
  } else {
    toolScopeMap.set(toolName.slice(7), scope);
  }
}

/**
 * Get the required scope for a tool by name.
 *
 * @param toolName - The MCP tool name (e.g., "sqlite_read_query")
 * @returns The required scope, or "admin" as a fail-closed default for unknown tools
 */
export function getRequiredScope(toolName: string): string {
  return toolScopeMap.get(toolName) ?? SCOPES.ADMIN;
}

/**
 * Get the full tool-to-scope map (for testing/debugging).
 */
export function getToolScopeMap(): ReadonlyMap<string, string> {
  return toolScopeMap;
}
