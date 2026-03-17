/**
 * Boundary & Stress Tests
 *
 * Tests edge cases: empty tables, NULL data, single rows,
 * idempotent operations, create-drop-recreate, and vector edge cases.
 *
 * Replaces Category 1 (Boundary Values) and Category 2 (Idempotency)
 * from test-tools-advanced-1.md and test-tools-advanced-2.md.
 *
 * Uses _e2e_boundary_* prefixed temp tables with cleanup.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess, expectHandlerError } from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Empty Table Operations
// =============================================================================

test.describe("Boundary: Empty Tables", () => {
  test("setup: create empty table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_boundary_empty",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "value", type: "REAL" },
          { name: "name", type: "TEXT" },
        ],
        ifNotExists: true,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });

  test("stats_count on empty table → count: 0", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_count", {
        table: "_e2e_boundary_empty",
      });
      expectSuccess(p);
      expect(p.count).toBe(0);
    } finally {
      await client.close();
    }
  });

  test("stats_basic on empty table → graceful handling", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_basic", {
        table: "_e2e_boundary_empty",
        column: "value",
      });
      // Should handle gracefully — either success with zeros/nulls or structured error
      expect(typeof p.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("read_query on empty table → 0 rows", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT * FROM _e2e_boundary_empty",
      });
      expectSuccess(p);
      expect(p.rowCount).toBe(0);
      expect(Array.isArray(p.rows)).toBe(true);
      expect((p.rows as unknown[]).length).toBe(0);
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop empty table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_boundary_empty",
        ifExists: true,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Single-Row Behavior
// =============================================================================

test.describe("Boundary: Single Row", () => {
  test("setup: create and populate single-row table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_boundary_single",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "value", type: "REAL" },
        ],
        ifNotExists: true,
      });
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_boundary_single (id, value) VALUES (1, 42.5)",
      });
    } finally {
      await client.close();
    }
  });

  test("stats_basic on single row → min = max = avg", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_basic", {
        table: "_e2e_boundary_single",
        column: "value",
      });
      expectSuccess(p);
      const stats = p.stats as Record<string, unknown>;
      expect(stats.count).toBe(1);
      expect(stats.min).toBe(42.5);
      expect(stats.max).toBe(42.5);
      expect(stats.avg).toBe(42.5);
    } finally {
      await client.close();
    }
  });

  test("stats_percentile on single row → all percentiles equal", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_percentile", {
        table: "_e2e_boundary_single",
        column: "value",
        percentiles: [25, 50, 75],
      });
      expectSuccess(p);
      const percentiles = p.percentiles as { percentile: number; value: number }[];
      for (const pct of percentiles) {
        expect(pct.value).toBe(42.5);
      }
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop single-row table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_boundary_single",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// NULL-Heavy Data
// =============================================================================

test.describe("Boundary: NULLs", () => {
  test("setup: create table with NULLs", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_boundary_nulls",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "value", type: "REAL" },
        ],
        ifNotExists: true,
      });
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_boundary_nulls (id, value) VALUES (1, NULL), (2, NULL), (3, NULL), (4, 100.0)",
      });
    } finally {
      await client.close();
    }
  });

  test("stats_count counts all rows including NULLs", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_count", {
        table: "_e2e_boundary_nulls",
      });
      expectSuccess(p);
      expect(p.count).toBe(4);
    } finally {
      await client.close();
    }
  });

  test("stats_basic counts only non-NULL values", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_basic", {
        table: "_e2e_boundary_nulls",
        column: "value",
      });
      expectSuccess(p);
      const stats = p.stats as Record<string, unknown>;
      expect(stats.count).toBe(1);
      expect(stats.min).toBe(100.0);
      expect(stats.max).toBe(100.0);
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop nulls table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_boundary_nulls",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Create-Drop-Recreate (Idempotency)
// =============================================================================

test.describe("Boundary: Idempotency", () => {
  test("create table → drop → recreate succeeds", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create
      const p1 = await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_boundary_idem",
        columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
      });
      expectSuccess(p1);

      // Drop
      const p2 = await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_boundary_idem",
      });
      expectSuccess(p2);

      // Recreate
      const p3 = await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_boundary_idem",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "extra", type: "TEXT" },
        ],
      });
      expectSuccess(p3);

      // Verify new schema
      const p4 = await callToolAndParse(client, "sqlite_describe_table", {
        table: "_e2e_boundary_idem",
      });
      expectSuccess(p4);
      const cols = p4.columns as { name: string }[];
      expect(cols.map((c) => c.name)).toContain("extra");
    } finally {
      await client.close();
    }
  });

  test("create existing table (no ifNotExists) → structured error or safe no-op", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_boundary_idem",
        columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
      });
      // Some backends silently succeed — accept either structured error or success
      expect(typeof p.success).toBe("boolean");
      if (p.success === false) {
        expect(typeof p.error).toBe("string");
      }
    } finally {
      await client.close();
    }
  });

  test("create existing table (with ifNotExists) → success", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_boundary_idem",
        columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
        ifNotExists: true,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop idem table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_boundary_idem",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// View Lifecycle
// =============================================================================

test.describe("Boundary: View Lifecycle", () => {
  test("create view → list → drop → re-drop → recreate", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create
      const p1 = await callToolAndParse(client, "sqlite_create_view", {
        viewName: "_e2e_boundary_view",
        selectQuery: "SELECT id, name FROM test_products LIMIT 5",
      });
      expectSuccess(p1);

      // List — should contain our view
      const p2 = await callToolAndParse(client, "sqlite_list_views");
      expectSuccess(p2);
      const views = p2.views as { name: string }[];
      expect(views.some((v) => v.name === "_e2e_boundary_view")).toBe(true);

      // Drop
      const p3 = await callToolAndParse(client, "sqlite_drop_view", {
        viewName: "_e2e_boundary_view",
      });
      expectSuccess(p3);

      // Re-drop (already gone) → accept either structured error or safe no-op
      const p4 = await callToolAndParse(client, "sqlite_drop_view", {
        viewName: "_e2e_boundary_view",
      });
      expect(typeof p4.success).toBe("boolean");

      // Recreate
      const p5 = await callToolAndParse(client, "sqlite_create_view", {
        viewName: "_e2e_boundary_view",
        selectQuery: "SELECT id, name FROM test_products LIMIT 5",
      });
      expectSuccess(p5);

      // Final cleanup
      await callToolAndParse(client, "sqlite_drop_view", {
        viewName: "_e2e_boundary_view",
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Vector Edge Cases
// =============================================================================

test.describe("Boundary: Vector", () => {
  test("vector normalize with zero vector → structured error or edge-case result", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_normalize", {
        vector: [0, 0, 0],
      });
      // Zero vector can't be meaningfully normalized — accept either error or success
      expect(typeof p.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("vector distance with identical vectors → distance 0", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_distance", {
        vector1: [1, 2, 3],
        vector2: [1, 2, 3],
        metric: "euclidean",
      });
      expectSuccess(p);
      expect(p.value).toBe(0);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Vector: Empty Table Edge Cases
// =============================================================================

test.describe("Boundary: Vector Empty Table", () => {
  test("setup: create empty vector table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_create_table", {
        tableName: "_e2e_boundary_vec_empty",
        dimensions: 4,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });

  test("vector count on empty table → 0", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_count", {
        table: "_e2e_boundary_vec_empty",
      });
      expectSuccess(p);
      expect(p.count).toBe(0);
    } finally {
      await client.close();
    }
  });

  test("vector search on empty table → 0 results, not error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_search", {
        table: "_e2e_boundary_vec_empty",
        vectorColumn: "vector",
        queryVector: [1, 2, 3, 4],
        metric: "cosine",
        limit: 5,
      });
      expectSuccess(p);
      expect(Array.isArray(p.results)).toBe(true);
      expect((p.results as unknown[]).length).toBe(0);
    } finally {
      await client.close();
    }
  });

  test("vector stats on empty table → graceful handling", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_stats", {
        table: "_e2e_boundary_vec_empty",
        vectorColumn: "vector",
      });
      // Should handle gracefully — success with count 0 or message
      expect(typeof p.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("vector dimensions on empty table → graceful handling", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_dimensions", {
        table: "_e2e_boundary_vec_empty",
        vectorColumn: "vector",
      });
      // No vectors to infer dimensions from — accept null or graceful message
      expect(typeof p.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop empty vector table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_boundary_vec_empty",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Geo Edge Cases
// =============================================================================

test.describe("Boundary: Geo", () => {
  test("geo distance same point → 0", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_geo_distance", {
        lat1: 0, lon1: 0, lat2: 0, lon2: 0,
      });
      expectSuccess(p);
      expect(p.distance).toBe(0);
    } finally {
      await client.close();
    }
  });

  test("geo nearby with 0 results → empty array, not error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_geo_nearby", {
        table: "test_locations",
        latColumn: "latitude",
        lonColumn: "longitude",
        centerLat: 0,
        centerLon: 0,
        radius: 100,
        unit: "km",
      });
      expectSuccess(p);
      expect(p.rowCount).toBe(0);
      expect(Array.isArray(p.results)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("geo bounding box covering entire world → all locations", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_geo_bounding_box", {
        table: "test_locations",
        latColumn: "latitude",
        lonColumn: "longitude",
        minLat: -90,
        maxLat: 90,
        minLon: -180,
        maxLon: 180,
      });
      expectSuccess(p);
      expect(p.rowCount).toBe(15);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Data Integrity Verification
// =============================================================================

test.describe("Boundary: Data Integrity", () => {
  test("test_products unchanged (16 rows)", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_count", {
        table: "test_products",
      });
      expectSuccess(p);
      expect(p.count).toBe(16);
    } finally {
      await client.close();
    }
  });

  test("test_orders unchanged (20 rows)", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_count", {
        table: "test_orders",
      });
      expectSuccess(p);
      expect(p.count).toBe(20);
    } finally {
      await client.close();
    }
  });

  test("test_measurements unchanged (200 rows)", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_count", {
        table: "test_measurements",
      });
      expectSuccess(p);
      expect(p.count).toBe(200);
    } finally {
      await client.close();
    }
  });

  test("test_locations unchanged (15 rows)", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_count", {
        table: "test_locations",
      });
      expectSuccess(p);
      expect(p.count).toBe(15);
    } finally {
      await client.close();
    }
  });
});
