/**
 * Tool Annotation Invariant Tests
 *
 * Structural invariant: EVERY tool must have `annotations` with an explicit
 * `readOnlyHint` value. This prevents the fail-closed `isWriteTool()` guard
 * in Code Mode from incorrectly blocking read-only tools that simply forgot
 * to declare annotations.
 *
 * Covers both WASM (SqliteAdapter) and Native (NativeSqliteAdapter) tool sets.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NativeSqliteAdapter } from "../../src/adapters/sqlite-native/native-sqlite-adapter.js";
import { SqliteAdapter } from "../../src/adapters/sqlite/sqlite-adapter.js";
import type { ToolDefinition } from "../../src/types/index.js";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Validate a single tool's annotations.
 * Returns a descriptive error string if invalid, or null if valid.
 */
function validateToolAnnotations(tool: ToolDefinition): string | null {
  if (!tool.annotations) {
    return `Tool '${tool.name}' (group: ${tool.group}) has NO annotations — will be blocked in readonly mode`;
  }
  if (tool.annotations.readOnlyHint === undefined) {
    return `Tool '${tool.name}' (group: ${tool.group}) has annotations but readOnlyHint is undefined`;
  }
  return null;
}

// =============================================================================
// Native Adapter (better-sqlite3) — All 139+ tools
// =============================================================================

describe("Tool Annotation Invariants (Native)", () => {
  let adapter: NativeSqliteAdapter;
  let tools: ToolDefinition[];

  beforeEach(async () => {
    adapter = new NativeSqliteAdapter();
    await adapter.connect({ type: "sqlite", filePath: ":memory:" });
    tools = adapter.getToolDefinitions();
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  it("should have tool definitions", () => {
    expect(tools.length).toBeGreaterThan(100);
  });

  it("every tool must have annotations defined", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      if (!tool.annotations) {
        violations.push(`${tool.name} (group: ${tool.group})`);
      }
    }
    expect(
      violations,
      `${violations.length} tool(s) missing annotations:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  it("every tool must have explicit readOnlyHint (not undefined)", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      const error = validateToolAnnotations(tool);
      if (error) {
        violations.push(error);
      }
    }
    expect(
      violations,
      `${violations.length} tool(s) with invalid annotations:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  it("read-only tools should have readOnlyHint: true", () => {
    // Tools that execute only SELECT queries should be readOnly
    const readOnlyGroups = new Set(["stats", "introspection"]);
    const violations: string[] = [];

    for (const tool of tools) {
      if (
        readOnlyGroups.has(tool.group) &&
        tool.annotations?.readOnlyHint !== true
      ) {
        violations.push(
          `${tool.name} (group: ${tool.group}) has readOnlyHint=${tool.annotations?.readOnlyHint} — expected true`,
        );
      }
    }
    expect(
      violations,
      `${violations.length} stats/introspection tool(s) not marked readOnly:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  it("every tool should have a title in annotations", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      if (!tool.annotations?.title) {
        violations.push(`${tool.name} (group: ${tool.group})`);
      }
    }
    // Code Mode tool uses inline annotations with title, so all should pass
    expect(
      violations,
      `${violations.length} tool(s) missing title:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  // ==========================================================================
  // Per-Group Annotation Checks
  // ==========================================================================

  describe("per-group annotation consistency", () => {
    /**
     * Groups where ALL tools should be readOnly (pure SELECT / analysis)
     */
    const allReadOnlyGroups = ["stats", "introspection"];

    for (const group of allReadOnlyGroups) {
      it(`all ${group} tools should have readOnlyHint: true`, () => {
        const groupTools = tools.filter((t) => t.group === group);
        expect(
          groupTools.length,
          `no tools found for group '${group}'`,
        ).toBeGreaterThan(0);

        for (const tool of groupTools) {
          expect(
            tool.annotations?.readOnlyHint,
            `${tool.name} should be readOnly`,
          ).toBe(true);
        }
      });
    }

    /**
     * Groups that contain a mix of read and write tools
     */
    const mixedGroups = [
      "core",
      "json",
      "text",
      "vector",
      "admin",
      "geo",
      "migration",
    ];

    for (const group of mixedGroups) {
      it(`all ${group} tools should have annotations with explicit readOnlyHint`, () => {
        const groupTools = tools.filter((t) => t.group === group);
        if (groupTools.length === 0) return; // Extension groups may be empty

        for (const tool of groupTools) {
          expect(
            tool.annotations,
            `${tool.name} missing annotations`,
          ).toBeDefined();
          expect(
            tool.annotations?.readOnlyHint,
            `${tool.name} readOnlyHint is undefined`,
          ).not.toBeUndefined();
        }
      });
    }
  });

  // ==========================================================================
  // Window Function Tools (the specific tools that were missing annotations)
  // ==========================================================================

  describe("window function tools annotations", () => {
    const windowToolNames = [
      "sqlite_window_row_number",
      "sqlite_window_rank",
      "sqlite_window_lag_lead",
      "sqlite_window_running_total",
      "sqlite_window_moving_avg",
      "sqlite_window_ntile",
    ];

    for (const toolName of windowToolNames) {
      it(`${toolName} should have readOnly annotation`, () => {
        const tool = tools.find((t) => t.name === toolName);
        expect(tool, `tool '${toolName}' not found`).toBeDefined();
        expect(
          tool?.annotations,
          `${toolName} missing annotations`,
        ).toBeDefined();
        expect(
          tool?.annotations?.readOnlyHint,
          `${toolName} should be readOnly`,
        ).toBe(true);
        expect(
          tool?.annotations?.title,
          `${toolName} should have a title`,
        ).toBeDefined();
      });
    }
  });
});

// =============================================================================
// WASM Adapter (sql.js) — Subset of tools
// =============================================================================

describe("Tool Annotation Invariants (WASM)", () => {
  let adapter: SqliteAdapter;
  let tools: ToolDefinition[];

  beforeEach(async () => {
    adapter = new SqliteAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });
    tools = adapter.getToolDefinitions();
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  it("should have tool definitions", () => {
    expect(tools.length).toBeGreaterThan(50);
  });

  it("every WASM tool must have annotations defined", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      if (!tool.annotations) {
        violations.push(`${tool.name} (group: ${tool.group})`);
      }
    }
    expect(
      violations,
      `${violations.length} WASM tool(s) missing annotations:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  it("every WASM tool must have explicit readOnlyHint", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      const error = validateToolAnnotations(tool);
      if (error) {
        violations.push(error);
      }
    }
    expect(
      violations,
      `${violations.length} WASM tool(s) with invalid annotations:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });
});
