/**
 * Extended Error Path Tests: Native-Only Tools
 *
 * Systematic domain error testing for native-only tools — nonexistent tables,
 * columns, invalid inputs — asserting structured handler errors.
 *
 * Extends errors-extended.spec.ts to cover FTS5, window functions, transactions,
 * and SpatiaLite tools that are excluded from the WASM project.
 *
 * This file is ignored by the WASM project via the /native\./ testIgnore pattern.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectHandlerError,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// FTS5 — Nonexistent Table, Empty Query
// =============================================================================

test.describe("Errors Native: FTS5", () => {
  test("fts_search on nonexistent FTS table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_fts_search", {
        table: "_e2e_nonexistent_fts_xyz",
        query: "test",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("fts_match_info on nonexistent FTS table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_fts_match_info", {
        table: "_e2e_nonexistent_fts_xyz",
        query: "test",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("fts_rebuild on nonexistent FTS table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_fts_rebuild", {
        table: "_e2e_nonexistent_fts_xyz",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("fts_create with nonexistent source table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_fts_create", {
        tableName: "_e2e_fts_err_test",
        sourceTable: "_e2e_nonexistent_xyz",
        columns: ["name"],
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Window Functions — Nonexistent Table, Column
// =============================================================================

test.describe("Errors Native: Window Functions", () => {
  test("window_row_number on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_window_row_number", {
        table: "_e2e_nonexistent_xyz",
        orderBy: "id",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("window_running_total on nonexistent column → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_window_running_total", {
        table: "test_orders",
        column: "_e2e_nonexistent_col",
        orderBy: "order_date",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("window_moving_avg on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_window_moving_avg", {
        table: "_e2e_nonexistent_xyz",
        column: "temperature",
        orderBy: "measured_at",
        windowSize: 5,
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("window_lag_lead on nonexistent column → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_window_lag_lead", {
        table: "test_measurements",
        column: "_e2e_nonexistent_col",
        orderBy: "measured_at",
        direction: "lag",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("window_ntile on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_window_ntile", {
        table: "_e2e_nonexistent_xyz",
        orderBy: "id",
        buckets: 4,
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("window_rank on nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_window_rank", {
        table: "_e2e_nonexistent_xyz",
        orderBy: "id",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Transactions — Invalid Operations
// =============================================================================

test.describe("Errors Native: Transactions", () => {
  test("transaction_execute with invalid SQL → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_transaction_execute", {
        statements: ["THIS IS NOT VALID SQL AT ALL"],
        rollbackOnError: true,
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("transaction_rollback_to nonexistent savepoint → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Begin a transaction first so savepoint operations are valid context
      await callToolAndParse(client, "sqlite_transaction_begin", {});

      const p = await callToolAndParse(
        client,
        "sqlite_transaction_rollback_to",
        {
          name: "_e2e_nonexistent_savepoint_xyz",
        },
      );
      expectHandlerError(p);
    } finally {
      // Clean up the open transaction
      await callToolAndParse(client, "sqlite_transaction_rollback", {});
      await client.close();
    }
  });

  test("transaction_release nonexistent savepoint → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_transaction_begin", {});

      const p = await callToolAndParse(client, "sqlite_transaction_release", {
        name: "_e2e_nonexistent_savepoint_xyz",
      });
      expectHandlerError(p);
    } finally {
      await callToolAndParse(client, "sqlite_transaction_rollback", {});
      await client.close();
    }
  });

  test("transaction_commit without active transaction → structured error or no-op", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_transaction_commit", {});
      // May return error or succeed as no-op — just verify structured response
      expect(typeof p.success).toBe("boolean");
      if (p.success === false) {
        expect(typeof p.error).toBe("string");
      }
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// SpatiaLite — Invalid Geometry, Bad SQL
// =============================================================================

test.describe("Errors Native: SpatiaLite", () => {
  let spatialiteAvailable = false;

  test("detect SpatiaLite availability", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_spatialite_load", {});
      spatialiteAvailable = p.success === true;
    } finally {
      await client.close();
    }
  });

  test("spatialite_query with invalid SQL → structured error", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_spatialite_query", {
        query: "THIS IS NOT VALID SQL",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("spatialite_import with invalid WKT → structured error", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_spatialite_import", {
        tableName: "_e2e_nonexistent_xyz",
        format: "wkt",
        data: "NOT_VALID_WKT(abc)",
        srid: 4326,
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("spatialite_transform with invalid geometry → structured error", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_spatialite_transform", {
        operation: "centroid",
        geometry1: "NOT_VALID_GEOMETRY",
        srid: 4326,
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("spatialite_analyze on nonexistent table → structured error", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_spatialite_analyze", {
        analysisType: "spatial_extent",
        sourceTable: "_e2e_nonexistent_xyz",
        geometryColumn: "geom",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("spatialite_index on nonexistent table → structured error", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_spatialite_index", {
        tableName: "_e2e_nonexistent_xyz",
        geometryColumn: "geom",
        action: "check",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});
