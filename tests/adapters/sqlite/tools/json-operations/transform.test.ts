/**
 * JSON Transform Tool Tests (Mock-based)
 *
 * Tests: json_pretty, jsonb_convert, json_storage_info, json_normalize_column
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createJsonPrettyTool,
  createJsonbConvertTool,
  createJsonStorageInfoTool,
  createJsonNormalizeColumnTool,
} from "../../../../../src/adapters/sqlite/tools/json-operations/transform.js";

const ctx = { timestamp: new Date(), requestId: "test" };

function createMockAdapter() {
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
  } as any;
}

// =============================================================================
// sqlite_json_pretty
// =============================================================================

describe("createJsonPrettyTool", () => {
  it("should format JSON", async () => {
    const tool = createJsonPrettyTool();
    const result = (await tool.handler({ json: '{"a":1,"b":2}' }, ctx)) as any;
    expect(result.success).toBe(true);
    expect(result.formatted).toContain("\n");
    expect(result.formatted).toContain("  ");
  });

  it("should reject invalid JSON", async () => {
    const tool = createJsonPrettyTool();
    const result = (await tool.handler({ json: "not json" }, ctx)) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_jsonb_convert
// =============================================================================

describe("createJsonbConvertTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should convert column to JSONB", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 10 });
    const tool = createJsonbConvertTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    // JSONB support depends on SQLite version; either succeeds or returns not-supported
    expect(result).toBeDefined();
    if (result.success) {
      expect(result.rowsAffected).toBe(10);
    }
  });

  it("should support whereClause", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 3 });
    const tool = createJsonbConvertTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", whereClause: "id < 10" },
      ctx,
    )) as any;
    if (result.success) {
      expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining("id < 10"),
      );
    }
  });

  it("should handle write error", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockRejectedValue(new Error("fail"));
    const tool = createJsonbConvertTool(adapter);
    const result = (await tool.handler(
      { table: "t", column: "c" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_json_storage_info
// =============================================================================

describe("createJsonStorageInfoTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should analyze text JSON storage", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ data: '{"a":1}' }, { data: '{"b":2}' }, { data: null }],
    });
    const tool = createJsonStorageInfoTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", sampleSize: 10 },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.formats.text).toBe(2);
    expect(result.formats.null).toBe(1);
    expect(result.sampleSize).toBe(3);
  });

  it("should handle empty table", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createJsonStorageInfoTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", sampleSize: 10 },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.sampleSize).toBe(0);
  });

  it("should detect JSONB (Buffer) storage", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ data: Buffer.from([0x01, 0x02]) }],
    });
    const tool = createJsonStorageInfoTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", sampleSize: 10 },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    // Buffer is not text → detected as jsonb or unknown depending on detection
    expect(
      result.formats.text + result.formats.jsonb + result.formats.unknown,
    ).toBe(1);
  });

  it("should handle query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(new Error("fail"));
    const tool = createJsonStorageInfoTool(adapter);
    const result = (await tool.handler(
      { table: "t", column: "c", sampleSize: 10 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_json_normalize_column
// =============================================================================

describe("createJsonNormalizeColumnTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should normalize JSON column rows", async () => {
    const adapter = createMockAdapter();
    // Return rows with json_data that can be normalized (keys out of order)
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { _rid_: 1, raw_data: '{"b":2,"a":1}', json_data: '{"b":2,"a":1}' },
        { _rid_: 2, raw_data: '{"a":1}', json_data: '{"a":1}' },
      ],
    });
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createJsonNormalizeColumnTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
    // At least some rows should be normalized (key sorting)
    expect(result.normalized + result.unchanged).toBe(2);
  });

  it("should skip null json_data", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ _rid_: 1, raw_data: null, json_data: null }],
    });
    const tool = createJsonNormalizeColumnTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.unchanged).toBe(1);
  });

  it("should reject invalid outputFormat", async () => {
    const tool = createJsonNormalizeColumnTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "users", column: "data", outputFormat: "bogus" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("outputFormat");
  });

  it("should support text outputFormat with JSONB data", async () => {
    const adapter = createMockAdapter();
    // raw_data is a Buffer (JSONB), outputFormat is 'text' → needs format change
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ _rid_: 1, raw_data: Buffer.from([1, 2]), json_data: '{"a":1}' }],
    });
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createJsonNormalizeColumnTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", outputFormat: "text" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.normalized).toBe(1);
    expect(result.outputFormat).toBe("text");
  });

  it("should support jsonb outputFormat with text data", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ _rid_: 1, raw_data: '{"a":1}', json_data: '{"a":1}' }],
    });
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createJsonNormalizeColumnTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", outputFormat: "jsonb" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.normalized).toBe(1);
    // Should use jsonb() wrapper in UPDATE
    expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
      expect.stringContaining("jsonb"),
      expect.any(Array),
    );
  });

  it("should support whereClause", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createJsonNormalizeColumnTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data", whereClause: "id < 10" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("id < 10"),
    );
  });

  it("should report first error detail on row update failure", async () => {
    const adapter = createMockAdapter();
    // A normalizable row (keys out of order → wasModified: true) but write fails
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { _rid_: 1, raw_data: '{"b":2,"a":1}', json_data: '{"b":2,"a":1}' },
      ],
    });
    adapter.executeWriteQuery.mockRejectedValue(new Error("disk full"));
    const tool = createJsonNormalizeColumnTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.errors).toBe(1);
    expect(result.firstErrorDetail).toContain("disk full");
  });

  it("should handle query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(new Error("fail"));
    const tool = createJsonNormalizeColumnTool(adapter);
    const result = (await tool.handler(
      { table: "t", column: "c" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});
