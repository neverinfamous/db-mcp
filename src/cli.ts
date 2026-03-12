#!/usr/bin/env node
/**
 * db-mcp - Command Line Interface
 *
 * Entry point for running the db-mcp server from the command line.
 */

import { createServer, DEFAULT_CONFIG } from "./server/mcp-server.js";
import { VERSION } from "./version.js";
import type {
  McpServerConfig,
  TransportType,
  DatabaseConfig,
  OAuthConfig,
} from "./types/index.js";

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<McpServerConfig> {
  const args = process.argv.slice(2);
  const config: Partial<McpServerConfig> = {};
  const databases: DatabaseConfig[] = [];

  // Track extension flags (apply to last native sqlite database)
  let enableCsv = false;
  let enableSpatialite = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--transport" || arg === "-t") {
      const value = args[++i];
      if (value === "stdio" || value === "http" || value === "sse") {
        config.transport = value as TransportType;
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
    } else if (arg === "--auth-token") {
      const tokenValue = args[++i];
      if (tokenValue) {
        config.authToken = tokenValue;
      }
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
        } as DatabaseConfig);
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
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (databases.length > 0) {
    config.databases = databases;
  }

  return config;
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
  --server-host <host>      Host/IP to bind to (default: 0.0.0.0)
                            Use 127.0.0.1 to restrict to local connections
  --stateless               Use stateless HTTP mode (no session management, no SSE)
                            Ideal for serverless deployments (Lambda, Workers)

Authentication Options:
  --auth-token <token>      Simple bearer token for HTTP authentication
  --oauth-enabled, -o       Enable OAuth 2.1 authentication
  --oauth-issuer <url>      Authorization server URL (issuer)
  --oauth-audience <aud>    Expected token audience
  --oauth-jwks-uri <url>    JWKS URI (auto-discovered from issuer if not set)
  --oauth-clock-tolerance <seconds>  Clock tolerance in seconds (default: 60)

Database Options:
  --sqlite <path>           Add SQLite database (WASM/sql.js)
  --sqlite-native <path>    Add SQLite database (native/better-sqlite3)

Extension Options (Native only):
  --csv                     Load CSV extension for CSV virtual tables
  --spatialite              Load SpatiaLite extension for GIS capabilities

Server Options:
  --name <name>             Server name (default: db-mcp)
  --version <version>       Server version (default: ${VERSION})
  --tool-filter <filter>    Tool filter string. Supports:
                              Shortcuts: starter, analytics, search, spatial, minimal, full
                              Groups: core, json, text, fts5, stats, vector, geo, ...
                              Mixed: core,json,-text (whitelist with exclusions)
                              Legacy: -vector,-geo (exclusion from all)

Environment Variables:
  MCP_HOST                  Host/IP to bind to (default: 0.0.0.0)
  MCP_AUTH_TOKEN             Simple bearer token (same as --auth-token)
  OAUTH_ENABLED              Enable OAuth 2.1 (same as --oauth-enabled)
  OAUTH_ISSUER               Authorization server URL
  OAUTH_AUDIENCE             Expected token audience
  OAUTH_JWKS_URI             JWKS URI
  OAUTH_CLOCK_TOLERANCE      Clock tolerance in seconds
  DB_MCP_TOOL_FILTER        Tool filter string
  SQLITE_DATABASE           SQLite database path
  CSV_EXTENSION_PATH        Custom path to CSV extension binary
  SPATIALITE_PATH           Custom path to SpatiaLite extension binary

Examples:
  db-mcp --sqlite-native ./data.db
  db-mcp --sqlite-native ./data.db --tool-filter "starter"
  db-mcp --transport http --port 3000 --auth-token my-secret --sqlite ./data.db
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
    config.authToken = authToken;
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

  // SQLite database from environment
  const sqliteUri =
    process.env["SQLITE_DATABASE"] ?? process.env["SQLITE_PATH"];
  if (sqliteUri) {
    databases.push({ type: "sqlite", connectionString: sqliteUri });
  }

  if (databases.length > 0) {
    config.databases = databases;
  }

  return config;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Load configuration from environment, then CLI (CLI overrides env)
    const envConfig = loadEnvConfig();
    const cliConfig = parseArgs();

    const config: McpServerConfig = {
      ...DEFAULT_CONFIG,
      ...envConfig,
      ...cliConfig,
      databases: [
        ...(envConfig.databases ?? []),
        ...(cliConfig.databases ?? []),
      ],
    } as McpServerConfig;

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
    for (const dbConfig of config.databases) {
      if (dbConfig.type === "sqlite") {
        const options = dbConfig.options as { backend?: string } | undefined;
        if (options?.backend === "better-sqlite3") {
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
      console.error(
        "Warning: No databases configured. Use --sqlite or --sqlite-native, or set SQLITE_DATABASE",
      );
    }

    // Start server
    await server.start();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
