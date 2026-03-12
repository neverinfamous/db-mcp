import initSqlJs, { type Database } from "sql.js";
import type { DatabaseConfig } from "../../../types/index.js";
import { createModuleLogger, ERROR_CODES } from "../../../utils/logger/index.js";
import { ConnectionError, ConfigurationError } from "../../../utils/errors/index.js";
import type { SqliteConfig } from "../types.js";
import { SchemaManager } from "../schema-manager.js";
import { applyCommonPragmas, autoEnableWal, detectAndSetJsonbSupport } from "../../sqlite-helpers.js";
import type { SqliteAdapter } from "../sqlite-adapter.js";

const log = createModuleLogger("SQLITE");

export interface ConnectionResult {
  db: Database;
  sqlJsInstance: Awaited<ReturnType<typeof initSqlJs>>;
  schemaManager: SchemaManager;
}

export async function connectSqliteDatabase(
  adapter: SqliteAdapter,
  config: DatabaseConfig,
): Promise<ConnectionResult> {
  if (config.type !== "sqlite") {
    throw new ConfigurationError(
      `Invalid database type: expected 'sqlite', got '${config.type as string}'`,
      "DB_TYPE_MISMATCH",
    );
  }

  const sqliteConfig = config as SqliteConfig;

  try {
    const sqlJsInstance = await initSqlJs();
    const filePath = sqliteConfig.filePath ?? sqliteConfig.connectionString ?? ":memory:";
    let db: Database;

    if (filePath === ":memory:") {
      db = new sqlJsInstance.Database();
      log.info("Connected to in-memory SQLite database", {
        code: "SQLITE_CONNECT",
      });
    } else {
      try {
        const fs = await import("fs");
        if (fs.existsSync(filePath)) {
          const buffer = await fs.promises.readFile(filePath);
          db = new sqlJsInstance.Database(buffer);
          log.info(`Connected to SQLite database: ${filePath}`, {
            code: "SQLITE_CONNECT",
          });
        } else {
          db = new sqlJsInstance.Database();
          log.info(`Created new SQLite database: ${filePath}`, {
            code: "SQLITE_CONNECT",
          });
        }
      } catch {
        db = new sqlJsInstance.Database();
        log.warning("File access unavailable, using in-memory database", {
          code: "SQLITE_FALLBACK",
        });
      }
    }

    if (sqliteConfig.options) {
      applyCommonPragmas(
        { runPragma: (pragma) => db.run(`PRAGMA ${pragma}`) },
        sqliteConfig.options,
      );
    }

    autoEnableWal(
      { runPragma: (pragma) => db.run(`PRAGMA ${pragma}`) },
      filePath,
      sqliteConfig.options,
      log,
    );

    detectAndSetJsonbSupport(() => {
      const versionResult = db.exec("SELECT sqlite_version()");
      return (versionResult[0]?.values[0]?.[0] as string) ?? "0.0.0";
    }, log);

    const schemaManager = new SchemaManager(adapter);

    return { db, sqlJsInstance, schemaManager };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to connect to SQLite: ${message}`, {
      code: ERROR_CODES.DB.CONNECT_FAILED.full,
    });
    throw new ConnectionError(
      `SQLite connection failed: ${message}`,
      "DB_CONNECT_FAILED",
      {
        cause: error instanceof Error ? error : undefined,
      },
    );
  }
}

export async function disconnectSqliteDatabase(
  db: Database,
  config: SqliteConfig | null,
): Promise<void> {
  if (config?.filePath && config.filePath !== ":memory:") {
    try {
      const fs = await import("fs");
      const data = db.export();
      await fs.promises.writeFile(config.filePath, Buffer.from(data));
      log.info(`Saved database to: ${config.filePath}`, {
        code: "SQLITE_DISCONNECT",
      });
    } catch {
      log.warning("Could not save database to file", {
        code: "SQLITE_SAVE_FAILED",
      });
    }
  }

  db.close();
  log.info("Disconnected from SQLite database", {
    code: "SQLITE_DISCONNECT",
  });
}
