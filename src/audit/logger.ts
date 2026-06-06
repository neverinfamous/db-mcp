/**
 * db-mcp — Audit Logger
 *
 * Async-buffered SQLite writer for the audit trail. Uses SystemDb
 * to persist structured logs for queryability, or writes to
 * stderr for containerised deployments (`--audit-log stderr`).
 *
 * Non-throwing by design: audit failures log to stderr but never
 * propagate to tool callers.
 */

import type { AuditConfig, AuditEntry, AuditCategory } from "./types.js";
import { redactObject } from "../utils/redaction.js";
import type { SystemDb } from "../observability/system-db.js";

interface AuditLogRow {
  timestamp: string;
  requestId: string;
  tool: string;
  category: string;
  scope: string;
  user: string | null;
  scopesJson: string | null;
  durationMs: number;
  success: number;
  tokenEstimate: number | null;
  error: string | null;
  argsJson: string | null;
  backupPath: string | null;
}

/** Maximum entries to buffer before forcing a flush */
const BUFFER_HIGH_WATER = 50;

/** Auto-flush interval in milliseconds */
const FLUSH_INTERVAL_MS = 100;

/** Default number of recent entries returned by `recent()` */
const DEFAULT_RECENT_COUNT = 50;

/** Special logPath value that routes audit output to stderr */
const STDERR_SENTINEL = "stderr";

export class AuditLogger {
  readonly config: AuditConfig;

  private buffer: AuditEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private activeFlush: Promise<void> | null = null;
  private closed = false;
  private readonly stderrMode: boolean;
  private systemDb: SystemDb | null;

  constructor(config: AuditConfig, systemDb: SystemDb | null = null) {
    this.config = config;
    this.systemDb = systemDb;
    this.stderrMode = config.logPath.toLowerCase() === STDERR_SENTINEL;

    if (config.enabled) {
      // Use unref() so the timer doesn't keep the process alive
      this.flushTimer = setInterval(() => {
        void this.flush();
      }, FLUSH_INTERVAL_MS);
      this.flushTimer.unref();
    }
  }

  /**
   * Initialization is handled externally by SystemDb.
   */
  init(): Promise<void> {
    if (this.stderrMode || !this.config.enabled) return Promise.resolve();
    return Promise.resolve();
  }

  /**
   * Append an audit entry to the buffer.
   * Non-blocking — the entry is queued; the
   * actual DB write happens on the next flush cycle.
   */
  log(entry: AuditEntry): void {
    if (this.closed || !this.config.enabled) return;

    // Defense-in-depth: explicitly redact any credentials before persisting
    const safeEntry = redactObject(entry, 0, 5) as AuditEntry;
    this.buffer.push(safeEntry);

    // Eagerly flush when the buffer is full
    if (this.buffer.length >= BUFFER_HIGH_WATER) {
      void this.flush();
    }
  }

  /**
   * Flush the buffer to SystemDb or stderr.
   * Safe to call concurrently — serialises via `this.activeFlush` Promise.
   */
  async flush(): Promise<void> {
    // If a flush is currently running, wait for it to finish
    if (this.activeFlush) {
      await this.activeFlush;
      // If the buffer is empty after waiting, return
      if (this.buffer.length === 0) return;
    }

    if (this.buffer.length === 0) return;

    const doFlush = async (): Promise<void> => {
      await Promise.resolve();
      // Swap the buffer so new entries can accumulate while we write
      const entries = this.buffer;
      this.buffer = [];

      try {
        if (this.stderrMode) {
          // Stderr mode: write directly
          const lines = entries.map((e) => JSON.stringify(e));
          process.stderr.write(lines.join("\n") + "\n");
        } else if (this.systemDb) {
          const db = this.systemDb.getDb();
          const stmt = db.prepare(`
            INSERT INTO audit_logs (timestamp, requestId, tool, category, scope, user, scopesJson, durationMs, success, tokenEstimate, error, argsJson, backupPath)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const transaction = db.transaction((logs: AuditEntry[]) => {
            for (const log of logs) {
              stmt.run(
                log.timestamp,
                log.requestId,
                log.tool,
                log.category,
                log.scope,
                log.user ?? null,
                JSON.stringify(log.scopes),
                log.durationMs,
                log.success ? 1 : 0,
                log.tokenEstimate ?? null,
                log.error ?? null,
                log.args ? JSON.stringify(log.args) : null,
                log.backup ?? null,
              );
            }
          });

          transaction(entries);
        }
      } catch (err) {
        // Never throw — audit must not break tool execution
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[AUDIT] Write failed: ${message}\n`);
        // Re-queue the failed entries so they aren't lost
        this.buffer.unshift(...entries);
      }
    };

    this.activeFlush = doFlush();
    try {
      await this.activeFlush;
    } finally {
      this.activeFlush = null;
    }
  }

  /**
   * Gracefully close the logger — flush remaining entries and stop the timer.
   */
  async close(): Promise<void> {
    this.closed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  /**
   * Read the most recent audit entries from the SystemDb.
   * Retrieve recent entries directly from the SystemDb.
   */
  async recent(limit: number = DEFAULT_RECENT_COUNT): Promise<AuditEntry[]> {
    if (this.stderrMode || !this.systemDb) {
      return [];
    }

    await this.flush();

    try {
      const db = this.systemDb.getDb();
      const rows = db
        .prepare(
          `
        SELECT * FROM audit_logs
        ORDER BY timestamp DESC
        LIMIT ?
      `,
        )
        .all(limit) as AuditLogRow[];

      return rows.map((row) => ({
        timestamp: row.timestamp,
        requestId: row.requestId,
        tool: row.tool,
        category: row.category as AuditCategory,
        scope: row.scope,
        user: row.user,
        scopes: row.scopesJson ? (JSON.parse(row.scopesJson) as string[]) : [],
        durationMs: row.durationMs,
        success: row.success === 1,
        tokenEstimate: row.tokenEstimate ?? undefined,
        error: row.error ?? undefined,
        args: row.argsJson
          ? (JSON.parse(row.argsJson) as Record<string, unknown>)
          : undefined,
        backup: row.backupPath ?? undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Search and filter audit entries from the SystemDb.
   */
  async search(filters: {
    tool?: string | undefined;
    category?: string | undefined;
    success?: boolean | undefined;
    requestId?: string | undefined;
    fromTimestamp?: string | undefined;
    toTimestamp?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<{ entries: AuditEntry[]; totalCount: number }> {
    if (this.stderrMode || !this.systemDb) {
      return { entries: [], totalCount: 0 };
    }

    await this.flush();

    try {
      const db = this.systemDb.getDb();
      let sql = "SELECT * FROM audit_logs WHERE 1=1";
      let countSql = "SELECT COUNT(*) as c FROM audit_logs WHERE 1=1";
      const params: unknown[] = [];

      if (filters.tool) {
        sql += " AND tool = ?";
        countSql += " AND tool = ?";
        params.push(filters.tool);
      }
      if (filters.category) {
        sql += " AND category = ?";
        countSql += " AND category = ?";
        params.push(filters.category);
      }
      if (filters.success !== undefined) {
        sql += " AND success = ?";
        countSql += " AND success = ?";
        params.push(filters.success ? 1 : 0);
      }
      if (filters.requestId) {
        sql += " AND requestId = ?";
        countSql += " AND requestId = ?";
        params.push(filters.requestId);
      }
      if (filters.fromTimestamp) {
        sql += " AND timestamp >= ?";
        countSql += " AND timestamp >= ?";
        params.push(filters.fromTimestamp);
      }
      if (filters.toTimestamp) {
        sql += " AND timestamp <= ?";
        countSql += " AND timestamp <= ?";
        params.push(filters.toTimestamp);
      }

      const totalCount = (db.prepare(countSql).get(...params) as { c: number })
        .c;

      sql += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
      params.push(filters.limit ?? 50);
      params.push(filters.offset ?? 0);

      const rows = db.prepare(sql).all(...params) as AuditLogRow[];

      const entries = rows.map((row) => ({
        timestamp: row.timestamp,
        requestId: row.requestId,
        tool: row.tool,
        category: row.category as AuditCategory,
        scope: row.scope,
        user: row.user,
        scopes: row.scopesJson ? (JSON.parse(row.scopesJson) as string[]) : [],
        durationMs: row.durationMs,
        success: row.success === 1,
        tokenEstimate: row.tokenEstimate ?? undefined,
        error: row.error ?? undefined,
        args: row.argsJson
          ? (JSON.parse(row.argsJson) as Record<string, unknown>)
          : undefined,
        backup: row.backupPath ?? undefined,
      }));

      return { entries, totalCount };
    } catch {
      return { entries: [], totalCount: 0 };
    }
  }
}
