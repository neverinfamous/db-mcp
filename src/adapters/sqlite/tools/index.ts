/**
 * SQLite Tools Index
 *
 * Aggregates and exports all tool definitions from category modules.
 */

import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, ToolGroup } from "../../../types/index.js";
import { getToolGroupIcon } from "../../../utils/icons.js";
import { getCoreTools } from "./core.js";
import { getJsonHelperTools } from "./json-helpers.js";
import { getJsonOperationTools } from "./json-operations.js";
import { getTextTools } from "./text.js";

import { getStatsTools } from "./stats.js";
import { getVirtualTools } from "./virtual.js";
import { getVectorTools } from "./vector.js";
import { getGeoTools } from "./geo.js";
import { getAdminTools } from "./admin.js";
import { getCodeModeTools } from "./codemode.js";

/**
 * Get all tool definitions for the SQLite adapter.
 * Attaches group-level icons to each tool.
 */
export function getAllToolDefinitions(
  adapter: SqliteAdapter,
): ToolDefinition[] {
  const tools = [
    ...getCoreTools(adapter),
    ...getJsonHelperTools(adapter),
    ...getJsonOperationTools(adapter),
    ...getTextTools(adapter),

    ...getStatsTools(adapter),
    ...getVirtualTools(adapter),
    ...getVectorTools(adapter),
    ...getGeoTools(adapter),
    ...getAdminTools(adapter),
    ...getCodeModeTools(adapter),
  ];

  // Attach group-level icons to each tool definition
  for (const tool of tools) {
    if (!tool.icons) {
      const icons = getToolGroupIcon(tool.group);
      if (icons) {
        tool.icons = icons;
      }
    }
  }

  return tools;
}

/**
 * Get tools filtered by group
 */
export function getToolsByGroup(
  adapter: SqliteAdapter,
  group: ToolGroup,
): ToolDefinition[] {
  return getAllToolDefinitions(adapter).filter((tool) => tool.group === group);
}

/**
 * Get tool count by group
 */
export function getToolCountByGroup(
  adapter: SqliteAdapter,
): Record<ToolGroup, number> {
  const tools = getAllToolDefinitions(adapter);
  const counts: Partial<Record<ToolGroup, number>> = {};

  for (const tool of tools) {
    counts[tool.group] = (counts[tool.group] ?? 0) + 1;
  }

  return counts as Record<ToolGroup, number>;
}

// Re-export individual tool modules
export { getCoreTools } from "./core.js";
export { getJsonHelperTools } from "./json-helpers.js";
export { getJsonOperationTools } from "./json-operations.js";
export { getTextTools } from "./text.js";

export { getStatsTools } from "./stats.js";
export { getVirtualTools } from "./virtual.js";
export { getVectorTools } from "./vector.js";
export { getGeoTools } from "./geo.js";
export { getAdminTools } from "./admin.js";
export { getCodeModeTools } from "./codemode.js";
