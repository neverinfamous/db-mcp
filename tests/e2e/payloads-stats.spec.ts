/**
 * Payload Contract Tests: Stats Group
 *
 * Validates response shapes for representative stats tools:
 * stats_basic, stats_count, stats_group_by, stats_histogram,
 * stats_percentile.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Stats", () => {
  test("sqlite_stats_basic returns { success, column, stats }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_basic", {
        table: "test_products",
        column: "price",
      });

      expectSuccess(payload);
      expect(payload.column).toBe("price");

      const stats = payload.stats as Record<string, unknown>;
      expect(typeof stats.count).toBe("number");
      expect(typeof stats.sum).toBe("number");
      expect(typeof stats.avg).toBe("number");
      expect(typeof stats.min).toBe("number");
      expect(typeof stats.max).toBe("number");
      expect(typeof stats.range).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_count returns { success, count }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_count", {
        table: "test_products",
      });

      expectSuccess(payload);
      expect(typeof payload.count).toBe("number");
      expect((payload.count as number)).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_count distinct returns { success, count, distinct }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_count", {
        table: "test_products",
        column: "category",
        distinct: true,
      });

      expectSuccess(payload);
      expect(typeof payload.count).toBe("number");
      expect(payload.distinct).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_group_by returns { success, statistic, rowCount, results }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_group_by", {
        table: "test_products",
        groupByColumn: "category",
        valueColumn: "price",
        stat: "avg",
      });

      expectSuccess(payload);
      expect(payload.statistic).toBe("avg");
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.results)).toBe(true);

      const results = payload.results as Record<string, unknown>[];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("category");
      expect(results[0]).toHaveProperty("stat_value");
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_histogram returns { success, column, range, buckets[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_histogram", {
        table: "test_products",
        column: "price",
        buckets: 5,
      });

      expectSuccess(payload);
      expect(payload.column).toBe("price");
      expect(typeof payload.bucketSize).toBe("number");

      const range = payload.range as Record<string, unknown>;
      expect(typeof range.min).toBe("number");
      expect(typeof range.max).toBe("number");

      const buckets = payload.buckets as Record<string, unknown>[];
      expect(Array.isArray(buckets)).toBe(true);
      expect(buckets.length).toBe(5);
      expect(typeof buckets[0].bucket).toBe("number");
      expect(typeof buckets[0].min).toBe("number");
      expect(typeof buckets[0].max).toBe("number");
      expect(typeof buckets[0].count).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_percentile returns { success, column, count, percentiles[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_percentile", {
        table: "test_products",
        column: "price",
        percentiles: [25, 50, 75],
      });

      expectSuccess(payload);
      expect(payload.column).toBe("price");
      expect(typeof payload.count).toBe("number");

      const percentiles = payload.percentiles as Record<string, unknown>[];
      expect(Array.isArray(percentiles)).toBe(true);
      expect(percentiles.length).toBe(3);
      expect(percentiles[0]).toHaveProperty("percentile");
      expect(percentiles[0]).toHaveProperty("value");
      expect(typeof percentiles[0].percentile).toBe("number");
      expect(typeof percentiles[0].value).toBe("number");
    } finally {
      await client.close();
    }
  });
});
