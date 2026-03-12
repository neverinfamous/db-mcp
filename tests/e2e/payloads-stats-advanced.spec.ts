/**
 * Payload Contract Tests: Stats Advanced + Inference
 *
 * Validates response shapes for:
 * correlation, top_n, distinct, summary, frequency,
 * outliers, regression, hypothesis.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Stats Advanced", () => {
  test("sqlite_stats_correlation returns { success, correlation, n }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_correlation", {
        table: "test_measurements",
        column1: "temperature",
        column2: "humidity",
      });

      expectSuccess(payload);
      expect(typeof payload.correlation).toBe("number");
      expect(typeof payload.n).toBe("number");
      expect(payload.column1).toBe("temperature");
      expect(payload.column2).toBe("humidity");
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_top_n returns { success, column, count, rows[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_top_n", {
        table: "test_measurements",
        column: "temperature",
        n: 5,
      });

      expectSuccess(payload);
      expect(payload.column).toBe("temperature");
      expect(typeof payload.count).toBe("number");
      expect(Array.isArray(payload.rows)).toBe(true);
      expect((payload.count as number)).toBeLessThanOrEqual(5);
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_distinct returns { success, column, distinctCount, values[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_distinct", {
        table: "test_measurements",
        column: "sensor_id",
      });

      expectSuccess(payload);
      expect(payload.column).toBe("sensor_id");
      expect(typeof payload.distinctCount).toBe("number");
      expect(Array.isArray(payload.values)).toBe(true);
      expect((payload.distinctCount as number)).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_summary returns { success, table, summaries[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_summary", {
        table: "test_measurements",
      });

      expectSuccess(payload);
      expect(payload.table).toBe("test_measurements");
      expect(Array.isArray(payload.summaries)).toBe(true);

      const summaries = payload.summaries as Record<string, unknown>[];
      if (summaries.length > 0) {
        const s = summaries[0];
        expect(typeof s.column).toBe("string");
        expect(typeof s.count).toBe("number");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_frequency returns { success, column, distinctValues, distribution[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_frequency", {
        table: "test_events",
        column: "event_type",
      });

      expectSuccess(payload);
      expect(payload.column).toBe("event_type");
      expect(typeof payload.distinctValues).toBe("number");
      expect(Array.isArray(payload.distribution)).toBe(true);

      const dist = payload.distribution as Record<string, unknown>[];
      if (dist.length > 0) {
        expect(dist[0]).toHaveProperty("value");
        expect(dist[0]).toHaveProperty("frequency");
      }
    } finally {
      await client.close();
    }
  });
});

test.describe("Payload Contracts: Stats Inference", () => {
  test("sqlite_stats_outliers returns { success, method, stats, outlierCount, outliers[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_outliers", {
        table: "test_measurements",
        column: "temperature",
        method: "iqr",
      });

      expectSuccess(payload);
      expect(payload.method).toBe("iqr");
      expect(typeof payload.outlierCount).toBe("number");
      expect(typeof payload.totalRows).toBe("number");
      expect(Array.isArray(payload.outliers)).toBe(true);

      const stats = payload.stats as Record<string, unknown>;
      expect(typeof stats.lowerBound).toBe("number");
      expect(typeof stats.upperBound).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_regression returns { success, type, coefficients, rSquared, equation }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_regression", {
        table: "test_measurements",
        xColumn: "temperature",
        yColumn: "humidity",
      });

      expectSuccess(payload);
      expect(typeof payload.type).toBe("string");
      expect(typeof payload.sampleSize).toBe("number");
      expect(typeof payload.rSquared).toBe("number");
      expect(typeof payload.equation).toBe("string");

      const coefficients = payload.coefficients as Record<string, unknown>;
      expect(typeof coefficients.intercept).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_stats_hypothesis returns { success, testType, statistic, pValue, significant }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_stats_hypothesis", {
        table: "test_measurements",
        column: "temperature",
        testType: "ttest_one",
        expectedMean: 25,
      });

      expectSuccess(payload);
      expect(payload.testType).toBe("ttest_one");
      expect(typeof payload.statistic).toBe("number");
      expect(typeof payload.pValue).toBe("number");
      expect(typeof payload.degreesOfFreedom).toBe("number");
      expect(typeof payload.significant).toBe("boolean");
    } finally {
      await client.close();
    }
  });
});
