/**
 * Payload Contract Tests: JSON Group
 *
 * Validates response shapes for representative JSON tools:
 * json_select, json_keys, json_validate_path, json_analyze_schema,
 * json_each, json_query.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectSuccess,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: JSON", () => {
  test("sqlite_json_select returns { success, rowCount, rows[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_select", {
        table: "test_jsonb_docs",
        column: "doc",
        paths: ["$.type", "$.title"],
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(payload.rowCount as number).toBeGreaterThan(0);
      expect(Array.isArray(payload.rows)).toBe(true);

      const rows = payload.rows as Record<string, unknown>[];
      // Extracted paths become column names
      expect(rows[0]).toHaveProperty("type");
      expect(rows[0]).toHaveProperty("title");
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_keys returns { success, rowCount, keys[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_keys", {
        table: "test_jsonb_docs",
        column: "doc",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.keys)).toBe(true);

      const keys = payload.keys as string[];
      expect(keys).toContain("type");
      expect(keys).toContain("title");
      expect(keys).toContain("author");
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_validate_path returns { success, path, valid }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Valid path
      const valid = await callToolAndParse(
        client,
        "sqlite_json_validate_path",
        {
          path: "$.type",
        },
      );
      expect(valid.success).toBe(true);
      expect(valid.path).toBe("$.type");
      expect(valid.valid).toBe(true);

      // Invalid path
      const invalid = await callToolAndParse(
        client,
        "sqlite_json_validate_path",
        {
          path: "no-dollar",
        },
      );
      expect(invalid.valid).toBe(false);
      expect(Array.isArray(invalid.issues)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_analyze_schema returns { success, schema }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(
        client,
        "sqlite_json_analyze_schema",
        {
          table: "test_jsonb_docs",
          column: "doc",
        },
      );

      expectSuccess(payload);
      const schema = payload.schema as Record<string, unknown>;
      expect(schema.type).toBe("object");
      expect(typeof schema.sampleSize).toBe("number");
      expect(typeof schema.nullCount).toBe("number");
      expect(typeof schema.properties).toBe("object");

      // Verify known keys exist in schema properties
      const props = schema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("type");
      expect(props).toHaveProperty("title");
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_each returns { success, rowCount, elements[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_each", {
        table: "test_jsonb_docs",
        column: "tags",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.elements)).toBe(true);

      const el = (payload.elements as Record<string, unknown>[])[0];
      expect(el).toHaveProperty("key");
      expect(el).toHaveProperty("value");
      expect(el).toHaveProperty("type");
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_query returns { success, rowCount, rows[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_query", {
        table: "test_jsonb_docs",
        column: "doc",
        selectPaths: ["$.title", "$.author"],
        filterPaths: { "$.type": "article" },
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(payload.rowCount as number).toBeGreaterThan(0);
      expect(Array.isArray(payload.rows)).toBe(true);

      const rows = payload.rows as Record<string, unknown>[];
      expect(rows[0]).toHaveProperty("title");
      expect(rows[0]).toHaveProperty("author");
    } finally {
      await client.close();
    }
  });
});
