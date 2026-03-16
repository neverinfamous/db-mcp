/**
 * Payload Contract Tests: FTS5 Full-Text Search
 *
 * Validates response shapes for all 4 FTS tools:
 * fts_create, fts_search, fts_rebuild, fts_match_info.
 *
 * All FTS tools are NATIVE ONLY.
 * Uses test_articles_fts (populated from test_articles, 8 rows).
 *
 * Tests run in serial: search pre-existing → create custom FTS → search → match_info → rebuild → cleanup.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: FTS5", () => {
  // =========================================================================
  // Use the pre-existing test_articles_fts for search and match_info
  // =========================================================================

  test("sqlite_fts_search returns { success, results[], rowCount }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Use wildcard query to reliably validate response shape
      // (avoids dependency on FTS index freshness)
      const payload = await callToolAndParse(client, "sqlite_fts_search", {
        table: "test_articles_fts",
        query: "*",
        limit: 5,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.results)).toBe(true);
      expect(typeof payload.rowCount).toBe("number");

      const results = payload.results as Record<string, unknown>[];
      expect(results.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_fts_search with phrase query", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_fts_search", {
        table: "test_articles_fts",
        query: '"full-text search"',
        limit: 5,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.results)).toBe(true);
      expect(typeof payload.rowCount).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_fts_match_info returns { success, results[], rowCount } with bm25 ranking", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_fts_match_info", {
        table: "test_articles_fts",
        query: "database performance",
        limit: 5,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.results)).toBe(true);
      expect(typeof payload.rowCount).toBe("number");

      const results = payload.results as Record<string, unknown>[];
      if (results.length > 0) {
        // bm25 results should have a score field
        expect(results[0]).toHaveProperty("score");
      }
    } finally {
      await client.close();
    }
  });

  // =========================================================================
  // FTS lifecycle: create → search → rebuild → drop
  // =========================================================================

  test("sqlite_fts_create returns { success, message, tableName }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // First drop if exists from prior run
      await callToolAndParse(client, "sqlite_drop_virtual_table", {
        tableName: "_e2e_fts_test",
      });

      const payload = await callToolAndParse(client, "sqlite_fts_create", {
        tableName: "_e2e_fts_test",
        sourceTable: "test_products",
        columns: ["name", "description"],
        createTriggers: false, // Avoid orphaned triggers on test_products
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(payload.tableName).toBe("_e2e_fts_test");
    } finally {
      await client.close();
    }
  });

  test("search the custom FTS table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_fts_search", {
        table: "_e2e_fts_test",
        query: "laptop",
        limit: 5,
      });

      expectSuccess(payload);
      const results = payload.results as Record<string, unknown>[];
      expect(results.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_fts_rebuild returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_fts_rebuild", {
        table: "_e2e_fts_test",
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop custom FTS table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_drop_virtual_table", {
        tableName: "_e2e_fts_test",
      });
      expectSuccess(payload);
    } finally {
      await client.close();
    }
  });
});
