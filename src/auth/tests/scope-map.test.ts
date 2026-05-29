/**
 * db-mcp - Scope Map Unit Tests
 *
 * Tests for the tool-to-scope reverse lookup.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getRequiredScope,
  getToolScopeMap,
  registerToolScope,
} from "../scope-map.js";

describe("scope-map", () => {
  beforeEach(() => {
    registerToolScope("test_read_tool", "read");
    registerToolScope("sqlite_test_read_tool", "read");
    registerToolScope("test_admin_tool", "admin");
  });

  describe("getRequiredScope", () => {
    it("should return correctly registered scope", () => {
      expect(getRequiredScope("test_read_tool")).toBe("read");
      expect(getRequiredScope("test_admin_tool")).toBe("admin");
    });

    it("should auto-prefix with sqlite_ if not present", () => {
      registerToolScope("foo_bar", "write");
      expect(getRequiredScope("sqlite_foo_bar")).toBe("write");
    });

    it("should return admin as fail-closed default for unknown tools", () => {
      expect(getRequiredScope("nonexistent_tool_xyz")).toBe("admin");
    });
  });

  describe("getToolScopeMap", () => {
    it("should return a ReadonlyMap", () => {
      const map = getToolScopeMap();
      expect(map).toBeInstanceOf(Map);
    });

    it("should not be empty after registration", () => {
      const map = getToolScopeMap();
      expect(map.size).toBeGreaterThan(0);
    });
  });
});
