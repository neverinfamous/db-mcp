/**
 * JSON Query & Aggregation Tool Tests (Mock-based)
 *
 * Tests: json_keys, json_each, json_group_array, json_group_object
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createJsonKeysTool,
  createJsonEachTool,
  createJsonGroupArrayTool,
  createJsonGroupObjectTool,
} from "../../../../../src/adapters/sqlite/tools/json-operations/query.js";

const ctx = { timestamp: new Date(), requestId: "test" };

function createMockAdapter() {
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
  } as any;
}

// =============================================================================
// sqlite_json_keys
// =============================================================================

describe("createJsonKeysTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return metadata", () => {
    const tool = createJsonKeysTool(createMockAdapter());
    expect(tool.name).toBe("sqlite_json_keys");
    expect(tool.group).toBe("json");
  });

  it("should return keys from JSON column", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ key: "name" }, { key: "age" }, { key: "email" }],
    });
    const tool = createJsonKeysTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(3);
    expect(result.keys).toEqual(["name", "age", "email"]);
  });

  it("should use custom path", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [{ key: "x" }] });
    const tool = createJsonKeysTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", path: "$.address" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject invalid path", async () => {
    const tool = createJsonKeysTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "users", column: "data", path: "address" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("$");
  });

  it("should support whereClause", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [{ key: "k" }] });
    const tool = createJsonKeysTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", whereClause: "id = 1" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("id = 1"),
    );
  });

  it("should handle empty result", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createJsonKeysTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(0);
  });

  it("should handle query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(new Error("no such table"));
    const tool = createJsonKeysTool(adapter);
    const result = (await tool.handler(
      { table: "missing", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_json_each
// =============================================================================

describe("createJsonEachTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should expand JSON array to rows", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { row_id: 1, key: 0, value: '"a"', type: "text" },
        { row_id: 1, key: 1, value: '"b"', type: "text" },
      ],
    });
    const tool = createJsonEachTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "tags", limit: 100 },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
  });

  it("should reject invalid path", async () => {
    const tool = createJsonEachTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "users", column: "data", path: "invalid", limit: 10 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("$");
  });

  it("should support whereClause with id qualification", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createJsonEachTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", whereClause: "id = 1", limit: 10 },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    // Should qualify 'id' to 't.id' to avoid ambiguity with json_each.id
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("t.id"),
    );
  });

  it("should handle query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(new Error("fail"));
    const tool = createJsonEachTool(adapter);
    const result = (await tool.handler(
      { table: "t", column: "c", limit: 10 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_json_group_array
// =============================================================================

describe("createJsonGroupArrayTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should aggregate values into JSON array", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ array_result: '["a","b","c"]' }],
    });
    const tool = createJsonGroupArrayTool(adapter);
    const result = (await tool.handler(
      { table: "users", valueColumn: "name" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(1);
  });

  it("should support groupByColumn", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { category: "A", array_result: '["x"]' },
        { category: "B", array_result: '["y"]' },
      ],
    });
    const tool = createJsonGroupArrayTool(adapter);
    const result = (await tool.handler(
      { table: "items", valueColumn: "name", groupByColumn: "category" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
  });

  it("should support allowExpressions with groupBy", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ group_key: "A", array_result: '["x"]' }],
    });
    const tool = createJsonGroupArrayTool(adapter);
    const result = (await tool.handler(
      {
        table: "items",
        valueColumn: "json_extract(data, '$.v')",
        groupByColumn: "json_extract(data, '$.k')",
        allowExpressions: true,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should support whereClause", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createJsonGroupArrayTool(adapter);
    const result = (await tool.handler(
      { table: "users", valueColumn: "name", whereClause: "active = 1" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("active = 1"),
    );
  });

  it("should handle query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(new Error("fail"));
    const tool = createJsonGroupArrayTool(adapter);
    const result = (await tool.handler(
      { table: "t", valueColumn: "c" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_json_group_object
// =============================================================================

describe("createJsonGroupObjectTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should aggregate pairs into JSON object", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ object_result: '{"a":1,"b":2}' }],
    });
    const tool = createJsonGroupObjectTool(adapter);
    const result = (await tool.handler(
      { table: "kv", keyColumn: "key", valueColumn: "value" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(1);
  });

  it("should support aggregateFunction", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ object_result: '{"A":10,"B":20}' }],
    });
    const tool = createJsonGroupObjectTool(adapter);
    const result = (await tool.handler(
      {
        table: "orders",
        keyColumn: "category",
        aggregateFunction: "COUNT(*)",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject aggregateFunction with groupByColumn", async () => {
    const tool = createJsonGroupObjectTool(createMockAdapter());
    const result = (await tool.handler(
      {
        table: "orders",
        keyColumn: "category",
        aggregateFunction: "COUNT(*)",
        groupByColumn: "region",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("groupByColumn");
  });

  it("should reject missing valueColumn when no aggregateFunction", async () => {
    const tool = createJsonGroupObjectTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "kv", keyColumn: "key" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("valueColumn");
  });

  it("should support allowExpressions with groupByColumn", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ group_key: "X", object_result: '{"a":1}' }],
    });
    const tool = createJsonGroupObjectTool(adapter);
    const result = (await tool.handler(
      {
        table: "items",
        keyColumn: "json_extract(data, '$.key')",
        valueColumn: "json_extract(data, '$.val')",
        groupByColumn: "json_extract(data, '$.group')",
        allowExpressions: true,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should add duplicate key hint with allowExpressions and no groupBy", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ object_result: '{"a":1}' }],
    });
    const tool = createJsonGroupObjectTool(adapter);
    const result = (await tool.handler(
      {
        table: "items",
        keyColumn: "json_extract(data, '$.key')",
        valueColumn: "json_extract(data, '$.val')",
        allowExpressions: true,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.hint).toContain("duplicate");
  });

  it("should support whereClause with aggregateFunction", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ object_result: '{"A":5}' }],
    });
    const tool = createJsonGroupObjectTool(adapter);
    const result = (await tool.handler(
      {
        table: "orders",
        keyColumn: "category",
        aggregateFunction: "SUM(amount)",
        whereClause: "status = 'active'",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'active'"),
    );
  });

  it("should support whereClause and groupByColumn", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createJsonGroupObjectTool(adapter);
    const result = (await tool.handler(
      {
        table: "kv",
        keyColumn: "key",
        valueColumn: "value",
        groupByColumn: "region",
        whereClause: "active = 1",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should handle query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(new Error("fail"));
    const tool = createJsonGroupObjectTool(adapter);
    const result = (await tool.handler(
      { table: "t", keyColumn: "k", valueColumn: "v" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});
