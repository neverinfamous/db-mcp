/**
 * db-mcp - Tool Filtering System
 *
 * Parses and applies tool filter rules from environment variables.
 * Compatible with postgres-mcp-server filtering syntax.
 *
 * Syntax:
 *   groupName     → Enable only this group (whitelist mode)
 *   shortcut      → Use a preset (starter, analytics, search, etc.)
 *   -group        → Disable all tools in a group
 *   +group        → Enable all tools in a group
 *   -tool         → Disable a specific tool
 *   +tool         → Enable a specific tool
 *
 * Mode Detection:
 *   - If first token starts with '-', start with ALL groups enabled (exclusion mode)
 *   - Otherwise, start with NO groups enabled (whitelist mode)
 *
 * Examples:
 *   "core,json"           → Whitelist: only core and json groups
 *   "starter"             → Preset: core + json + text groups
 *   "starter,-fts5"       → Preset minus fts5 group
 *   "-vector,-geo"        → Legacy: all groups except vector and geo
 */

import type {
  ToolGroup,
  MetaGroup,
  ToolFilterConfig,
  ToolDefinition,
} from "../types/index.js";

import { META_GROUPS, ALL_TOOL_GROUPS, TOOL_GROUPS } from "./ToolConstants.js";

// Re-export for backwards compatibility
export { META_GROUPS, TOOL_GROUPS, ALL_TOOL_GROUPS } from "./ToolConstants.js";

/**
 * Cached list of all tool names
 * Lazy-initialized since TOOL_GROUPS is immutable
 */
let cachedAllToolNames: string[] | null = null;

/**
 * Reverse lookup map: tool name -> group
 * Lazy-initialized for O(1) tool group lookups
 */
let toolToGroupMap: Map<string, ToolGroup> | null = null;

/**
 * Get all tool names from all groups (cached)
 */
export function getAllToolNames(): string[] {
  if (cachedAllToolNames) {
    return cachedAllToolNames;
  }
  cachedAllToolNames = ALL_TOOL_GROUPS.flatMap((group) => TOOL_GROUPS[group]);
  return cachedAllToolNames;
}

/**
 * Get or initialize the tool-to-group reverse lookup map
 */
function getToolToGroupMap(): Map<string, ToolGroup> {
  if (toolToGroupMap) {
    return toolToGroupMap;
  }
  toolToGroupMap = new Map<string, ToolGroup>();
  for (const group of ALL_TOOL_GROUPS) {
    for (const tool of TOOL_GROUPS[group]) {
      toolToGroupMap.set(tool, group);
    }
  }
  return toolToGroupMap;
}

/**
 * Get the group for a specific tool (O(1) lookup)
 */
export function getToolGroup(toolName: string): ToolGroup | undefined {
  return getToolToGroupMap().get(toolName);
}

/**
 * Clear all caches - useful for testing
 */
export function clearToolFilterCaches(): void {
  cachedAllToolNames = null;
  toolToGroupMap = null;
}

/**
 * Check if a name is a valid tool group
 */
export function isToolGroup(name: string): name is ToolGroup {
  return ALL_TOOL_GROUPS.includes(name as ToolGroup);
}

/**
 * Check if a name is a valid meta-group
 */
export function isMetaGroup(name: string): name is MetaGroup {
  return name in META_GROUPS;
}

/**
 * Get tool groups from a meta-group
 */
export function getMetaGroupGroups(metaGroup: MetaGroup): ToolGroup[] {
  return META_GROUPS[metaGroup];
}

/**
 * Parse a tool filter string into structured rules
 *
 * @param filterString - The filter string (e.g., "starter" or "-vector,-geo")
 * @returns Parsed filter configuration with enabled groups
 */
export function parseToolFilter(
  filterString: string | undefined,
): ToolFilterConfig {
  // Default: all groups enabled, no specific tool exclusions
  const enabledGroups = new Set<ToolGroup>(ALL_TOOL_GROUPS);
  const excludedTools = new Set<string>();
  const includedTools = new Set<string>();

  if (!filterString || filterString.trim() === "") {
    return {
      raw: "",
      rules: [],
      enabledGroups,
      excludedTools,
      includedTools,
    };
  }

  const rules: ToolFilterConfig["rules"] = [];
  const parts = filterString
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p);

  if (parts.length === 0) {
    return {
      raw: filterString,
      rules: [],
      enabledGroups,
      excludedTools,
      includedTools,
    };
  }

  // Mode detection: if first token starts with '-', exclusion mode (legacy)
  // Otherwise, whitelist mode (new) - start with empty groups
  const firstPart = parts[0];
  if (!firstPart) {
    return {
      raw: filterString,
      rules: [],
      enabledGroups,
      excludedTools,
      includedTools,
    };
  }
  const startsWithExclude = firstPart.startsWith("-");

  if (!startsWithExclude) {
    enabledGroups.clear();
  }

  for (const part of parts) {
    if (!part) continue;

    let isInclude = true; // Default to include (whitelist mode)
    let isExclude = false;
    let target = part;

    if (part.startsWith("+")) {
      isInclude = true;
      target = part.substring(1);
    } else if (part.startsWith("-")) {
      isInclude = false;
      isExclude = true;
      target = part.substring(1);
    }
    // No prefix = include (whitelist mode)

    // Special case: 'all'
    if (target === "all") {
      if (isExclude) {
        enabledGroups.clear();
      } else {
        for (const group of ALL_TOOL_GROUPS) {
          enabledGroups.add(group);
        }
      }
      continue;
    }

    const targetIsMetaGroup = isMetaGroup(target);
    const targetIsGroup = isToolGroup(target);

    rules.push({
      type: isInclude ? "include" : "exclude",
      target,
      isGroup: targetIsGroup || targetIsMetaGroup,
    });

    // Apply rule - check meta-groups first, then regular groups, then individual tools
    if (targetIsMetaGroup) {
      // Expand meta-group to its constituent groups
      const groupsInMeta = getMetaGroupGroups(target as MetaGroup);
      if (isExclude) {
        for (const group of groupsInMeta) {
          enabledGroups.delete(group);
        }
      } else {
        for (const group of groupsInMeta) {
          enabledGroups.add(group);
        }
      }
    } else if (targetIsGroup) {
      // Add/remove a single group
      if (isExclude) {
        enabledGroups.delete(target as ToolGroup);
      } else {
        enabledGroups.add(target as ToolGroup);
      }
    } else {
      // Individual tool - track in include/exclude sets
      if (isExclude) {
        excludedTools.add(target);
        includedTools.delete(target);
      } else {
        includedTools.add(target);
        excludedTools.delete(target);
      }
    }
  }

  return {
    raw: filterString,
    rules,
    enabledGroups,
    excludedTools,
    includedTools,
  };
}

/**
 * Check if a tool is enabled based on filter configuration
 * Uses the tool's group property for matching
 */
export function isToolEnabled(
  tool: ToolDefinition,
  config: ToolFilterConfig,
): boolean {
  const baseName = tool.name.replace(
    /^(sqlite|mysql|postgres|mongodb|redis|sqlserver)_/,
    "",
  );

  // Check explicit tool exclusion
  if (
    config.excludedTools.has(tool.name) ||
    config.excludedTools.has(baseName)
  ) {
    return false;
  }

  // Check explicit tool inclusion
  if (
    config.includedTools.has(tool.name) ||
    config.includedTools.has(baseName)
  ) {
    return true;
  }

  // Check if tool's group is enabled
  return config.enabledGroups.has(tool.group);
}

/**
 * Filter a list of tool definitions based on filter configuration
 */
export function filterTools(
  tools: ToolDefinition[],
  config: ToolFilterConfig,
): ToolDefinition[] {
  return tools.filter((tool) => isToolEnabled(tool, config));
}

/**
 * Get the tool filter from environment variable
 */
export function getToolFilterFromEnv(): ToolFilterConfig {
  const filterString =
    process.env["DB_MCP_TOOL_FILTER"] ?? process.env["TOOL_FILTER"] ?? "";
  return parseToolFilter(filterString);
}

/**
 * Generate a summary of the current filter configuration
 */
export function getFilterSummary(config: ToolFilterConfig): string {
  const lines: string[] = [
    `Tool Filter Summary:`,
    `  Filter: ${config.raw || "(none)"}`,
    `  Enabled groups: ${config.enabledGroups.size}/${ALL_TOOL_GROUPS.length}`,
  ];

  if (config.enabledGroups.size > 0) {
    lines.push(`    Groups: ${[...config.enabledGroups].join(", ")}`);
  }

  if (config.excludedTools.size > 0) {
    lines.push(`  Excluded tools: ${[...config.excludedTools].join(", ")}`);
  }

  if (config.includedTools.size > 0) {
    lines.push(`  Included tools: ${[...config.includedTools].join(", ")}`);
  }

  if (config.rules.length > 0) {
    lines.push(`  Rules applied: ${config.rules.length}`);
    for (const rule of config.rules) {
      const prefix = rule.type === "include" ? "+" : "-";
      const type = isMetaGroup(rule.target)
        ? "meta-group"
        : rule.isGroup
          ? "group"
          : "tool";
      lines.push(`    ${prefix}${rule.target} (${type})`);
    }
  }

  return lines.join("\n");
}

/**
 * Get a list of all meta-groups with their expanded groups
 */
export function getMetaGroupInfo(): {
  metaGroup: MetaGroup;
  groups: ToolGroup[];
}[] {
  return Object.entries(META_GROUPS).map(([metaGroup, groups]) => ({
    metaGroup: metaGroup as MetaGroup,
    groups,
  }));
}
