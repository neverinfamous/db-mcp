/**
 * Payload Contract Tests: SpatiaLite Tools
 *
 * Validates response shapes for all 7 SpatiaLite tools (NATIVE ONLY):
 * spatialite_load, spatialite_create_table, spatialite_query,
 * spatialite_index, spatialite_analyze, spatialite_transform,
 * spatialite_import.
 *
 * These tests require the SpatiaLite extension to be installed.
 * If SpatiaLite is not available, all tests are gracefully skipped.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: SpatiaLite", () => {
  let spatialiteAvailable = false;

  test("sqlite_spatialite_load returns { success, message } or skip if unavailable", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_spatialite_load", {});

      if (payload.success) {
        spatialiteAvailable = true;
        expect(typeof payload.message).toBe("string");
      } else {
        // SpatiaLite not available — all subsequent tests will skip
        spatialiteAvailable = false;
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_spatialite_create_table returns { success, message, tableName }", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      // Clean up from prior runs
      await callToolAndParse(client, "sqlite_drop_table", {
        tableName: "_e2e_spatial_test",
      });

      const payload = await callToolAndParse(client, "sqlite_spatialite_create_table", {
        tableName: "_e2e_spatial_test",
        geometryColumn: "geom",
        geometryType: "POINT",
        srid: 4326,
        additionalColumns: [
          { name: "label", type: "TEXT" },
          { name: "value", type: "REAL" },
        ],
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(payload.tableName).toBe("_e2e_spatial_test");
    } finally {
      await client.close();
    }
  });

  test("sqlite_spatialite_import inserts WKT geometry", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      // Import 3 points individually (import takes a single geometry per call)
      const points = [
        { wkt: "POINT(-73.9857 40.7484)", label: "NYC", value: 1.0 },
        { wkt: "POINT(-118.2437 34.0522)", label: "LA", value: 2.0 },
        { wkt: "POINT(-87.6298 41.8781)", label: "Chicago", value: 3.0 },
      ];

      for (const pt of points) {
        const payload = await callToolAndParse(client, "sqlite_spatialite_import", {
          tableName: "_e2e_spatial_test",
          format: "wkt",
          data: pt.wkt,
          srid: 4326,
          additionalData: { label: pt.label, value: pt.value },
        });
        expectSuccess(payload);
        expect(typeof payload.rowsAffected).toBe("number");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_spatialite_query returns rows from spatial SQL", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_spatialite_query", {
        query: 'SELECT label, AsText(geom) as wkt FROM "_e2e_spatial_test"',
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.rows)).toBe(true);
      expect(payload.rowCount).toBe(3);
    } finally {
      await client.close();
    }
  });

  test("sqlite_spatialite_index create returns { success, message, action }", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_spatialite_index", {
        tableName: "_e2e_spatial_test",
        geometryColumn: "geom",
        action: "create",
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(payload.action).toBe("create");
    } finally {
      await client.close();
    }
  });

  test("sqlite_spatialite_index check returns { success, indexed, action }", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_spatialite_index", {
        tableName: "_e2e_spatial_test",
        geometryColumn: "geom",
        action: "check",
      });

      expectSuccess(payload);
      expect(payload.action).toBe("check");
      expect(payload.indexed).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_spatialite_analyze returns { success, analysisType, results }", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_spatialite_analyze", {
        analysisType: "spatial_extent",
        sourceTable: "_e2e_spatial_test",
        geometryColumn: "geom",
      });

      expectSuccess(payload);
      expect(payload.analysisType).toBe("spatial_extent");
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.results)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_spatialite_transform centroid returns { success, operation, result }", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_spatialite_transform", {
        operation: "centroid",
        geometry1: "POLYGON((-73 40, -73 41, -74 41, -74 40, -73 40))",
        srid: 4326,
      });

      expectSuccess(payload);
      expect(payload.operation).toBe("centroid");
      expect(typeof payload.result).toBe("string");
      // Result should be a POINT WKT
      expect((payload.result as string).startsWith("POINT")).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_spatialite_transform buffer returns { success, operation, result }", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_spatialite_transform", {
        operation: "buffer",
        geometry1: "POINT(-73.9857 40.7484)",
        distance: 0.01,
        srid: 4326,
      });

      expectSuccess(payload);
      expect(payload.operation).toBe("buffer");
      expect(typeof payload.result).toBe("string");
      // Buffer of a point should produce a POLYGON
      expect((payload.result as string).startsWith("POLYGON")).toBe(true);
    } finally {
      await client.close();
    }
  });

  // =========================================================================
  // Cleanup
  // =========================================================================

  test("cleanup: drop spatial index and table", async ({}, testInfo) => {
    if (!spatialiteAvailable) test.skip();

    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_spatialite_index", {
        tableName: "_e2e_spatial_test",
        geometryColumn: "geom",
        action: "drop",
      });

      await callToolAndParse(client, "sqlite_drop_table", {
        tableName: "_e2e_spatial_test",
      });
    } finally {
      await client.close();
    }
  });
});
