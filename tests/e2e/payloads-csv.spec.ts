/**
 * Payload Contract Tests: CSV Tools
 *
 * Validates response shapes for the 2 CSV virtual table tools:
 * create_csv_table, analyze_csv_schema.
 *
 * These tools require the CSV extension to be available.
 * If the CSV extension is not available, tests are skipped gracefully.
 *
 * Uses test-server/fixtures/sample.csv as the fixture file.
 */

import * as path from "node:path";
import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectSuccess,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

// Resolve absolute path to the CSV fixture
const CSV_PATH = path.resolve("test-server/fixtures/sample.csv");

test.describe("Payload Contracts: CSV Tools", () => {
  let csvAvailable = true;

  test("sqlite_create_csv_table returns { success, message, sql, columns } or CSV unavailable", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Clean up from prior runs
      await callToolAndParse(client, "sqlite_drop_virtual_table", {
        tableName: "_e2e_csv_test",
      });

      const payload = await callToolAndParse(
        client,
        "sqlite_create_csv_table",
        {
          tableName: "_e2e_csv_test",
          filePath: CSV_PATH,
        },
      );

      if (!payload.success) {
        // CSV extension not available — skip remaining tests
        const msg = payload.message as string;
        if (msg && (msg.includes("not available") || msg.includes("CSV"))) {
          csvAvailable = false;
          test.skip();
          return;
        }
      }

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(typeof payload.sql).toBe("string");
      expect(Array.isArray(payload.columns)).toBe(true);

      const columns = payload.columns as string[];
      expect(columns.length).toBeGreaterThan(0);
      // CSV fixture has: id, name, category, price, in_stock
      expect(columns).toContain("id");
      expect(columns).toContain("name");
    } finally {
      await client.close();
    }
  });

  test("query the CSV virtual table", async ({}, testInfo) => {
    if (!csvAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_read_query", {
        query: 'SELECT * FROM "_e2e_csv_test"',
      });

      expectSuccess(payload);
      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(5); // 5 data rows in fixture
    } finally {
      await client.close();
    }
  });

  test("sqlite_analyze_csv_schema returns { success, columns[] }", async ({}, testInfo) => {
    if (!csvAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(
        client,
        "sqlite_analyze_csv_schema",
        {
          filePath: CSV_PATH,
        },
      );

      expectSuccess(payload);
      expect(Array.isArray(payload.columns)).toBe(true);
      expect(typeof payload.hasHeader).toBe("boolean");
      expect(typeof payload.rowCount).toBe("number");

      const columns = payload.columns as Record<string, unknown>[];
      expect(columns.length).toBeGreaterThan(0);
      // Each column should have name, inferredType, nullCount, sampleValues
      expect(typeof columns[0].name).toBe("string");
      expect(typeof columns[0].inferredType).toBe("string");
      expect(typeof columns[0].nullCount).toBe("number");
      expect(Array.isArray(columns[0].sampleValues)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop CSV virtual table", async ({}, testInfo) => {
    if (!csvAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(
        client,
        "sqlite_drop_virtual_table",
        {
          tableName: "_e2e_csv_test",
        },
      );
      expectSuccess(payload);
    } finally {
      await client.close();
    }
  });

  test("sqlite_create_csv_table with relative path → error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(
        client,
        "sqlite_create_csv_table",
        {
          tableName: "_e2e_csv_relpath",
          filePath: "test-server/fixtures/sample.csv",
        },
      );

      // Should fail because relative paths are not supported
      expect(payload.success).toBe(false);
    } finally {
      await client.close();
    }
  });
});
