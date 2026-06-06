#!/usr/bin/env node
/**
 * db-mcp - Command Line Interface
 *
 * Entry point for running the db-mcp server from the command line.
 */

import { createServer, DEFAULT_CONFIG } from "./server/mcp-server.js";
import { VERSION } from "./version.js";
import { logger } from "./utils/logger/index.js";
import { parseAllowedIoRoots } from "./utils/security-utils.js";
import type {
  McpServerConfig,
  DatabaseConfig,
  OAuthConfig,
} from "./types/index.js";
import fs from "node:fs";
import yaml from "yaml";
import {
  DEFAULT_AUDIT_LOG_MAX_SIZE_BYTES,
  DEFAULT_AUDIT_BACKUP_MAX_DATA_SIZE_BYTES,
  DEFAULT_AUDIT_BACKUP_MAX_AGE_DAYS,
  DEFAULT_AUDIT_BACKUP_MAX_COUNT,
} from "./audit/types.js";

/**
 * Parse command line arguments
 */
function parseArgs(): {
  cliConfig: Partial<McpServerConfig>;
  dumpConfig: boolean;
  configPath?: string;
} {
  const args = process.argv.slice(2);
  const config: Partial<McpServerConfig> = {};
  const databases: DatabaseConfig[] = [];

  // Track extension flags (apply to last native sqlite database)
  let enableCsv = false;
  let enableSpatialite = false;

  // Track audit flags
  let auditLogPath: string | undefined;
  let auditRedact = true;
  let auditReads = false;
  let auditBackup = false;
  let auditBackupData = false;

  // Track observability flags
  let metricsExport: "prometheus" | undefined;

  let dumpConfig = false;
  let configPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--transport" || arg === "-t") {
      const value = args[++i];
      if (value === "stdio" || value === "http" || value === "sse") {
        config.transport = value;
      }
    } else if (arg === "--port" || arg === "-p") {
      const portValue = args[++i];
      if (portValue) {
        config.port = parseInt(portValue, 10);
      }
    } else if (arg === "--server-host") {
      const hostValue = args[++i];
      if (hostValue) {
        config.host = hostValue;
      }
    } else if (arg === "--stateless") {
      // Enable stateless HTTP mode (no session management, no SSE)
      config.statelessHttp = true;
    } else if (arg === "--enable-hsts") {
      config.enableHSTS = true;
    } else if (arg === "--no-auth-enforcement") {
      config.noAuthEnforcement = true;
    } else if (arg === "--oauth-enabled" || arg === "-o") {
      if (!config.oauth) {
        config.oauth = { enabled: true };
      } else {
        config.oauth.enabled = true;
      }
    } else if (arg === "--oauth-issuer") {
      const issuerValue = args[++i];
      if (issuerValue) {
        config.oauth ??= { enabled: true };
        config.oauth.authorizationServerUrl = issuerValue;
        config.oauth.issuer = issuerValue;
      }
    } else if (arg === "--oauth-audience") {
      const audValue = args[++i];
      if (audValue) {
        config.oauth ??= { enabled: true };
        config.oauth.audience = audValue;
      }
    } else if (arg === "--oauth-jwks-uri") {
      const jwksValue = args[++i];
      if (jwksValue) {
        config.oauth ??= { enabled: true };
        config.oauth.jwksUri = jwksValue;
      }
    } else if (arg === "--oauth-clock-tolerance") {
      const tolValue = args[++i];
      if (tolValue) {
        config.oauth ??= { enabled: true };
        config.oauth.clockTolerance = parseInt(tolValue, 10);
      }
    } else if (arg === "--name") {
      const nameValue = args[++i];
      if (nameValue) {
        config.name = nameValue;
      }
    } else if (arg === "--version") {
      const versionValue = args[++i];
      if (versionValue) {
        config.version = versionValue;
      }
    } else if (arg === "--tool-filter") {
      const filterValue = args[++i];
      if (filterValue) {
        config.toolFilter = filterValue;
      }
    } else if (arg === "--sqlite") {
      const dbPath = args[++i];
      if (dbPath) {
        databases.push({
          type: "sqlite",
          connectionString: dbPath,
        });
      }
    } else if (arg === "--sqlite-native") {
      const dbPath = args[++i];
      if (dbPath) {
        databases.push({
          type: "sqlite",
          connectionString: dbPath,
          options: {
            backend: "better-sqlite3",
            csv: enableCsv,
            spatialite: enableSpatialite,
          },
        });
      }
    } else if (arg === "--csv") {
      enableCsv = true;
      // Apply to already-added native database if exists
      const lastDb = databases[databases.length - 1];
      if (lastDb?.options && "backend" in lastDb.options) {
        lastDb.options["csv"] = true;
      }
    } else if (arg === "--spatialite") {
      enableSpatialite = true;
      // Apply to already-added native database if exists
      const lastDb = databases[databases.length - 1];
      if (lastDb?.options && "backend" in lastDb.options) {
        lastDb.options["spatialite"] = true;
      }
    } else if (arg === "--encryption-key") {
      const keyValue = args[++i];
      if (keyValue) {
        // Apply to already-added native database if exists
        const lastDb = databases[databases.length - 1];
        if (lastDb?.options && "backend" in lastDb.options) {
          lastDb.options["encryptionKey"] = keyValue;
        } else {
          console.error(
            "Error: --encryption-key must be specified after --sqlite-native",
          );
          process.exit(1);
        }
      }
    } else if (arg === "--audit-log") {
      const logPath = args[++i];
      if (logPath) {
        auditLogPath = logPath;
      }
    } else if (arg === "--audit-no-redact") {
      auditRedact = false;
    } else if (arg === "--audit-reads") {
      auditReads = true;
    } else if (arg === "--audit-backup") {
      auditBackup = true;
    } else if (arg === "--audit-backup-data") {
      auditBackupData = true;
    } else if (arg === "--metrics-export") {
      const metricsValue = args[++i];
      if (metricsValue === "prometheus") {
        metricsExport = "prometheus";
      }
    } else if (arg === "--allowed-io-roots") {
      const rootsValue = args[++i];
      if (rootsValue) {
        config.allowedIoRoots = parseAllowedIoRoots(rootsValue);
      }
    } else if (arg === "--config" || arg === "-c") {
      const pathValue = args[++i];
      if (pathValue) {
        configPath = pathValue;
      }
    } else if (arg === "--dump-config") {
      dumpConfig = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (databases.length > 0) {
    config.databases = databases;
  }

  if (metricsExport) {
    config.metricsExport = metricsExport;
  }

  // Build audit config if --audit-log was specified
  if (auditLogPath) {
    config.audit = {
      enabled: true,
      logPath: auditLogPath,
      redact: auditRedact,
      auditReads: auditReads,
      maxSizeBytes: DEFAULT_AUDIT_LOG_MAX_SIZE_BYTES,
      ...(auditBackup && {
        backup: {
          enabled: true,
          includeData: auditBackupData,
          maxAgeDays: DEFAULT_AUDIT_BACKUP_MAX_AGE_DAYS,
          maxCount: DEFAULT_AUDIT_BACKUP_MAX_COUNT,
          maxDataSizeBytes: DEFAULT_AUDIT_BACKUP_MAX_DATA_SIZE_BYTES,
        },
      }),
    };
  }

  return {
    cliConfig: config,
    dumpConfig,
    ...(configPath !== undefined ? { configPath } : {}),
  };
}

/**
 * Print help message
 */
function printHelp(): void {
  // Use stderr for all output - stdout is reserved for MCP protocol
  console.error(`
db-mcp - SQLite MCP Server

Usage: db-mcp [options]

Transport Options:
  --transport, -t <type>    Transport type: stdio (default), http, sse
  --port, -p <port>         HTTP port (default: 3000)
  --server-host <host>      Host/IP to bind to (default: 127.0.0.1)
                            Use 127.0.0.1 for local, 0.0.0.0 to allow external connections
  --stateless               Use stateless HTTP mode (no session management, no SSE)
                            Ideal for serverless deployments (Lambda, Workers)
  --enable-hsts             Enable HSTS header (use when behind HTTPS)

Authentication Options:
  --no-auth-enforcement     Explicitly bypass auth enforcement for HTTP
  --oauth-enabled, -o       Enable OAuth 2.1 authentication
  --oauth-issuer <url>      Authorization server URL (issuer)
  --oauth-audience <aud>    Expected token audience
  --oauth-jwks-uri <url>    JWKS URI (auto-discovered from issuer if not set)
  --oauth-clock-tolerance <seconds>  Clock tolerance in seconds (default: 30)

Database Options:
  --sqlite <path>           Add SQLite database (WASM/sql.js)
  --sqlite-native <path>    Add SQLite database (native/better-sqlite3)

Extension Options (Native only):
  --csv                     Load CSV extension for CSV virtual tables
  --spatialite              Load SpatiaLite extension for GIS capabilities
  --encryption-key <key>    Set SQLCipher encryption key for the database

Audit Options:
  --audit-log <path>        Enable audit logging (JSONL file path, or "stderr")
  --audit-no-redact          Include tool arguments in audit entries (default: redacted)
  --audit-reads             Also log read-scoped tool invocations
  --audit-backup            Enable pre-mutation DDL snapshots
  --audit-backup-data       Include sample data rows in snapshots

Security Options:
  --allowed-io-roots <paths> Allowlisted filesystem roots for IO operations (comma-separated or JSON array)

Server Options:
  --config, -c <path>       Load configuration from YAML/JSON file
  --dump-config             Print the resolved configuration and exit
  --name <name>             Server name (default: db-mcp)
  --version <version>       Server version (default: ${VERSION})
  --metrics-export <type>   Export metrics at HTTP /metrics (e.g., prometheus)
  --tool-filter <filter>    Tool filter string. Supports:
                              Shortcuts: starter, analytics, search, spatial, minimal, full
                              Groups: core, json, text, stats, vector, geo, ...
                              Mixed: core,json,-text (whitelist with exclusions)
                              Legacy: -vector,-geo (exclusion from all)

Environment Variables:
  MCP_HOST                  Host/IP to bind to (default: 127.0.0.1)
  MCP_AUTH_TOKEN             Simple bearer token
  OAUTH_ENABLED              Enable OAuth 2.1 (same as --oauth-enabled)
  OAUTH_ISSUER               Authorization server URL
  OAUTH_AUDIENCE             Expected token audience
  OAUTH_JWKS_URI             JWKS URI
  OAUTH_CLOCK_TOLERANCE      Clock tolerance in seconds
  MCP_ENABLE_HSTS            Enable HSTS header (same as --enable-hsts)
  DB_MCP_TOOL_FILTER        Tool filter string
  SQLITE_DATABASE           SQLite database path
  DB_ENCRYPTION_KEY         SQLCipher encryption key (Native only)
  CSV_EXTENSION_PATH        Custom path to CSV extension binary
  SPATIALITE_PATH           Custom path to SpatiaLite extension binary
  METRICS_EXPORT            Export metrics (e.g., prometheus)
  AUDIT_LOG                 Audit log file path (or "stderr")
  AUDIT_REDACT              Redact arguments (default: true, set false to include args)
  AUDIT_READS               Log reads (true/false)
  AUDIT_BACKUP              Enable backups (true/false)
  AUDIT_BACKUP_DATA         Include data (true/false)

Examples:
  db-mcp --sqlite-native ./data.db
  db-mcp --sqlite-native ./data.db --tool-filter "starter"
  MCP_AUTH_TOKEN=my-secret db-mcp --transport http --port 3000 --sqlite ./data.db
  db-mcp --transport http --oauth-enabled --oauth-issuer http://keycloak:8080/realms/mcp --oauth-audience db-mcp --sqlite ./data.db

For more information, visit: https://github.com/neverinfamous/db-mcp
`);
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<McpServerConfig> {
  const config: Partial<McpServerConfig> = {};
  const databases: DatabaseConfig[] = [];

  // Host from environment
  const host = process.env["MCP_HOST"] ?? process.env["HOST"];
  if (host) {
    config.host = host;
  }

  // Simple bearer token from environment
  const authToken = process.env["MCP_AUTH_TOKEN"];
  if (authToken) {
    if (authToken.length < 32) {
      logger.warning(
        "MCP_AUTH_TOKEN is too short (< 32 chars). Use a cryptographically random token.",
      );
    }
    config.authToken = authToken;
  }

  if (process.env["NO_AUTH_ENFORCEMENT"] === "true") {
    logger.warning(
      "Auth enforcement explicitly disabled via NO_AUTH_ENFORCEMENT. Ensure this is not running in production.",
    );
    config.noAuthEnforcement = true;
  }

  // OAuth from environment
  const oauthEnabled = process.env["OAUTH_ENABLED"] === "true";
  if (oauthEnabled) {
    const oauth: OAuthConfig = { enabled: true };
    const issuer = process.env["OAUTH_ISSUER"];
    if (issuer) {
      oauth.authorizationServerUrl = issuer;
      oauth.issuer = issuer;
    }
    const audience = process.env["OAUTH_AUDIENCE"];
    if (audience) oauth.audience = audience;
    const jwksUri = process.env["OAUTH_JWKS_URI"];
    if (jwksUri) oauth.jwksUri = jwksUri;
    const clockTolerance = process.env["OAUTH_CLOCK_TOLERANCE"];
    if (clockTolerance) oauth.clockTolerance = parseInt(clockTolerance, 10);
    config.oauth = oauth;
  }

  // Tool filter from environment
  const toolFilter =
    process.env["DB_MCP_TOOL_FILTER"] ?? process.env["TOOL_FILTER"];
  if (toolFilter) {
    config.toolFilter = toolFilter;
  }

  // Audit from environment
  const auditLog = process.env["AUDIT_LOG"];
  if (auditLog) {
    config.audit = {
      enabled: true,
      logPath: auditLog,
      redact: process.env["AUDIT_REDACT"] !== "false",
      auditReads: process.env["AUDIT_READS"] === "true",
      maxSizeBytes: DEFAULT_AUDIT_LOG_MAX_SIZE_BYTES,
      ...(process.env["AUDIT_BACKUP"] === "true" && {
        backup: {
          enabled: true,
          includeData: process.env["AUDIT_BACKUP_DATA"] === "true",
          maxAgeDays: DEFAULT_AUDIT_BACKUP_MAX_AGE_DAYS,
          maxCount: DEFAULT_AUDIT_BACKUP_MAX_COUNT,
          maxDataSizeBytes: DEFAULT_AUDIT_BACKUP_MAX_DATA_SIZE_BYTES,
        },
      }),
    };
  }

  // SQLite database from environment
  const sqliteUri =
    process.env["SQLITE_DATABASE"] ?? process.env["SQLITE_PATH"];
  if (sqliteUri) {
    databases.push({ type: "sqlite", connectionString: sqliteUri });
  }

  // Metrics from environment
  if (process.env["METRICS_EXPORT"] === "prometheus") {
    config.metricsExport = "prometheus";
  }

  // Allowed IO Roots from environment
  const allowedIoRoots = process.env["ALLOWED_IO_ROOTS"];
  if (allowedIoRoots) {
    config.allowedIoRoots = parseAllowedIoRoots(allowedIoRoots);
  }

  if (databases.length > 0) {
    config.databases = databases;
  }

  return config;
}

/**
 * Load configuration from a JSON or YAML file
 */
function loadConfigFile(configPath: string): Partial<McpServerConfig> {
  try {
    const fileContent = fs.readFileSync(configPath, "utf-8");
    if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
      return yaml.parse(fileContent) as Partial<McpServerConfig>;
    } else {
      return JSON.parse(fileContent) as Partial<McpServerConfig>;
    }
  } catch (error) {
    logger.error(`Failed to load config file: ${configPath}`, {
      error: error instanceof Error ? error : new Error(String(error)),
      module: "CLI",
    });
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Parse CLI args first to get config path and dump flag
    const { cliConfig, dumpConfig, configPath } = parseArgs();

    // Load config file if specified
    const fileConfig = configPath ? loadConfigFile(configPath) : {};

    // Load configuration from environment
    const envConfig = loadEnvConfig();

    const config: McpServerConfig = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      ...envConfig,
      ...cliConfig,
      databases: [
        ...(fileConfig.databases ?? []),
        ...(envConfig.databases ?? []),
        ...(cliConfig.databases ?? []),
      ],
    } as McpServerConfig;

    if (dumpConfig) {
      // Redact sensitive values before dumping
      const safeConfig = JSON.parse(JSON.stringify(config)) as Record<
        string,
        unknown
      >;
      if (typeof safeConfig["authToken"] === "string") {
        safeConfig["authToken"] = "***REDACTED***";
      }
      if (
        typeof safeConfig["oauth"] === "object" &&
        safeConfig["oauth"] !== null
      ) {
        const oauth = safeConfig["oauth"] as Record<string, unknown>;
        if (typeof oauth["jwksUri"] === "string") {
          oauth["jwksUri"] = "***REDACTED***";
        }
      }

      process.stdout.write(JSON.stringify(safeConfig, null, 2) + "\n");
      process.exit(0);
    }

    // Security Check: Prevent unauthenticated production access
    if (
      process.env["NODE_ENV"] === "production" &&
      config.transport === "http" &&
      !config.oauth?.enabled &&
      !config.authToken &&
      !config.noAuthEnforcement
    ) {
      logger.error(
        "FATAL SECURITY ERROR: HTTP transport in production requires authentication (--oauth-enabled or --auth-token). If you intend to run without authentication, you must explicitly pass --no-auth-enforcement.",
        { module: "SERVER" },
      );
      process.exit(1);
    }

    // Create server
    const server = createServer(config);

    // Handle shutdown signals
    process.on("SIGINT", () => {
      void server.shutdown().then(() => {
        process.exit(0);
      });
    });

    process.on("SIGTERM", () => {
      void server.shutdown().then(() => {
        process.exit(0);
      });
    });

    // Register database adapters based on config.databases
    const globalEncryptionKey = process.env["DB_ENCRYPTION_KEY"];

    for (const dbConfig of config.databases) {
      if (dbConfig.type === "sqlite") {
        const options = (dbConfig.options ?? {}) as {
          backend?: string;
          encryptionKey?: string;
        };
        if (globalEncryptionKey && !options.encryptionKey) {
          if (options.backend === "better-sqlite3") {
            options.encryptionKey = globalEncryptionKey;
          }
        }
        dbConfig.options = options;

        if (options.encryptionKey && options.backend !== "better-sqlite3") {
          logger.error(
            "FATAL: SQLCipher encryption is only supported with the native better-sqlite3 backend. Use --sqlite-native or specify backend: 'better-sqlite3' in config.",
            { module: "CLI" },
          );
          process.exit(1);
        }

        if (options.backend === "better-sqlite3") {
          // Use native SQLite adapter with FTS5, window functions, transactions
          const { NativeSqliteAdapter } =
            await import("./adapters/sqlite-native/index.js");
          const adapter = new NativeSqliteAdapter();
          await server.registerAdapter(adapter, dbConfig);
        } else {
          // Use sql.js WASM adapter (default)
          const { SqliteAdapter } = await import("./adapters/sqlite/index.js");
          const adapter = new SqliteAdapter();
          await server.registerAdapter(adapter, dbConfig);
        }
      }
    }

    if (config.databases.length === 0) {
      logger.warning(
        "Warning: No databases configured. Use --sqlite or --sqlite-native, or set SQLITE_DATABASE",
      );
    }

    // Start server
    await server.start();
  } catch (error: unknown) {
    logger.error("Fatal error", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    process.exit(1);
  }
}

// Run
main().catch((error: unknown) => {
  logger.error("Unhandled fatal error", {
    error: error instanceof Error ? error : new Error(String(error)),
  });
  process.exit(1);
});
