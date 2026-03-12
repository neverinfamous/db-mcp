# db-mcp (SQLite MCP Server)

**Last Updated March 12, 2026**

**SQLite MCP Server** with 139 specialized tools, 8 resources, and 10 prompts, HTTP/SSE Transport, OAuth 2.1 authentication, tool filtering, granular access control, and structured error handling with categorized, actionable responses. Available in WASM and better-sqlite3 variants.

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

| Feature                        | Description                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **139 Specialized Tools**      | The most comprehensive SQLite MCP server available — core CRUD, JSON/JSONB, FTS5 full-text search, statistical analysis, vector search, geospatial/SpatiaLite, introspection, migration, and admin           |
| **8 Resources**                | Schema, tables, indexes, views, health status, database metadata, and business insights — always readable regardless of tool configuration                                                                   |
| **10 AI-Powered Prompts**      | Guided workflows for schema exploration, query building, data analysis, optimization, migration, debugging, and hybrid FTS5 + vector search                                                                  |
| **Code Mode**                  | **Massive Token Savings:** Execute complex, multi-step operations inside a fast, secure JavaScript sandbox — reducing token overhead by up to 90% while exposing all 139 capabilities locally                |
| **Token-Optimized Payloads**   | Every tool response is audited for token efficiency. Tools with large payloads offer optional flags (`compact`, `nodesOnly`, `maxOutliers`, `minSeverity`, `maxInvalid`) to reduce response size             |
| **Dual SQLite Backends**       | WASM (sql.js) for zero-compilation portability, Native (better-sqlite3) for full features including transactions, window functions, and SpatiaLite GIS                                                       |
| **Performance**                | **⚠️ WASM Caution:** Synchronous execution blocks Node Event Loop on heavy workloads. **🚀 Native:** High-performance concurrent execution.                                                                  |
| **OAuth 2.1 + Access Control** | Enterprise-ready security with RFC 9728/8414 compliance, granular scopes (`read`, `write`, `admin`, `db:*`, `table:*:*`), and Keycloak integration                                                           |
| **Smart Tool Filtering**       | 9 tool groups + 7 shortcuts let you stay within IDE limits while exposing exactly what you need                                                                                                              |
| **HTTP Streaming Transport**   | Dual-protocol HTTP with Streamable HTTP + Legacy SSE, security headers, rate limiting, health check, and stateless mode for serverless                                                                       |
| **Production-Ready Security**  | SQL injection prevention via parameter binding, input validation, non-root Docker execution, and build provenance                                                                                            |
| **Strict TypeScript**          | 100% type-safe codebase with strict mode, no `any` types                                                                                                                                                     |
| **Structured Error Handling**  | Every tool returns rich `{success, error, code, category, suggestion, recoverable}` responses — no raw exceptions. Agents get error classification, actionable remediation hints, and recoverability signals |
| **MCP 2025-03-26 Compliant**   | Full protocol support with tool safety hints, resource priorities, and progress notifications                                                                                                                |

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

### Tool Groups (10 Available)

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

| Resource              | URI                                 | Description                       | Min Config    |
| --------------------- | ----------------------------------- | --------------------------------- | ------------- |
| `sqlite_schema`       | `sqlite://schema`                   | Full database schema              | `minimal`     |
| `sqlite_tables`       | `sqlite://tables`                   | List all tables                   | `minimal`     |
| `sqlite_table_schema` | `sqlite://table/{tableName}/schema` | Schema for a specific table       | `minimal`     |
| `sqlite_indexes`      | `sqlite://indexes`                  | All indexes in the database       | `minimal`     |
| `sqlite_views`        | `sqlite://views`                    | All views in the database         | `core,admin`  |
| `sqlite_health`       | `sqlite://health`                   | Database health and status        | _(read-only)_ |
| `sqlite_meta`         | `sqlite://meta`                     | Database metadata and PRAGMAs     | `core,admin`  |
| `sqlite_insights`     | `memo://insights`                   | Business insights memo (analysis) | `core,admin`  |

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

## 🔧 Configuration

### Environment Variables

| Variable                | Default   | Description                                                   |
| ----------------------- | --------- | ------------------------------------------------------------- |
| `MCP_HOST`              | `0.0.0.0` | Host/IP to bind to (CLI: `--server-host`)                     |
| `SQLITE_DATABASE`       | —         | SQLite database path (CLI: `--sqlite` / `--sqlite-native`)    |
| `DB_MCP_TOOL_FILTER`    | —         | Tool filter string (CLI: `--tool-filter`)                     |
| `MCP_AUTH_TOKEN`        | —         | Simple bearer token for HTTP auth (CLI: `--auth-token`)       |
| `OAUTH_ENABLED`         | `false`   | Enable OAuth 2.1 (CLI: `--oauth-enabled`)                    |
| `OAUTH_ISSUER`          | —         | Authorization server URL (CLI: `--oauth-issuer`)              |
| `OAUTH_AUDIENCE`        | —         | Expected token audience (CLI: `--oauth-audience`)             |
| `OAUTH_JWKS_URI`        | —         | JWKS URI, auto-discovered if omitted (CLI: `--oauth-jwks-uri`)|
| `OAUTH_CLOCK_TOLERANCE` | `60`      | Clock tolerance in seconds (CLI: `--oauth-clock-tolerance`)   |
| `LOG_LEVEL`             | `info`    | Log verbosity: `debug`, `info`, `warning`, `error`            |
| `METADATA_CACHE_TTL_MS` | `5000`    | Schema cache TTL in ms (auto-invalidated on DDL operations)   |
| `CODEMODE_ISOLATION`    | `worker`  | Code Mode sandbox: `worker` (enhanced isolation) or `vm`      |
| `MCP_RATE_LIMIT_MAX`    | `100`     | Max requests/minute per IP (HTTP transport)                   |
| `CSV_EXTENSION_PATH`    | —         | Custom path to CSV extension binary (native only)             |
| `SPATIALITE_PATH`       | —         | Custom path to SpatiaLite extension binary (native only)      |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `1000`), or increase it for production with stable schemas (e.g., `60000` = 1 min). Schema cache is automatically invalidated on DDL operations (CREATE/ALTER/DROP).

### CLI Reference

```
db-mcp [options]

Transport:    --transport <stdio|http|sse>  --port <N>  --server-host <host>  --stateless
Auth:         --auth-token <token>  |  --oauth-enabled --oauth-issuer <url> --oauth-audience <aud>
Database:     --sqlite <path>  |  --sqlite-native <path>
Extensions:   --csv  --spatialite                         (native only)
Server:       --name <name>  --version <ver>  --tool-filter <filter>
```

> CLI flags override environment variables. Run `node dist/cli.js --help` for full details.

## 📚 MCP Client Configuration

Add to your `~/.cursor/mcp.json`, Claude Desktop config, or equivalent:

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

| Variant                | Change                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **WASM backend**       | Replace `--sqlite-native` with `--sqlite`                                                                                            |
| **In-memory database** | Replace the database path with `:memory:`                                                                                            |
| **Starter preset**     | Replace `"codemode"` with `"starter"` for individual tool calls                                                                      |
| **CSV extension**      | Add `"--csv"` before `"--tool-filter"` (native only)                                                                                 |
| **SpatiaLite**         | Add `"--spatialite"` and set `env: { "SPATIALITE_PATH": "/path/to/mod_spatialite" }` (native only)                                   |
| **Linux/macOS**        | Use forward-slash Unix paths (e.g., `/path/to/db-mcp/dist/cli.js`)                                                                   |
| **Docker**             | Replace `"command": "node"` with `"command": "docker"` and wrap args in `run -i --rm -v ./data:/app/data writenotenow/db-mcp:latest` |

> See [Tool Filtering](#️-tool-filtering) to customize which tools are exposed.

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

- **7 Security Headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Cache-Control`, `Referrer-Policy` (no-referrer), `Permissions-Policy` + opt-in `Strict-Transport-Security` via `enableHSTS`
- **Server Timeouts** — Request, keep-alive, and headers timeouts prevent slowloris-style DoS
- **Rate Limiting** — 100 requests/minute per IP (429 + Retry-After on excess, health checks exempt)
- **CORS** — Configurable via `--cors-origins` (default: `*`, supports wildcard subdomains like `*.example.com`). ⚠️ **Security Warning:** The default `*` allows requests from any origin. For production HTTP deployments, explicitly configure this to your trusted domains.
- **Trust Proxy** — Opt-in `trustProxy` for X-Forwarded-For IP extraction behind reverse proxies
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

## 🔐 Authentication

db-mcp supports two authentication mechanisms for HTTP transport:

### Simple Bearer Token (`--auth-token`)

Lightweight authentication for development or single-tenant deployments:

```bash
# CLI
node dist/cli.js --transport http --port 3000 --auth-token my-secret --sqlite-native ./database.db

# Environment variable
export MCP_AUTH_TOKEN=my-secret
node dist/cli.js --transport http --port 3000 --sqlite-native ./database.db
```

Clients must include `Authorization: Bearer my-secret` on all requests. `/health` and `/` are exempt. Unauthenticated requests receive `401` with `WWW-Authenticate: Bearer` headers per RFC 6750.

### OAuth 2.1 (Enterprise)

Full OAuth 2.1 with RFC 9728/8414 compliance for production multi-tenant deployments:

| Component                   | Status | Description                                      |
| --------------------------- | ------ | ------------------------------------------------ |
| Protected Resource Metadata | ✅     | RFC 9728 `/.well-known/oauth-protected-resource` |
| Auth Server Discovery       | ✅     | RFC 8414 metadata discovery with caching         |
| Token Validation            | ✅     | JWT validation with JWKS support                 |
| Scope Enforcement           | ✅     | Granular `read`, `write`, `admin` scopes         |
| HTTP Transport              | ✅     | Streamable HTTP with OAuth middleware            |

#### Supported Scopes

| Scope                | Description                            |
| -------------------- | -------------------------------------- |
| `read`               | Read-only access to all databases      |
| `write`              | Read and write access to all databases |
| `admin`              | Full administrative access             |
| `db:{name}`          | Access to specific database only       |
| `table:{db}:{table}` | Access to specific table only          |

#### Quick Start with OAuth CLI Flags

```bash
node dist/cli.js --transport http --port 3000 \
  --oauth-enabled \
  --oauth-issuer http://localhost:8080/realms/db-mcp \
  --oauth-audience db-mcp-server \
  --sqlite-native ./database.db
```

> **Additional flags:** `--oauth-jwks-uri <url>` (auto-discovered if omitted), `--oauth-clock-tolerance <seconds>` (default: 60).

#### Keycloak Integration

See [docs/KEYCLOAK_SETUP.md](docs/KEYCLOAK_SETUP.md) for setting up Keycloak as your OAuth provider.

> **Priority:** When both `--auth-token` and `--oauth-enabled` are set, OAuth 2.1 takes precedence. If neither is configured, the server warns and runs without authentication.

## 📊 Benchmarks

Performance benchmarks measure framework overhead on critical hot paths using [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) (tinybench). The suite validates that framework plumbing stays negligible relative to actual database I/O:

- **Tool dispatch:** ~11M ops/sec — Map-based lookup is effectively zero-cost
- **Auth scope checks:** 7–9M ops/sec — OAuth middleware adds no measurable latency
- **Identifier validation:** 6.4M ops/sec — SQL sanitization is near-instant
- **Schema cache hits:** 4.3M ops/sec — metadata lookups avoid redundant queries
- **Debug log (filtered):** 9.5M ops/sec — disabled log levels are true no-ops (50× faster than actual writes)
- **Code Mode security:** 1.2M validations/sec for typical code, blocked patterns rejected in <1 µs

```bash
npm run bench            # Run all benchmarks
npm run bench:verbose    # Verbose mode with detailed timings
```

| Benchmark             | What It Measures                                                        |
| --------------------- | ----------------------------------------------------------------------- |
| Handler Dispatch      | Tool lookup, error construction, progress notification overhead         |
| Utilities             | Identifier sanitization, WHERE clause validation, SQL validation        |
| Tool Filtering        | Filter parsing, group lookups, meta-group catalog generation            |
| Schema Parsing        | Zod schema validation for simple/complex/large payloads + failure paths |
| Logger & Sanitization | Log call overhead, message sanitization, sensitive data redaction       |
| Transport & Auth      | Token extraction, scope checking, error formatting, rate limiting       |
| Code Mode             | Sandbox creation, pool lifecycle, security validation, execution        |
| Database Operations   | PRAGMA ops, table metadata, query result processing, schema caching     |
| Resource & Prompts    | URI matching, content assembly, prompt generation, tool indexing        |

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
