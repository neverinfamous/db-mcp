/**
 * Vector Tools Tests
 *
 * Tests for SQLite vector embedding tools:
 * create table, store, batch store, search, get, delete, count, stats,
 * dimensions, normalize, distance.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Vector Tools", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Get tools as a map for easy access
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
    it("should create a vector table", async () => {
      const result = (await tools.get("sqlite_vector_create_table")?.({
        tableName: "embeddings",
        dimensions: 3,
      })) as {
        success: boolean;
        message?: string;
      };

      expect(result.success).toBe(true);
    });

    it("should create with additional columns", async () => {
      const result = (await tools.get("sqlite_vector_create_table")?.({
        tableName: "custom_embeddings",
        dimensions: 4,
        additionalColumns: [{ name: "label", type: "TEXT" }],
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_vector_store", () => {
    it("should store a vector", async () => {
      // First create the table
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "test_vectors",
        dimensions: 3,
      });

      const result = (await tools.get("sqlite_vector_store")?.({
        table: "test_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [1.0, 2.0, 3.0],
      })) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
    });
  });

  describe("sqlite_vector_batch_store", () => {
    it("should batch store vectors", async () => {
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "batch_vectors",
        dimensions: 3,
      });

      const result = (await tools.get("sqlite_vector_batch_store")?.({
        table: "batch_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        items: [
          { id: 1, vector: [1.0, 0.0, 0.0] },
          { id: 2, vector: [0.0, 1.0, 0.0] },
          { id: 3, vector: [0.0, 0.0, 1.0] },
        ],
      })) as {
        success: boolean;
        stored: number;
      };

      expect(result.success).toBe(true);
      expect(result.stored).toBe(3);
    });
  });

  describe("sqlite_vector_search", () => {
    it("should search for similar vectors", async () => {
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "search_vectors",
        dimensions: 3,
      });

      await tools.get("sqlite_vector_batch_store")?.({
        table: "search_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        items: [
          { id: 1, vector: [1.0, 0.0, 0.0] },
          { id: 2, vector: [0.9, 0.1, 0.0] },
          { id: 3, vector: [0.0, 1.0, 0.0] },
        ],
      });

      const result = (await tools.get("sqlite_vector_search")?.({
        table: "search_vectors",
        vectorColumn: "vector",
        queryVector: [1.0, 0.0, 0.0],
        limit: 2,
      })) as {
        success: boolean;
        count: number;
        results: { id: number; _similarity: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe("sqlite_vector_get", () => {
    it("should get a vector by id", async () => {
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "get_vectors",
        dimensions: 3,
      });

      await tools.get("sqlite_vector_store")?.({
        table: "get_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [1.0, 2.0, 3.0],
      });

      const result = (await tools.get("sqlite_vector_get")?.({
        table: "get_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
      })) as {
        success: boolean;
        vector: number[];
      };

      expect(result.success).toBe(true);
      expect(result.vector).toEqual([1.0, 2.0, 3.0]);
    });
  });

  describe("sqlite_vector_delete", () => {
    it("should delete vectors", async () => {
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "del_vectors",
        dimensions: 3,
      });

      await tools.get("sqlite_vector_store")?.({
        table: "del_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [1.0, 2.0, 3.0],
      });

      const result = (await tools.get("sqlite_vector_delete")?.({
        table: "del_vectors",
        idColumn: "id",
        ids: [1],
      })) as {
        success: boolean;
        deleted: number;
      };

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(1);
    });
  });

  describe("sqlite_vector_count", () => {
    it("should count vectors", async () => {
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "count_vectors",
        dimensions: 3,
      });

      await tools.get("sqlite_vector_batch_store")?.({
        table: "count_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        items: [
          { id: 1, vector: [1.0, 0.0, 0.0] },
          { id: 2, vector: [0.0, 1.0, 0.0] },
        ],
      });

      const result = (await tools.get("sqlite_vector_count")?.({
        table: "count_vectors",
      })) as {
        success: boolean;
        count: number;
      };

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe("sqlite_vector_stats", () => {
    it("should return vector table stats", async () => {
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "stats_vectors",
        dimensions: 3,
      });

      await tools.get("sqlite_vector_store")?.({
        table: "stats_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [1.0, 2.0, 3.0],
      });

      const result = (await tools.get("sqlite_vector_stats")?.({
        table: "stats_vectors",
        vectorColumn: "vector",
      })) as {
        success: boolean;
        sampleSize: number;
        dimensions: number;
      };

      expect(result.success).toBe(true);
      expect(result.sampleSize).toBe(1);
      expect(result.dimensions).toBe(3);
    });
  });

  describe("sqlite_vector_dimensions", () => {
    it("should return vector dimensions", async () => {
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "dim_vectors",
        dimensions: 5,
      });

      await tools.get("sqlite_vector_store")?.({
        table: "dim_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [1.0, 2.0, 3.0, 4.0, 5.0],
      });

      const result = (await tools.get("sqlite_vector_dimensions")?.({
        table: "dim_vectors",
        vectorColumn: "vector",
      })) as {
        success: boolean;
        dimensions: number;
      };

      expect(result.success).toBe(true);
      expect(result.dimensions).toBe(5);
    });
  });

  describe("sqlite_vector_normalize", () => {
    it("should normalize a vector", async () => {
      const result = (await tools.get("sqlite_vector_normalize")?.({
        vector: [3.0, 4.0, 0.0], // Length = 5
      })) as {
        success: boolean;
        normalized: number[];
        originalMagnitude: number;
      };

      expect(result.success).toBe(true);
      expect(result.normalized[0]).toBeCloseTo(0.6);
      expect(result.normalized[1]).toBeCloseTo(0.8);
      expect(result.originalMagnitude).toBeCloseTo(5);
    });
  });

  describe("sqlite_vector_distance", () => {
    it("should calculate distance between two vectors", async () => {
      const result = (await tools.get("sqlite_vector_distance")?.({
        vector1: [1.0, 0.0, 0.0],
        vector2: [0.0, 1.0, 0.0],
        metric: "euclidean",
      })) as {
        success: boolean;
        value: number;
      };

      expect(result.success).toBe(true);
      expect(result.value).toBeCloseTo(Math.sqrt(2), 3);
    });

    it("should calculate cosine similarity", async () => {
      const result = (await tools.get("sqlite_vector_distance")?.({
        vector1: [1.0, 0.0],
        vector2: [1.0, 0.0],
        metric: "cosine",
      })) as {
        success: boolean;
        value: number;
      };

      expect(result.success).toBe(true);
      expect(result.value).toBe(1); // Identical vectors
    });

    it("should calculate dot product", async () => {
      const result = (await tools.get("sqlite_vector_distance")?.({
        vector1: [1.0, 2.0, 3.0],
        vector2: [4.0, 5.0, 6.0],
        metric: "dot",
      })) as {
        success: boolean;
        value: number;
      };

      expect(result.success).toBe(true);
      expect(result.value).toBeCloseTo(32); // 1*4 + 2*5 + 3*6 = 32
    });
  });

  describe("sqlite_vector_get edge cases", () => {
    it("should handle non-existent vector gracefully", async () => {
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "edge_vectors",
        dimensions: 3,
      });

      const result = (await tools.get("sqlite_vector_get")?.({
        table: "edge_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        id: 999,
      })) as {
        success: boolean;
        vector: number[] | null;
      };

      // Either returns success with null vector or success:false
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("sqlite_vector_search metrics", () => {
    it("should search using euclidean distance", async () => {
      await tools.get("sqlite_vector_create_table")?.({
        tableName: "metric_vectors",
        dimensions: 3,
      });

      await tools.get("sqlite_vector_batch_store")?.({
        table: "metric_vectors",
        idColumn: "id",
        vectorColumn: "vector",
        items: [
          { id: 1, vector: [1.0, 0.0, 0.0] },
          { id: 2, vector: [0.0, 1.0, 0.0] },
        ],
      });

      const result = (await tools.get("sqlite_vector_search")?.({
        table: "metric_vectors",
        vectorColumn: "vector",
        queryVector: [1.0, 0.0, 0.0],
        metric: "euclidean",
        limit: 1,
      })) as {
        success: boolean;
        count: number;
        results: { id: number }[];
      };

      expect(result.success).toBe(true);
      expect(result.results[0]?.id).toBe(1);
    });
  });

  describe("sqlite_vector_normalize edge cases", () => {
    it("should handle zero vector", async () => {
      const result = (await tools.get("sqlite_vector_normalize")?.({
        vector: [0.0, 0.0, 0.0],
      })) as {
        success: boolean;
        normalized: number[];
        originalMagnitude: number;
      };

      expect(result.success).toBe(true);
      expect(result.originalMagnitude).toBe(0);
    });
  });
});
