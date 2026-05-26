import type { ToolGroup } from "../../types/index.js";
import { TOOL_GROUPS } from "../../filtering/tool-filter.js";
import { SCOPES } from "./constants.js";
import {
  ADMIN_TOOLS,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  ADMIN_SCOPE_GROUPS,
  READ_SCOPE_GROUPS,
  WRITE_SCOPE_GROUPS,
  TOOL_GROUP_SCOPES,
} from "./mapping.js";
import { hasReadScope, hasWriteScope, hasAdminScope } from "./validation.js";

const toolScopeMap = new Map<string, string[]>();

export function registerToolScopes(map: Map<string, string[]>): void {
  for (const [key, val] of map.entries()) {
    toolScopeMap.set(key, val);
  }
}

/**
 * Check if a scope grants access to a specific tool
 */
export function scopeGrantsToolAccess(
  scope: string,
  toolName: string,
): boolean {
  // Full scope grants access to all tools
  if (scope === "full" || scope === "admin") {
    return true;
  }

  // Use dynamic scopes if available
  if (toolScopeMap.size > 0) {
    const required = toolScopeMap.get(toolName);
    if (required) {
      if (required.includes(scope)) {
        return true;
      }
      // 'write' scope grants access to 'read' tools
      if (scope === "write" && required.includes("read")) {
        return true;
      }
      return false;
    }
    // Fail-closed: unknown tools require admin scope
    return false;
  }

  // Fallback to legacy logic...
  if (scope === "write") {
    return WRITE_TOOLS.has(toolName) || READ_ONLY_TOOLS.has(toolName);
  }

  if (scope === "read") {
    return READ_ONLY_TOOLS.has(toolName);
  }

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
 * Get the required minimum scope for a tool group
 */
export function getRequiredScopeForGroup(group: ToolGroup): string {
  return TOOL_GROUP_SCOPES[group] ?? SCOPES.ADMIN;
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
  if (READ_ONLY_TOOLS.has(toolName)) {
    return "read";
  }
  // Fail-closed: unknown tools require admin scope
  return "admin";
}

/**
 * Get tool groups accessible with given scopes
 */
export function getAccessibleToolGroups(scopes: string[]): ToolGroup[] {
  if (scopes.includes(SCOPES.FULL) || hasAdminScope(scopes)) {
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
