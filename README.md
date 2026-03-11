# db-mcp (SQLite MCP Server)

**Last Updated March 10, 2026**

**SQLite MCP Server** with HTTP/SSE Transport, OAuth 2.1 authentication, smart tool filtering, granular access control, 139 specialized tools, 8 resources, and 10 prompts. Available in WASM and better-sqlite3 variants.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/db--mcp-blue?logo=github)](https://github.com/neverinfamous/db-mcp)
[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/db-mcp)](https://github.com/neverinfamous/db-mcp/releases/latest)
[![npm](https://img.shields.io/npm/v/db-mcp)](https://www.npmjs.com/package/db-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/db-mcp)](https://hub.docker.com/r/writenotenow/db-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-Published-green)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/db-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/db-mcp)
[![E2E](https://github.com/neverinfamous/db-mcp/actions/workflows/e2e.yml/badge.svg)](https://github.com/neverinfamous/db-mcp/actions/workflows/e2e.yml)
![Tests](https://img.shields.io/badge/Tests-941%20passed-brightgreen)
![Coverage](https://img.shields.io/badge/Coverage-80%25-yellow)

**[Wiki](https://github.com/neverinfamous/db-mcp/wiki)** • **[Changelog](CHANGELOG.md)**

---

## 🎯 What Sets Us Apart

| Feature                          | Description                                                                                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **139 Specialized Tools**        | The most comprehensive SQLite MCP server available — core CRUD, JSON/JSONB, FTS5 full-text search, statistical analysis, vector search, geospatial/SpatiaLite, introspection, migration, and admin |
| **Code Mode**                    | **Massive Token Savings:** Execute complex, multi-step operations inside a fast, secure JavaScript sandbox — reducing token overhead by up to 90% while exposing all 139 capabilities locally      |
| **8 Resources**                  | Schema, tables, indexes, views, health status, database metadata, and business insights — always readable regardless of tool configuration                                                         |
| **10 AI-Powered Prompts**        | Guided workflows for schema exploration, query building, data analysis, optimization, migration, debugging, and hybrid FTS5 + vector search                                                        |
| **Dual SQLite Backends**         | WASM (sql.js) for zero-compilation portability, Native (better-sqlite3) for full features including transactions, window functions, and SpatiaLite GIS                                             |
| **OAuth 2.1 + Access Control**   | Enterprise-ready security with RFC 9728/8414 compliance, granular scopes (`read`, `write`, `admin`, `db:*`, `table:*:*`), and Keycloak integration                                                 |
| **Smart Tool Filtering**         | 9 tool groups + 7 shortcuts let you stay within IDE limits while exposing exactly what you need                                                                                                    |
| **HTTP Streaming Transport**     | Dual-protocol HTTP with Streamable HTTP + Legacy SSE, security headers, rate limiting, health check, and stateless mode for serverless                                                             |
| **Production-Ready Security**    | SQL injection prevention via parameter binding, input validation, non-root Docker execution, and build provenance                                                                                  |
| **Strict TypeScript**            | 100% type-safe codebase with strict mode, no `any` types                                                                                                                                           |
| **Deterministic Error Handling** | Every tool returns structured `{success, error}` responses — no raw exceptions, no silent failures. Agents get actionable context instead of cryptic error codes                                   |
| **MCP 2025-11-25 Compliant**     | Full protocol support with tool safety hints, resource priorities, and progress notifications                                                                                                      |

## 🚀 Quick Start

### Option 1: Docker (Recommended)

Pull and run instantly:

```bash
docker pull writenotenow/db-mcp:latest
```

Run with volume mount:

```bash
docker run -i --rm \
  -v $(pwd):/workspace \
  writenotenow/db-mcp:latest \
  --sqlite-native /workspace/database.db
```

### Option 2: Node.js Installation

Clone the repository:

```bash
git clone https://github.com/neverinfamous/db-mcp.git
```

Navigate to directory:

```bash
cd db-mcp
```

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Run the server:

```bash
# Native backend (better-sqlite3) - Full features, requires Node.js native build
node dist/cli.js --transport stdio --sqlite-native ./database.db

# WASM backend (sql.js) - Cross-platform, no compilation required
node dist/cli.js --transport stdio --sqlite ./database.db
```

> **Backend Choice:** Use `--sqlite-native` for full features (139 tools, transactions, window functions, SpatiaLite). Use `--sqlite` for WASM mode (115 tools, no native dependencies).

### Verify It Works

```bash
node dist/cli.js --transport stdio --sqlite-native :memory:
```

Expected output:

```
[db-mcp] Starting MCP server...
[db-mcp] Registered adapter: Native SQLite Adapter (better-sqlite3) (sqlite:default)
[db-mcp] Server started successfully
```

Run the test suite:

```bash
npm run test
```

### Prerequisites

- ✅ Docker installed and running (for Docker method)
- ✅ Node.js 24+ (LTS) (for local installation)

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 139 tools in the native backend, you must use tool filtering to stay within limits. Use **shortcuts** or specify **groups** to enable only what you need.

### Quick Start: Recommended Configurations

#### ⭐ Recommended: Code Mode (Maximum Token Savings)

Code Mode (`sqlite_execute_code`) provides access to all 139 tools' worth of capability through a single, secure JavaScript sandbox. Instead of spending thousands of tokens on back-and-forth tool calls, Code Mode exposes all capabilities locally — reducing token overhead by up to 90%.

```json
{
  "mcpServers": {
    "db-mcp-sqlite": {
      "command": "node",
      "args": [
        "C:/path/to/db-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--sqlite-native",
        "C:/path/to/database.db",
        "--tool-filter",
        "codemode"
      ]
    }
  }
}
```

This exposes just `sqlite_execute_code` plus built-in tools. The agent writes JavaScript against the typed `sqlite.*` SDK — composing queries, chaining operations across all 9 tool groups, and returning exactly the data it needs — in one execution.

#### Starter (50 tools)

If you prefer individual tool calls, `starter` provides Core + JSON + Text:

```json
{
  "args": ["--tool-filter", "starter"]
}
```

#### Custom Groups

Specify exactly the groups you need:

```json
{
  "args": ["--tool-filter", "core,json,stats"]
}
```

### Shortcuts (Predefined Bundles)

> **Note:** Native includes FTS5 (4), window functions (6), transactions (7), and SpatiaLite (7) not available in WASM.

| Shortcut     | WASM   | Native | + Built-in | What's Included                |
| ------------ | ------ | ------ | ---------- | ------------------------------ |
| `starter`    | **46** | **50** | +3         | Core, JSON, Text               |
| `analytics`  | 46     | 52     | +3         | Core, JSON, Stats              |
| `search`     | 34     | 38     | +3         | Core, Text, Vector             |
| `spatial`    | 25     | 32     | +3         | Core, Geo, Vector              |
| `dev-schema` | 25     | 25     | +3         | Core, Introspection, Migration |
| `minimal`    | 10     | 10     | +3         | Core only                      |
| `full`       | 115    | 139    | +3         | Everything enabled             |

### Tool Groups (9 Available)

> **Note:** +3 built-in tools (server_info, server_health, list_adapters) and +1 code mode are always included.

| Group           | WASM | Native | + Built-in | Description                                  |
| --------------- | ---- | ------ | ---------- | -------------------------------------------- |
| `codemode`      | 1    | 1      | +3         | Code Mode (sandboxed code execution) 🌟      |
| `core`          | 10   | 10     | +3         | Basic CRUD, schema, tables                   |
| `json`          | 24   | 24     | +3         | JSON/JSONB operations, analysis              |
| `text`          | 14   | 18     | +3         | Text processing + FTS5 + advanced search     |
| `stats`         | 14   | 20     | +3         | Statistical analysis (+ window funcs)        |
| `vector`        | 12   | 12     | +3         | Embeddings, similarity search                |
| `admin`         | 27   | 34     | +3         | Backup, restore, virtual tables, pragma      |
| `geo`           | 5    | 12     | +3         | Geospatial + SpatiaLite (Native only)        |
| `introspection` | 10   | 10     | +3         | FK graph, cascade sim, storage/index audit   |
| `migration`     | 7    | 7      | +3         | Migration tracking, apply, rollback (opt-in) |

### Syntax Reference

| Prefix   | Target   | Example         | Effect                                        |
| -------- | -------- | --------------- | --------------------------------------------- |
| _(none)_ | Shortcut | `starter`       | **Whitelist Mode:** Enable ONLY this shortcut |
| _(none)_ | Group    | `core`          | **Whitelist Mode:** Enable ONLY this group    |
| `+`      | Group    | `+vector`       | Add tools from this group to current set      |
| `-`      | Group    | `-admin`        | Remove tools in this group from current set   |
| `+`      | Tool     | `+fuzzy_search` | Add one specific tool                         |
| `-`      | Tool     | `-drop_table`   | Remove one specific tool                      |

**Examples:**

```bash
--tool-filter "starter"
--tool-filter "core,json,text,fts5"
--tool-filter "starter,+stats"
--tool-filter "starter,-fts5"
```

**Legacy Syntax (still supported):**
If you start with a negative filter (e.g., `-vector,-geo`), it assumes you want to start with _all_ tools enabled and then subtract.

```bash
--tool-filter "-stats,-vector,-geo,-backup,-monitoring,-transactions,-window"
```

## � SQLite Extensions

SQLite supports both **built-in** extensions (compiled into better-sqlite3) and **loadable** extensions (require separate binaries).

#### Built-in Extensions (work out of box)

| Extension  | Purpose                             | Status           |
| ---------- | ----------------------------------- | ---------------- |
| **FTS5**   | Full-text search with BM25 ranking  | ✅ Always loaded |
| **JSON1**  | JSON functions (json_extract, etc.) | ✅ Always loaded |
| **R-Tree** | Spatial indexing for bounding boxes | ✅ Always loaded |

#### Loadable Extensions (require installation)

| Extension      | Purpose                   | Tools | CLI Flag       |
| -------------- | ------------------------- | ----- | -------------- |
| **CSV**        | CSV virtual tables        | 2     | `--csv`        |
| **SpatiaLite** | Advanced GIS capabilities | 7     | `--spatialite` |

#### Installing Extensions

**CSV Extension:**

```bash
# Download precompiled binary or compile from SQLite source:
# https://www.sqlite.org/csv.html

# Set environment variable:
export CSV_EXTENSION_PATH=/path/to/csv.so  # Linux
export CSV_EXTENSION_PATH=/path/to/csv.dll # Windows

# Or use CLI flag:
db-mcp --sqlite-native ./data.db --csv
```

**SpatiaLite Extension:**

```bash
# Linux (apt):
sudo apt install libspatialite-dev

# macOS (Homebrew):
brew install libspatialite

# Windows: Download from https://www.gaia-gis.it/gaia-sins/

# Set environment variable:
export SPATIALITE_PATH=/path/to/mod_spatialite.so

# Or use CLI flag:
db-mcp --sqlite-native ./data.db --spatialite
```

> **Note:** Extension binaries must match your platform and architecture. The server searches common paths automatically, or use the `CSV_EXTENSION_PATH` / `SPATIALITE_PATH` environment variables for custom locations.

## 📁 Resources (8)

MCP resources provide read-only access to database metadata:

| Resource              | URI                            | Description                       | Min Config    |
| --------------------- | ------------------------------ | --------------------------------- | ------------- |
| `sqlite_schema`       | `sqlite://schema`              | Full database schema              | `minimal`     |
| `sqlite_tables`       | `sqlite://tables`              | List all tables                   | `minimal`     |
| `sqlite_table_schema` | `sqlite://table/{name}/schema` | Schema for a specific table       | `minimal`     |
| `sqlite_indexes`      | `sqlite://indexes`             | All indexes in the database       | `minimal`     |
| `sqlite_views`        | `sqlite://views`               | All views in the database         | `core,admin`  |
| `sqlite_health`       | `sqlite://health`              | Database health and status        | _(read-only)_ |
| `sqlite_meta`         | `sqlite://meta`                | Database metadata and PRAGMAs     | `core,admin`  |
| `sqlite_insights`     | `memo://insights`              | Business insights memo (analysis) | `core,admin`  |

> **Efficiency Tip:** Resources are always **readable** regardless of tool configuration. The "Min Config" column shows the smallest configuration that provides tools to **act on** what the resource exposes. Use `--tool-filter "codemode"` for maximum token efficiency, or `--tool-filter "core,admin"` (~37 WASM / ~44 Native tools) for individual tool calls.

## 💬 Prompts (10)

MCP prompts provide AI-assisted database workflows:

| Prompt                          | Description                                      |
| ------------------------------- | ------------------------------------------------ |
| `sqlite_explain_schema`         | Explain database structure and relationships     |
| `sqlite_query_builder`          | Help construct SQL queries for common operations |
| `sqlite_data_analysis`          | Analyze data patterns and provide insights       |
| `sqlite_optimization`           | Analyze and suggest database optimizations       |
| `sqlite_migration`              | Help create database migration scripts           |
| `sqlite_debug_query`            | Debug SQL queries that aren't working            |
| `sqlite_documentation`          | Generate documentation for the database schema   |
| `sqlite_summarize_table`        | Intelligent table analysis and summary           |
| `sqlite_hybrid_search_workflow` | Hybrid FTS5 + vector search workflow             |
| `sqlite_demo`                   | Interactive demo of MCP capabilities             |

## ⚡ Performance Tuning

Schema metadata is cached to reduce repeated queries during tool/resource invocations.

| Variable                | Default   | Description                                        |
| ----------------------- | --------- | -------------------------------------------------- |
| `MCP_HOST`              | `0.0.0.0` | Host/IP to bind to (HTTP transport)                |
| `METADATA_CACHE_TTL_MS` | `5000`    | Cache TTL for schema metadata (milliseconds)       |
| `LOG_LEVEL`             | `info`    | Log verbosity: `debug`, `info`, `warning`, `error` |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `1000`), or increase it for production with stable schemas (e.g., `60000` = 1 min). Schema cache is automatically invalidated on DDL operations (CREATE/ALTER/DROP).

## 📚 MCP Client Configuration

### Cursor IDE / Claude Desktop

```json
{
  "mcpServers": {
    "db-mcp-sqlite": {
      "command": "node",
      "args": [
        "C:/path/to/db-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--sqlite-native",
        "C:/path/to/your/database.db",
        "--tool-filter",
        "codemode"
      ]
    }
  }
}
```

**Variants** (modify the `args` array above):

| Variant                | Change                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **WASM backend**       | Replace `--sqlite-native` with `--sqlite`                                                          |
| **In-memory database** | Replace the database path with `:memory:`                                                          |
| **Starter preset**     | Replace `"codemode"` with `"starter"` for individual tool calls                                    |
| **CSV extension**      | Add `"--csv"` before `"--tool-filter"` (native only)                                               |
| **SpatiaLite**         | Add `"--spatialite"` and set `env: { "SPATIALITE_PATH": "/path/to/mod_spatialite" }` (native only) |
| **Linux/macOS**        | Use forward-slash Unix paths (e.g., `/path/to/db-mcp/dist/cli.js`)                                 |

> See [Tool Filtering](#️-tool-filtering) to customize which tools are exposed.

### Docker

```json
{
  "mcpServers": {
    "db-mcp-sqlite": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/path/to/project:/workspace",
        "writenotenow/db-mcp:latest",
        "--sqlite-native",
        "/workspace/database.db"
      ]
    }
  }
}
```

### HTTP/SSE Transport (Remote Access)

For remote access, web-based clients, or MCP Inspector testing, run the server in HTTP mode:

```bash
node dist/cli.js --transport http --port 3000 --server-host 0.0.0.0 --sqlite-native ./database.db
```

**Endpoints:**

| Endpoint         | Description                                      | Mode     |
| ---------------- | ------------------------------------------------ | -------- |
| `GET /`          | Server info and available endpoints              | Both     |
| `POST /mcp`      | JSON-RPC requests (initialize, tools/call, etc.) | Both     |
| `GET /mcp`       | SSE stream for server-to-client notifications    | Stateful |
| `DELETE /mcp`    | Session termination                              | Stateful |
| `GET /sse`       | Legacy SSE connection (MCP 2024-11-05)           | Stateful |
| `POST /messages` | Legacy SSE message endpoint                      | Stateful |
| `GET /health`    | Health check (always public)                     | Both     |

**Session Management:** The server uses stateful sessions by default. Include the `mcp-session-id` header (returned from initialization) in subsequent requests for session continuity.

**Security Features:**

- **7 Security Headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Cache-Control`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`
- **Rate Limiting** — 100 requests/minute per IP (429 on excess, health checks exempt)
- **CORS** — Configurable via `--cors-origins` (default: `*`)
- **Body Size Limit** — Configurable via `--max-body-bytes` (default: 1 MB)
- **404 Handler** — Unknown paths return `{ error: "Not found" }`
- **Cross-Protocol Guard** — SSE session IDs rejected on `/mcp` and vice versa

#### Stateless Mode (Serverless)

For serverless deployments (AWS Lambda, Cloudflare Workers, Vercel), use stateless mode:

```bash
node dist/cli.js --transport http --port 3000 --server-host 0.0.0.0 --stateless --sqlite-native :memory:
```

| Mode                      | Progress Notifications | Legacy SSE | Serverless |
| ------------------------- | ---------------------- | ---------- | ---------- |
| Stateful (default)        | ✅ Yes                 | ✅ Yes     | ⚠️ Complex |
| Stateless (`--stateless`) | ❌ No                  | ❌ No      | ✅ Native  |

## 🔐 OAuth 2.1 Implementation

| Component                   | Status | Description                                      |
| --------------------------- | ------ | ------------------------------------------------ |
| Protected Resource Metadata | ✅     | RFC 9728 `/.well-known/oauth-protected-resource` |
| Auth Server Discovery       | ✅     | RFC 8414 metadata discovery with caching         |
| Token Validation            | ✅     | JWT validation with JWKS support                 |
| Scope Enforcement           | ✅     | Granular `read`, `write`, `admin` scopes         |
| HTTP Transport              | ✅     | Streamable HTTP with OAuth middleware            |

### Supported Scopes

| Scope                | Description                            |
| -------------------- | -------------------------------------- |
| `read`               | Read-only access to all databases      |
| `write`              | Read and write access to all databases |
| `admin`              | Full administrative access             |
| `db:{name}`          | Access to specific database only       |
| `table:{db}:{table}` | Access to specific table only          |

### Keycloak Integration

See [docs/KEYCLOAK_SETUP.md](docs/KEYCLOAK_SETUP.md) for setting up Keycloak as your OAuth provider.

### Quick Start with OAuth

**1. Start the server with OAuth enabled:**

```bash
# Set environment variables
export KEYCLOAK_URL=http://localhost:8080
export KEYCLOAK_REALM=db-mcp
export KEYCLOAK_CLIENT_ID=db-mcp-server

# Start server with HTTP transport and OAuth
node dist/cli.js --transport http --port 3000 --server-host 0.0.0.0 --sqlite-native ./database.db
```

**2. Get an access token from Keycloak:**

```bash
# Using cURL
curl -X POST "http://localhost:8080/realms/db-mcp/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=db-mcp-server" \
  -d "client_secret=YOUR_SECRET" \
  -d "username=testuser" \
  -d "password=YOUR_PASSWORD" \
  -d "grant_type=password" \
  -d "scope=openid read write"
```

**3. Make authenticated MCP requests:**

```bash
# Initialize session with Bearer token
curl -X POST "http://localhost:3000/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'
```

> **Note:** OAuth is automatically enabled when running in HTTP mode with OAuth environment variables configured. The `/.well-known/oauth-protected-resource` endpoint provides RFC 9728 metadata for client discovery.

> **Configuration files:** Copy `.env.example` for a quick-start template. See `config/db-mcp.keycloak.json` for a complete Keycloak configuration example.

---

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## Security

For security concerns, please see our [Security Policy](SECURITY.md).

> **⚠️ Never commit credentials** - Store secrets in `.env` (gitignored)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in this project.
