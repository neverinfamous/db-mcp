/**
 * Tool Filter System Tests - Evaluation
 *
 * Tests for the tool filtering system including:
 * - Tool enablement checks
 * - Filter evaluation
 * - Edge cases and security boundaries
 */

import { describe, it, expect } from "vitest";
import {
  parseToolFilter,
  isToolEnabled,
  filterTools,
  ALL_TOOL_GROUPS,
} from "../../../src/filtering/tool-filter.js";
import type { ToolDefinition, ToolGroup } from "../../../src/types/index.js";

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

describe("edge cases", () => {
  it("should handle duplicate groups gracefully", () => {
    const config = parseToolFilter("core,core,core");

    expect(config.enabledGroups.size).toBe(2); // core + codemode (auto-injected)
    expect(config.enabledGroups.has("core")).toBe(true);
    expect(config.enabledGroups.has("codemode")).toBe(true);
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
    // No valid groups enabled, so codemode auto-injection doesn't trigger
    expect(config.enabledGroups.size).toBe(0);
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

  it("should auto-inject codemode when using a raw group filter", () => {
    const config = parseToolFilter("core");

    expect(config.enabledGroups.has("core")).toBe(true);
    expect(config.enabledGroups.has("codemode")).toBe(true);
    expect(config.enabledGroups.size).toBe(2); // core + codemode
  });

  it("should not inject codemode when explicitly excluded with -codemode", () => {
    const config = parseToolFilter("core,-codemode");

    expect(config.enabledGroups.has("core")).toBe(true);
    expect(config.enabledGroups.has("codemode")).toBe(false);
  });

  it("should not inject codemode when sqlite_execute_code explicitly excluded", () => {
    const config = parseToolFilter("core,-sqlite_execute_code");

    expect(config.enabledGroups.has("core")).toBe(true);
    expect(config.enabledGroups.has("codemode")).toBe(false);
  });
});
