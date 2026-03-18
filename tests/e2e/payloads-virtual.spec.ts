/**
 * Payload Contract Tests: Virtual Tables, Views & Analysis
 *
 * Validates response shapes for:
 * list_virtual_tables, virtual_table_info, generate_series,
 * list_views, dbstat, vacuum.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectSuccess,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Virtual Tables & Views", () => {
  test("sqlite_list_virtual_tables returns { success, count, virtualTables[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(
        client,
        "sqlite_list_virtual_tables",
        {},
      );

      expectSuccess(payload);
      expect(typeof payload.count).toBe("number");
      expect(Array.isArray(payload.virtualTables)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_generate_series returns { success, count, values[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_generate_series", {
        start: 1,
        stop: 5,
        step: 1,
      });

      expectSuccess(payload);
      expect(payload.count).toBe(5);
      expect(Array.isArray(payload.values)).toBe(true);
      expect((payload.values as number[]).length).toBe(5);
    } finally {
      await client.close();
    }
  });

  test("sqlite_dbstat returns { success } with stats or fallback", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_dbstat", {
        summarize: true,
      });

      expectSuccess(payload);
      // Either summarized mode or fallback mode
      if (payload.summarized) {
        expect(typeof payload.objectCount).toBe("number");
        expect(Array.isArray(payload.objects)).toBe(true);
      } else {
        // Fallback: basic stats
        expect(typeof payload.pageCount).toBe("number");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_vacuum returns { success, message, durationMs }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_vacuum", {});

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(typeof payload.durationMs).toBe("number");
    } finally {
      await client.close();
    }
  });
});
