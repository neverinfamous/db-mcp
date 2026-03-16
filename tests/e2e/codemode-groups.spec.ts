/**
 * Code Mode Group Tests
 *
 * Exercises each tool group through the code mode sqlite.* API.
 * Validates that code mode provides equivalent access to all tool groups.
 *
 * Replaces test-tools-codemode.md Phases 3-8.
 * Native-only (code mode uses better-sqlite3).
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Core Group via Code Mode
// =============================================================================

test.describe("Code Mode Groups: Core", () => {
  test("readQuery returns rows", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.core.readQuery({ query: "SELECT COUNT(*) as cnt FROM test_products" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const rows = result.rows as Record<string, unknown>[];
      expect(rows[0].cnt).toBe(16);
    } finally {
      await client.close();
    }
  });

  test("positional args work", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.core.readQuery("SELECT name FROM test_products LIMIT 2");`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect((result.rows as unknown[]).length).toBe(2);
    } finally {
      await client.close();
    }
  });

  test("listTables", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "return await sqlite.core.listTables();",
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.tables)).toBe(true);
      expect((result.tables as unknown[]).length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("describeTable", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.core.describeTable("test_products");`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.columns)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("getIndexes", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "return await sqlite.core.getIndexes();",
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.indexes)).toBe(true);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// JSON Group via Code Mode
// =============================================================================

test.describe("Code Mode Groups: JSON", () => {
  test("json extract", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.json.extract({ table: "test_jsonb_docs", column: "doc", path: "$.title" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.values)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("json query with filter", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.json.query({ table: "test_jsonb_docs", column: "doc", filterPaths: { "$.type": "article" } });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect((result.rowCount as number)).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("json analyzeSchema", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.json.analyzeSchema({ table: "test_jsonb_docs", column: "doc" });`,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });

  test("json valid", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.json.valid({ json: '{"key": "value"}' });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.valid).toBe(true);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Stats Group via Code Mode
// =============================================================================

test.describe("Code Mode Groups: Stats", () => {
  test("statsBasic", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.statsBasic({ table: "test_measurements", column: "temperature" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result).toHaveProperty("stats");
    } finally {
      await client.close();
    }
  });

  test("statsHistogram", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.statsHistogram({ table: "test_measurements", column: "temperature", buckets: 5 });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.buckets)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("statsCorrelation", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.statsCorrelation({ table: "test_measurements", column1: "temperature", column2: "humidity" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.correlation).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("statsTopN", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.statsTopN({ table: "test_products", column: "price", n: 5 });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Text Group via Code Mode
// =============================================================================

test.describe("Code Mode Groups: Text", () => {
  test("regexMatch", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.text.regexMatch({ table: "test_users", column: "email", pattern: "@example\\\\.com$" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.matches)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("fuzzyMatch", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.text.fuzzyMatch({ table: "test_products", column: "name", search: "laptop", maxDistance: 2 });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.matches)).toBe(true);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Vector Group via Code Mode
// =============================================================================

test.describe("Code Mode Groups: Vector", () => {
  test("vector search", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const first = await sqlite.core.readQuery("SELECT embedding FROM test_embeddings LIMIT 1");
          const vec = JSON.parse(first.rows[0].embedding);
          return await sqlite.vector.search({ table: "test_embeddings", vectorColumn: "embedding", queryVector: vec, limit: 3 });
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.results)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("vector stats", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.vector.stats({ table: "test_embeddings", vectorColumn: "embedding" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.dimensions).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("vector count", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.vector.count({ table: "test_embeddings" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.count).toBe("number");
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Geo, Introspection, Admin, Migration via Code Mode
// =============================================================================

test.describe("Code Mode Groups: Geo + Introspection + Admin + Migration", () => {
  test("geo distance", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.geo.distance({ lat1: 40.7128, lon1: -74.006, lat2: 34.0522, lon2: -118.2437 });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.distance).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("introspection dependencyGraph", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "return await sqlite.introspection.dependencyGraph();",
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.nodes)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("introspection schemaSnapshot", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.introspection.schemaSnapshot({ sections: ["tables"] });`,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });

  test("admin integrityCheck", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.admin.integrityCheck({ maxErrors: 5 });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.integrity).toBe("ok");
    } finally {
      await client.close();
    }
  });

  test("admin pragmaSettings", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.admin.pragmaSettings({ pragma: "journal_mode" });`,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });

  test("migration init + status", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          await sqlite.migration.migrationInit();
          return await sqlite.migration.migrationStatus();
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.initialized).toBe("boolean");
    } finally {
      await client.close();
    }
  });
});
