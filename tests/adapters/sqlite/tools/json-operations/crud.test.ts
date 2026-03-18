/**
 * JSON CRUD Tool Tests (Mock-based)
 *
 * Tests: json_valid, json_extract, json_set, json_remove,
 *        json_type, json_array_length, json_array_append
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createValidateJsonTool,
  createJsonExtractTool,
  createJsonSetTool,
  createJsonRemoveTool,
  createJsonTypeTool,
  createJsonArrayLengthTool,
  createJsonArrayAppendTool,
} from "../../../../../src/adapters/sqlite/tools/json-operations/crud.js";

const ctx = { timestamp: new Date(), requestId: "test" };

function createMockAdapter() {
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
  } as any;
}

// =============================================================================
// sqlite_json_valid
// =============================================================================

describe("createValidateJsonTool", () => {
  it("should return metadata", () => {
    const tool = createValidateJsonTool();
    expect(tool.name).toBe("sqlite_json_valid");
  });

  it("should validate correct JSON", async () => {
    const tool = createValidateJsonTool();
    const result = (await tool.handler({ json: '{"a":1}' }, ctx)) as any;
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("should detect invalid JSON", async () => {
    const tool = createValidateJsonTool();
    const result = (await tool.handler({ json: "not json" }, ctx)) as any;
    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
  });
});

// =============================================================================
// sqlite_json_extract
// =============================================================================

describe("createJsonExtractTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should extract values from JSON column", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ value: "Alice" }, { value: "Bob" }],
    });
    const tool = createJsonExtractTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", path: "$.name" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
    expect(result.values).toEqual(["Alice", "Bob"]);
  });

  it("should reject invalid path", async () => {
    const tool = createJsonExtractTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "users", column: "data", path: "name" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("$");
  });

  it("should support whereClause", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [{ value: "x" }] });
    const tool = createJsonExtractTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", path: "$.name", whereClause: "id = 1" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = 1"),
    );
  });

  it("should handle query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(new Error("fail"));
    const tool = createJsonExtractTool(adapter);
    const result = (await tool.handler(
      { table: "t", column: "c", path: "$.x" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_json_set
// =============================================================================

describe("createJsonSetTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should set value in JSON column", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createJsonSetTool(adapter);
    const result = (await tool.handler(
      {
        table: "users",
        column: "data",
        path: "$.name",
        value: "New Name",
        whereClause: "id = 1",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowsAffected).toBe(1);
  });

  it("should warn when no rows matched", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 0 });
    const tool = createJsonSetTool(adapter);
    const result = (await tool.handler(
      {
        table: "users",
        column: "data",
        path: "$.name",
        value: "x",
        whereClause: "id = 999",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowsAffected).toBe(0);
    expect(result.warning).toContain("No rows matched");
  });

  it("should reject invalid path", async () => {
    const tool = createJsonSetTool(createMockAdapter());
    const result = (await tool.handler(
      {
        table: "users",
        column: "data",
        path: "name",
        value: "x",
        whereClause: "id = 1",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("$");
  });

  it("should reject undefined value", async () => {
    const tool = createJsonSetTool(createMockAdapter());
    const result = (await tool.handler(
      {
        table: "users",
        column: "data",
        path: "$.name",
        whereClause: "id = 1",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("value");
  });

  it("should handle query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockRejectedValue(new Error("fail"));
    const tool = createJsonSetTool(adapter);
    const result = (await tool.handler(
      {
        table: "t",
        column: "c",
        path: "$.x",
        value: 1,
        whereClause: "id = 1",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_json_remove
// =============================================================================

describe("createJsonRemoveTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should remove value at JSON path", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createJsonRemoveTool(adapter);
    const result = (await tool.handler(
      {
        table: "users",
        column: "data",
        path: "$.temp",
        whereClause: "id = 1",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowsAffected).toBe(1);
  });

  it("should warn when no rows matched", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 0 });
    const tool = createJsonRemoveTool(adapter);
    const result = (await tool.handler(
      {
        table: "users",
        column: "data",
        path: "$.temp",
        whereClause: "id = 999",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.warning).toContain("No rows matched");
  });

  it("should reject invalid path", async () => {
    const tool = createJsonRemoveTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "users", column: "data", path: "temp", whereClause: "1=1" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_json_type
// =============================================================================

describe("createJsonTypeTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return JSON type", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ type: "object" }, { type: "array" }],
    });
    const tool = createJsonTypeTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.types).toEqual(["object", "array"]);
  });

  it("should reject invalid path", async () => {
    const tool = createJsonTypeTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "users", column: "data", path: "invalid" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should support whereClause", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [{ type: "text" }] });
    const tool = createJsonTypeTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", whereClause: "id = 1" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("id = 1"),
    );
  });
});

// =============================================================================
// sqlite_json_array_length
// =============================================================================

describe("createJsonArrayLengthTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return array lengths", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ length: 3 }, { length: 5 }],
    });
    const tool = createJsonArrayLengthTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "tags" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.lengths).toEqual([3, 5]);
  });

  it("should reject invalid path", async () => {
    const tool = createJsonArrayLengthTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "users", column: "tags", path: "nope" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should support whereClause", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [{ length: 1 }] });
    const tool = createJsonArrayLengthTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "tags", whereClause: "id = 1" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// sqlite_json_array_append
// =============================================================================

describe("createJsonArrayAppendTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should append value to JSON array", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createJsonArrayAppendTool(adapter);
    const result = (await tool.handler(
      {
        table: "users",
        column: "tags",
        path: "$",
        value: "new-tag",
        whereClause: "id = 1",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.rowsAffected).toBe(1);
  });

  it("should handle path ending with ]", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createJsonArrayAppendTool(adapter);
    const result = (await tool.handler(
      {
        table: "users",
        column: "data",
        path: "$.items[0]",
        value: "x",
        whereClause: "id = 1",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject invalid path", async () => {
    const tool = createJsonArrayAppendTool(createMockAdapter());
    const result = (await tool.handler(
      {
        table: "users",
        column: "tags",
        path: "tags",
        value: "x",
        whereClause: "1=1",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should reject undefined value", async () => {
    const tool = createJsonArrayAppendTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "users", column: "tags", path: "$", whereClause: "1=1" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("value");
  });

  it("should handle write error", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockRejectedValue(new Error("fail"));
    const tool = createJsonArrayAppendTool(adapter);
    const result = (await tool.handler(
      { table: "t", column: "c", path: "$", value: 1, whereClause: "1=1" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});
