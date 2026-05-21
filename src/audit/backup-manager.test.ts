/**
 * db-mcp — Backup Manager Tests
 *
 * Validates pre-mutation DDL snapshot capture, gzip compression,
 * listing, retrieval, retention cleanup, and stats.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BackupManager, type SnapshotQueryAdapter } from "./backup-manager.js";
import { readdir, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { BackupConfig } from "./types.js";

/** Create a temporary directory for each test */
function tempDir(): string {
  return join(
    tmpdir(),
    `db-mcp-backup-test-${Date.now()}-${String(Math.random()).slice(2, 8)}`,
  );
}

/** Create a default backup config */
function makeConfig(overrides: Partial<BackupConfig> = {}): BackupConfig {
  return {
    enabled: true,
    includeData: false,
    maxAgeDays: 30,
    maxCount: 1000,
    maxDataSizeBytes: 50 * 1024 * 1024,
    ...overrides,
  };
}

/** Helper: create a mock SnapshotQueryAdapter */
function createMockAdapter(
  overrides: Partial<SnapshotQueryAdapter> = {},
): SnapshotQueryAdapter {
  return {
    executeQuery: async (sql: string) => {
      // Mock sqlite_master query for DDL
      if (sql.includes("sqlite_master") && sql.includes("sql")) {
        return {
          rows: [
            {
              sql: "CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)",
            },
          ],
        };
      }
      // Mock sqlite_master type query
      if (sql.includes("sqlite_master") && sql.includes("type")) {
        return { rows: [{ type: "table" }] };
      }
      // Mock COUNT(*)
      if (sql.includes("COUNT(*)")) {
        return { rows: [{ row_count: 42 }] };
      }
      // Mock SELECT *
      if (sql.includes("SELECT *")) {
        return {
          rows: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
        };
      }
      return { rows: [] };
    },
    ...overrides,
  };
}

describe("BackupManager", () => {
  let dir: string;
  let auditLogPath: string;

  beforeEach(async () => {
    dir = tempDir();
    await mkdir(dir, { recursive: true });
    auditLogPath = join(dir, "audit.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe("shouldSnapshot", () => {
    it("returns true for destructive tools", () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);

      expect(manager.shouldSnapshot("sqlite_drop_table")).toBe(true);
      expect(manager.shouldSnapshot("sqlite_drop_index")).toBe(true);
      expect(manager.shouldSnapshot("sqlite_drop_view")).toBe(true);
      expect(manager.shouldSnapshot("sqlite_import_csv")).toBe(true);
      expect(manager.shouldSnapshot("sqlite_backup")).toBe(true);
    });

    it("returns false for non-destructive tools", () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);

      expect(manager.shouldSnapshot("sqlite_read_query")).toBe(false);
      expect(manager.shouldSnapshot("sqlite_write_query")).toBe(false);
      expect(manager.shouldSnapshot("sqlite_create_table")).toBe(false);
    });

    it("returns false when disabled", () => {
      const config = makeConfig({ enabled: false });
      const manager = new BackupManager(config, auditLogPath);

      expect(manager.shouldSnapshot("sqlite_drop_table")).toBe(false);
    });
  });

  describe("createSnapshot", () => {
    it("creates a gzip-compressed snapshot file", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);
      const adapter = createMockAdapter();

      const filename = await manager.createSnapshot(
        "sqlite_drop_table",
        { table: "test_table" },
        "req-1",
        adapter,
      );

      expect(filename).toBeDefined();
      expect(filename).toContain(".snapshot.json.gz");

      await manager.flush();

      // Verify the snapshot directory was created
      const snapshotDir = join(dir, "snapshots");
      const files = await readdir(snapshotDir);
      expect(files.length).toBeGreaterThanOrEqual(1);
    });

    it("returns undefined for non-snapshot tools", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);
      const adapter = createMockAdapter();

      const filename = await manager.createSnapshot(
        "sqlite_read_query",
        { sql: "SELECT 1" },
        "req-1",
        adapter,
      );

      expect(filename).toBeUndefined();
    });

    it("returns undefined when disabled", async () => {
      const config = makeConfig({ enabled: false });
      const manager = new BackupManager(config, auditLogPath);
      const adapter = createMockAdapter();

      const filename = await manager.createSnapshot(
        "sqlite_drop_table",
        { table: "test_table" },
        "req-1",
        adapter,
      );

      expect(filename).toBeUndefined();
    });

    it("captures DDL from sqlite_master", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);
      const adapter = createMockAdapter();

      const filename = await manager.createSnapshot(
        "sqlite_drop_table",
        { table: "test_table" },
        "req-1",
        adapter,
      );

      expect(filename).toBeDefined();
      await manager.flush();

      // Read the snapshot back
      if (filename) {
        const snapshot = await manager.getSnapshot(filename);
        expect(snapshot).not.toBeNull();
        expect(snapshot?.ddl).toContain("CREATE TABLE test_table");
        expect(snapshot?.metadata.tool).toBe("sqlite_drop_table");
        expect(snapshot?.metadata.target).toBe("test_table");
        expect(snapshot?.metadata.type).toBe("ddl");
      }
    });
  });

  describe("listSnapshots", () => {
    it("returns empty array when no snapshots exist", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);

      const snapshots = await manager.listSnapshots();
      expect(snapshots).toEqual([]);
    });

    it("lists snapshots sorted newest first", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);
      const adapter = createMockAdapter();

      await manager.createSnapshot(
        "sqlite_drop_table",
        { table: "table1" },
        "req-1",
        adapter,
      );
      // Small delay to ensure distinct timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      await manager.createSnapshot(
        "sqlite_drop_table",
        { table: "table2" },
        "req-2",
        adapter,
      );

      await manager.flush();

      const snapshots = await manager.listSnapshots();
      expect(snapshots.length).toBeGreaterThanOrEqual(2);
      // Newest first
      expect(snapshots[0]!.timestamp >= snapshots[1]!.timestamp).toBe(true);
    });
  });

  describe("getSnapshot", () => {
    it("returns null for non-existent snapshot", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);

      const snapshot = await manager.getSnapshot(
        "nonexistent.snapshot.json.gz",
      );
      expect(snapshot).toBeNull();
    });

    it("sanitizes filename to prevent path traversal", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);

      const snapshot = await manager.getSnapshot("../../etc/passwd");
      expect(snapshot).toBeNull();
    });
  });

  describe("cleanup", () => {
    it("returns 0 when disabled", async () => {
      const config = makeConfig({ enabled: false });
      const manager = new BackupManager(config, auditLogPath);

      const deleted = await manager.cleanup();
      expect(deleted).toBe(0);
    });

    it("returns 0 when no snapshots exist", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);

      const deleted = await manager.cleanup();
      expect(deleted).toBe(0);
    });
  });

  describe("getStats", () => {
    it("returns zero stats when no snapshots exist", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);

      const stats = await manager.getStats();
      expect(stats.count).toBe(0);
      expect(stats.totalSizeKB).toBe(0);
    });

    it("reports snapshot count and size", async () => {
      const config = makeConfig();
      const manager = new BackupManager(config, auditLogPath);
      const adapter = createMockAdapter();

      await manager.createSnapshot(
        "sqlite_drop_table",
        { table: "test_table" },
        "req-1",
        adapter,
      );
      await manager.flush();

      const stats = await manager.getStats();
      expect(stats.count).toBeGreaterThanOrEqual(1);
      expect(stats.totalSizeKB).toBeGreaterThanOrEqual(0);
    });
  });
});
