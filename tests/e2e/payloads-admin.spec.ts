/**
 * Payload Contract Tests: Admin + Introspection + Migration
 *
 * Validates response shapes for representative tools across
 * admin, introspection, and migration groups.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Admin + Introspection + Migration", () => {
  test("sqlite_integrity_check returns { success, integrity }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_integrity_check");

      expectSuccess(payload);
      expect(payload.integrity).toBe("ok");
    } finally {
      await client.close();
    }
  });

  test("sqlite_list_views returns { success, views[], count }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_list_views");

      expectSuccess(payload);
      expect(typeof payload.count).toBe("number");
      expect(Array.isArray(payload.views)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_pragma_database_list returns { success, databases[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_pragma_database_list");

      expectSuccess(payload);
      expect(Array.isArray(payload.databases)).toBe(true);

      const dbs = payload.databases as Record<string, unknown>[];
      expect(dbs.length).toBeGreaterThan(0);
      // Main database should be present
      const main = dbs.find((d) => d.name === "main");
      expect(main).toBeDefined();
    } finally {
      await client.close();
    }
  });

  test("sqlite_schema_snapshot returns { success, snapshot, stats }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_schema_snapshot");

      expectSuccess(payload);

      // Data is wrapped in snapshot object
      const snapshot = payload.snapshot as Record<string, unknown>;
      expect(Array.isArray(snapshot.tables)).toBe(true);
      expect(Array.isArray(snapshot.views)).toBe(true);
      expect(Array.isArray(snapshot.indexes)).toBe(true);

      // Stats summary
      const stats = payload.stats as Record<string, unknown>;
      expect(typeof stats.tables).toBe("number");
      expect((stats.tables as number)).toBeGreaterThan(0);

      // generatedAt timestamp
      expect(typeof payload.generatedAt).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_dependency_graph returns { success, nodes[], edges[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_dependency_graph");

      expectSuccess(payload);
      expect(Array.isArray(payload.nodes)).toBe(true);
      expect(Array.isArray(payload.edges)).toBe(true);

      // Should have nodes for tables
      const nodes = payload.nodes as Record<string, unknown>[];
      expect(nodes.length).toBeGreaterThan(0);
      expect(typeof nodes[0].table).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_migration_status returns { success, initialized }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_status");

      expectSuccess(payload);
      expect(typeof payload.initialized).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("sqlite_storage_analysis returns { success, database, tables[], recommendations[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_storage_analysis");

      expectSuccess(payload);

      // Database metrics are nested under database object
      const db = payload.database as Record<string, unknown>;
      expect(typeof db.pageSize).toBe("number");
      expect(typeof db.totalPages).toBe("number");
      expect(typeof db.totalSizeBytes).toBe("number");
      expect(typeof db.fragmentationPct).toBe("number");
      expect(typeof db.journalMode).toBe("string");

      // Recommendations array
      expect(Array.isArray(payload.recommendations)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_topological_sort returns { success, order[], direction }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_topological_sort", {
        direction: "create",
      });

      expectSuccess(payload);
      expect(payload.direction).toBe("create");
      expect(Array.isArray(payload.order)).toBe(true);
      expect(typeof payload.hasCycles).toBe("boolean");

      const order = payload.order as Record<string, unknown>[];
      if (order.length > 0) {
        expect(typeof order[0].table).toBe("string");
        expect(typeof order[0].level).toBe("number");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_cascade_simulator returns { success, affected[], severity }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_cascade_simulator", {
        table: "test_orders",
        operation: "DELETE",
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.affectedTables)).toBe(true);
      expect(typeof payload.severity).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_query_plan returns { success, plan[], analysis }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_query_plan", {
        sql: "SELECT * FROM test_products WHERE category = 'electronics'",
      });

      expectSuccess(payload);
      expect(typeof payload.sql).toBe("string");
      expect(Array.isArray(payload.plan)).toBe(true);

      const analysis = payload.analysis as Record<string, unknown>;
      expect(Array.isArray(analysis.fullScans)).toBe(true);
      expect(typeof analysis.estimatedEfficiency).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_index_audit returns { success, totalIndexes, findings[], summary }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_index_audit", {});

      expectSuccess(payload);
      expect(typeof payload.totalIndexes).toBe("number");
      expect(Array.isArray(payload.findings)).toBe(true);

      const summary = payload.summary as Record<string, unknown>;
      expect(typeof summary.redundant).toBe("number");
      expect(typeof summary.total).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_constraint_analysis returns { success }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_constraint_analysis", {
        table: "test_products",
      });

      expectSuccess(payload);
    } finally {
      await client.close();
    }
  });

  test("sqlite_migration_risks returns { success, risks[], summary }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_risks", {
        statements: [
          "ALTER TABLE test_orders ADD COLUMN notes TEXT",
          "DROP TABLE IF EXISTS _temp_cleanup",
        ],
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.risks)).toBe(true);

      const summary = payload.summary as Record<string, unknown>;
      expect(typeof summary.totalStatements).toBe("number");
      expect(typeof summary.totalRisks).toBe("number");
      expect(typeof summary.highestRisk).toBe("string");
    } finally {
      await client.close();
    }
  });
});
