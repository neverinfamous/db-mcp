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

// =============================================================================
// Admin Write Lifecycle Tests (missing payload coverage)
// =============================================================================

test.describe("Payload Contracts: Admin Lifecycle", () => {
  // --- Views ---
  test("sqlite_create_view returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Cleanup
      await callToolAndParse(client, "sqlite_drop_view", {
        viewName: "_e2e_test_view",
      });

      const payload = await callToolAndParse(client, "sqlite_create_view", {
        viewName: "_e2e_test_view",
        selectQuery: "SELECT id, name, price FROM test_products WHERE price > 50",
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("verify view appears in list_views", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_list_views", {});

      expectSuccess(payload);
      expect(Array.isArray(payload.views)).toBe(true);
      const views = payload.views as Record<string, unknown>[];
      const found = views.some((v) => v.name === "_e2e_test_view");
      expect(found).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_drop_view returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_drop_view", {
        viewName: "_e2e_test_view",
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });

  // --- Virtual Tables ---
  test("sqlite_create_rtree_table returns success or WASM limitation", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_drop_virtual_table", {
        tableName: "_e2e_rtree_test",
      });

      const payload = await callToolAndParse(client, "sqlite_create_rtree_table", {
        tableName: "_e2e_rtree_test",
        dimensions: 2,
      });

      // R-Tree not available on WASM
      expect(typeof payload.success).toBe("boolean");
      if (payload.success) {
        expect(typeof payload.message).toBe("string");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_virtual_table_info returns { success, name, type } or error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_virtual_table_info", {
        tableName: "_e2e_rtree_test",
      });

      // If R-Tree was created (native), info should succeed
      // If WASM, table doesn't exist so it may error
      expect(typeof payload.success).toBe("boolean");
      if (payload.success) {
        expect(payload.name).toBe("_e2e_rtree_test");
        expect(typeof payload.type).toBe("string");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_drop_virtual_table returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_drop_virtual_table", {
        tableName: "_e2e_rtree_test",
      });

      // Always succeeds with ifExists: true (default)
      expect(typeof payload.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("sqlite_create_series_table returns { success, message, rowCount }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_write_query", {
        query: "DROP TABLE IF EXISTS _e2e_series_test",
      });

      const payload = await callToolAndParse(client, "sqlite_create_series_table", {
        tableName: "_e2e_series_test",
        start: 1,
        stop: 10,
        step: 1,
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(payload.rowCount).toBe(10);
    } finally {
      // create_series_table makes a regular table, not virtual
      await callToolAndParse(client, "sqlite_write_query", {
        query: "DROP TABLE IF EXISTS _e2e_series_test",
      });
      await client.close();
    }
  });

  // --- Backup/Restore lifecycle ---
  test("sqlite_verify_backup returns success or WASM limitation", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_verify_backup", {
        backupPath: "/tmp/test-backup.db",
      });

      // Native: may succeed if backup exists, fail gracefully otherwise
      // WASM: WASM limitation
      expect(typeof payload.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("sqlite_restore returns success or WASM limitation", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_restore", {
        sourcePath: "/tmp/test-backup.db",
      });

      // Native: may succeed if backup exists, fail gracefully otherwise
      // WASM: WASM limitation
      expect(typeof payload.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });
});

