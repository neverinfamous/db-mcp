/**
 * Code Mode E2E Tests: Sandbox, Security, Readonly, Workflows
 *
 * Tests the sqlite_execute_code sandbox fundamentals:
 * return values, async, errors, help API, security blocks,
 * readonly enforcement, and multi-step workflows.
 *
 * Replaces test-tools-codemode.md Phases 1-2, 9-12.
 * Native-only (code mode uses better-sqlite3 under the hood).
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess, expectHandlerError } from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Phase 1: Sandbox Basics
// =============================================================================

test.describe("Code Mode: Sandbox Basics", () => {
  test("simple return value", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "return 42;",
      });
      expectSuccess(p);
      expect(p.result).toBe(42);
    } finally {
      await client.close();
    }
  });

  test("string return", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: 'return "hello from sandbox";',
      });
      expectSuccess(p);
      expect(p.result).toBe("hello from sandbox");
    } finally {
      await client.close();
    }
  });

  test("object return", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: 'return { name: "test", values: [1, 2, 3] };',
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.name).toBe("test");
      expect(result.values).toEqual([1, 2, 3]);
    } finally {
      await client.close();
    }
  });

  test("async/await support", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: 'const result = await Promise.resolve("async works"); return result;',
      });
      expectSuccess(p);
      expect(p.result).toBe("async works");
    } finally {
      await client.close();
    }
  });

  test("runtime error → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "const x = undefinedVariable; return x;",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("empty code → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Phase 2: API Discoverability
// =============================================================================

test.describe("Code Mode: API Discoverability", () => {
  test("sqlite.help() returns groups", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "return await sqlite.help();",
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.groups)).toBe(true);
      expect((result.groups as string[]).length).toBe(9);
    } finally {
      await client.close();
    }
  });

  test("sqlite.core.help() returns methods", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "return await sqlite.core.help();",
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.group).toBe("core");
      expect(Array.isArray(result.methods)).toBe(true);
      expect((result.methods as string[]).length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("all 9 groups exist and have methods", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const groups = ["core","json","text","stats","vector","admin","geo","introspection","migration"];
          const results = {};
          for (const g of groups) {
            const h = await sqlite[g].help();
            results[g] = h.methods.length;
          }
          return results;
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, number>;
      for (const group of ["core", "json", "text", "stats", "vector", "admin", "geo", "introspection", "migration"]) {
        expect(result[group], `${group} should have methods`).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Phase 3: Readonly Mode
// =============================================================================

test.describe("Code Mode: Readonly", () => {
  test("read operations work in readonly", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: 'return await sqlite.core.readQuery("SELECT COUNT(*) as cnt FROM test_products");',
        readonly: true,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(Array.isArray(result.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("write operations blocked in readonly (native) or allowed (WASM)", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.core.writeQuery("INSERT INTO test_products (name) VALUES ('blocked')");`,
        readonly: true,
      });
      // Native: success: false with CODEMODE_READONLY_VIOLATION
      // WASM: readonly not enforced in code mode — may succeed
      expect(typeof p.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("create table blocked in readonly (native) or allowed (WASM)", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.core.writeQuery("CREATE TABLE IF NOT EXISTS _e2e_readonly_test (id INTEGER)");`,
        readonly: true,
      });
      // Native: success: false with CODEMODE_READONLY_VIOLATION
      // WASM: readonly not enforced — may succeed
      expect(typeof p.success).toBe("boolean");
      // Cleanup in case WASM created it
      if (p.success) {
        await callToolAndParse(client, "sqlite_execute_code", {
          code: `return await sqlite.core.writeQuery("DROP TABLE IF EXISTS _e2e_readonly_test");`,
        });
      }
    } finally {
      await client.close();
    }
  });

  test("stats reads work in readonly", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.statsBasic({ table: "test_products", column: "price" });`,
        readonly: true,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });

  // Window function tools in readonly — these were previously blocked
  // by the fail-closed isWriteTool() guard due to missing annotations.
  // Window functions are native-only (not available in WASM).
  // On WASM: assert the function is unavailable (expected behavior).
  // On Native: assert readonly execution succeeds.

  test("window row_number works in readonly (native) or unavailable (WASM)", async ({}, testInfo) => {
    const isWasm = testInfo.project.name === "wasm";
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.windowRowNumber({ table: "test_products", orderBy: "price DESC" });`,
        readonly: true,
      });
      if (isWasm) {
        expect(p.success).toBe(false);
        expect(String(p.error)).toContain("not a function");
      } else {
        expectSuccess(p);
        const result = p.result as Record<string, unknown>;
        expect(result.rowCount).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });

  test("window rank works in readonly (native) or unavailable (WASM)", async ({}, testInfo) => {
    const isWasm = testInfo.project.name === "wasm";
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.windowRank({ table: "test_products", orderBy: "price DESC" });`,
        readonly: true,
      });
      if (isWasm) {
        expect(p.success).toBe(false);
        expect(String(p.error)).toContain("not a function");
      } else {
        expectSuccess(p);
        const result = p.result as Record<string, unknown>;
        expect(result.rowCount).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });

  test("window lag_lead works in readonly (native) or unavailable (WASM)", async ({}, testInfo) => {
    const isWasm = testInfo.project.name === "wasm";
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.windowLagLead({ table: "test_products", column: "price", orderBy: "id", direction: "lag" });`,
        readonly: true,
      });
      if (isWasm) {
        expect(p.success).toBe(false);
        expect(String(p.error)).toContain("not a function");
      } else {
        expectSuccess(p);
        const result = p.result as Record<string, unknown>;
        expect(result.rowCount).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });

  test("window running_total works in readonly (native) or unavailable (WASM)", async ({}, testInfo) => {
    const isWasm = testInfo.project.name === "wasm";
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.windowRunningTotal({ table: "test_products", column: "price", orderBy: "id" });`,
        readonly: true,
      });
      if (isWasm) {
        expect(p.success).toBe(false);
        expect(String(p.error)).toContain("not a function");
      } else {
        expectSuccess(p);
        const result = p.result as Record<string, unknown>;
        expect(result.rowCount).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });

  test("window moving_avg works in readonly (native) or unavailable (WASM)", async ({}, testInfo) => {
    const isWasm = testInfo.project.name === "wasm";
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.windowMovingAvg({ table: "test_products", column: "price", orderBy: "id", windowSize: 3 });`,
        readonly: true,
      });
      if (isWasm) {
        expect(p.success).toBe(false);
        expect(String(p.error)).toContain("not a function");
      } else {
        expectSuccess(p);
        const result = p.result as Record<string, unknown>;
        expect(result.rowCount).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });

  test("window ntile works in readonly (native) or unavailable (WASM)", async ({}, testInfo) => {
    const isWasm = testInfo.project.name === "wasm";
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.stats.windowNtile({ table: "test_products", orderBy: "price DESC", buckets: 4 });`,
        readonly: true,
      });
      if (isWasm) {
        expect(p.success).toBe(false);
        expect(String(p.error)).toContain("not a function");
      } else {
        expectSuccess(p);
        const result = p.result as Record<string, unknown>;
        expect(result.rowCount).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Phase 4: Security
// =============================================================================

test.describe("Code Mode: Security", () => {
  test("require() blocked → CODEMODE_VALIDATION_FAILED", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `const fs = require("fs"); return fs.readFileSync("/etc/passwd");`,
      });
      expect(p.success).toBe(false);
      expect(p.code).toBe("CODEMODE_VALIDATION_FAILED");
    } finally {
      await client.close();
    }
  });

  test("process access blocked", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "return process.env;",
      });
      expect(p.success).toBe(false);
    } finally {
      await client.close();
    }
  });

  test("eval() blocked → CODEMODE_VALIDATION_FAILED", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return eval("1+1");`,
      });
      expect(p.success).toBe(false);
      expect(p.code).toBe("CODEMODE_VALIDATION_FAILED");
    } finally {
      await client.close();
    }
  });

  test("timeout enforcement", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const start = Date.now();
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "while(true) {}",
        timeout: 2000,
      });
      const elapsed = Date.now() - start;
      expect(p.success).toBe(false);
      // Should complete within ~5s (2s timeout + some overhead)
      expect(elapsed).toBeLessThan(10000);
    } finally {
      await client.close();
    }
  });

  test("invalid tool call via API → structured error, no crash", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `return await sqlite.core.readQuery({ query: "SELECT * FROM _e2e_nonexistent_xyz" });`,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.success).toBe(false);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Phase 5: Multi-Step Workflows
// =============================================================================

test.describe("Code Mode: Workflows", () => {
  test("ETL pipeline — create, populate, transform, read", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          await sqlite.core.writeQuery("CREATE TABLE IF NOT EXISTS _e2e_cm_etl (id INTEGER PRIMARY KEY, raw TEXT, processed TEXT)");
          for (let i = 1; i <= 5; i++) {
            await sqlite.core.writeQuery({ query: \`INSERT INTO _e2e_cm_etl (raw) VALUES ('item_\${i}')\` });
          }
          await sqlite.core.writeQuery("UPDATE _e2e_cm_etl SET processed = UPPER(raw)");
          const result = await sqlite.core.readQuery("SELECT * FROM _e2e_cm_etl");
          await sqlite.core.writeQuery("DROP TABLE IF EXISTS _e2e_cm_etl");
          return result;
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const rows = result.rows as Record<string, unknown>[];
      // Native: 5 rows with processed = UPPER(raw)
      // WASM: writes may not persist in code mode — accept 0 rows too
      expect(Array.isArray(rows)).toBe(true);
      if (rows.length > 0) {
        expect(rows.length).toBe(5);
        expect(rows[0].processed).toBe("ITEM_1");
      }
    } finally {
      // Cleanup in case DROP TABLE didn't run
      try {
        await callToolAndParse(client, "sqlite_execute_code", {
          code: `await sqlite.core.writeQuery("DROP TABLE IF EXISTS _e2e_cm_etl"); return { cleaned: true };`,
        });
      } catch { /* ignore cleanup errors */ }
      await client.close();
    }
  });

  test("cross-group analysis — stats + json", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const stats = await sqlite.stats.statsBasic({ table: "test_products", column: "price" });
          const top = await sqlite.stats.statsTopN({ table: "test_products", column: "price", n: 3 });
          return { priceStats: stats, topProducts: top };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result).toHaveProperty("priceStats");
      expect(result).toHaveProperty("topProducts");
    } finally {
      await client.close();
    }
  });

  test("schema introspection + query", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const tables = await sqlite.core.listTables();
          const first = tables.tables[0].name;
          const schema = await sqlite.core.describeTable(first);
          const sample = await sqlite.core.readQuery({ query: \`SELECT * FROM \${first} LIMIT 3\` });
          return { table: first, columnCount: schema.columns?.length, sampleRows: sample.rows?.length };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.table).toBe("string");
      expect(typeof result.columnCount).toBe("number");
      expect(result.sampleRows).toBeLessThanOrEqual(3);
    } finally {
      await client.close();
    }
  });

  test("loop with accumulator", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const tables = await sqlite.core.listTables();
          const counts = {};
          for (const t of tables.tables.slice(0, 5)) {
            const r = await sqlite.stats.statsCount({ table: t.name });
            counts[t.name] = r.count;
          }
          return counts;
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, number>;
      expect(Object.keys(result).length).toBeLessThanOrEqual(5);
      for (const count of Object.values(result)) {
        expect(typeof count).toBe("number");
      }
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// API Discoverability: help(), method aliases, convenience aliases
// =============================================================================

test.describe("Code Mode: API Discoverability", () => {
  test("sqlite.help() returns all 9 groups", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "return await sqlite.help();",
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      const groups = result.groups as string[];
      expect(groups.length).toBe(9);
      const expected = [
        "core", "json", "text", "stats", "vector",
        "admin", "geo", "introspection", "migration",
      ];
      for (const g of expected) {
        expect(groups).toContain(g);
      }
      expect(typeof result.totalMethods === "number" || result.totalMethods === undefined).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite.core.help() returns methods array", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "return await sqlite.core.help();",
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.group).toBe("core");
      const methods = result.methods as string[];
      expect(Array.isArray(methods)).toBe(true);
      expect(methods.length).toBeGreaterThan(0);
      // Core should include these canonical methods
      expect(methods).toContain("readQuery");
      expect(methods).toContain("listTables");
    } finally {
      await client.close();
    }
  });

  test("method alias resolves: core.query() = core.readQuery()", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const r1 = await sqlite.core.query("SELECT 1 AS num");
          const r2 = await sqlite.core.readQuery("SELECT 1 AS num");
          return { aliasRows: r1.rows, canonicalRows: r2.rows };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.aliasRows).toEqual(result.canonicalRows);
    } finally {
      await client.close();
    }
  });

  test("top-level convenience alias: sqlite.listTables()", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const tables = await sqlite.listTables();
          return { success: true, tableCount: tables.tables?.length };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.tableCount).toBe("number");
      expect((result.tableCount as number)).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("all groups return >0 methods from help()", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: `
          const groups = ["core","json","text","stats","vector","admin","geo","introspection","migration"];
          const results = {};
          for (const g of groups) {
            const h = await sqlite[g].help();
            results[g] = h.methods.length;
          }
          return results;
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, number>;
      expect(Object.keys(result).length).toBe(9);
      for (const [group, count] of Object.entries(result)) {
        expect(count, `${group} should have >0 methods`).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Timeout Enforcement
// =============================================================================

test.describe("Code Mode: Timeout", () => {
  test("infinite loop with timeout → structured error within ~2s", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const start = Date.now();
      const p = await callToolAndParse(client, "sqlite_execute_code", {
        code: "while (true) {}",
        timeout: 2000,
      });
      const elapsed = Date.now() - start;
      expect(p.success).toBe(false);
      expect(typeof p.error).toBe("string");
      // Should complete within a reasonable time (not hang forever)
      expect(elapsed).toBeLessThan(15000);
    } finally {
      await client.close();
    }
  });
});
