/**
 * db-mcp — Backup Manager
 *
 * Pre-mutation snapshot capture for the audit trail.
 * Creates DDL snapshots (+ optional data) of database objects
 * before write/admin tools modify them. Snapshots are stored
 * as gzip-compressed JSON files in a `snapshots/` directory
 * alongside the audit log.
 *
 * DDL is captured from sqlite_master (`SELECT sql FROM sqlite_master`).
 * Volume metadata uses `COUNT(*)` and page-count pragmas.
 *
 * Non-throwing by design: snapshot failures log to stderr
 * but never block tool execution.
 */

import {
  writeFile,
  readFile,
  readdir,
  mkdir,
  stat,
  unlink,
  rename,
  mkdtemp,
  rmdir,
} from "node:fs/promises";

import { join, dirname, basename, sep } from "node:path";
import { gunzipSync, gzip as gzipCb } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzipCb);
import type {
  BackupConfig,
  SnapshotMetadata,
  SnapshotContent,
} from "./types.js";

/**
 * Tools that should receive pre-mutation snapshots, mapped to the
 * argument key that identifies the target object.
 *
 * Tools not in this map are audited but don't trigger snapshots.
 */
const SNAPSHOT_TOOL_ARGS: Record<string, { targetKey: string }> = {
  sqlite_drop_table: { targetKey: "table" },
  sqlite_drop_index: { targetKey: "index" },
  sqlite_drop_view: { targetKey: "viewName" },
  sqlite_import_csv: { targetKey: "table" },
  sqlite_backup: { targetKey: "targetPath" },
};

/** File extension for compressed snapshot files */
const SNAPSHOT_EXT = ".snapshot.json.gz";

/** Legacy uncompressed extension for backward compatibility */
const SNAPSHOT_EXT_LEGACY = ".snapshot.json";

/** How many data rows to include in snapshot samples */
const MAX_SAMPLE_ROWS = 100;

/** Default max data size for snapshot data capture (50 MB) */
const DEFAULT_MAX_DATA_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Interface for database queries needed by the backup manager.
 * Avoids circular imports from the full adapter.
 */
export interface SnapshotQueryAdapter {
  executeQuery(
    sql: string,
    params?: unknown[],
  ): Promise<{
    rows?: Record<string, unknown>[];
  }>;
}

export class BackupManager {
  readonly config: BackupConfig;
  private readonly snapshotDir: string;
  private dirEnsured = false;
  private readonly pendingWrites = new Set<Promise<void>>();

  constructor(config: BackupConfig, auditLogPath: string) {
    this.config = config;
    // Snapshots live alongside the audit log file
    const logDir = dirname(auditLogPath);
    this.snapshotDir = join(logDir, "snapshots");
  }

  /**
   * Check if a tool should receive a pre-mutation snapshot.
   */
  shouldSnapshot(toolName: string): boolean {
    return this.config.enabled && toolName in SNAPSHOT_TOOL_ARGS;
  }

  /**
   * Create a pre-mutation snapshot of the target object.
   *
   * @returns Relative path to the snapshot file, or undefined if skipped/failed
   */
  async createSnapshot(
    toolName: string,
    args: Record<string, unknown>,
    requestId: string,
    adapter: SnapshotQueryAdapter,
    logAs?: string,
  ): Promise<string | undefined> {
    if (!this.shouldSnapshot(toolName)) return undefined;

    try {
      const mapping = SNAPSHOT_TOOL_ARGS[toolName];
      if (!mapping) return undefined;

      const rawTarget = args[mapping.targetKey];
      const target = typeof rawTarget === "string" ? rawTarget : "unknown";

      return await this.captureObjectSnapshot(
        logAs ?? toolName,
        target,
        requestId,
        adapter,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[AUDIT-BACKUP] Snapshot failed for ${toolName}: ${message}\n`,
      );
      return undefined;
    }
  }

  /**
   * List available snapshots with metadata.
   */
  async listSnapshots(limit = 10, offset = 0): Promise<{ snapshots: SnapshotMetadata[], total: number }> {
    try {
      await this.ensureDirectory();
      const files = await readdir(this.snapshotDir);
      
      const snapshotFiles = files.filter(f => f.endsWith(SNAPSHOT_EXT) || f.endsWith(SNAPSHOT_EXT_LEGACY));
      // Sort newest first by parsing timestamp from filename, but lexicographical works for ISO timestamps
      snapshotFiles.sort((a, b) => b.localeCompare(a));
      
      const total = snapshotFiles.length;
      const targetFiles = snapshotFiles.slice(offset, offset + limit);
      
      const snapshots: SnapshotMetadata[] = [];

      for (const file of targetFiles) {
        try {
          const parsed = await this.readSnapshotFile(file);
          if (parsed) {
            snapshots.push({ ...parsed.metadata, filename: file });
          }
        } catch {
          // Skip corrupt snapshot files
        }
      }

      return { snapshots, total };
    } catch {
      // Intentional: listSnapshots is best-effort — return empty on error
      return { snapshots: [], total: 0 };
    }
  }

  /**
   * Read a specific snapshot by filename.
   */
  async getSnapshot(filename: string): Promise<SnapshotContent | null> {
    try {
      // Sanitize: only allow the basename to prevent path traversal
      const safe = basename(filename);
      return await this.readSnapshotFile(safe);
    } catch {
      // Intentional: getSnapshot is best-effort — return null on corrupt/missing file
      return null;
    }
  }

  /**
   * Apply retention policy — delete oldest snapshots that exceed limits.
   */
  async cleanup(): Promise<number> {
    if (!this.config.enabled) return 0;

    try {
      const files = await readdir(this.snapshotDir);
      const snapshotFiles = files.filter(
        (f) => f.endsWith(SNAPSHOT_EXT) || f.endsWith(SNAPSHOT_EXT_LEGACY),
      );

      if (snapshotFiles.length === 0) return 0;

      // Gather file info
      const fileInfos: { name: string; mtime: Date; path: string }[] = [];
      for (const file of snapshotFiles) {
        const filePath = join(this.snapshotDir, file);
        try {
          const stats = await stat(filePath);
          fileInfos.push({ name: file, mtime: stats.mtime, path: filePath });
        } catch {
          // Skip inaccessible files
        }
      }

      // Sort oldest first
      fileInfos.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      let deleted = 0;
      const now = Date.now();
      const maxAgeMs = this.config.maxAgeDays * 24 * 60 * 60 * 1000;

      for (const info of fileInfos) {
        const age = now - info.mtime.getTime();
        const overAge = age > maxAgeMs;
        const overCount = fileInfos.length - deleted > this.config.maxCount;

        if (overAge || overCount) {
          try {
            await unlink(info.path);
            deleted++;
          } catch {
            // Skip undeletable files
          }
        }
      }

      if (deleted > 0) {
        process.stderr.write(
          `[AUDIT-BACKUP] Cleaned up ${String(deleted)} snapshot(s)\n`,
        );
      }

      return deleted;
    } catch {
      // Intentional: cleanup is best-effort — don't fail on inaccessible directory
      return 0;
    }
  }

  /**
   * Flush all pending async snapshot writes.
   * Call during graceful shutdown to ensure all snapshots are persisted.
   */
  async flush(): Promise<void> {
    if (this.pendingWrites.size > 0) {
      await Promise.allSettled(this.pendingWrites);
    }
  }

  async getStats(): Promise<{
    count: number;
    oldestAge?: string;
    totalSizeKB: number;
  }> {
    try {
      const files = await readdir(this.snapshotDir);
      const snapshotFiles = files.filter(
        (f) => f.endsWith(SNAPSHOT_EXT) || f.endsWith(SNAPSHOT_EXT_LEGACY),
      );
      let totalSize = 0;
      let oldestMtime: Date | undefined;

      for (const file of snapshotFiles) {
        try {
          const stats = await stat(join(this.snapshotDir, file));
          totalSize += stats.size;
          if (!oldestMtime || stats.mtime < oldestMtime) {
            oldestMtime = stats.mtime;
          }
        } catch {
          // Skip
        }
      }

      return {
        count: snapshotFiles.length,
        ...(oldestMtime && { oldestAge: oldestMtime.toISOString() }),
        totalSizeKB: Math.round(totalSize / 1024),
      };
    } catch {
      // Intentional: stats gathering is best-effort — return zero counts
      return { count: 0, totalSizeKB: 0 };
    }
  }

  // =========================================================================
  // Private snapshot capture methods
  // =========================================================================

  private async captureObjectSnapshot(
    toolName: string,
    target: string,
    requestId: string,
    adapter: SnapshotQueryAdapter,
  ): Promise<string | undefined> {
    const ddl = await this.buildDdl(target, adapter);
    const { rowCount } = await this.captureVolumeMetadata(target, adapter);
    const { data, dataSkipped, dataSkippedReason } =
      await this.captureTableData(target, adapter);

    return this.writeSnapshot(toolName, target, requestId, ddl, data, {
      ...(rowCount !== undefined && { rowCount }),
      ...(dataSkipped && { dataSkipped }),
      ...(dataSkippedReason !== undefined && { dataSkippedReason }),
    });
  }

  /**
   * Build a DDL string from sqlite_master for the given object.
   * Works for tables, views, indexes, and triggers.
   */
  private async buildDdl(
    objectName: string,
    adapter: SnapshotQueryAdapter,
  ): Promise<string> {
    try {
      const result = await adapter.executeQuery(
        "SELECT sql FROM sqlite_master WHERE name = ?",
        [objectName],
      );
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        if (row?.["sql"] != null) {
          const val = row["sql"];
          return typeof val === "string" ? val : "";
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(
        `[AUDIT-BACKUP] DDL capture failed for ${objectName}: ${msg}\n`,
      );
    }
    return `-- Object "${objectName}" does not exist or cannot be described`;
  }

  /**
   * Capture row count using COUNT(*).
   * Near-zero cost for small tables; failures are silently ignored (best-effort).
   */
  private async captureVolumeMetadata(
    tableName: string,
    adapter: SnapshotQueryAdapter,
  ): Promise<{ rowCount?: number }> {
    try {
      // Only attempt COUNT for tables (not indexes/views)
      const typeResult = await adapter.executeQuery(
        "SELECT type FROM sqlite_master WHERE name = ?",
        [tableName],
      );
      const objType = typeResult.rows?.[0]?.["type"];
      if (objType !== "table") return {};

      const countResult = await adapter.executeQuery(
        `SELECT COUNT(*) as row_count FROM "${tableName}"`,
      );
      const rawCount = countResult.rows?.[0]?.["row_count"];
      if (typeof rawCount === "number") {
        return { rowCount: rawCount };
      }
    } catch {
      // Volume metadata is best-effort — don't fail the snapshot
    }
    return {};
  }

  /**
   * Capture row data as INSERT statements, subject to config limits.
   * Returns empty output when `includeData` is disabled.
   */
  private async captureTableData(
    tableName: string,
    adapter: SnapshotQueryAdapter,
  ): Promise<{
    data?: string;
    dataSkipped: boolean;
    dataSkippedReason?: string;
  }> {
    if (!this.config.includeData) {
      return { dataSkipped: false };
    }

    const maxDataSize =
      this.config.maxDataSizeBytes || DEFAULT_MAX_DATA_SIZE_BYTES;

    // Check table type first — only capture data from tables
    try {
      const typeResult = await adapter.executeQuery(
        "SELECT type FROM sqlite_master WHERE name = ?",
        [tableName],
      );
      const objType = typeResult.rows?.[0]?.["type"];
      if (objType !== "table") return { dataSkipped: false };
    } catch {
      return { dataSkipped: false };
    }

    // Estimate table size via page_count * page_size
    try {
      const pageResult = await adapter.executeQuery(
        "SELECT (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) as total_size",
      );
      const rawSize = pageResult.rows?.[0]?.["total_size"];
      const totalSizeBytes = typeof rawSize === "number" ? rawSize : 0;

      if (totalSizeBytes > maxDataSize) {
        const sizeMB = Math.round(totalSizeBytes / (1024 * 1024));
        const thresholdMB = Math.round(maxDataSize / (1024 * 1024));
        return {
          dataSkipped: true,
          dataSkippedReason: `Database size ~${String(sizeMB)}MB exceeds ${String(thresholdMB)}MB threshold`,
        };
      }
    } catch {
      // Size estimation failure — proceed with data capture
    }

    try {
      const result = await adapter.executeQuery(
        `SELECT * FROM "${tableName}" LIMIT ${String(MAX_SAMPLE_ROWS)}`,
      );
      if (result.rows && result.rows.length > 0) {
        const firstRow = result.rows[0];
        if (firstRow) {
          const cols = Object.keys(firstRow)
            .map((c) => `"${c}"`)
            .join(", ");
          const data = result.rows
            .map((row) => {
              const vals = Object.values(row)
                .map((v) => {
                  if (v === null) return "NULL";
                  if (typeof v === "string")
                    return `'${v.replace(/'/g, "''")}'`;
                  if (typeof v === "number" || typeof v === "boolean")
                    return String(v);
                  return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                })
                .join(", ");
              return `INSERT INTO "${tableName}" (${cols}) VALUES (${vals});`;
            })
            .join("\n");
          return { data, dataSkipped: false };
        }
      }
    } catch {
      // Data capture is best-effort
    }

    return { dataSkipped: false };
  }

  private async writeSnapshot(
    tool: string,
    target: string,
    requestId: string,
    ddl: string,
    data?: string,
    volumeMeta?: {
      rowCount?: number;
      dataSkipped?: boolean;
      dataSkippedReason?: string;
    },
  ): Promise<string | undefined> {
    await this.ensureDirectory();

    const timestamp = new Date().toISOString();
    const safeTarget = target.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTool = tool.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${timestamp.replace(/[:.]/g, "-")}_${safeTool}_${safeTarget}${SNAPSHOT_EXT}`;

    const content: SnapshotContent = {
      metadata: {
        timestamp,
        tool,
        target,
        type: data ? "ddl+data" : "ddl",
        requestId,
        sizeBytes: 0, // Updated after serialization
        ...(volumeMeta?.rowCount !== undefined && {
          rowCount: volumeMeta.rowCount,
        }),
        ...(volumeMeta?.dataSkipped && { dataSkipped: true }),
        ...(volumeMeta?.dataSkippedReason && {
          dataSkippedReason: volumeMeta.dataSkippedReason,
        }),
      },
      ddl,
      data,
    };

    // Serialize once, compute byte length, then patch sizeBytes inline
    const json = JSON.stringify(content, null, 2);
    const sizeBytes = Buffer.byteLength(json, "utf-8");
    const finalJson = json.replace(
      '"sizeBytes": 0',
      `"sizeBytes": ${String(sizeBytes)}`,
    );

    // Async gzip compress + fire-and-forget write
    const compressed = await gzipAsync(Buffer.from(finalJson, "utf-8"));
    const filePath = join(this.snapshotDir, filename);

    // Async atomic write (secure temp dir → rename) + fire-and-forget
    const writePromise = mkdtemp(`${this.snapshotDir}${sep}.tmp-`)
      .then(async (tempDir) => {
        const tmpPath = join(tempDir, filename);
        await writeFile(tmpPath, compressed, { flag: "wx" });
        await rename(tmpPath, filePath);
        // Best-effort cleanup of the temp directory
        await rmdir(tempDir).catch(() => null);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `[AUDIT-BACKUP] Async write failed for ${filename}: ${msg}\n`,
        );
      });
    this.pendingWrites.add(writePromise);
    void writePromise.finally(() => {
      this.pendingWrites.delete(writePromise);
    });

    return filename;
  }

  /**
   * Read and decompress a snapshot file (supports both gzip and legacy JSON).
   */
  private async readSnapshotFile(
    filename: string,
  ): Promise<SnapshotContent | null> {
    const filePath = join(this.snapshotDir, filename);
    const raw = await readFile(filePath);

    // Gzip files start with 0x1f 0x8b magic bytes
    if (raw[0] === 0x1f && raw[1] === 0x8b) {
      const decompressed = gunzipSync(raw);
      return JSON.parse(decompressed.toString("utf-8")) as SnapshotContent;
    }

    // Legacy uncompressed JSON
    return JSON.parse(raw.toString("utf-8")) as SnapshotContent;
  }

  private async ensureDirectory(): Promise<void> {
    if (this.dirEnsured) return;
    try {
      await mkdir(this.snapshotDir, { recursive: true });
      this.dirEnsured = true;
    } catch {
      // Intentional: directory already exists or permission error — proceed regardless
      this.dirEnsured = true;
    }
  }
}
