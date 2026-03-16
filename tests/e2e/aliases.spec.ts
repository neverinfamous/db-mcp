/**
 * E2E Tests: Parameter Alias Acceptance
 *
 * Verifies that core tools accept legacy parameter names
 * (tableName, sql, name) as aliases for canonical names
 * (table, query, indexName).
 *
 * Split Schema pattern §2: "For tools with documented parameter
 * aliases (e.g., table/tableName, query/sql, indexName/name),
 * verify that direct MCP tool calls correctly accept the aliases."
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectSuccess,
  expectHandlerError,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// tableName → table aliases
// =============================================================================

test.describe("Alias: tableName → table", () => {
  test("sqlite_describe_table accepts tableName alias", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_describe_table", {
        tableName: "test_products",
      });
      expectSuccess(p);
      expect(p.table).toBe("test_products");
      expect(Array.isArray(p.columns)).toBe(true);
      expect((p.columns as unknown[]).length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_get_indexes accepts tableName alias", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_get_indexes", {
        tableName: "test_orders",
      });
      expectSuccess(p);
      expect(Array.isArray(p.indexes)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_create_table accepts tableName alias", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_create_table", {
        tableName: "_e2e_alias_test",
        columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
      });
      expectSuccess(p);

      // Verify table was created
      const d = await callToolAndParse(client, "sqlite_describe_table", {
        table: "_e2e_alias_test",
      });
      expectSuccess(d);

      // Cleanup
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_alias_test",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });

  test("sqlite_drop_table accepts tableName alias", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create a table to drop
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_alias_drop",
        columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
      });

      // Drop using alias
      const p = await callToolAndParse(client, "sqlite_drop_table", {
        tableName: "_e2e_alias_drop",
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });

  test("sqlite_create_index accepts tableName alias", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create a table to index
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_alias_idx",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT" },
        ],
      });

      // Create index using tableName alias
      const p = await callToolAndParse(client, "sqlite_create_index", {
        indexName: "idx_e2e_alias_val",
        tableName: "_e2e_alias_idx",
        columns: ["val"],
      });
      expectSuccess(p);

      // Cleanup
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_alias_idx",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });

  test("canonical table takes precedence over tableName alias", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // When both are supplied, canonical `table` wins
      const p = await callToolAndParse(client, "sqlite_describe_table", {
        table: "test_products",
        tableName: "nonexistent_xyz",
      });
      expectSuccess(p);
      expect(p.table).toBe("test_products");
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// sql → query aliases
// =============================================================================

test.describe("Alias: sql → query", () => {
  test("sqlite_read_query accepts sql alias", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_read_query", {
        sql: "SELECT COUNT(*) AS n FROM test_products",
      });
      expectSuccess(p);
      expect(p.rowCount).toBe(1);
      const rows = p.rows as { n: number }[];
      expect(rows[0].n).toBe(16);
    } finally {
      await client.close();
    }
  });

  test("sqlite_write_query accepts sql alias", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create temp table first
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_alias_sql",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT" },
        ],
      });

      // Insert using sql alias
      const p = await callToolAndParse(client, "sqlite_write_query", {
        sql: "INSERT INTO _e2e_alias_sql (id, val) VALUES (1, 'hello')",
      });
      expectSuccess(p);
      expect(p.rowsAffected).toBe(1);

      // Cleanup
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_alias_sql",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });

  test("canonical query takes precedence over sql alias", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // When both are supplied, canonical `query` wins
      const p = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT 1 AS val",
        sql: "THIS WOULD FAIL",
      });
      expectSuccess(p);
      expect(p.rowCount).toBe(1);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// name → indexName aliases
// =============================================================================

test.describe("Alias: name → indexName", () => {
  test("sqlite_create_index accepts name alias for indexName", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create a table
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_alias_name",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT" },
        ],
      });

      // Create index using name alias
      const p = await callToolAndParse(client, "sqlite_create_index", {
        name: "idx_e2e_alias_name_val",
        table: "_e2e_alias_name",
        columns: ["val"],
      });
      expectSuccess(p);

      // Cleanup
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_alias_name",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });

  test("sqlite_drop_index accepts name alias for indexName", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create table + index
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_alias_drop_idx",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT" },
        ],
      });
      await callToolAndParse(client, "sqlite_create_index", {
        indexName: "idx_e2e_alias_drop_val",
        table: "_e2e_alias_drop_idx",
        columns: ["val"],
      });

      // Drop using name alias
      const p = await callToolAndParse(client, "sqlite_drop_index", {
        name: "idx_e2e_alias_drop_val",
      });
      expectSuccess(p);

      // Cleanup
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_alias_drop_idx",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Invalid alias usage → structured errors
// =============================================================================

test.describe("Alias: error paths", () => {
  test("tableName alias with nonexistent table → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_describe_table", {
        tableName: "nonexistent_table_xyz",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("sql alias with invalid SQL → structured error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_read_query", {
        sql: "SELEC * FORM nothing",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});
