/**
 * Tool Filter System Tests - Parsing
 *
 * Tests for the tool filtering system including:
 * - Filter string parsing (whitelist, exclusion, meta-groups)
 * - Environment variable loading
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseToolFilter,
  getToolFilterFromEnv,
  ALL_TOOL_GROUPS,
} from "../../../src/filtering/tool-filter.js";

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
    it("should enable only specified group (plus codemode auto-inject)", () => {
      const config = parseToolFilter("core");

      expect(config.enabledGroups.has("core")).toBe(true);
      expect(config.enabledGroups.has("codemode")).toBe(true);
      expect(config.enabledGroups.size).toBe(2); // core + codemode
    });

    it("should enable multiple groups", () => {
      const config = parseToolFilter("core,json,text");

      expect(config.enabledGroups.has("core")).toBe(true);
      expect(config.enabledGroups.has("json")).toBe(true);
      expect(config.enabledGroups.has("text")).toBe(true);
      expect(config.enabledGroups.has("codemode")).toBe(true);
      expect(config.enabledGroups.size).toBe(4); // core + json + text + codemode
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

describe("getToolFilterFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["DB_MCP_TOOL_FILTER"];
    delete process.env["TOOL_FILTER"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should read from DB_MCP_TOOL_FILTER", () => {
    process.env["DB_MCP_TOOL_FILTER"] = "core,json";
    const config = getToolFilterFromEnv();

    expect(config.enabledGroups.has("core")).toBe(true);
    expect(config.enabledGroups.has("json")).toBe(true);
  });

  it("should fall back to TOOL_FILTER", () => {
    process.env["TOOL_FILTER"] = "text";
    const config = getToolFilterFromEnv();

    expect(config.enabledGroups.has("text")).toBe(true);
  });

  it("should prefer DB_MCP_TOOL_FILTER over TOOL_FILTER", () => {
    process.env["DB_MCP_TOOL_FILTER"] = "core";
    process.env["TOOL_FILTER"] = "json";
    const config = getToolFilterFromEnv();

    expect(config.enabledGroups.has("core")).toBe(true);
    expect(config.enabledGroups.has("json")).toBe(false);
  });

  it("should return all groups enabled when no env var set", () => {
    const config = getToolFilterFromEnv();

    expect(config.enabledGroups.size).toBe(ALL_TOOL_GROUPS.length);
  });
});
