/**
 * Payload Contract Tests: Introspection Tools
 *
 * Validates response shapes for all 8 introspection tools:
 * dependency_graph, topological_sort, cascade_simulator,
 * constraint_analysis, migration_risks, storage_analysis,
 * index_audit, query_plan.
 *
 * schema_snapshot is already covered in payloads-admin.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Introspection", () => {
  // =========================================================================
  // Graph tools
  // =========================================================================

  test("sqlite_dependency_graph returns { success, nodes[], edges[], stats }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_dependency_graph", {});

      expectSuccess(payload);
      expect(Array.isArray(payload.nodes)).toBe(true);

      const nodes = payload.nodes as Record<string, unknown>[];
      expect(nodes.length).toBeGreaterThan(0);
      // Each node should have a table name
      expect(typeof nodes[0].table).toBe("string");

      // Stats object
      expect(payload.stats).toBeDefined();
      const stats = payload.stats as Record<string, unknown>;
      expect(typeof stats.totalTables).toBe("number");
      expect(typeof stats.totalRelationships).toBe("number");
      expect(Array.isArray(stats.rootTables)).toBe(true);
      expect(Array.isArray(stats.leafTables)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_dependency_graph with nodesOnly", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_dependency_graph", {
        nodesOnly: true,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.nodes)).toBe(true);
      // edges should be omitted when nodesOnly is true
      expect(payload.edges).toBeUndefined();
    } finally {
      await client.close();
    }
  });

  test("sqlite_topological_sort returns { success, order[], direction }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_topological_sort", {});

      expectSuccess(payload);
      expect(Array.isArray(payload.order)).toBe(true);
      expect(payload.direction).toBe("create");

      const order = payload.order as Record<string, unknown>[];
      expect(order.length).toBeGreaterThan(0);
      // Each entry should have table, level, dependencies
      expect(typeof order[0].table).toBe("string");
      expect(typeof order[0].level).toBe("number");
      expect(Array.isArray(order[0].dependencies)).toBe(true);

      expect(typeof payload.hasCycles).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("sqlite_topological_sort with drop direction", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_topological_sort", {
        direction: "drop",
      });

      expectSuccess(payload);
      expect(payload.direction).toBe("drop");
      expect(Array.isArray(payload.order)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_cascade_simulator returns { success, affectedTables[], severity, stats }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // test_products has FK references from test_orders
      const payload = await callToolAndParse(client, "sqlite_cascade_simulator", {
        table: "test_products",
        operation: "DELETE",
      });

      expectSuccess(payload);
      expect(payload.sourceTable).toBe("test_products");
      expect(payload.operation).toBe("DELETE");
      expect(Array.isArray(payload.affectedTables)).toBe(true);
      expect(typeof payload.severity).toBe("string");
      expect(["low", "medium", "high", "critical"]).toContain(payload.severity);

      // Stats
      const stats = payload.stats as Record<string, unknown>;
      expect(typeof stats.totalTablesAffected).toBe("number");
      expect(typeof stats.cascadeActions).toBe("number");
      expect(typeof stats.blockingActions).toBe("number");
      expect(typeof stats.setNullActions).toBe("number");
      expect(typeof stats.maxDepth).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_cascade_simulator nonexistent table → error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_cascade_simulator", {
        table: "nonexistent_table_xyz",
      });

      expect(payload.success).toBe(false);
      expect(typeof payload.error).toBe("string");
    } finally {
      await client.close();
    }
  });

  // =========================================================================
  // Analysis tools
  // =========================================================================

  test("sqlite_constraint_analysis returns { success, findings[], summary }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_constraint_analysis", {});

      expectSuccess(payload);
      expect(Array.isArray(payload.findings)).toBe(true);

      const findings = payload.findings as Record<string, unknown>[];
      if (findings.length > 0) {
        // Each finding should have type, severity, table, description
        expect(typeof findings[0].type).toBe("string");
        expect(typeof findings[0].severity).toBe("string");
        expect(typeof findings[0].table).toBe("string");
        expect(typeof findings[0].description).toBe("string");
      }

      // Summary
      const summary = payload.summary as Record<string, unknown>;
      expect(typeof summary.totalFindings).toBe("number");
      expect(typeof summary.byType).toBe("object");
      expect(typeof summary.bySeverity).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("sqlite_constraint_analysis on specific table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_constraint_analysis", {
        table: "test_orders",
      });

      expectSuccess(payload);
      const findings = payload.findings as Record<string, unknown>[];
      // All findings should be for test_orders
      for (const f of findings) {
        expect(f.table).toBe("test_orders");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_migration_risks returns { success, risks[], summary }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_risks", {
        statements: [
          'ALTER TABLE test_products ADD COLUMN weight REAL',
          'DROP TABLE test_products',
        ],
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.risks)).toBe(true);

      const risks = payload.risks as Record<string, unknown>[];
      // DROP TABLE should produce at least one risk
      expect(risks.length).toBeGreaterThan(0);

      // Risk entry shape
      const risk = risks[0];
      expect(typeof risk.statement).toBe("string");
      expect(typeof risk.statementIndex).toBe("number");
      expect(typeof risk.riskLevel).toBe("string");
      expect(typeof risk.category).toBe("string");
      expect(typeof risk.description).toBe("string");

      // Summary
      const summary = payload.summary as Record<string, unknown>;
      expect(typeof summary.totalStatements).toBe("number");
      expect(summary.totalStatements).toBe(2);
      expect(typeof summary.totalRisks).toBe("number");
      expect(typeof summary.highestRisk).toBe("string");
    } finally {
      await client.close();
    }
  });

  // =========================================================================
  // Diagnostics tools
  // =========================================================================

  test("sqlite_storage_analysis returns { success, database, tables[], recommendations[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_storage_analysis", {});

      expectSuccess(payload);

      // Database metrics
      const db = payload.database as Record<string, unknown>;
      expect(typeof db.totalSizeBytes).toBe("number");
      expect(typeof db.pageSize).toBe("number");
      expect(typeof db.totalPages).toBe("number");
      expect(typeof db.freePages).toBe("number");
      expect(typeof db.fragmentationPct).toBe("number");
      expect(typeof db.journalMode).toBe("string");
      expect(typeof db.autoVacuum).toBe("string");

      // Tables breakdown
      expect(Array.isArray(payload.tables)).toBe(true);
      const tables = payload.tables as Record<string, unknown>[];
      if (tables.length > 0) {
        expect(typeof tables[0].name).toBe("string");
        expect(typeof tables[0].sizeBytes).toBe("number");
        expect(typeof tables[0].rowCount).toBe("number");
      }

      // Recommendations
      expect(Array.isArray(payload.recommendations)).toBe(true);
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

      const findings = payload.findings as Record<string, unknown>[];
      if (findings.length > 0) {
        // Finding shape
        expect(typeof findings[0].type).toBe("string");
        expect(typeof findings[0].severity).toBe("string");
        expect(typeof findings[0].table).toBe("string");
        expect(typeof findings[0].suggestion).toBe("string");
      }

      // Summary
      const summary = payload.summary as Record<string, unknown>;
      expect(typeof summary.redundant).toBe("number");
      expect(typeof summary.missingFk).toBe("number");
      expect(typeof summary.unindexedLarge).toBe("number");
      expect(typeof summary.total).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_index_audit on specific table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_index_audit", {
        table: "test_orders",
      });

      expectSuccess(payload);
      const findings = payload.findings as Record<string, unknown>[];
      // All findings should be for test_orders
      for (const f of findings) {
        expect(f.table).toBe("test_orders");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_query_plan returns { success, plan[], analysis, suggestions }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_query_plan", {
        sql: 'SELECT * FROM test_products WHERE price > 10',
      });

      expectSuccess(payload);
      expect(payload.sql).toBe("SELECT * FROM test_products WHERE price > 10");
      expect(Array.isArray(payload.plan)).toBe(true);

      const plan = payload.plan as Record<string, unknown>[];
      expect(plan.length).toBeGreaterThan(0);
      // Plan entry shape
      expect(typeof plan[0].id).toBe("number");
      expect(typeof plan[0].parent).toBe("number");
      expect(typeof plan[0].detail).toBe("string");

      // Analysis
      const analysis = payload.analysis as Record<string, unknown>;
      expect(Array.isArray(analysis.fullScans)).toBe(true);
      expect(Array.isArray(analysis.indexScans)).toBe(true);
      expect(Array.isArray(analysis.coveringIndexes)).toBe(true);
      expect(typeof analysis.estimatedEfficiency).toBe("string");
      expect(["good", "moderate", "poor"]).toContain(analysis.estimatedEfficiency);
    } finally {
      await client.close();
    }
  });

  test("sqlite_query_plan rejects non-SELECT queries", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_query_plan", {
        sql: "DELETE FROM test_products",
      });

      expect(payload.success).toBe(false);
      expect(typeof payload.error).toBe("string");
    } finally {
      await client.close();
    }
  });
});
