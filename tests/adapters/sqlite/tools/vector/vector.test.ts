/**
 * Vector Tool Tests (Mock-based)
 *
 * Tests: vector_search, vector_get, vector_create_table,
 *        vector_store, vector_batch_store, vector_delete
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVectorSearchTool,
  createVectorGetTool,
} from "../../../../../src/adapters/sqlite/tools/vector/search.js";
import {
  createVectorCreateTableTool,
  createVectorStoreTool,
  createVectorBatchStoreTool,
  createVectorDeleteTool,
} from "../../../../../src/adapters/sqlite/tools/vector/storage.js";

const ctx = { timestamp: new Date(), requestId: "test" };

function createMockAdapter() {
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
    executeQuery: vi.fn(),
  } as any;
}

// =============================================================================
// sqlite_vector_search
// =============================================================================

describe("createVectorSearchTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should search by cosine similarity", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { id: 1, vector: "[1,0,0]" },
        { id: 2, vector: "[0,1,0]" },
      ],
    });
    const tool = createVectorSearchTool(adapter);
    const result = (await tool.handler(
      {
        table: "vectors",
        vectorColumn: "vector",
        queryVector: [1, 0, 0],
        metric: "cosine",
        limit: 10,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.results[0]._similarity).toBeDefined();
  });

  it("should search by euclidean distance", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ id: 1, vector: "[1,0]" }],
    });
    const tool = createVectorSearchTool(adapter);
    const result = (await tool.handler(
      {
        table: "vectors",
        vectorColumn: "vector",
        queryVector: [1, 0],
        metric: "euclidean",
        limit: 5,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should search by dot product", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ id: 1, vector: "[1,2,3]" }],
    });
    const tool = createVectorSearchTool(adapter);
    const result = (await tool.handler(
      {
        table: "vectors",
        vectorColumn: "vector",
        queryVector: [1, 2, 3],
        metric: "dot",
        limit: 5,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject empty queryVector", async () => {
    const tool = createVectorSearchTool(createMockAdapter());
    const result = (await tool.handler(
      {
        table: "vectors",
        vectorColumn: "vector",
        queryVector: [],
        metric: "cosine",
        limit: 10,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should support whereClause", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createVectorSearchTool(adapter);
    const result = (await tool.handler(
      {
        table: "vectors",
        vectorColumn: "vector",
        queryVector: [1, 0],
        metric: "cosine",
        limit: 5,
        whereClause: "category = 'test'",
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("category = 'test'"),
    );
  });

  it("should support returnColumns", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ id: 1, name: "test", vector: "[1,0]" }],
    });
    const tool = createVectorSearchTool(adapter);
    const result = (await tool.handler(
      {
        table: "vectors",
        vectorColumn: "vector",
        queryVector: [1, 0],
        metric: "cosine",
        limit: 5,
        returnColumns: ["id", "name"],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.results[0]).toHaveProperty("_similarity");
  });

  it("should skip invalid vectors and report warning", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { id: 1, vector: "[1,0]" },
        { id: 2, vector: "invalid" },
      ],
    });
    const tool = createVectorSearchTool(adapter);
    const result = (await tool.handler(
      {
        table: "vectors",
        vectorColumn: "vector",
        queryVector: [1, 0],
        metric: "cosine",
        limit: 10,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(1);
    expect(result.warning).toContain("skipped");
  });

  it("should handle query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(new Error("fail"));
    const tool = createVectorSearchTool(adapter);
    const result = (await tool.handler(
      {
        table: "t",
        vectorColumn: "v",
        queryVector: [1],
        metric: "cosine",
        limit: 5,
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// sqlite_vector_get
// =============================================================================

describe("createVectorGetTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should get vector by numeric ID", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ id: 1, vector: "[1,2,3]", name: "test" }],
    });
    const tool = createVectorGetTool(adapter);
    const result = (await tool.handler(
      { table: "vectors", idColumn: "id", vectorColumn: "vector", id: 1 },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.dimensions).toBe(3);
    expect(result.vector).toEqual([1, 2, 3]);
  });

  it("should get vector by string ID", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ id: "abc", vector: "[1,0]" }],
    });
    const tool = createVectorGetTool(adapter);
    const result = (await tool.handler(
      { table: "vectors", idColumn: "id", vectorColumn: "vector", id: "abc" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("'abc'"),
    );
  });

  it("should return not found", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createVectorGetTool(adapter);
    const result = (await tool.handler(
      { table: "vectors", idColumn: "id", vectorColumn: "vector", id: 999 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("VECTOR_NOT_FOUND");
  });

  it("should handle null vector column", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ id: 1, vector: null }],
    });
    const tool = createVectorGetTool(adapter);
    const result = (await tool.handler(
      { table: "vectors", idColumn: "id", vectorColumn: "vector", id: 1 },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("NULL");
  });
});

// =============================================================================
// sqlite_vector_create_table
// =============================================================================

describe("createVectorCreateTableTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should create vector table", async () => {
    const adapter = createMockAdapter();
    adapter.executeQuery.mockResolvedValue({ rows: [] });
    const tool = createVectorCreateTableTool(adapter);
    const result = (await tool.handler(
      {
        tableName: "embeddings",
        dimensions: 384,
        additionalColumns: [{ name: "label", type: "TEXT" }],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.sql).toContain("CREATE TABLE");
    expect(result.sql).toContain("384");
    expect(result.sql).toContain("label");
  });

  it("should reject zero dimensions", async () => {
    const tool = createVectorCreateTableTool(createMockAdapter());
    const result = (await tool.handler(
      { tableName: "vecs", dimensions: 0, additionalColumns: [] },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("Dimensions");
  });

  it("should create without additional columns", async () => {
    const adapter = createMockAdapter();
    adapter.executeQuery.mockResolvedValue({ rows: [] });
    const tool = createVectorCreateTableTool(adapter);
    const result = (await tool.handler(
      { tableName: "vecs", dimensions: 128, additionalColumns: [] },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// sqlite_vector_store
// =============================================================================

describe("createVectorStoreTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should store vector (insert when update returns 0)", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        {
          sql: "CREATE TABLE vecs (id INTEGER, vector TEXT, dimensions INTEGER DEFAULT 3)",
        },
      ],
    });
    adapter.executeWriteQuery
      .mockResolvedValueOnce({ rowsAffected: 0 }) // update
      .mockResolvedValueOnce({ rowsAffected: 1 }); // insert
    const tool = createVectorStoreTool(adapter);
    const result = (await tool.handler(
      {
        table: "vecs",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [1, 2, 3],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.dimensions).toBe(3);
  });

  it("should update existing vector", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ sql: "CREATE TABLE vecs (id, vector)" }],
    });
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createVectorStoreTool(adapter);
    const result = (await tool.handler(
      {
        table: "vecs",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [1, 0],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });

  it("should reject empty vector", async () => {
    const tool = createVectorStoreTool(createMockAdapter());
    const result = (await tool.handler(
      {
        table: "vecs",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should detect dimension mismatch", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        {
          sql: "CREATE TABLE vecs (id INTEGER, vector TEXT, dimensions INTEGER DEFAULT 3)",
        },
      ],
    });
    const tool = createVectorStoreTool(adapter);
    const result = (await tool.handler(
      {
        table: "vecs",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [1, 2], // 2 dims, table expects 3
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("DIMENSION_MISMATCH");
  });

  it("should store with string ID", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ sql: "CREATE TABLE vecs (id, vector)" }],
    });
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createVectorStoreTool(adapter);
    const result = (await tool.handler(
      {
        table: "vecs",
        idColumn: "id",
        vectorColumn: "vector",
        id: "abc",
        vector: [1, 0],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// sqlite_vector_batch_store
// =============================================================================

describe("createVectorBatchStoreTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should batch store vectors", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { sql: "CREATE TABLE vecs (id, vector, dimensions INTEGER DEFAULT 2)" },
      ],
    });
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createVectorBatchStoreTool(adapter);
    const result = (await tool.handler(
      {
        table: "vecs",
        idColumn: "id",
        vectorColumn: "vector",
        items: [
          { id: 1, vector: [1, 0] },
          { id: 2, vector: [0, 1] },
        ],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.stored).toBe(2);
  });

  it("should handle empty items with existing table", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ name: "vecs" }],
    });
    const tool = createVectorBatchStoreTool(adapter);
    const result = (await tool.handler(
      {
        table: "vecs",
        idColumn: "id",
        vectorColumn: "vector",
        items: [],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.stored).toBe(0);
  });

  it("should reject empty items with missing table", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createVectorBatchStoreTool(adapter);
    const result = (await tool.handler(
      {
        table: "nonexistent",
        idColumn: "id",
        vectorColumn: "vector",
        items: [],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("does not exist");
  });

  it("should detect dimension mismatch in batch", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { sql: "CREATE TABLE vecs (id, vector, dimensions INTEGER DEFAULT 3)" },
      ],
    });
    const tool = createVectorBatchStoreTool(adapter);
    const result = (await tool.handler(
      {
        table: "vecs",
        idColumn: "id",
        vectorColumn: "vector",
        items: [
          { id: 1, vector: [1, 2, 3] },
          { id: 2, vector: [1, 2] }, // wrong dims
        ],
      },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("DIMENSION_MISMATCH");
  });
});

// =============================================================================
// sqlite_vector_delete
// =============================================================================

describe("createVectorDeleteTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should delete vectors by IDs", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 2 });
    const tool = createVectorDeleteTool(adapter);
    const result = (await tool.handler(
      { table: "vecs", idColumn: "id", ids: [1, 2] },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(2);
  });

  it("should handle empty IDs array", async () => {
    const tool = createVectorDeleteTool(createMockAdapter());
    const result = (await tool.handler(
      { table: "vecs", idColumn: "id", ids: [] },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(0);
  });

  it("should handle string IDs", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });
    const tool = createVectorDeleteTool(adapter);
    const result = (await tool.handler(
      { table: "vecs", idColumn: "id", ids: ["abc", "def"] },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
      expect.stringContaining("'abc'"),
    );
  });

  it("should handle delete error", async () => {
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockRejectedValue(new Error("fail"));
    const tool = createVectorDeleteTool(adapter);
    const result = (await tool.handler(
      { table: "t", idColumn: "id", ids: [1] },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });
});
