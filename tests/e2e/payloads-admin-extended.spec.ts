/**
 * Payload Contract Tests: Admin Extended
 *
 * Validates response shapes for admin tools not covered in payloads-admin.spec.ts:
 * analyze, optimize, pragma_compile_options, pragma_optimize,
 * pragma_settings, pragma_table_info, index_stats, append_insight.
 *
 * Write-heavy tools (backup, restore, verify_backup) are platform-dependent
 * and tested conditionally via WASM limitations.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Admin Extended", () => {
  test("sqlite_analyze returns { success, message, durationMs }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_analyze", {
        table: "test_products",
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(typeof payload.durationMs).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_optimize returns { success, message, operations[], durationMs }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_optimize", {
        analyze: true,
        reindex: false,
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(Array.isArray(payload.operations)).toBe(true);
      expect(typeof payload.durationMs).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_pragma_compile_options returns { success, options[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_pragma_compile_options", {});

      expectSuccess(payload);
      expect(Array.isArray(payload.options)).toBe(true);
      expect((payload.options as string[]).length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_pragma_compile_options with filter", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_pragma_compile_options", {
        filter: "THREAD",
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.options)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_pragma_optimize returns { success, message, durationMs }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_pragma_optimize", {});

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(typeof payload.durationMs).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_pragma_settings returns { success, pragma, value }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_pragma_settings", {
        pragma: "journal_mode",
      });

      expectSuccess(payload);
      expect(payload.pragma).toBe("journal_mode");
      expect(payload.value).toBeDefined();
    } finally {
      await client.close();
    }
  });

  test("sqlite_pragma_table_info returns { success, table, columns[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_pragma_table_info", {
        table: "test_products",
      });

      expectSuccess(payload);
      expect(payload.table).toBe("test_products");
      expect(Array.isArray(payload.columns)).toBe(true);

      const cols = payload.columns as Record<string, unknown>[];
      expect(cols.length).toBeGreaterThan(0);
      expect(typeof cols[0].name).toBe("string");
      expect(typeof cols[0].type).toBe("string");
      expect(typeof cols[0].notNull).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("sqlite_index_stats returns { success, indexes[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_index_stats", {
        table: "test_products",
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.indexes)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_append_insight returns { success, message, insightCount }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_append_insight", {
        insight: "Test insight from payload contract test",
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(typeof payload.insightCount).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_backup returns success or WASM limitation", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_backup", {
        targetPath: "/tmp/test-backup.db",
      });

      // In native mode: success with a path
      // In WASM mode: success: false with wasmLimitation flag
      expect(typeof payload.success).toBe("boolean");
      if (payload.success) {
        expect(typeof payload.path).toBe("string");
      }
    } finally {
      await client.close();
    }
  });
});
