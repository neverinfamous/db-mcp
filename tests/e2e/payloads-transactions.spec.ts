/**
 * Payload Contract Tests: Transaction Tools
 *
 * Validates response shapes for all 7 transaction tools:
 * transaction_begin, transaction_commit, transaction_rollback,
 * transaction_savepoint, transaction_release, transaction_rollback_to,
 * transaction_execute.
 *
 * All transaction tools are NATIVE ONLY.
 * Tests run in serial: lifecycle flows build on each other.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectSuccess,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Transactions", () => {
  // =========================================================================
  // Basic lifecycle: begin → write → commit
  // =========================================================================

  test("sqlite_transaction_begin returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(
        client,
        "sqlite_transaction_begin",
        {
          mode: "immediate",
        },
      );

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      // Rollback to clean up the open transaction
      await callToolAndParse(client, "sqlite_transaction_rollback", {});
      await client.close();
    }
  });

  test("sqlite_transaction_commit returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Begin first
      await callToolAndParse(client, "sqlite_transaction_begin", {});

      const payload = await callToolAndParse(
        client,
        "sqlite_transaction_commit",
        {},
      );

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_transaction_rollback returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Begin first
      await callToolAndParse(client, "sqlite_transaction_begin", {});

      const payload = await callToolAndParse(
        client,
        "sqlite_transaction_rollback",
        {},
      );

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await client.close();
    }
  });

  // =========================================================================
  // Begin → write → commit verifies data persists
  // =========================================================================

  test("begin → write → commit persists data", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create table OUTSIDE the transaction using the admin tool
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_txn_test",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT" },
        ],
      });

      await callToolAndParse(client, "sqlite_transaction_begin", {
        mode: "immediate",
      });

      // DML via write_query inside the transaction
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_txn_test (val) VALUES ('committed')",
      });

      const commitPayload = await callToolAndParse(
        client,
        "sqlite_transaction_commit",
        {},
      );
      expectSuccess(commitPayload);

      // Verify data persisted
      const readPayload = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT val FROM _e2e_txn_test WHERE val = 'committed'",
      });
      expectSuccess(readPayload);
      const rows = readPayload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(1);
      expect(rows[0].val).toBe("committed");
    } finally {
      // Cleanup
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_txn_test",
      });
      await client.close();
    }
  });

  // =========================================================================
  // Begin → write → rollback discards data
  // =========================================================================

  test("begin → write → rollback discards data", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create table outside transaction
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_txn_rollback",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT" },
        ],
      });

      await callToolAndParse(client, "sqlite_transaction_begin", {
        mode: "immediate",
      });
      await callToolAndParse(client, "sqlite_write_query", {
        query:
          "INSERT INTO _e2e_txn_rollback (val) VALUES ('to_be_rolled_back')",
      });

      const rollbackPayload = await callToolAndParse(
        client,
        "sqlite_transaction_rollback",
        {},
      );
      expectSuccess(rollbackPayload);

      // Verify data was rolled back
      const readPayload = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT COUNT(*) as cnt FROM _e2e_txn_rollback",
      });
      const rows = readPayload.rows as Record<string, unknown>[];
      expect(rows[0].cnt).toBe(0);
    } finally {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_txn_rollback",
      });
      await client.close();
    }
  });

  // =========================================================================
  // Savepoint lifecycle: begin → savepoint → write → rollback_to → release
  // =========================================================================

  test("sqlite_transaction_savepoint returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_transaction_begin", {});

      const payload = await callToolAndParse(
        client,
        "sqlite_transaction_savepoint",
        {
          name: "e2e_sp1",
        },
      );

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await callToolAndParse(client, "sqlite_transaction_rollback", {});
      await client.close();
    }
  });

  test("sqlite_transaction_release returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      await callToolAndParse(client, "sqlite_transaction_begin", {});
      await callToolAndParse(client, "sqlite_transaction_savepoint", {
        name: "e2e_sp_release",
      });

      const payload = await callToolAndParse(
        client,
        "sqlite_transaction_release",
        {
          name: "e2e_sp_release",
        },
      );

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");
    } finally {
      await callToolAndParse(client, "sqlite_transaction_rollback", {});
      await client.close();
    }
  });

  test("sqlite_transaction_rollback_to returns { success, message }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create table outside transaction
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_txn_sp",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT" },
        ],
      });

      await callToolAndParse(client, "sqlite_transaction_begin", {
        mode: "immediate",
      });

      // Insert initial data
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_txn_sp (val) VALUES ('before_savepoint')",
      });

      // Create savepoint
      await callToolAndParse(client, "sqlite_transaction_savepoint", {
        name: "e2e_sp_rollback",
      });

      // Write after savepoint
      await callToolAndParse(client, "sqlite_write_query", {
        query: "INSERT INTO _e2e_txn_sp (val) VALUES ('after_savepoint')",
      });

      // Rollback to savepoint — should discard the second insert
      const payload = await callToolAndParse(
        client,
        "sqlite_transaction_rollback_to",
        {
          name: "e2e_sp_rollback",
        },
      );

      expectSuccess(payload);
      expect(typeof payload.message).toBe("string");

      // Verify: only the first row should exist
      const readPayload = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT COUNT(*) as cnt FROM _e2e_txn_sp",
      });
      const rows = readPayload.rows as Record<string, unknown>[];
      expect(rows[0].cnt).toBe(1);
    } finally {
      await callToolAndParse(client, "sqlite_transaction_rollback", {});
      // Clean up table
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_txn_sp",
      });
      await client.close();
    }
  });

  // =========================================================================
  // transaction_execute: batch statements
  // =========================================================================

  test("sqlite_transaction_execute returns { success, results[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(
        client,
        "sqlite_transaction_execute",
        {
          statements: [
            "CREATE TABLE IF NOT EXISTS _e2e_txn_exec (id INTEGER PRIMARY KEY, val TEXT)",
            "INSERT INTO _e2e_txn_exec (val) VALUES ('batch_1')",
            "INSERT INTO _e2e_txn_exec (val) VALUES ('batch_2')",
            "INSERT INTO _e2e_txn_exec (val) VALUES ('batch_3')",
          ],
        },
      );

      expectSuccess(payload);
      expect(Array.isArray(payload.results)).toBe(true);
      const results = payload.results as Record<string, unknown>[];
      expect(results.length).toBe(4);
    } finally {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_txn_exec",
      });
      await client.close();
    }
  });

  test("sqlite_transaction_execute rolls back on error", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      // Create table first using admin tool
      await callToolAndParse(client, "sqlite_create_table", {
        table: "_e2e_txn_exec_err",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "val", type: "TEXT NOT NULL" },
        ],
      });

      const payload = await callToolAndParse(
        client,
        "sqlite_transaction_execute",
        {
          statements: [
            "INSERT INTO _e2e_txn_exec_err (val) VALUES ('should_rollback')",
            "INSERT INTO _e2e_txn_exec_err (val) VALUES (NULL)", // NOT NULL violation
          ],
          rollbackOnError: true,
        },
      );

      // Should fail
      expect(payload.success).toBe(false);

      // Table should be empty because first insert was rolled back
      const readPayload = await callToolAndParse(client, "sqlite_read_query", {
        query: "SELECT COUNT(*) as cnt FROM _e2e_txn_exec_err",
      });
      const rows = readPayload.rows as Record<string, unknown>[];
      expect(rows[0].cnt).toBe(0);
    } finally {
      await callToolAndParse(client, "sqlite_drop_table", {
        table: "_e2e_txn_exec_err",
      });
      await client.close();
    }
  });
});
