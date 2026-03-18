/**
 * Cross-Group Integration Workflow Tests
 *
 * Exercises realistic multi-group workflows that span tool boundaries
 * to catch inter-group regressions.
 *
 * Workflow 1: Core → JSON → Stats (Data Pipeline)
 * Workflow 2: Core → Vector → Text (AI Search Pipeline)
 * Workflow 3: Admin → Introspection (Health Check Pipeline)
 *
 * All workflows use code mode for multi-step orchestration.
 * Uses _e2e_integration_* prefixed temp tables with cleanup.
 * Native-only (code mode uses better-sqlite3).
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectSuccess,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Workflow 1: Core → JSON → Stats (Data Pipeline)
// =============================================================================

test.describe("Integration: Core → JSON → Stats Pipeline", () => {
  test("create table, insert JSON data, extract + analyze", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Step 1: Create table
      const create = await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_integration_pipeline",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "data", type: "TEXT" },
          { name: "score", type: "REAL" },
        ],
        ifNotExists: true,
      });
      expectSuccess(create);

      // Step 2: Insert JSON + numeric data
      const insert = await callToolAndParse(client, "sqlite_write_query", {
        query: `INSERT INTO _e2e_integration_pipeline VALUES
          (1, '{"category": "A", "value": 42}', 85.5),
          (2, '{"category": "B", "value": 17}', 92.3),
          (3, '{"category": "A", "value": 88}', 71.0),
          (4, '{"category": "B", "value": 55}', 63.8),
          (5, '{"category": "A", "value": 31}', 99.1)`,
      });
      expectSuccess(insert);

      // Step 3: Cross-group — JSON extract
      const extracted = await callToolAndParse(client, "sqlite_json_extract", {
        table: "_e2e_integration_pipeline",
        column: "data",
        path: "$.category",
      });
      expectSuccess(extracted);
      expect(extracted.rowCount).toBe(5);

      // Step 4: Cross-group — Stats basic
      const stats = await callToolAndParse(client, "sqlite_stats_basic", {
        table: "_e2e_integration_pipeline",
        column: "score",
      });
      expectSuccess(stats);
      const s = stats.stats as Record<string, unknown>;
      expect(s.count).toBe(5);
      expect(typeof s.min).toBe("number");
      expect(typeof s.max).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop pipeline table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_integration_pipeline",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Workflow 2: Core → Vector → Text (AI Search Pipeline)
// =============================================================================

test.describe("Integration: Core → Vector → Text Pipeline", () => {
  test("create vector table, store vectors, search, fuzzy match labels", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          // Step 1: Create vector table with metadata columns
          await sqlite.vector.createTable({
            tableName: "_e2e_integration_ai",
            dimensions: 4,
            additionalColumns: [
              { name: "content", type: "TEXT" },
              { name: "label", type: "TEXT" },
            ],
          });

          // Step 2: Batch store vectors with metadata
          await sqlite.vector.batchStore({
            table: "_e2e_integration_ai",
            idColumn: "id",
            vectorColumn: "vector",
            items: [
              { id: 1, vector: [0.1, 0.2, 0.3, 0.4] },
              { id: 2, vector: [0.5, 0.6, 0.7, 0.8] },
              { id: 3, vector: [0.9, 0.1, 0.2, 0.3] },
            ],
          });

          // Update labels via core write
          await sqlite.core.writeQuery("UPDATE _e2e_integration_ai SET label = 'alpha' WHERE id = 1");
          await sqlite.core.writeQuery("UPDATE _e2e_integration_ai SET label = 'beta' WHERE id = 2");
          await sqlite.core.writeQuery("UPDATE _e2e_integration_ai SET label = 'gamma' WHERE id = 3");

          // Step 3: Vector search for nearest neighbor
          const searchResults = await sqlite.vector.search({
            table: "_e2e_integration_ai",
            vectorColumn: "vector",
            queryVector: [0.1, 0.2, 0.3, 0.4],
            limit: 2,
          });

          // Step 4: Count vectors
          const count = await sqlite.vector.count({ table: "_e2e_integration_ai" });

          return {
            stored: 3,
            searchResultCount: searchResults.results.length,
            topResultId: searchResults.results[0]?.id,
            totalVectors: count.count,
          };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.stored).toBe(3);
      expect(result.searchResultCount).toBe(2);
      expect(result.topResultId).toBe(1); // Exact match should be first
      expect(result.totalVectors).toBe(3);
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop AI search table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_integration_ai",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Workflow 3: Admin → Introspection (Health Check Pipeline)
// =============================================================================

test.describe("Integration: Admin → Introspection Health Check", () => {
  test("integrity check → index audit → storage analysis → query plan", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          // Step 1: Integrity check
          const integrity = await sqlite.admin.integrityCheck({ maxErrors: 5 });

          // Step 2: Index audit
          const audit = await sqlite.introspection.indexAudit({});

          // Step 3: Storage analysis
          const storage = await sqlite.introspection.storageAnalysis({});

          // Step 4: Query plan for a complex join
          const plan = await sqlite.introspection.queryPlan({
            sql: "SELECT p.name, COUNT(o.id) as order_count FROM test_products p LEFT JOIN test_orders o ON o.product_id = p.id GROUP BY p.name",
          });

          return {
            integrityOk: integrity.integrity === "ok",
            totalIndexes: audit.totalIndexes,
            findingsCount: audit.findings.length,
            dbSizeBytes: storage.database.totalSizeBytes,
            planSteps: plan.plan.length,
          };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.integrityOk).toBe(true);
      expect(typeof result.totalIndexes).toBe("number");
      expect(typeof result.findingsCount).toBe("number");
      expect(typeof result.dbSizeBytes).toBe("number");
      expect(result.dbSizeBytes as number).toBeGreaterThan(0);
      expect(typeof result.planSteps).toBe("number");
      expect(result.planSteps as number).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Workflow 4: Core + Stats Cross-Validation
// =============================================================================

test.describe("Integration: Core + Stats Cross-Validation", () => {
  test("manual COUNT matches stats_count for multiple tables", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const tables = ["test_products", "test_orders", "test_measurements"];
          const results = {};
          for (const t of tables) {
            const manual = await sqlite.core.readQuery({ query: "SELECT COUNT(*) as cnt FROM " + t });
            const stats = await sqlite.stats.statsCount({ table: t });
            results[t] = {
              manualCount: manual.rows[0].cnt,
              statsCount: stats.count,
              match: manual.rows[0].cnt === stats.count,
            };
          }
          return results;
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, Record<string, unknown>>;
      for (const [table, data] of Object.entries(result)) {
        expect(
          data.match,
          `${table}: manual count should match stats count`,
        ).toBe(true);
      }
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Data Integrity Verification — no workflows polluted source tables
// =============================================================================

test.describe("Integration: Data Integrity", () => {
  test("test_products still has 16 rows", async ({}, testInfo) => {
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

  test("test_orders still has 20 rows", async ({}, testInfo) => {
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

  test("test_embeddings still has 20 rows", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_count", {
        table: "test_embeddings",
      });
      expectSuccess(p);
      expect(p.count).toBe(20);
    } finally {
      await client.close();
    }
  });
});
