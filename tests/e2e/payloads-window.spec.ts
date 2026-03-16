/**
 * Payload Contract Tests: Window Functions
 *
 * Validates response shapes for all 6 window function tools:
 * window_row_number, window_rank, window_lag_lead,
 * window_running_total, window_moving_avg, window_ntile.
 *
 * All window functions are NATIVE ONLY.
 * Uses test_measurements (200 rows, columns: sensor_id, temperature, humidity, pressure, measured_at).
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Window Functions", () => {
  test("sqlite_window_row_number returns { success, rows[] } with row_number field", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_row_number", {
        table: "test_measurements",
        orderBy: "temperature",
        limit: 5,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.rows)).toBe(true);

      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(5);
      expect(typeof rows[0].row_number).toBe("number");
      expect(rows[0].row_number).toBe(1);
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_row_number with partitionBy", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_row_number", {
        table: "test_measurements",
        orderBy: "temperature",
        partitionBy: "sensor_id",
        limit: 10,
      });

      expectSuccess(payload);
      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(10);
      expect(typeof rows[0].row_number).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_rank returns { success, rows[] } with rank field", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_rank", {
        table: "test_measurements",
        orderBy: "temperature",
        limit: 5,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.rows)).toBe(true);

      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(5);
      // Default rankType is "rank", aliased as "rank" in SQL
      expect(typeof rows[0].rank).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_rank with rankType dense_rank", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_rank", {
        table: "test_measurements",
        orderBy: "sensor_id",
        rankType: "dense_rank",
        limit: 5,
      });

      expectSuccess(payload);
      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(5);
      // rankType "dense_rank" → aliased as "dense_rank" in SQL
      expect(typeof rows[0].dense_rank).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_rank with rankType percent_rank", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_rank", {
        table: "test_measurements",
        orderBy: "temperature",
        rankType: "percent_rank",
        limit: 5,
      });

      expectSuccess(payload);
      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(5);
      expect(typeof rows[0].percent_rank).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_lag_lead returns { success, rows[] } with lag_value", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_lag_lead", {
        table: "test_measurements",
        column: "temperature",
        orderBy: "measured_at",
        direction: "lag",
        limit: 5,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.rows)).toBe(true);

      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(5);
      expect(rows[0]).toHaveProperty("lag_value");
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_lag_lead with direction lead and offset", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_lag_lead", {
        table: "test_measurements",
        column: "temperature",
        orderBy: "measured_at",
        direction: "lead",
        offset: 3,
        limit: 5,
      });

      expectSuccess(payload);
      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(5);
      expect(rows[0]).toHaveProperty("lead_value");
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_running_total returns { success, rows[] } with running_total", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_running_total", {
        table: "test_orders",
        valueColumn: "total_price",
        orderBy: "order_date",
        limit: 5,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.rows)).toBe(true);

      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(5);
      expect(typeof rows[0].running_total).toBe("number");
      // Running total should increase monotonically
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].running_total as number).toBeGreaterThanOrEqual(rows[i - 1].running_total as number);
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_running_total with partitionBy", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_running_total", {
        table: "test_orders",
        valueColumn: "total_price",
        orderBy: "order_date",
        partitionBy: "status",
        limit: 10,
      });

      expectSuccess(payload);
      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(10);
      expect(typeof rows[0].running_total).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_moving_avg returns { success, rows[] } with moving_avg", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_moving_avg", {
        table: "test_measurements",
        valueColumn: "temperature",
        orderBy: "measured_at",
        windowSize: 5,
        limit: 10,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.rows)).toBe(true);

      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(10);
      expect(typeof rows[0].moving_avg).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_ntile returns { success, rows[] } with ntile field", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_ntile", {
        table: "test_measurements",
        orderBy: "temperature",
        buckets: 4,
        limit: 10,
      });

      expectSuccess(payload);
      expect(Array.isArray(payload.rows)).toBe(true);

      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(10);
      expect(typeof rows[0].ntile).toBe("number");
      // ntile values should be between 1 and buckets
      for (const row of rows) {
        expect(row.ntile as number).toBeGreaterThanOrEqual(1);
        expect(row.ntile as number).toBeLessThanOrEqual(4);
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_window_ntile with 10 buckets (deciles)", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_window_ntile", {
        table: "test_measurements",
        orderBy: "temperature",
        buckets: 10,
        limit: 5,
      });

      expectSuccess(payload);
      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(5);
      expect(rows[0].ntile).toBe(1);
    } finally {
      await client.close();
    }
  });
});
