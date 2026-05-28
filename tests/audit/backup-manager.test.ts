import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BackupManager,
  type SnapshotQueryAdapter,
} from "../../../src/audit/backup-manager.js";
import { join } from "node:path";
import * as fs from "node:fs/promises";

vi.mock("node:zlib", () => ({
  gzip: (buf: Buffer, cb: (err: any, result: Buffer) => void) => cb(null, buf),
  gunzipSync: (buf: Buffer) => buf,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  mkdtemp: vi.fn(),
  rmdir: vi.fn(),
}));

describe("BackupManager", () => {
  const auditLogPath = "/mock/audit.log";
  const snapshotDir = join("/mock", "snapshots");

  beforeEach(() => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined as never);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined as never);
    vi.mocked(fs.rename).mockResolvedValue(undefined as never);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.unlink).mockResolvedValue(undefined as never);
    vi.mocked(fs.mkdtemp).mockResolvedValue(join(snapshotDir, ".tmp-abc123"));
    vi.mocked(fs.rmdir).mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should list snapshots and skip corrupt files", async () => {
    const manager = new BackupManager(
      { enabled: true, maxAgeDays: 7, maxCount: 10, includeData: true },
      auditLogPath,
    );

    // Mock readdir to return some valid and corrupt files
    vi.mocked(fs.readdir).mockResolvedValue([
      "audit_snapshot_2.snapshot.json.gz",
      "audit_snapshot_1.snapshot.json",
      "corrupt.snapshot.json.gz",
      "ignored.txt",
    ] as any);

    // Mock readFile behavior
    vi.mocked(fs.readFile).mockImplementation(
      async (path: string | Buffer | URL) => {
        const p = path.toString();
        if (p.includes("audit_snapshot_2"))
          return Buffer.from(
            JSON.stringify({
              metadata: { timestamp: "2024-01-02", target: "t1" },
            }),
          );
        if (p.includes("audit_snapshot_1"))
          return Buffer.from(
            JSON.stringify({
              metadata: { timestamp: "2024-01-01", target: "t2" },
            }),
          );
        if (p.includes("corrupt")) throw new Error("corrupt file");
        return Buffer.from("");
      },
    );

    const { snapshots, total } = await manager.listSnapshots();
    expect(snapshots.length).toBe(2);
    expect(total).toBe(3);
    // Should sort newest first
    expect(snapshots[0].target).toBe("t1");
  });

  it("should handle error in captureObjectSnapshot gracefully", async () => {
    const manager = new BackupManager(
      { enabled: true, maxAgeDays: 7, maxCount: 10, includeData: true },
      auditLogPath,
    );

    // Inject a failure
    const mockAdapter: SnapshotQueryAdapter = {
      executeQuery: async () => {
        throw new Error("Query Failed");
      },
    };

    // Intercept process.stderr.write to keep test output clean
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const result = await manager.createSnapshot(
      "sqlite_drop_table",
      { table: "test" },
      "req-1",
      mockAdapter,
    );

    // Because snapshot failures are non-throwing, it should complete and write an empty snapshot
    expect(result).toBeDefined();

    stderrSpy.mockRestore();
  });

  it("should format table data correctly for backups", async () => {
    const manager = new BackupManager(
      { enabled: true, maxAgeDays: 7, maxCount: 10, includeData: true },
      auditLogPath,
    );

    const mockAdapter: SnapshotQueryAdapter = {
      executeQuery: async (sql: string) => {
        if (sql.includes("type FROM sqlite_master")) {
          return { rows: [{ type: "table" }] };
        }
        if (sql.includes("pragma_page_count")) {
          return { rows: [{ total_size: 1024 }] };
        }
        if (sql.includes("SELECT * FROM")) {
          return {
            rows: [
              {
                id: 1,
                name: "foo",
                active: true,
                nothing: null,
                obj: { a: 1 },
              },
              {
                id: 2,
                name: "O'Hara",
                active: false,
                nothing: null,
                obj: [1, 2],
              },
            ],
          };
        }
        if (sql.includes("sql FROM sqlite_master")) {
          return { rows: [{ sql: "CREATE TABLE t (id INT)" }] };
        }
        return { rows: [] };
      },
    };

    let writtenContent = "";
    vi.mocked(fs.writeFile).mockImplementation(async (p, data) => {
      writtenContent = data.toString();
    });

    await manager.createSnapshot(
      "sqlite_drop_table",
      { table: "test" },
      "req-1",
      mockAdapter,
    );

    // Verify JSON serialization includes data formatting
    expect(writtenContent).toContain("INSERT INTO");
    expect(writtenContent).toContain("O''Hara");
    expect(writtenContent).toContain("NULL");
  });

  it("should skip table data if it exceeds max size limit", async () => {
    const manager = new BackupManager(
      {
        enabled: true,
        maxAgeDays: 7,
        maxCount: 10,
        includeData: true,
        maxDataSizeBytes: 1000,
      },
      auditLogPath,
    );

    const mockAdapter: SnapshotQueryAdapter = {
      executeQuery: async (sql: string) => {
        if (sql.includes("type FROM sqlite_master")) {
          return { rows: [{ type: "table" }] };
        }
        if (sql.includes("pragma_page_count")) {
          return { rows: [{ total_size: 5000 }] }; // Exceeds limit
        }
        if (sql.includes("SELECT COUNT(*)")) {
          return { rows: [{ row_count: 50 }] };
        }
        return { rows: [{ sql: "CREATE TABLE t" }] };
      },
    };

    let writtenContent = "";
    vi.mocked(fs.writeFile).mockImplementation(async (p, data) => {
      writtenContent = data.toString();
    });

    await manager.createSnapshot(
      "sqlite_drop_table",
      { table: "test" },
      "req-1",
      mockAdapter,
    );

    const parsed = JSON.parse(writtenContent);
    expect(parsed.metadata.dataSkipped).toBe(true);
    expect(parsed.metadata.dataSkippedReason).toContain("exceeds");
    expect(parsed.data).toBeUndefined();
  });

  it("should cleanup snapshots based on count and age", async () => {
    const manager = new BackupManager(
      { enabled: true, maxAgeDays: 7, maxCount: 2, includeData: true },
      auditLogPath,
    );

    vi.mocked(fs.readdir).mockResolvedValue([
      "f1.snapshot.json.gz",
      "f2.snapshot.json.gz",
      "f3.snapshot.json.gz",
      "f4.snapshot.json.gz",
    ] as any);

    const now = Date.now();
    vi.mocked(fs.stat).mockImplementation(
      async (path: string | Buffer | URL) => {
        const p = path.toString();
        // f1 is very old (10 days)
        if (p.includes("f1"))
          return { mtime: new Date(now - 10 * 24 * 3600 * 1000) } as any;
        // f2 is moderately old, but max count is 2, so it might be deleted
        if (p.includes("f2"))
          return { mtime: new Date(now - 2 * 24 * 3600 * 1000) } as any;
        if (p.includes("f3"))
          return { mtime: new Date(now - 1 * 24 * 3600 * 1000) } as any;
        if (p.includes("f4")) return { mtime: new Date(now) } as any;
        throw new Error();
      },
    );

    const unlinkSpy = vi
      .mocked(fs.unlink)
      .mockResolvedValue(undefined as never);

    // Mute stderr for cleanup logs
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const deletedCount = await manager.cleanup();

    expect(deletedCount).toBe(2);
    // f1 deleted for age, f2 deleted for count
    expect(unlinkSpy).toHaveBeenCalledTimes(2);

    stderrSpy.mockRestore();
  });

  it("should not cleanup if disabled", async () => {
    const manager = new BackupManager(
      { enabled: false, maxAgeDays: 7, maxCount: 2, includeData: true },
      auditLogPath,
    );
    const deletedCount = await manager.cleanup();
    expect(deletedCount).toBe(0);
  });
});
