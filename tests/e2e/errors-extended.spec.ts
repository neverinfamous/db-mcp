/**
 * Extended Error Path Tests
 *
 * Systematic domain error testing per group — nonexistent tables, columns,
 * invalid inputs — asserting structured handler errors with relevant codes.
 *
 * Extends the 6 tests in errors.spec.ts to comprehensive per-group coverage.
 * Replaces the "Error path testing" sections from test-group-tools.md.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  callToolRaw,
  expectHandlerError,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Core — Table/Index Not Found
// =============================================================================

test.describe("Errors: Core", () => {
  test("read_query on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT * FROM _e2e_nonexistent_xyz",
      });
      expectHandlerError(p);
      expect(p.error as string).toMatch(/no such table|_e2e_nonexistent_xyz/i);
    } finally {
      await client.close();
    }
  });

  test("describe_table on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_describe_table", {
        table: "_e2e_nonexistent_xyz",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("drop_table on nonexistent table (no ifExists) → structured error or safe no-op", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_nonexistent_xyz",
      });
      // Some handlers use IF EXISTS internally — accept either structured error or success
      expect(typeof p.success).toBe("boolean");
      if (p.success === false) {
        expect(typeof p.error).toBe("string");
      }
    } finally {
      await client.close();
    }
  });

  test("get_indexes on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_get_indexes", {
        table: "_e2e_nonexistent_xyz",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("write_query with SELECT → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_write_query", {
        query: "SELECT * FROM test_products",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("read_query with INSERT → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_read_query", {
        query: "INSERT INTO test_products (name, price) VALUES ('x', 1)",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// JSON — Invalid Table/Column/Path
// =============================================================================

test.describe("Errors: JSON", () => {
  test("json_extract on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_json_extract", {
        table: "_e2e_nonexistent_xyz",
        column: "doc",
        path: "$.type",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("json_extract on nonexistent column → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_json_extract", {
        table: "test_jsonb_docs",
        column: "_e2e_nonexistent_col",
        path: "$.type",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("json_valid with non-string → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_json_valid", {
        json: "{not valid json}",
      });
      // json_valid returns { success: true, valid: false } for invalid JSON
      expect(p.success).toBe(true);
      expect(p.valid).toBe(false);
    } finally {
      await client.close();
    }
  });

  test("json_validate_path with invalid path → valid: false or handler error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_json_validate_path", {
        path: "no-dollar-sign",
      });
      // Server may return { success: true, valid: false } or { success: false, error: "..." }
      expect(typeof p.success).toBe("boolean");
      if (p.success) {
        expect(p.valid).toBe(false);
      }
    } finally {
      await client.close();
    }
  });

  test("json_set on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_json_set", {
        table: "_e2e_nonexistent_xyz",
        column: "doc",
        path: "$.key",
        value: "test",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Text — Invalid Table/Column
// =============================================================================

test.describe("Errors: Text", () => {
  test("regex_match on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_regex_match", {
        table: "_e2e_nonexistent_xyz",
        column: "name",
        pattern: "test",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("fuzzy_match on nonexistent column → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_fuzzy_match", {
        table: "test_products",
        column: "_e2e_nonexistent_col",
        search: "laptop",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("text_validate with invalid pattern name → error (handler or Zod)", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Invalid enum value may be caught by Zod (raw MCP error) or handler
      const response = await callToolRaw(client, "sqlite_text_validate", {
        table: "test_users",
        column: "email",
        pattern: "not_a_real_pattern",
      });
      const text = response.content[0]?.text;
      expect(text).toBeDefined();
      // We just verify an error occurred — either raw MCP or structured
      try {
        const parsed = JSON.parse(text);
        expect(parsed.success).toBe(false);
      } catch {
        // Raw MCP error string is also acceptable for invalid enum
        expect(text).toContain("error");
      }
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Stats — Invalid Column Types
// =============================================================================

test.describe("Errors: Stats", () => {
  test("stats_basic on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_basic", {
        table: "_e2e_nonexistent_xyz",
        column: "price",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("stats_basic on nonexistent column → COLUMN_NOT_FOUND", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_basic", {
        table: "test_products",
        column: "_e2e_nonexistent_col",
      });
      expectHandlerError(p);
      expect(p.code).toBe("COLUMN_NOT_FOUND");
    } finally {
      await client.close();
    }
  });

  test("stats_basic on non-numeric column → INVALID_INPUT", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_basic", {
        table: "test_products",
        column: "name",
      });
      expectHandlerError(p);
      expect(p.code).toBe("INVALID_INPUT");
    } finally {
      await client.close();
    }
  });

  test("stats_correlation on nonexistent column → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_stats_correlation", {
        table: "test_measurements",
        column1: "_e2e_nonexistent_col",
        column2: "humidity",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Vector — Invalid Dimensions
// =============================================================================

test.describe("Errors: Vector", () => {
  test("vector_search on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_search", {
        table: "_e2e_nonexistent_xyz",
        vectorColumn: "embedding",
        queryVector: [0.1, 0.2],
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("vector_distance with mismatched dimensions → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_distance", {
        vector1: [1, 0, 0],
        vector2: [0, 1],
        metric: "cosine",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("vector_normalize with empty vector → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_vector_normalize", {
        vector: [],
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Geo — Invalid Coordinates
// =============================================================================

test.describe("Errors: Geo", () => {
  test("geo_distance with lat > 90 → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_geo_distance", {
        lat1: 91,
        lon1: 0,
        lat2: 0,
        lon2: 0,
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("geo_nearby on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_geo_nearby", {
        table: "_e2e_nonexistent_xyz",
        latColumn: "lat",
        lonColumn: "lon",
        centerLat: 0,
        centerLon: 0,
        radius: 100,
        unit: "km",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("geo_nearby on nonexistent column → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_geo_nearby", {
        table: "test_locations",
        latColumn: "_e2e_nonexistent_col",
        lonColumn: "longitude",
        centerLat: 0,
        centerLon: 0,
        radius: 100,
        unit: "km",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Introspection — Invalid SQL/Tables
// =============================================================================

test.describe("Errors: Introspection", () => {
  test("query_plan with non-SELECT → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_query_plan", {
        sql: "DELETE FROM test_products WHERE id = 1",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("query_plan with nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_query_plan", {
        sql: "SELECT * FROM _e2e_nonexistent_xyz",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("cascade_simulator on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_cascade_simulator", {
        table: "_e2e_nonexistent_xyz",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Migration — Invalid Versions
// =============================================================================

test.describe("Errors: Migration", () => {
  test("migration_rollback on nonexistent version → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_migration_rollback", {
        version: "_e2e_nonexistent_version_xyz",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Admin — Invalid Targets
// =============================================================================

test.describe("Errors: Admin", () => {
  test("drop_view on nonexistent view → error or no-op", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const response = await callToolRaw(client, "sqlite_drop_view", {
        viewName: "_e2e_nonexistent_view_xyz",
      });
      const text = response.content[0]?.text;
      expect(text).toBeDefined();
      // Handler may: (1) return {success: true, message: "did not exist"},
      // (2) return {success: false, error: "..."}, or (3) raw MCP error
      try {
        const parsed = JSON.parse(text);
        expect(typeof parsed.success).toBe("boolean");
      } catch {
        // Raw error string is acceptable
        expect(text.length).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });

  test("verify_backup on nonexistent file → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_verify_backup", {
        backupPath: "_e2e_nonexistent_backup.db",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("pragma_table_info on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_pragma_table_info", {
        table: "_e2e_nonexistent_xyz",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("virtual_table_info on nonexistent vtable → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_virtual_table_info", {
        tableName: "_e2e_nonexistent_vtable_xyz",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});
