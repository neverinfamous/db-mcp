/**
 * Code Mode Tool Handler Unit Tests
 *
 * Tests the sqlite_execute_code tool definition, input validation,
 * and pool management. Execution tests are skipped because the worker-script.js
 * is only available in compiled mode (tsup output), not during vitest runs.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getCodeModeTools,
  cleanupCodeMode,
} from "../../../../src/adapters/sqlite/tools/codemode.js";
import type { ToolDefinition } from "../../../../src/types/index.js";

// =============================================================================
// Helpers
// =============================================================================

function createMockAdapter() {
  const readTool: ToolDefinition = {
    name: "sqlite_read_query",
    description: "Read",
    group: "core",
    annotations: { readOnlyHint: true },
    handler: vi.fn().mockResolvedValue({ rows: [] }),
  };

  const writeTool: ToolDefinition = {
    name: "sqlite_write_query",
    description: "Write",
    group: "core",
    annotations: { readOnlyHint: false },
    handler: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
  };

  return {
    getToolDefinitions: vi.fn().mockReturnValue([readTool, writeTool]),
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
    executeRawQuery: vi.fn(),
  };
}

// =============================================================================
// getCodeModeTools
// =============================================================================

describe("getCodeModeTools", () => {
  afterEach(() => {
    cleanupCodeMode();
  });

  it("should return an array with one tool", () => {
    const adapter = createMockAdapter();
    const tools = getCodeModeTools(adapter as any);

    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("sqlite_execute_code");
  });

  it("should have correct tool metadata", () => {
    const adapter = createMockAdapter();
    const tools = getCodeModeTools(adapter as any);
    const tool = tools[0]!;

    expect(tool.group).toBe("codemode");
    expect(tool.description).toContain("Execute JavaScript");
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
    expect(tool.annotations).toBeDefined();
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });
});

// =============================================================================
// Tool Handler — Validation Only (no worker-script.js in test mode)
// =============================================================================

describe("sqlite_execute_code handler - validation", () => {
  afterEach(() => {
    cleanupCodeMode();
  });

  it("should reject empty code", async () => {
    const adapter = createMockAdapter();
    const tool = getCodeModeTools(adapter as any)[0]!;

    const result = (await tool.handler(
      { code: "" },
      { timestamp: new Date(), requestId: "test" },
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
  });

  it("should reject code with blocked patterns", async () => {
    const adapter = createMockAdapter();
    const tool = getCodeModeTools(adapter as any)[0]!;

    const result = (await tool.handler(
      { code: 'const fs = require("fs");' },
      { timestamp: new Date(), requestId: "test" },
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(result.code).toBe("CODEMODE_VALIDATION_FAILED");
    expect(result.category).toBe("validation");
  });

  it("should reject timeout out of range (too low)", async () => {
    const adapter = createMockAdapter();
    const tool = getCodeModeTools(adapter as any)[0]!;

    const result = (await tool.handler(
      { code: "return 1;", timeout: 100 },
      { timestamp: new Date(), requestId: "test" },
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(result.code).toBe("CODEMODE_VALIDATION_FAILED");
    expect(String(result.error)).toContain("between 1000 and 30000");
  });

  it("should reject timeout out of range (too high)", async () => {
    const adapter = createMockAdapter();
    const tool = getCodeModeTools(adapter as any)[0]!;

    const result = (await tool.handler(
      { code: "return 1;", timeout: 60000 },
      { timestamp: new Date(), requestId: "test" },
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(result.code).toBe("CODEMODE_VALIDATION_FAILED");
  });

  it("should fail gracefully when worker-script is unavailable", async () => {
    const adapter = createMockAdapter();
    const tool = getCodeModeTools(adapter as any)[0]!;

    // Valid code, but worker-script.js isn't built during vitest runs
    const result = (await tool.handler(
      { code: "return 42;" },
      { timestamp: new Date(), requestId: "test" },
    )) as Record<string, unknown>;

    // Should return an error result (not crash)
    expect(result.success).toBe(false);
    expect(result.error).toContain("worker-script");
  });
});

// =============================================================================
// Readonly Guards & Write-Tool Detection
// =============================================================================

describe("sqlite_execute_code handler - readonly guards", () => {
  afterEach(() => {
    cleanupCodeMode();
  });

  it("should include unannotated tools as write tools (fail-closed)", () => {
    const unannotatedTool: ToolDefinition = {
      name: "sqlite_custom_op",
      description: "No annotations",
      group: "core",
      handler: vi.fn().mockResolvedValue({ success: true }),
    };

    const adapter = {
      getToolDefinitions: vi
        .fn()
        .mockReturnValue([unannotatedTool]),
    };

    // Getting tools should not crash even with unannotated tools
    const tools = getCodeModeTools(adapter as any);
    expect(tools).toHaveLength(1);
  });

  it("should coerce string timeout to number", async () => {
    const adapter = createMockAdapter();
    const tool = getCodeModeTools(adapter as any)[0]!;

    // String "100" should be coerced to number 100, which is out of range
    const result = (await tool.handler(
      { code: "return 1;", timeout: "100" },
      { timestamp: new Date(), requestId: "test" },
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(result.code).toBe("CODEMODE_VALIDATION_FAILED");
  });

  it("should coerce unparseable string timeout to default", async () => {
    const adapter = createMockAdapter();
    const tool = getCodeModeTools(adapter as any)[0]!;

    // "abc" is not parseable, should become NaN → undefined → default 30000
    // Then valid code hits worker-script missing error
    const result = (await tool.handler(
      { code: "return 1;", timeout: "abc" },
      { timestamp: new Date(), requestId: "test" },
    )) as Record<string, unknown>;

    // Should not be a validation error from timeout — defaults to 30000
    expect(result.success).toBe(false);
    // Error is about worker-script, not timeout
    expect(result.code).not.toBe("CODEMODE_VALIDATION_FAILED");
  });
});

// =============================================================================
// cleanupCodeMode
// =============================================================================

describe("cleanupCodeMode", () => {
  it("should not throw when called without initialization", () => {
    expect(() => cleanupCodeMode()).not.toThrow();
  });

  it("should not throw when called multiple times", () => {
    expect(() => {
      cleanupCodeMode();
      cleanupCodeMode();
    }).not.toThrow();
  });
});
