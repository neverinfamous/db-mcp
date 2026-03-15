/**
 * Payload Contract Tests: Geo Group
 *
 * Validates response shapes for WASM-accessible geo tools:
 * geo_distance, geo_nearby, geo_bounding_box.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Geo", () => {
  test("sqlite_geo_distance returns { success, distance, unit }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_geo_distance", {
        lat1: 40.7128,
        lon1: -74.006,
        lat2: 34.0522,
        lon2: -118.2437,
      });

      expectSuccess(payload);
      expect(typeof payload.distance).toBe("number");
      expect((payload.distance as number)).toBeGreaterThan(0);
      expect(payload.unit).toBe("km");
    } finally {
      await client.close();
    }
  });

  test("sqlite_geo_nearby returns { success, rowCount, results[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Search near Times Square — should find NYC landmarks
      const payload = await callToolAndParse(client, "sqlite_geo_nearby", {
        table: "test_locations",
        latColumn: "latitude",
        lonColumn: "longitude",
        centerLat: 40.758,
        centerLon: -73.9855,
        radius: 10,
        unit: "km",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.results)).toBe(true);

      const results = payload.results as Record<string, unknown>[];
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("distance");
        expect(typeof results[0].distance).toBe("number");
        expect(results[0]).toHaveProperty("name");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_geo_bounding_box returns { success, rowCount, results[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Bounding box around NYC
      const payload = await callToolAndParse(client, "sqlite_geo_bounding_box", {
        table: "test_locations",
        latColumn: "latitude",
        lonColumn: "longitude",
        minLat: 40.7,
        maxLat: 40.8,
        minLon: -74.0,
        maxLon: -73.9,
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.results)).toBe(true);

      // Should find NYC locations within this box
      const results = payload.results as Record<string, unknown>[];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("name");
      expect(results[0]).toHaveProperty("latitude");
      expect(results[0]).toHaveProperty("longitude");
    } finally {
      await client.close();
    }
  });

  test("sqlite_geo_cluster returns { success, clusters[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_geo_cluster", {
        table: "test_locations",
        latColumn: "latitude",
        lonColumn: "longitude",
        gridSize: 1,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.clusters)).toBe(true);

      const clusters = payload.clusters as Record<string, unknown>[];
      if (clusters.length > 0) {
        expect(typeof clusters[0].clusterId).toBe("number");
        expect(typeof clusters[0].pointCount).toBe("number");

        const center = clusters[0].center as Record<string, unknown>;
        expect(typeof center.latitude).toBe("number");
        expect(typeof center.longitude).toBe("number");
      }
    } finally {
      await client.close();
    }
  });
});
