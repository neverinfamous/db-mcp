import type { Database } from "better-sqlite3";
import { logger } from "../utils/logger/index.js";
import { dirname } from "path";
import { mkdirSync } from "fs";

export interface SystemDbConfig {
  dbPath: string;
}

export class SystemDb {
  private db: Database | null = null;
  private readonly config: SystemDbConfig;

  constructor(config: SystemDbConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    try {
      const BetterSqlite3 = (await import("better-sqlite3")).default;
      
      if (this.config.dbPath !== ":memory:") {
        mkdirSync(dirname(this.config.dbPath), { recursive: true });
      }

      this.db = new BetterSqlite3(this.config.dbPath);

      // Initialize schema
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("synchronous = NORMAL");

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          requestId TEXT NOT NULL,
          tool TEXT NOT NULL,
          category TEXT NOT NULL,
          scope TEXT NOT NULL,
          user TEXT,
          durationMs INTEGER NOT NULL,
          success INTEGER NOT NULL,
          tokenEstimate INTEGER,
          error TEXT,
          argsJson TEXT,
          scopesJson TEXT,
          backupPath TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_tool ON audit_logs(tool);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);

        CREATE TABLE IF NOT EXISTS metrics_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          tool TEXT NOT NULL,
          calls INTEGER NOT NULL,
          errors INTEGER NOT NULL,
          p50 INTEGER NOT NULL,
          p95 INTEGER NOT NULL,
          p99 INTEGER NOT NULL,
          tokens INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_timestamp ON metrics_snapshots(timestamp);
      `);

      logger.info(`System database initialized at ${this.config.dbPath}`, { module: "SYSTEM_DB" });
    } catch (err) {
      logger.error("Failed to initialize SystemDb. better-sqlite3 may not be installed.", {
        module: "SYSTEM_DB",
        error: err instanceof Error ? err : new Error(String(err))
      });
      throw err;
    }
  }

  getDb(): Database {
    if (!this.db) {
      throw new Error("SystemDb not initialized");
    }
    return this.db;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
