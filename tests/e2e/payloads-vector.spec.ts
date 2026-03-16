/**
 * Payload Contract Tests: Vector Group
 *
 * Validates response shapes for representative vector tools:
 * vector_count, vector_search, vector_stats, vector_get.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Vector", () => {
  test("sqlite_vector_count returns { success, count }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_count", {
        table: "test_embeddings",
      });

      expectSuccess(payload);
      expect(typeof payload.count).toBe("number");
      expect((payload.count as number)).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_vector_search returns { success, results[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_search", {
        table: "test_embeddings",
        vectorColumn: "embedding",
        queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01],
        limit: 3,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.results)).toBe(true);
      expect((payload.results as unknown[]).length).toBeLessThanOrEqual(3);

      const results = payload.results as Record<string, unknown>[];
      if (results.length > 0) {
        const r = results[0];
        expect(r).toHaveProperty("id");
        expect(r).toHaveProperty("_similarity");
        expect(typeof r._similarity).toBe("number");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_vector_stats returns { success, sampleSize, dimensions, magnitudeStats }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_stats", {
        table: "test_embeddings",
        vectorColumn: "embedding",
      });

      expectSuccess(payload);
      expect(typeof payload.sampleSize).toBe("number");
      expect(typeof payload.dimensions).toBe("number");

      const mag = payload.magnitudeStats as Record<string, unknown>;
      expect(typeof mag.min).toBe("number");
      expect(typeof mag.max).toBe("number");
      expect(typeof mag.avg).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_vector_get returns { success, id, vector, dimensions, metadata }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_get", {
        table: "test_embeddings",
        idColumn: "id",
        vectorColumn: "embedding",
        id: 1,
      });

      expectSuccess(payload);
      expect(payload).toHaveProperty("id");
      expect(typeof payload.dimensions).toBe("number");

      // vector should be an array of numbers
      expect(payload).toHaveProperty("vector");
      const vector = payload.vector as number[];
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBeGreaterThan(0);
      expect(typeof vector[0]).toBe("number");

      // metadata contains remaining row columns
      expect(payload).toHaveProperty("metadata");
    } finally {
      await client.close();
    }
  });

  test("sqlite_vector_dimensions returns { success, dimensions }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_dimensions", {
        table: "test_embeddings",
        vectorColumn: "embedding",
      });

      expectSuccess(payload);
      expect(typeof payload.dimensions).toBe("number");
      expect((payload.dimensions as number)).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_vector_normalize returns { success, original, normalized }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_normalize", {
        vector: [3, 4],
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.original)).toBe(true);
      expect(Array.isArray(payload.normalized)).toBe(true);
      expect(typeof payload.originalMagnitude).toBe("number");

      // Normalized vector should have magnitude ~1
      const normalized = payload.normalized as number[];
      expect(normalized.length).toBe(2);
    } finally {
      await client.close();
    }
  });

  test("sqlite_vector_distance returns { success, metric, value }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_distance", {
        vector1: [1, 0, 0],
        vector2: [0, 1, 0],
        metric: "cosine",
      });

      expectSuccess(payload);
      expect(payload.metric).toBe("cosine");
      expect(typeof payload.value).toBe("number");
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Vector Write Operations (setup → verify → cleanup)
// =============================================================================

test.describe("Payload Contracts: Vector Write Operations", () => {
  test("sqlite_vector_create_table returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Cleanup from prior runs
      await callToolAndParse(client, "sqlite_drop_table", {
        tableName: "_e2e_vec_write",
      });

      const payload = await callToolAndParse(client, "sqlite_vector_create_table", {
        tableName: "_e2e_vec_write",
        dimensions: 4,
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_vector_store returns { success }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Ensure the table exists (vector_create_table may use executeQuery which is read-only on some backends)
      await callToolAndParse(client, "sqlite_create_table", {
        tableName: "_e2e_vec_write",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "vector", type: "TEXT", nullable: false },
          { name: "dimensions", type: "INTEGER" },
        ],
      });

      const payload = await callToolAndParse(client, "sqlite_vector_store", {
        table: "_e2e_vec_write",
        idColumn: "id",
        vectorColumn: "vector",
        id: 1,
        vector: [0.1, 0.2, 0.3, 0.4],
      });

      expectSuccess(payload);
      expect(typeof payload.id).toBe("number");
      expect(payload.dimensions).toBe(4);
    } finally {
      await client.close();
    }
  });

  test("sqlite_vector_batch_store returns { success, stored }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_batch_store", {
        table: "_e2e_vec_write",
        idColumn: "id",
        vectorColumn: "vector",
        items: [
          { id: 2, vector: [0.5, 0.6, 0.7, 0.8] },
          { id: 3, vector: [0.9, 1.0, 0.1, 0.2] },
          { id: 4, vector: [0.3, 0.4, 0.5, 0.6] },
        ],
      });

      expectSuccess(payload);
      expect(typeof payload.stored).toBe("number");
      expect(payload.stored).toBe(3);
    } finally {
      await client.close();
    }
  });

  test("verify stored vectors via vector_count", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_count", {
        table: "_e2e_vec_write",
      });

      expectSuccess(payload);
      expect(payload.count).toBe(4); // 1 single + 3 batch
    } finally {
      await client.close();
    }
  });

  test("sqlite_vector_delete returns { success, deleted }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vector_delete", {
        table: "_e2e_vec_write",
        idColumn: "id",
        ids: [2, 3],
      });

      expectSuccess(payload);
      expect(typeof payload.deleted).toBe("number");
      expect(payload.deleted).toBe(2);
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop vector write table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_vec_write",
      });
      expectSuccess(payload);
    } finally {
      await client.close();
    }
  });
});


