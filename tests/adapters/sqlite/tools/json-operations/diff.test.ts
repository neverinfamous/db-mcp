import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createJsonDiffTool } from "../../../../../src/adapters/sqlite/tools/json-operations/diff.js";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";
import type { RequestContext } from "../../../../../src/types/index.js";
import type { SqliteAdapter } from "../../../../../src/adapters/sqlite/sqlite-adapter.js";

describe("createJsonDiffTool", () => {
  let adapter: TestAdapter;
  let context: RequestContext;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({ type: "sqlite", connectionString: ":memory:" });

    // Create test table and data
    await adapter.executeWriteQuery(`
      CREATE TABLE test_json (id INTEGER PRIMARY KEY, data TEXT);
    `);

    await adapter.executeWriteQuery(`
      INSERT INTO test_json (id, data) VALUES 
      (1, '{"a": 1, "b": 2}'),
      (2, '{"a": 1, "b": 1}'),
      (3, '{"a": 3, "b": 4}');
    `);

    context = {} as RequestContext;
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  it("should diff two json paths", async () => {
    // Cast TestAdapter to SqliteAdapter for the tool
    const tool = createJsonDiffTool(adapter as unknown as SqliteAdapter);
    const result = (await tool.handler(
      {
        table: "test_json",
        column: "data",
        path1: "$.a",
        path2: "$.b",
        limit: 10,
      },
      context,
    )) as any;

    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(3);

    // row 1: a=1, b=2
    expect(result.diffs[0].identical).toBe(false);
    expect(result.diffs[0].path1Value).toBe(1);
    expect(result.diffs[0].path2Value).toBe(2);

    // row 2: a=1, b=1
    expect(result.diffs[1].identical).toBe(true);
  });

  it("should filter to only differences if requested", async () => {
    const tool = createJsonDiffTool(adapter as unknown as SqliteAdapter);
    const result = (await tool.handler(
      {
        table: "test_json",
        column: "data",
        path1: "$.a",
        path2: "$.b",
        onlyDifferences: true,
        limit: 10,
      },
      context,
    )) as any;

    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
    // Rows 1 and 3 are different
    expect(result.diffs[0].identical).toBe(false);
    expect(result.diffs[1].identical).toBe(false);
  });

  it("should enforce limit constraints", async () => {
    const tool = createJsonDiffTool(adapter as unknown as SqliteAdapter);

    // Test limit < 1
    const result = (await tool.handler(
      {
        table: "test_json",
        column: "data",
        path1: "$.a",
        path2: "$.b",
        limit: 0,
      },
      context,
    )) as any;

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Test MAX_LIMIT cap
    const resultMax = (await tool.handler(
      {
        table: "test_json",
        column: "data",
        path1: "$.a",
        path2: "$.b",
        limit: 1000,
      },
      context,
    )) as any;
    expect(resultMax.success).toBe(true);
  });

  it("should apply where clauses", async () => {
    const tool = createJsonDiffTool(adapter as unknown as SqliteAdapter);
    const result = (await tool.handler(
      {
        table: "test_json",
        column: "data",
        path1: "$.a",
        path2: "$.b",
        conditions: [{ column: "id", operator: "=", value: 1 }],
        limit: 10,
      },
      context,
    )) as any;

    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(1);
    expect(result.diffs[0].path1Value).toBe(1);
  });

  it("should apply both where clauses and onlyDifferences", async () => {
    const tool = createJsonDiffTool(adapter as unknown as SqliteAdapter);
    const result = (await tool.handler(
      {
        table: "test_json",
        column: "data",
        path1: "$.a",
        path2: "$.b",
        conditions: [{ column: "id", operator: ">", value: 0 }],
        onlyDifferences: true,
        limit: 10,
      },
      context,
    )) as any;

    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
  });
});
