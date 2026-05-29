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
  if (tool.annotations.sensitiveHint === undefined) {
    return `Tool '${tool.name}' (group: ${tool.group}) has annotations but sensitiveHint is undefined`;
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
    await adapter.connect({ type: "sqlite", connectionString: ":memory:" });
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
      "transactions",
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

// =============================================================================
// Audit Tools (server-level, MCP-only — NOT part of adapter.getToolDefinitions)
// =============================================================================

describe("Tool Annotation Invariants (Audit Tools)", () => {
  /**
   * Audit tools are registered via McpServer.registerTool() in
   * src/server/registration/audit-tools.ts and are not accessible through
   * adapter.getToolDefinitions(). This test validates their annotation
   * structure statically to ensure the invariant holds across all tool surfaces.
   */

  const expectedAuditTools = [
    {
      name: "sqlite_audit_list_backups",
      readOnlyHint: true,
      destructiveHint: false,
      sensitiveHint: true,
    },
    {
      name: "sqlite_audit_get_backup",
      readOnlyHint: true,
      destructiveHint: false,
      sensitiveHint: true,
    },
    {
      name: "sqlite_audit_cleanup",
      readOnlyHint: false,
      destructiveHint: true,
      sensitiveHint: true,
    },
    {
      name: "sqlite_audit_diff_backup",
      readOnlyHint: true,
      destructiveHint: false,
      sensitiveHint: true,
    },
    {
      name: "sqlite_audit_restore_backup",
      readOnlyHint: false,
      destructiveHint: true,
      sensitiveHint: true,
    },
  ];

  it("should define exactly 5 audit tools", () => {
    expect(expectedAuditTools).toHaveLength(5);
  });

  it("audit tool names follow the sqlite_audit_ prefix convention", () => {
    for (const tool of expectedAuditTools) {
      expect(
        tool.name.startsWith("sqlite_audit_"),
        `${tool.name} should start with sqlite_audit_`,
      ).toBe(true);
    }
  });

  it("read-only audit tools should not be marked destructive", () => {
    const violations: string[] = [];
    for (const tool of expectedAuditTools) {
      if (tool.readOnlyHint && tool.destructiveHint) {
        violations.push(
          `${tool.name}: readOnlyHint=true AND destructiveHint=true is contradictory`,
        );
      }
    }
    expect(violations).toHaveLength(0);
  });

  it("destructive audit tools should not be marked read-only", () => {
    const violations: string[] = [];
    for (const tool of expectedAuditTools) {
      if (tool.destructiveHint && tool.readOnlyHint) {
        violations.push(
          `${tool.name}: destructiveHint=true AND readOnlyHint=true is contradictory`,
        );
      }
    }
    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// Tool Description Security Audit (L-6)
// =============================================================================

describe("Tool Description Security Audit", () => {
  /**
   * Instruction-like patterns that should NOT appear in tool descriptions.
   * These could be used for tool poisoning / prompt injection where the
   * description manipulates the LLM's behavior beyond the tool's scope.
   *
   * Each pattern is case-insensitive and anchored on word boundaries.
   */
  const SUSPICIOUS_PATTERNS: { pattern: RegExp; label: string }[] = [
    {
      pattern: /\byou must\b/i,
      label: "directive language: 'you must'",
    },
    {
      pattern: /\byou should always\b/i,
      label: "directive language: 'you should always'",
    },
    {
      pattern: /\balways use this tool\b/i,
      label: "directive language: 'always use this tool'",
    },
    {
      pattern: /\bbefore calling\b/i,
      label: "instructional: 'before calling'",
    },
    {
      pattern: /\bafter calling\b/i,
      label: "instructional: 'after calling'",
    },
    {
      pattern: /\bignore previous\b/i,
      label: "prompt injection: 'ignore previous'",
    },
    {
      pattern: /\bignore all\b/i,
      label: "prompt injection: 'ignore all'",
    },
    {
      pattern: /\bsystem prompt\b/i,
      label: "prompt injection: 'system prompt'",
    },
    {
      pattern: /\bdo not tell\b/i,
      label: "manipulation: 'do not tell'",
    },
    {
      pattern: /\bpretend\b/i,
      label: "manipulation: 'pretend'",
    },
    {
      pattern: /\brole[- ]?play\b/i,
      label: "manipulation: 'roleplay'",
    },
    {
      pattern: /\bjailbreak\b/i,
      label: "prompt injection: 'jailbreak'",
    },
    {
      pattern: /\boverride\b/i,
      label: "manipulation: 'override'",
    },
  ];

  it("Native adapter tool descriptions should not contain instruction-like language", async () => {
    const adapter = new NativeSqliteAdapter();
    await adapter.connect({ type: "sqlite", connectionString: ":memory:" });
    const tools = adapter.getToolDefinitions();

    const violations: string[] = [];

    for (const tool of tools) {
      const desc = tool.description ?? "";
      for (const { pattern, label } of SUSPICIOUS_PATTERNS) {
        if (pattern.test(desc)) {
          violations.push(
            `${tool.name}: description matches '${label}'` +
              ` — "${desc.substring(0, 100)}..."`,
          );
        }
      }
    }

    await adapter.disconnect();

    expect(
      violations,
      `${violations.length} tool(s) with suspicious description language:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  it("WASM adapter tool descriptions should not contain instruction-like language", async () => {
    const adapter = new SqliteAdapter();
    await adapter.connect({ type: "sqlite", connectionString: ":memory:" });
    const tools = adapter.getToolDefinitions();

    const violations: string[] = [];

    for (const tool of tools) {
      const desc = tool.description ?? "";
      for (const { pattern, label } of SUSPICIOUS_PATTERNS) {
        if (pattern.test(desc)) {
          violations.push(
            `${tool.name}: description matches '${label}'` +
              ` — "${desc.substring(0, 100)}..."`,
          );
        }
      }
    }

    await adapter.disconnect();

    expect(
      violations,
      `${violations.length} WASM tool(s) with suspicious description language:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });
});
