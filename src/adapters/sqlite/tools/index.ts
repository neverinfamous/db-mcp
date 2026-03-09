/**
 * SQLite Tools Index
 *
 * Aggregates and exports all tool definitions from category modules.
 */

import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, ToolGroup } from "../../../types/index.js";
import { getToolGroupIcon } from "../../../utils/icons.js";
import { getCoreTools } from "./core/index.js";
import { getJsonHelperTools } from "./json-helpers.js";
import { getJsonOperationTools } from "./json-operations/index.js";
import { getTextTools } from "./text/index.js";

import { getStatsTools } from "./stats/index.js";
import { getVirtualTools } from "./virtual/index.js";
import { getVectorTools } from "./vector/index.js";
import { getGeoTools } from "./geo.js";
import { getAdminTools } from "./admin/index.js";
import { getIntrospectionTools } from "./introspection/index.js";
import { getMigrationTools } from "./migration/index.js";
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
    ...getIntrospectionTools(adapter),
    ...getMigrationTools(adapter),
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
export { getCoreTools } from "./core/index.js";
export { getJsonHelperTools } from "./json-helpers.js";
export { getJsonOperationTools } from "./json-operations/index.js";
export { getTextTools } from "./text/index.js";

export { getStatsTools } from "./stats/index.js";
export { getVirtualTools } from "./virtual/index.js";
export { getVectorTools } from "./vector/index.js";
export { getGeoTools } from "./geo.js";
export { getAdminTools } from "./admin/index.js";
export { getIntrospectionTools } from "./introspection/index.js";
export { getMigrationTools } from "./migration/index.js";
export { getCodeModeTools } from "./codemode.js";

