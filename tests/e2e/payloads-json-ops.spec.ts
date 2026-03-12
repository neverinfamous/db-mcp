/**
 * Payload Contract Tests: JSON Operations
 *
 * Validates response shapes for json-operations tools:
 * json_valid, json_extract, json_type, json_array_length,
 * json_pretty, json_storage_info, json_group_array, json_group_object.
 *
 * Write tools (json_set, json_remove, json_array_append, jsonb_convert,
 * json_normalize_column) are tested with setup/teardown.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: JSON Operations (Read)", () => {
  test("sqlite_json_valid returns { success, valid, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_valid", {
        json: '{"key": "value"}',
      });

      expectSuccess(payload);
      expect(payload.valid).toBe(true);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_valid returns valid=false for invalid JSON", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_valid", {
        json: "{not valid json}",
      });

      expectSuccess(payload);
      expect(payload.valid).toBe(false);
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_extract returns { success, rowCount, values[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_extract", {
        table: "test_jsonb_docs",
        column: "doc",
        path: "$.type",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.values)).toBe(true);
      expect((payload.rowCount as number)).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_type returns { success, rowCount, types[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_type", {
        table: "test_jsonb_docs",
        column: "doc",
        path: "$",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.types)).toBe(true);

      const types = payload.types as string[];
      if (types.length > 0) {
        expect(typeof types[0]).toBe("string");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_array_length returns { success, rowCount, lengths[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_array_length", {
        table: "test_jsonb_docs",
        column: "tags",
        path: "$",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.lengths)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_pretty returns { success, formatted }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_pretty", {
        json: '{"a":1,"b":2}',
      });

      expectSuccess(payload);
      expect(typeof payload.formatted).toBe("string");
      // Should have indentation
      expect((payload.formatted as string)).toContain("\n");
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_storage_info returns { success, jsonbSupported, sampleSize, formats }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_storage_info", {
        table: "test_jsonb_docs",
        column: "doc",
      });

      expectSuccess(payload);
      expect(typeof payload.jsonbSupported).toBe("boolean");
      expect(typeof payload.sampleSize).toBe("number");

      const formats = payload.formats as Record<string, unknown>;
      expect(typeof formats.text).toBe("number");
      expect(typeof formats.null).toBe("number");
      expect(typeof payload.recommendation).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_group_array returns { success, rowCount, rows[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_group_array", {
        table: "test_products",
        valueColumn: "name",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_group_object returns { success, rowCount, rows[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_group_object", {
        table: "test_products",
        keyColumn: "name",
        valueColumn: "category",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.rows)).toBe(true);
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
        path: "$",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.keys)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_each returns { success, rowCount, elements[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_each", {
        table: "test_jsonb_docs",
        column: "doc",
        path: "$",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.elements)).toBe(true);
    } finally {
      await client.close();
    }
  });
});

test.describe("Payload Contracts: JSON Operations (Write)", () => {
  test("sqlite_json_set returns { success, rowsAffected }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_set", {
        table: "test_jsonb_docs",
        column: "doc",
        path: "$.test_flag",
        value: true,
        whereClause: "rowid = 1",
      });

      expectSuccess(payload);
      expect(typeof payload.rowsAffected).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_remove returns { success, rowsAffected }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_remove", {
        table: "test_jsonb_docs",
        column: "doc",
        path: "$.test_flag",
        whereClause: "rowid = 1",
      });

      expectSuccess(payload);
      expect(typeof payload.rowsAffected).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_json_array_append returns { success, rowsAffected }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_json_array_append", {
        table: "test_jsonb_docs",
        column: "tags",
        path: "$",
        value: "new_tag",
        whereClause: "rowid = 1",
      });

      expectSuccess(payload);
      expect(typeof payload.rowsAffected).toBe("number");
    } finally {
      await client.close();
    }
  });
});
