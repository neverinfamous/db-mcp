/**
 * Vector Tools Tests
 *
 * Tests for SQLite vector similarity search tools.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteAdapter } from "../../../src/adapters/sqlite/SqliteAdapter.js";

describe("Vector Tools", () => {
  let adapter: SqliteAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = new SqliteAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    tools = new Map();
    const toolDefs = adapter.getToolDefinitions();
    const context = { scopes: ["read", "write", "admin"] };

    for (const tool of toolDefs) {
      tools.set(tool.name, (params) => tool.handler(params, context as never));
    }
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe("sqlite_vector_create_table", () => {
    it("should create vector table", async () => {
      const result = await tools.get("sqlite_vector_create_table")?.({
        tableName: "embeddings",
        dimensions: 3,
      });

      expect(result).toHaveProperty("success", true);

      const tables = await adapter.listTables();
      expect(tables.map((t) => t.name)).toContain("embeddings");
    });
  });

  describe("sqlite_vector_store", () => {
    it("should store a vector", async () => {
      await adapter.executeWriteQuery(`
                CREATE TABLE vectors (id INTEGER PRIMARY KEY, embedding TEXT)
            `);

      const result = await tools.get("sqlite_vector_store")?.({
        table: "vectors",
        idColumn: "id",
        vectorColumn: "embedding",
        id: 1,
        vector: [0.1, 0.2, 0.3],
      });

      expect(result).toHaveProperty("success", true);
    });
  });

  describe("sqlite_vector_search", () => {
    it("should find similar vectors", async () => {
      await adapter.executeWriteQuery(`
                CREATE TABLE vectors (id INTEGER PRIMARY KEY, embedding TEXT, label TEXT)
            `);

      // Store some vectors
      await adapter.executeWriteQuery(`
                INSERT INTO vectors (embedding, label) VALUES
                ('[1.0, 0.0, 0.0]', 'x-axis'),
                ('[0.0, 1.0, 0.0]', 'y-axis'),
                ('[0.707, 0.707, 0.0]', 'xy-diagonal')
            `);

      // Search for vector similar to x-axis
      const result = (await tools.get("sqlite_vector_search")?.({
        table: "vectors",
        vectorColumn: "embedding",
        queryVector: [0.9, 0.1, 0.0],
        metric: "cosine",
        limit: 2,
      })) as { results: { label: string; _similarity: number }[] };

      // x-axis should be most similar
      expect(result.results[0]?.label).toBe("x-axis");
    });
  });

  describe("sqlite_vector_distance", () => {
    it("should calculate cosine similarity", async () => {
      const result = (await tools.get("sqlite_vector_distance")?.({
        vector1: [1, 0, 0],
        vector2: [1, 0, 0],
        metric: "cosine",
      })) as { value: number };

      expect(result.value).toBe(1); // Same vector = similarity 1
    });

    it("should calculate euclidean distance", async () => {
      const result = (await tools.get("sqlite_vector_distance")?.({
        vector1: [0, 0],
        vector2: [3, 4],
        metric: "euclidean",
      })) as { value: number };

      expect(result.value).toBe(5); // 3-4-5 triangle
    });
  });

  describe("sqlite_vector_normalize", () => {
    it("should normalize a vector", async () => {
      const result = (await tools.get("sqlite_vector_normalize")?.({
        vector: [3, 4],
      })) as { normalized: number[] };

      expect(result.normalized[0]).toBeCloseTo(0.6, 5);
      expect(result.normalized[1]).toBeCloseTo(0.8, 5);
    });
  });
});
