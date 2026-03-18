/**
 * Payload Contract Tests: Core Group
 *
 * Validates the exact JSON response shapes returned by core tools:
 * list_tables, describe_table, read_query, write_query, get_indexes.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectSuccess,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Core", () => {
  test("sqlite_list_tables returns { success, count, tables[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_list_tables");

      expectSuccess(payload);
      expect(typeof payload.count).toBe("number");
      expect(Array.isArray(payload.tables)).toBe(true);
      expect(payload.count as number).toBeGreaterThan(0);

      // Validate table entry shape
      const tables = payload.tables as Record<string, unknown>[];
      const table = tables[0];
      expect(typeof table.name).toBe("string");
      expect(typeof table.type).toBe("string");
      expect(typeof table.columnCount).toBe("number");
      // rowCount may be undefined now that COUNT(*) scans are removed
      expect(["number", "undefined"].includes(typeof table.rowCount)).toBe(
        true,
      );
    } finally {
      await client.close();
    }
  });

  test("sqlite_describe_table returns { success, table, columns[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_describe_table", {
        table: "test_products",
      });

      expectSuccess(payload);
      expect(payload.table).toBe("test_products");
      expect(["number", "undefined"].includes(typeof payload.rowCount)).toBe(
        true,
      );
      expect(Array.isArray(payload.columns)).toBe(true);

      // Validate column entry shape
      const columns = payload.columns as Record<string, unknown>[];
      expect(columns.length).toBeGreaterThan(0);
      const col = columns[0];
      expect(typeof col.name).toBe("string");
      expect(typeof col.type).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_read_query returns { success, rowCount, rows[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT id, name, price FROM test_products LIMIT 3",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(payload.rowCount).toBe(3);
      expect(Array.isArray(payload.rows)).toBe(true);

      // Validate row shape — rows are objects keyed by column name
      const rows = payload.rows as Record<string, unknown>[];
      const row = rows[0];
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("name");
      expect(row).toHaveProperty("price");

      // executionTimeMs is optional but should be number when present
      if (payload.executionTimeMs !== undefined) {
        expect(typeof payload.executionTimeMs).toBe("number");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_read_query with params returns same shape", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT name, price FROM test_products WHERE category = ?",
        params: ["electronics"],
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(payload.rowCount as number).toBeGreaterThan(0);
      expect(Array.isArray(payload.rows)).toBe(true);

      const rows = payload.rows as Record<string, unknown>[];
      expect(rows[0]).toHaveProperty("name");
      expect(rows[0]).toHaveProperty("price");
    } finally {
      await client.close();
    }
  });

  test("sqlite_write_query returns { success, rowsAffected }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create temp table via create_table (write_query only allows DML)
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_payload_test",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT" },
        ],
        ifNotExists: true,
      });

      const payload = await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_payload_test (val) VALUES ('test_payload')",
      });

      expectSuccess(payload);
      expect(typeof payload.rowsAffected).toBe("number");
      expect(payload.rowsAffected).toBe(1);
      if (payload.executionTimeMs !== undefined) {
        expect(typeof payload.executionTimeMs).toBe("number");
      }

      // Cleanup
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_payload_test",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });

  test("sqlite_get_indexes returns { success, count, indexes[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_get_indexes", {
        table: "test_products",
      });

      expectSuccess(payload);
      expect(typeof payload.count).toBe("number");
      expect(Array.isArray(payload.indexes)).toBe(true);

      // test_products has idx_products_category
      const indexes = payload.indexes as Record<string, unknown>[];
      if (indexes.length > 0) {
        const idx = indexes[0];
        expect(typeof idx.name).toBe("string");
        expect(typeof idx.table).toBe("string");
        expect(typeof idx.unique).toBe("boolean");
        expect(typeof idx.sql).toBe("string");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_create_table returns { success, message, sql }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_ddl_test",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "name", type: "TEXT" },
        ],
        ifNotExists: true,
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
      expect(typeof payload.sql).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_create_index returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_create_index", {
        table: "_e2e_ddl_test",
        indexName: "_e2e_idx_name",
        columns: ["name"],
        ifNotExists: true,
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_drop_index returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_drop_index", {
        indexName: "_e2e_idx_name",
        ifExists: true,
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_drop_table returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_ddl_test",
        ifExists: true,
      });

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });
});
