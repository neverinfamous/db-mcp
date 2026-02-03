/**
 * Tool Filter System Tests
 *
 * Tests for the tool filtering system including:
 * - Filter string parsing (whitelist, exclusion, meta-groups)
 * - Tool enablement checks
 * - Filter configuration caching
 * - Edge cases and security boundaries
 *
 * Phase 3 of db-mcp Security Test Coverage Improvement Plan
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  parseToolFilter,
  isToolEnabled,
  filterTools,
  isToolGroup,
  isMetaGroup,
  getMetaGroupGroups,
  getAllToolNames,
  getToolGroup,
  clearToolFilterCaches,
  getFilterSummary,
  getMetaGroupInfo,
  ALL_TOOL_GROUPS,
  META_GROUPS,
} from "../../src/filtering/ToolFilter.js";
import type { ToolDefinition, ToolGroup } from "../../src/types/index.js";

// Mock tool for testing
function createMockTool(name: string, group: ToolGroup): ToolDefinition {
  return {
    name,
    description: `Mock ${name}`,
    group,
    inputSchema: {} as never,
    outputSchema: {} as never,
    requiredScopes: ["read"],
    handler: async () => ({ success: true }),
  };
}

// =============================================================================
// parseToolFilter Tests
// =============================================================================

describe("parseToolFilter", () => {
  describe("empty/undefined input", () => {
    it("should return all groups enabled for undefined", () => {
      const config = parseToolFilter(undefined);

      expect(config.enabledGroups.size).toBe(ALL_TOOL_GROUPS.length);
      expect(config.raw).toBe("");
    });

    it("should return all groups enabled for empty string", () => {
      const config = parseToolFilter("");

      expect(config.enabledGroups.size).toBe(ALL_TOOL_GROUPS.length);
    });

    it("should return all groups enabled for whitespace", () => {
      const config = parseToolFilter("   ");

      expect(config.enabledGroups.size).toBe(ALL_TOOL_GROUPS.length);
    });
  });

  describe("whitelist mode", () => {
    it("should enable only specified group", () => {
      const config = parseToolFilter("core");

      expect(config.enabledGroups.has("core")).toBe(true);
      expect(config.enabledGroups.size).toBe(1);
    });

    it("should enable multiple groups", () => {
      const config = parseToolFilter("core,json,text");

      expect(config.enabledGroups.has("core")).toBe(true);
      expect(config.enabledGroups.has("json")).toBe(true);
      expect(config.enabledGroups.has("text")).toBe(true);
      expect(config.enabledGroups.size).toBe(3);
    });

    it("should expand meta-groups", () => {
      const config = parseToolFilter("starter");

      // starter = core + json + text
      expect(config.enabledGroups.has("core")).toBe(true);
      expect(config.enabledGroups.has("json")).toBe(true);
      expect(config.enabledGroups.has("text")).toBe(true);
    });
  });

  describe("exclusion mode (legacy)", () => {
    it("should start with all groups and exclude specified", () => {
      const config = parseToolFilter("-vector");

      expect(config.enabledGroups.has("vector")).toBe(false);
      expect(config.enabledGroups.has("core")).toBe(true);
    });

    it("should exclude multiple groups", () => {
      const config = parseToolFilter("-vector,-geo");

      expect(config.enabledGroups.has("vector")).toBe(false);
      expect(config.enabledGroups.has("geo")).toBe(false);
      expect(config.enabledGroups.has("core")).toBe(true);
    });
  });

  describe("mixed mode", () => {
    it("should allow whitelist with exclusions", () => {
      const config = parseToolFilter("starter,-text");

      expect(config.enabledGroups.has("core")).toBe(true);
      expect(config.enabledGroups.has("json")).toBe(true);
      expect(config.enabledGroups.has("text")).toBe(false);
    });
  });

  describe("explicit include/exclude", () => {
    it("should handle +group syntax", () => {
      const config = parseToolFilter("+core,+json");

      expect(config.enabledGroups.has("core")).toBe(true);
      expect(config.enabledGroups.has("json")).toBe(true);
    });

    it("should handle +tool for individual tools", () => {
      const config = parseToolFilter("core,+sqlite_list_tables");

      expect(config.includedTools.has("sqlite_list_tables")).toBe(true);
    });

    it("should handle -tool for individual tools", () => {
      const config = parseToolFilter("-sqlite_backup");

      expect(config.excludedTools.has("sqlite_backup")).toBe(true);
    });
  });

  describe("special 'all' keyword", () => {
    it("should enable all groups with +all", () => {
      const config = parseToolFilter("+all");

      expect(config.enabledGroups.size).toBe(ALL_TOOL_GROUPS.length);
    });

    it("should disable all groups with -all", () => {
      const config = parseToolFilter("-all");

      expect(config.enabledGroups.size).toBe(0);
    });
  });

  describe("rules tracking", () => {
    it("should track all applied rules", () => {
      const config = parseToolFilter("core,-text,+sqlite_backup");

      expect(config.rules.length).toBe(3);
      expect(config.rules[0]).toEqual({
        type: "include",
        target: "core",
        isGroup: true,
      });
      expect(config.rules[1]).toEqual({
        type: "exclude",
        target: "text",
        isGroup: true,
      });
      expect(config.rules[2]).toEqual({
        type: "include",
        target: "sqlite_backup",
        isGroup: false,
      });
    });
  });
});

// =============================================================================
// isToolEnabled Tests
// =============================================================================

describe("isToolEnabled", () => {
  it("should enable tool in enabled group", () => {
    const config = parseToolFilter("core");
    const tool = createMockTool("sqlite_list_tables", "core");

    expect(isToolEnabled(tool, config)).toBe(true);
  });

  it("should disable tool in disabled group", () => {
    const config = parseToolFilter("core");
    const tool = createMockTool("sqlite_vector_search", "vector");

    expect(isToolEnabled(tool, config)).toBe(false);
  });

  it("should respect explicit tool exclusion", () => {
    const config = parseToolFilter("core,-sqlite_list_tables");
    const tool = createMockTool("sqlite_list_tables", "core");

    expect(isToolEnabled(tool, config)).toBe(false);
  });

  it("should respect explicit tool inclusion over group exclusion", () => {
    const config = parseToolFilter("-vector,+sqlite_vector_search");
    const tool = createMockTool("sqlite_vector_search", "vector");

    expect(isToolEnabled(tool, config)).toBe(true);
  });

  it("should handle base name matching (without prefix)", () => {
    const config = parseToolFilter("core,-list_tables");
    const tool = createMockTool("sqlite_list_tables", "core");

    expect(isToolEnabled(tool, config)).toBe(false);
  });
});

// =============================================================================
// filterTools Tests
// =============================================================================

describe("filterTools", () => {
  const mockTools: ToolDefinition[] = [
    createMockTool("sqlite_list_tables", "core"),
    createMockTool("sqlite_json_extract", "json"),
    createMockTool("sqlite_vector_search", "vector"),
    createMockTool("sqlite_geo_distance", "geo"),
  ];

  it("should filter tools by group", () => {
    const config = parseToolFilter("core,json");
    const filtered = filterTools(mockTools, config);

    expect(filtered.length).toBe(2);
    expect(filtered.map((t) => t.name)).toContain("sqlite_list_tables");
    expect(filtered.map((t) => t.name)).toContain("sqlite_json_extract");
  });

  it("should return all tools with no filter", () => {
    const config = parseToolFilter("");
    const filtered = filterTools(mockTools, config);

    expect(filtered.length).toBe(mockTools.length);
  });

  it("should exclude specific tools", () => {
    const config = parseToolFilter("-sqlite_vector_search");
    const filtered = filterTools(mockTools, config);

    expect(filtered.map((t) => t.name)).not.toContain("sqlite_vector_search");
    expect(filtered.length).toBe(mockTools.length - 1);
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe("isToolGroup", () => {
  it("should return true for valid groups", () => {
    expect(isToolGroup("core")).toBe(true);
    expect(isToolGroup("json")).toBe(true);
    expect(isToolGroup("vector")).toBe(true);
  });

  it("should return false for invalid groups", () => {
    expect(isToolGroup("invalid")).toBe(false);
    expect(isToolGroup("")).toBe(false);
    expect(isToolGroup("CORE")).toBe(false); // Case sensitive
  });
});

describe("isMetaGroup", () => {
  it("should return true for valid meta-groups", () => {
    expect(isMetaGroup("starter")).toBe(true);
    expect(isMetaGroup("analytics")).toBe(true);
    expect(isMetaGroup("full")).toBe(true);
  });

  it("should return false for invalid meta-groups", () => {
    expect(isMetaGroup("core")).toBe(false); // core is a group, not meta
    expect(isMetaGroup("invalid")).toBe(false);
  });
});

describe("getMetaGroupGroups", () => {
  it("should return groups for starter", () => {
    const groups = getMetaGroupGroups("starter");

    expect(groups).toContain("core");
    expect(groups).toContain("json");
    expect(groups).toContain("text");
  });

  it("should return groups for full", () => {
    const groups = getMetaGroupGroups("full");

    expect(groups.length).toBe(ALL_TOOL_GROUPS.length);
  });
});

describe("getAllToolNames", () => {
  beforeEach(() => {
    clearToolFilterCaches();
  });

  it("should return all tool names", () => {
    const names = getAllToolNames();

    expect(names.length).toBeGreaterThan(0);
    // TOOL_GROUPS uses base names without prefix (e.g., "list_tables" not "sqlite_list_tables")
    expect(names).toContain("list_tables");
  });

  it("should cache results", () => {
    const first = getAllToolNames();
    const second = getAllToolNames();

    expect(first).toBe(second); // Same reference = cached
  });
});

describe("getToolGroup", () => {
  beforeEach(() => {
    clearToolFilterCaches();
  });

  it("should return group for known tool", () => {
    // TOOL_GROUPS uses base names without prefix
    const group = getToolGroup("list_tables");

    expect(group).toBe("core");
  });

  it("should return undefined for unknown tool", () => {
    const group = getToolGroup("unknown_tool");

    expect(group).toBeUndefined();
  });
});

describe("getFilterSummary", () => {
  it("should generate readable summary", () => {
    const config = parseToolFilter("core,json,-sqlite_backup");
    const summary = getFilterSummary(config);

    expect(summary).toContain("Tool Filter Summary");
    expect(summary).toContain("core");
    expect(summary).toContain("json");
    expect(summary).toContain("sqlite_backup");
  });
});

describe("getMetaGroupInfo", () => {
  it("should return all meta-groups with their groups", () => {
    const info = getMetaGroupInfo();

    expect(info.length).toBe(Object.keys(META_GROUPS).length);
    expect(info.some((i) => i.metaGroup === "starter")).toBe(true);
  });
});

// =============================================================================
// Edge Cases and Security Boundaries
// =============================================================================

describe("edge cases", () => {
  it("should handle duplicate groups gracefully", () => {
    const config = parseToolFilter("core,core,core");

    expect(config.enabledGroups.size).toBe(1);
    expect(config.enabledGroups.has("core")).toBe(true);
  });

  it("should handle conflicting include/exclude", () => {
    // Last one wins
    const config = parseToolFilter("core,-core");

    expect(config.enabledGroups.has("core")).toBe(false);
  });

  it("should handle unknown groups as tools", () => {
    const config = parseToolFilter("unknown_thing");

    // Unknown names are treated as individual tools
    expect(config.includedTools.has("unknown_thing")).toBe(true);
    expect(config.enabledGroups.size).toBe(0); // Whitelist mode, nothing enabled
  });

  it("should handle special characters in filter string", () => {
    // Should be treated as tool names, not cause issues
    const config = parseToolFilter("core,weird%name,test@tool");

    expect(config.enabledGroups.has("core")).toBe(true);
    expect(config.includedTools.has("weird%name")).toBe(true);
    expect(config.includedTools.has("test@tool")).toBe(true);
  });

  it("should handle extra whitespace and commas", () => {
    const config = parseToolFilter(" core , json , , text ");

    expect(config.enabledGroups.has("core")).toBe(true);
    expect(config.enabledGroups.has("json")).toBe(true);
    expect(config.enabledGroups.has("text")).toBe(true);
  });

  it("should handle comma-only string (no valid parts)", () => {
    const config = parseToolFilter(",,,");

    // All groups enabled (no valid parts = same as empty)
    expect(config.enabledGroups.size).toBe(ALL_TOOL_GROUPS.length);
  });

  it("should exclude meta-group correctly", () => {
    // Start with all, exclude starter meta-group
    const config = parseToolFilter("-starter");

    // core, json, text should be excluded
    expect(config.enabledGroups.has("core")).toBe(false);
    expect(config.enabledGroups.has("json")).toBe(false);
    expect(config.enabledGroups.has("text")).toBe(false);
    // Other groups should remain
    expect(config.enabledGroups.has("vector")).toBe(true);
    expect(config.enabledGroups.has("geo")).toBe(true);
  });

  it("should include summary with included tools", () => {
    const config = parseToolFilter("core,+some_specific_tool");
    const summary = getFilterSummary(config);

    expect(summary).toContain("Included tools");
    expect(summary).toContain("some_specific_tool");
  });
});
