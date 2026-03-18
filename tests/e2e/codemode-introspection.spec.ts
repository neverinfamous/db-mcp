/**
 * Code Mode: Introspection Optional Parameters
 *
 * Tests code-mode-only parameters for introspection tools that are
 * NOT exposed in MCP tool definitions but ARE accessible via
 * sqlite.introspection.* API:
 *
 * - schemaSnapshot({ sections, compact })
 * - constraintAnalysis({ checks, table })
 * - storageAnalysis({ includeTableDetails, limit })
 * - indexAudit({ table })
 * - topologicalSort({ direction })
 *
 * These params shape/filter output and are high-value regression targets.
 * Native-only (code mode uses better-sqlite3).
 *
 * Schema shapes (from output-schemas/introspection.ts):
 * - schemaSnapshot → { success, snapshot: { tables[], views[], indexes[], triggers[] }, stats: {...} }
 * - constraintAnalysis → { success, findings[], summary: { byType, bySeverity } }
 * - storageAnalysis → { success, database: { totalSizeBytes, ... }, tables[] }
 * - indexAudit → { success, totalIndexes, findings[] }
 * - topologicalSort → { success, order: [{ table, level, dependencies[] }], direction }
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
// Schema Snapshot: sections + compact params
// =============================================================================

test.describe("Code Mode Introspection: schemaSnapshot", () => {
  test("sections: ['tables'] → snapshot has tables", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.schemaSnapshot({ sections: ["tables"] });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const snapshot = result.snapshot as Record<string, unknown>;
      expect(snapshot).toBeDefined();
      const tables = snapshot.tables as unknown[];
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sections: ['indexes'] → snapshot has indexes", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.schemaSnapshot({ sections: ["indexes"] });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const snapshot = result.snapshot as Record<string, unknown>;
      expect(snapshot).toBeDefined();
      const indexes = snapshot.indexes as unknown[];
      expect(Array.isArray(indexes)).toBe(true);
      expect(indexes.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sections: ['tables', 'indexes'] → both present in snapshot", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.schemaSnapshot({ sections: ["tables", "indexes"] });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const snapshot = result.snapshot as Record<string, unknown>;
      expect((snapshot.tables as unknown[]).length).toBeGreaterThan(0);
      expect((snapshot.indexes as unknown[]).length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("compact: true → column arrays absent per table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.schemaSnapshot({ compact: true });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const snapshot = result.snapshot as Record<string, unknown>;
      const tables = snapshot.tables as Record<string, unknown>[];
      expect(tables.length).toBeGreaterThan(0);
      // In compact mode, tables should NOT have column details
      const first = tables[0];
      const cols = first.columns as unknown[] | undefined;
      if (cols !== undefined) {
        expect(cols.length).toBe(0);
      }
    } finally {
      await client.close();
    }
  });

  test("compact: false → column details present", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.schemaSnapshot({ compact: false });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const snapshot = result.snapshot as Record<string, unknown>;
      const tables = snapshot.tables as Record<string, unknown>[];
      expect(tables.length).toBeGreaterThan(0);
      const first = tables[0];
      const cols = first.columns as Record<string, unknown>[];
      expect(Array.isArray(cols)).toBe(true);
      expect(cols.length).toBeGreaterThan(0);
      // Column objects should have name and type
      expect(typeof cols[0].name).toBe("string");
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Constraint Analysis: checks + table params
// =============================================================================

test.describe("Code Mode Introspection: constraintAnalysis", () => {
  test("table filter → only findings for specified table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.constraintAnalysis({ table: "test_users" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const findings = result.findings as Record<string, unknown>[];
      expect(Array.isArray(findings)).toBe(true);
      // All findings should only reference test_users
      for (const f of findings) {
        expect(f.table).toBe("test_users");
      }
    } finally {
      await client.close();
    }
  });

  test("checks filter → only specified check type", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.constraintAnalysis({ checks: ["unindexed_fk"] });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const findings = result.findings as Record<string, unknown>[];
      expect(Array.isArray(findings)).toBe(true);
      // All findings should be of the requested check type
      for (const f of findings) {
        expect(f.type).toBe("unindexed_fk");
      }
    } finally {
      await client.close();
    }
  });

  test("full analysis → summary has byType and bySeverity", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.constraintAnalysis({});`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const summary = result.summary as Record<string, unknown>;
      expect(summary).toHaveProperty("byType");
      expect(summary).toHaveProperty("bySeverity");
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Storage Analysis: includeTableDetails + limit params
// =============================================================================

test.describe("Code Mode Introspection: storageAnalysis", () => {
  test("includeTableDetails: false → tables absent", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.storageAnalysis({ includeTableDetails: false });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      // Database-level metrics should still be present
      expect(result).toHaveProperty("database");
      const db = result.database as Record<string, unknown>;
      expect(typeof db.totalSizeBytes).toBe("number");
      // Tables should be absent or empty
      if (result.tables !== undefined) {
        expect((result.tables as unknown[]).length).toBe(0);
      }
    } finally {
      await client.close();
    }
  });

  test("limit: 3 → at most 3 tables returned", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.storageAnalysis({ limit: 3 });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const tables = result.tables as unknown[];
      if (tables) {
        expect(tables.length).toBeLessThanOrEqual(3);
      }
    } finally {
      await client.close();
    }
  });

  test("database arithmetic: totalSizeBytes ≈ pageSize × totalPages", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.storageAnalysis({});`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const db = result.database as Record<string, unknown>;
      const totalSize = db.totalSizeBytes as number;
      const pageSize = db.pageSize as number;
      const totalPages = db.totalPages as number;
      expect(typeof totalSize).toBe("number");
      expect(typeof pageSize).toBe("number");
      expect(typeof totalPages).toBe("number");
      // totalSizeBytes should equal pageSize * totalPages
      expect(totalSize).toBe(pageSize * totalPages);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Index Audit: table filter
// =============================================================================

test.describe("Code Mode Introspection: indexAudit", () => {
  test("table filter → only findings for specified table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.indexAudit({ table: "test_products" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const findings = result.findings as Record<string, unknown>[];
      expect(Array.isArray(findings)).toBe(true);
      // All findings should reference test_products
      for (const f of findings) {
        expect(f.table).toBe("test_products");
      }
    } finally {
      await client.close();
    }
  });

  test("full audit → returns totalIndexes and findings", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.indexAudit({});`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.totalIndexes).toBe("number");
      const findings = result.findings as Record<string, unknown>[];
      expect(Array.isArray(findings)).toBe(true);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Topological Sort: direction param
// =============================================================================

test.describe("Code Mode Introspection: topologicalSort", () => {
  test("direction: 'create' → dependencies before dependents", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.topologicalSort({ direction: "create" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      // order is an array of {table, level, dependencies[]}
      const order = result.order as { table: string; level: number }[];
      expect(Array.isArray(order)).toBe(true);
      const tableNames = order.map((o) => o.table);
      // test_products should appear BEFORE test_orders (FK dependency)
      const productsIdx = tableNames.indexOf("test_products");
      const ordersIdx = tableNames.indexOf("test_orders");
      if (productsIdx >= 0 && ordersIdx >= 0) {
        expect(productsIdx).toBeLessThan(ordersIdx);
      }
    } finally {
      await client.close();
    }
  });

  test("direction: 'drop' → dependents before dependencies", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.topologicalSort({ direction: "drop" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const order = result.order as { table: string; level: number }[];
      expect(Array.isArray(order)).toBe(true);
      const tableNames = order.map((o) => o.table);
      // test_orders should appear BEFORE test_products (reverse of create)
      const productsIdx = tableNames.indexOf("test_products");
      const ordersIdx = tableNames.indexOf("test_orders");
      if (productsIdx >= 0 && ordersIdx >= 0) {
        expect(ordersIdx).toBeLessThan(productsIdx);
      }
    } finally {
      await client.close();
    }
  });

  test("both directions list the same set of tables", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const create = await sqlite.introspection.topologicalSort({ direction: "create" });
          const drop = await sqlite.introspection.topologicalSort({ direction: "drop" });
          return {
            createTables: create.order.map(o => o.table).sort(),
            dropTables: drop.order.map(o => o.table).sort(),
          };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.createTables).toEqual(result.dropTables);
    } finally {
      await client.close();
    }
  });
});
