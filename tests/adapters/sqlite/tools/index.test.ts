/**
 * Tools Index Tests
 *
 * Tests for the SQLite tools index barrel file.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";
import {
  getAllToolDefinitions,
  getToolsByGroup,
  getToolCountByGroup,
} from "../../../../src/adapters/sqlite/tools/index.js";
import type { SqliteAdapter } from "../../../../src/adapters/sqlite/SqliteAdapter.js";

describe("Tools Index", () => {
  let adapter: TestAdapter;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("getAllToolDefinitions", () => {
    it("should return all tool definitions", () => {
      const tools = getAllToolDefinitions(adapter as unknown as SqliteAdapter);

      expect(tools.length).toBeGreaterThan(100);
      expect(tools.every((t) => t.name && t.handler)).toBe(true);
    });
  });

  describe("getToolsByGroup", () => {
    it("should filter tools by core group", () => {
      const coreTools = getToolsByGroup(
        adapter as unknown as SqliteAdapter,
        "core",
      );

      expect(coreTools.length).toBeGreaterThan(0);
      expect(coreTools.every((t) => t.group === "core")).toBe(true);
    });

    it("should filter tools by json group", () => {
      const jsonTools = getToolsByGroup(
        adapter as unknown as SqliteAdapter,
        "json",
      );

      expect(jsonTools.length).toBeGreaterThan(0);
      expect(jsonTools.every((t) => t.group === "json")).toBe(true);
    });

    it("should filter tools by admin group", () => {
      const adminTools = getToolsByGroup(
        adapter as unknown as SqliteAdapter,
        "admin",
      );

      expect(adminTools.length).toBeGreaterThan(0);
      expect(adminTools.every((t) => t.group === "admin")).toBe(true);
    });
  });

  describe("getToolCountByGroup", () => {
    it("should return counts for all groups", () => {
      const counts = getToolCountByGroup(adapter as unknown as SqliteAdapter);

      expect(counts.core).toBeGreaterThan(0);
      expect(counts.json).toBeGreaterThan(0);
      expect(counts.text).toBeGreaterThan(0);
      expect(counts.stats).toBeGreaterThan(0);
      expect(counts.admin).toBeGreaterThan(0);
    });

    it("should match total from getAllToolDefinitions", () => {
      const counts = getToolCountByGroup(adapter as unknown as SqliteAdapter);
      const tools = getAllToolDefinitions(adapter as unknown as SqliteAdapter);

      const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
      expect(total).toBe(tools.length);
    });
  });
});
