/**
 * Hypothesis Testing Tool Unit Tests
 *
 * Tests ttest_one, ttest_two, and chi_square test types via mock adapter.
 * Mocks must match the exact SQL patterns used by:
 *   - validateTableExists (queries sqlite_master)
 *   - validateColumnExists (queries pragma_table_info)
 *   - validateNumericColumn (calls adapter.describeTable)
 *   - the stats queries themselves (AVG, COUNT, GROUP BY)
 */

import { describe, it, expect, vi } from "vitest";
import { createHypothesisTool } from "../../../../../src/adapters/sqlite/tools/stats/inference/hypothesis.js";

// =============================================================================
// Helpers
// =============================================================================

function createMockAdapter(columns: Array<{ name: string; type: string }>) {
  const adapter = {
    executeReadQuery: vi.fn(),
    describeTable: vi.fn().mockResolvedValue({
      name: "test",
      columns,
    }),
  } as any;

  // Default executeReadQuery handler: dispatches based on SQL content
  adapter.executeReadQuery.mockImplementation((sql: string) => {
    // Table existence check (validateTableExists)
    if (sql.includes("sqlite_master")) {
      return Promise.resolve({ rows: [{ "1": 1 }] });
    }
    // Column existence check (validateColumnExists → pragma_table_info)
    if (sql.includes("pragma_table_info")) {
      // Extract the column name from the WHERE clause
      const match = /name\s*=\s*'([^']+)'/i.exec(sql);
      const requestedCol = match?.[1];
      const found = columns.find((c) => c.name === requestedCol);
      return Promise.resolve({ rows: found ? [{ name: found.name }] : [] });
    }
    return Promise.resolve({ rows: [] });
  });

  return adapter;
}

const ctx = { timestamp: new Date(), requestId: "test" };

// =============================================================================
// Tool Metadata
// =============================================================================

describe("createHypothesisTool", () => {
  it("should return correct tool metadata", () => {
    const adapter = createMockAdapter([]);
    const tool = createHypothesisTool(adapter);

    expect(tool.name).toBe("sqlite_stats_hypothesis");
    expect(tool.group).toBe("stats");
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });
});

// =============================================================================
// Validation
// =============================================================================

describe("hypothesis handler - validation", () => {
  it("should reject invalid testType", async () => {
    const adapter = createMockAdapter([{ name: "value", type: "REAL" }]);
    const tool = createHypothesisTool(adapter);

    const result = (await tool.handler(
      { table: "test", column: "value", testType: "invalid_test" },
      ctx,
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Invalid testType");
  });
});

// =============================================================================
// One-sample t-test
// =============================================================================

describe("hypothesis handler - ttest_one", () => {
  it("should perform one-sample t-test", async () => {
    const adapter = createMockAdapter([{ name: "value", type: "REAL" }]);

    // Override to also handle the stats query
    const originalImpl = adapter.executeReadQuery.getMockImplementation()!;
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("AVG") && sql.includes("COUNT")) {
        return Promise.resolve({
          rows: [{ n: 30, mean: 5.2, variance: 2.5 }],
        });
      }
      return originalImpl(sql);
    });

    const tool = createHypothesisTool(adapter);
    const result = (await tool.handler(
      {
        table: "test",
        column: "value",
        testType: "ttest_one",
        expectedMean: 5.0,
      },
      ctx,
    )) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.testType).toBe("ttest_one");
    expect(result.statistic).toBeDefined();
    expect(result.pValue).toBeDefined();
    expect(result.degreesOfFreedom).toBe(29);
    expect(typeof result.significant).toBe("boolean");
    expect(result.details).toBeDefined();
  });

  it("should reject insufficient sample size", async () => {
    const adapter = createMockAdapter([{ name: "value", type: "REAL" }]);
    const originalImpl = adapter.executeReadQuery.getMockImplementation()!;
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("AVG")) {
        return Promise.resolve({ rows: [{ n: 1, mean: 5, variance: 0 }] });
      }
      return originalImpl(sql);
    });

    const tool = createHypothesisTool(adapter);
    const result = (await tool.handler(
      { table: "test", column: "value", testType: "ttest_one" },
      ctx,
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Insufficient");
  });
});

// =============================================================================
// Two-sample t-test
// =============================================================================

describe("hypothesis handler - ttest_two", () => {
  it("should perform two-sample t-test", async () => {
    const adapter = createMockAdapter([
      { name: "value", type: "REAL" },
      { name: "value2", type: "REAL" },
    ]);
    const originalImpl = adapter.executeReadQuery.getMockImplementation()!;
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("n1")) {
        return Promise.resolve({
          rows: [
            { n1: 30, mean1: 5.2, var1: 2.5, n2: 30, mean2: 4.8, var2: 3.1 },
          ],
        });
      }
      return originalImpl(sql);
    });

    const tool = createHypothesisTool(adapter);
    const result = (await tool.handler(
      {
        table: "test",
        column: "value",
        column2: "value2",
        testType: "ttest_two",
      },
      ctx,
    )) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.testType).toBe("ttest_two");
    expect(result.statistic).toBeDefined();
    expect(result.pValue).toBeDefined();
    expect(result.details).toBeDefined();
  });

  it("should reject missing column2", async () => {
    const adapter = createMockAdapter([{ name: "value", type: "REAL" }]);
    const tool = createHypothesisTool(adapter);

    const result = (await tool.handler(
      { table: "test", column: "value", testType: "ttest_two" },
      ctx,
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("column2");
  });

  it("should reject insufficient sample for ttest_two", async () => {
    const adapter = createMockAdapter([
      { name: "value", type: "REAL" },
      { name: "value2", type: "REAL" },
    ]);
    const originalImpl = adapter.executeReadQuery.getMockImplementation()!;
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("n1")) {
        return Promise.resolve({
          rows: [{ n1: 1, mean1: 5, var1: 0, n2: 1, mean2: 4, var2: 0 }],
        });
      }
      return originalImpl(sql);
    });

    const tool = createHypothesisTool(adapter);
    const result = (await tool.handler(
      {
        table: "test",
        column: "value",
        column2: "value2",
        testType: "ttest_two",
      },
      ctx,
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Insufficient");
  });
});

// =============================================================================
// Chi-square test
// =============================================================================

describe("hypothesis handler - chi_square", () => {
  it("should perform chi-square test", async () => {
    const adapter = createMockAdapter([
      { name: "category", type: "TEXT" },
      { name: "group", type: "TEXT" },
    ]);
    const originalImpl = adapter.executeReadQuery.getMockImplementation()!;
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY")) {
        return Promise.resolve({
          rows: [
            { col1: "A", col2: "X", observed: 10 },
            { col1: "A", col2: "Y", observed: 20 },
            { col1: "B", col2: "X", observed: 15 },
            { col1: "B", col2: "Y", observed: 5 },
          ],
        });
      }
      return originalImpl(sql);
    });

    const tool = createHypothesisTool(adapter);
    const result = (await tool.handler(
      {
        table: "test",
        column: "category",
        groupColumn: "group",
        testType: "chi_square",
      },
      ctx,
    )) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.testType).toBe("chi_square");
    expect(result.statistic).toBeDefined();
    expect(result.degreesOfFreedom).toBe(1); // (2-1) * (2-1)
    expect(result.details).toBeDefined();
  });

  it("should reject missing groupColumn", async () => {
    const adapter = createMockAdapter([{ name: "category", type: "TEXT" }]);
    const tool = createHypothesisTool(adapter);

    const result = (await tool.handler(
      { table: "test", column: "category", testType: "chi_square" },
      ctx,
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("groupColumn");
  });

  it("should reject insufficient categories", async () => {
    const adapter = createMockAdapter([
      { name: "category", type: "TEXT" },
      { name: "group", type: "TEXT" },
    ]);
    const originalImpl = adapter.executeReadQuery.getMockImplementation()!;
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY")) {
        return Promise.resolve({
          rows: [{ col1: "A", col2: "X", observed: 10 }],
        });
      }
      return originalImpl(sql);
    });

    const tool = createHypothesisTool(adapter);
    const result = (await tool.handler(
      {
        table: "test",
        column: "category",
        groupColumn: "group",
        testType: "chi_square",
      },
      ctx,
    )) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Insufficient categories");
  });
});
