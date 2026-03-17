/**
 * Payload Contract Tests: Migration Tracking
 *
 * Validates the full migration lifecycle:
 * init → apply → history → rollback (dry-run + real) → status.
 * Tests run in serial and build on each other.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

// Unique identifier shared across the serial lifecycle tests
const testId = Date.now();

test.describe("Payload Contracts: Migration Tracking", () => {
  test("sqlite_migration_init returns { success, tableCreated, tableName }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_init", {});

      expectSuccess(payload);
      expect(typeof payload.tableCreated).toBe("boolean");
      expect(typeof payload.tableName).toBe("string");
      expect(typeof payload.existingRecords).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("sqlite_migration_apply returns { success, record }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_apply", {
        version: `e2e_${testId}`,
        description: "Test migration from payload contract tests",
        migrationSql: `CREATE TABLE IF NOT EXISTS _e2e_migration_test_${testId} (id INTEGER PRIMARY KEY, val TEXT)`,
        rollbackSql: `DROP TABLE IF EXISTS _e2e_migration_test_${testId}`,
      });

      expectSuccess(payload);

      const record = payload.record as Record<string, unknown>;
      expect(typeof record.id).toBe("number");
      expect(record.version).toBe(`e2e_${testId}`);
      expect(record.status).toBe("applied");
      expect(typeof record.appliedAt).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_migration_history returns { success, records[], total }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_history", {});

      expectSuccess(payload);
      expect(Array.isArray(payload.records)).toBe(true);
      expect(typeof payload.total).toBe("number");
      expect(typeof payload.limit).toBe("number");
      expect(typeof payload.offset).toBe("number");

      const records = payload.records as Record<string, unknown>[];
      expect(records.length).toBeGreaterThan(0);

      const first = records[0];
      expect(typeof first.id).toBe("number");
      expect(typeof first.version).toBe("string");
      expect(typeof first.status).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_migration_rollback with dryRun returns { success, dryRun, rollbackSql }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_rollback", {
        version: `e2e_${testId}`,
        dryRun: true,
      });

      expectSuccess(payload);
      expect(payload.dryRun).toBe(true);
      expect(typeof payload.rollbackSql).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("sqlite_migration_rollback actually rolls back", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_rollback", {
        version: `e2e_${testId}`,
        dryRun: false,
      });

      expectSuccess(payload);
      expect(payload.dryRun).toBe(false);
      expect(typeof payload.rollbackSql).toBe("string");

      // Record should be updated
      const record = payload.record as Record<string, unknown>;
      expect(record.status).toBe("rolled_back");
    } finally {
      await client.close();
    }
  });

  test("sqlite_migration_status returns { success, initialized, counts }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_status", {});

      expectSuccess(payload);
      expect(payload.initialized).toBe(true);

      const counts = payload.counts as Record<string, unknown>;
      expect(typeof counts.total).toBe("number");
      expect(typeof counts.applied).toBe("number");
      expect(typeof counts.rolledBack).toBe("number");
      expect(typeof counts.failed).toBe("number");

      expect(Array.isArray(payload.sourceSystems)).toBe(true);
    } finally {
      await client.close();
    }
  });

  // =========================================================================
  // migration_record (external recording without execution)
  // =========================================================================

  test("sqlite_migration_record returns { success, record }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_record", {
        version: `e2e_record_${testId}`,
        description: "Externally applied migration recorded by e2e test",
        migrationSql: `CREATE TABLE IF NOT EXISTS _e2e_migration_external_${testId} (id INTEGER)`,
        sourceSystem: "e2e-test",
      });

      expectSuccess(payload);
      const record = payload.record as Record<string, unknown>;
      expect(typeof record.id).toBe("number");
      expect(record.version).toBe(`e2e_record_${testId}`);
      expect(record.status).toBe("applied");
      expect(record.sourceSystem).toBe("e2e-test");
    } finally {
      await client.close();
    }
  });

  test("sqlite_migration_record rejects duplicate SHA-256", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_migration_record", {
        version: `e2e_record_dup_${testId}`,
        description: "Duplicate migration",
        migrationSql: `CREATE TABLE IF NOT EXISTS _e2e_migration_external_${testId} (id INTEGER)`,
        sourceSystem: "e2e-test",
      });

      // Should fail because the SQL hash matches the previous record
      expect(payload.success).toBe(false);
      expect(typeof payload.error).toBe("string");
    } finally {
      await client.close();
    }
  });
});
