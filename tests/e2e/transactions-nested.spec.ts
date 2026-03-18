/**
 * Transaction Nested Savepoint Tests
 *
 * Tests nested savepoint operations: multiple savepoints (sp1, sp2),
 * partial rollback at each level, verifying that rollback_to undoes
 * exactly the right changes and nothing more.
 *
 * Extends payloads-transactions.spec.ts which covers basic savepoint
 * lifecycle but not nested savepoint data correctness.
 *
 * NATIVE ONLY — transaction tools are not available in WASM mode.
 * Uses _e2e_txn_nested_* prefixed temp tables.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectSuccess,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Transactions: Nested Savepoints", () => {
  test("setup: create temp table for savepoint tests", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const p = await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_txn_nested",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT" },
        ],
        ifNotExists: true,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });

  test("nested savepoints: rollback_to sp2 keeps sp1 data", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Begin transaction
      await callToolAndParse(client, "sqlite_transaction_begin", {
        mode: "immediate",
      });

      // Insert row A (before any savepoint)
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_txn_nested (val) VALUES ('row_A_pre_sp')",
      });

      // Create savepoint sp1
      await callToolAndParse(client, "sqlite_transaction_savepoint", {
        name: "e2e_sp1",
      });

      // Insert row B (after sp1)
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_txn_nested (val) VALUES ('row_B_after_sp1')",
      });

      // Create savepoint sp2
      await callToolAndParse(client, "sqlite_transaction_savepoint", {
        name: "e2e_sp2",
      });

      // Insert row C (after sp2)
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_txn_nested (val) VALUES ('row_C_after_sp2')",
      });

      // Verify 3 rows before rollback
      const before = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT COUNT(*) as cnt FROM _e2e_txn_nested",
      });
      expect((before.rows as Record<string, unknown>[])[0].cnt).toBe(3);

      // Rollback to sp2 — should undo row C only
      const rb2 = await callToolAndParse(
        client,
        "sqlite_transaction_rollback_to",
        {
          name: "e2e_sp2",
        },
      );
      expectSuccess(rb2);

      // Verify: 2 rows remain (A + B, C was undone)
      const afterSp2 = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT COUNT(*) as cnt FROM _e2e_txn_nested",
      });
      expect((afterSp2.rows as Record<string, unknown>[])[0].cnt).toBe(2);

      // Verify the surviving rows are A and B
      const surviving = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT val FROM _e2e_txn_nested ORDER BY id",
      });
      const vals = (surviving.rows as Record<string, unknown>[]).map(
        (r) => r.val,
      );
      expect(vals).toContain("row_A_pre_sp");
      expect(vals).toContain("row_B_after_sp1");
      expect(vals).not.toContain("row_C_after_sp2");

      // Commit to persist
      await callToolAndParse(client, "sqlite_transaction_commit", {});

      // Verify persistence outside transaction
      const final = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT COUNT(*) as cnt FROM _e2e_txn_nested",
      });
      expect((final.rows as Record<string, unknown>[])[0].cnt).toBe(2);
    } finally {
      // Clean up rows for next test
      await callToolAndParse(client, "sqlite_write_query", {
        query: "DELETE FROM _e2e_txn_nested",
      });
      await client.close();
    }
  });

  test("nested savepoints: rollback_to sp1 undoes everything after sp1", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Begin transaction
      await callToolAndParse(client, "sqlite_transaction_begin", {
        mode: "immediate",
      });

      // Insert row X (before any savepoint)
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_txn_nested (val) VALUES ('row_X_pre_sp')",
      });

      // Create savepoint sp1
      await callToolAndParse(client, "sqlite_transaction_savepoint", {
        name: "e2e_sp1_full",
      });

      // Insert row Y (after sp1)
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_txn_nested (val) VALUES ('row_Y_after_sp1')",
      });

      // Create savepoint sp2
      await callToolAndParse(client, "sqlite_transaction_savepoint", {
        name: "e2e_sp2_full",
      });

      // Insert row Z (after sp2)
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_txn_nested (val) VALUES ('row_Z_after_sp2')",
      });

      // Rollback to sp1 — should undo BOTH Y and Z
      const rb1 = await callToolAndParse(
        client,
        "sqlite_transaction_rollback_to",
        {
          name: "e2e_sp1_full",
        },
      );
      expectSuccess(rb1);

      // Verify: only 1 row remains (X only; Y and Z were undone)
      const afterSp1 = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT val FROM _e2e_txn_nested",
      });
      const rows = afterSp1.rows as Record<string, unknown>[];
      expect(rows.length).toBe(1);
      expect(rows[0].val).toBe("row_X_pre_sp");

      // Commit
      await callToolAndParse(client, "sqlite_transaction_commit", {});
    } finally {
      // Clean up
      await callToolAndParse(client, "sqlite_write_query", {
        query: "DELETE FROM _e2e_txn_nested",
      });
      await client.close();
    }
  });

  test("cleanup: drop nested savepoint table", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_txn_nested",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});
