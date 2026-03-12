/**
 * Tool Filter System Tests - Groups
 *
 * Tests for the tool filtering system including:
 * - Tool groups
 * - Meta groups
 * - Filter summaries
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  parseToolFilter,
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
} from "../../../src/filtering/tool-filter.js";

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

  it("should cache results on second call", () => {
    // First call initializes the cache
    const first = getToolGroup("list_tables");
    // Second call hits the cache (line 66)
    const second = getToolGroup("describe_table");

    expect(first).toBe("core");
    expect(second).toBe("core");
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

  it("should include summary with included tools", () => {
    const config = parseToolFilter("core,+some_specific_tool");
    const summary = getFilterSummary(config);

    expect(summary).toContain("Included tools");
    expect(summary).toContain("some_specific_tool");
  });
});

describe("getMetaGroupInfo", () => {
  it("should return all meta-groups with their groups", () => {
    const info = getMetaGroupInfo();

    expect(info.length).toBe(Object.keys(META_GROUPS).length);
    expect(info.some((i) => i.metaGroup === "starter")).toBe(true);
  });
});
