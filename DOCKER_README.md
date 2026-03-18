# db-mcp (SQLite MCP Server)

**SQLite MCP Server** with 139 specialized tools, 8 data resources + 7 help resources, and 10 prompts, HTTP/SSE Transport, OAuth 2.1 authentication, tool filtering, granular access control, and structured error handling with categorized, actionable responses. Available in WASM and better-sqlite3 variants.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/db--mcp-blue?logo=github)](https://github.com/neverinfamous/db-mcp)
[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/db-mcp)](https://github.com/neverinfamous/db-mcp/releases/latest)
[![npm](https://img.shields.io/npm/v/db-mcp)](https://www.npmjs.com/package/db-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/db-mcp)](https://hub.docker.com/r/writenotenow/db-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-Published-green)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/db-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/db-mcp/blob/main/SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/db-mcp)
[![E2E](https://github.com/neverinfamous/db-mcp/actions/workflows/e2e.yml/badge.svg)](https://github.com/neverinfamous/db-mcp/actions/workflows/e2e.yml)
![Tests](https://img.shields.io/badge/Tests-941%20passed-brightgreen)
![Coverage](https://img.shields.io/badge/Coverage-80%25-yellow)

**[GitHub](https://github.com/neverinfamous/db-mcp)** • **[Wiki](https://github.com/neverinfamous/db-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/db-mcp/blob/main/CHANGELOG.md)**

---

## 🎯 What Sets Us Apart

| Feature                        | Description                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **139 Specialized Tools**      | The most comprehensive SQLite MCP server available — core CRUD, JSON/JSONB, FTS5 full-text search, statistical analysis, vector search, geospatial/SpatiaLite, introspection, migration, and admin           |
| **15 Resources**               | 8 data resources (schema, tables, indexes, views, health, metadata, insights) + 7 help resources (`sqlite://help` + per-group reference) — filtered by `--tool-filter`                                       |
| **10 AI-Powered Prompts**      | Guided workflows for schema exploration, query building, data analysis, optimization, migration, debugging, and hybrid FTS5 + vector search                                                                  |
| **Code Mode**                  | **Massive Token Savings:** Execute complex, multi-step operations inside a fast, secure JavaScript sandbox. Instead of spending thousands of tokens on back-and-forth tool calls, Code Mode exposes all 139 capabilities locally, reducing token overhead by up to 90% and supercharging AI agent reasoning |
| **Token-Optimized Payloads**   | Every tool response is designed for minimal token footprint. Tools include `compact`, `nodesOnly`, `maxOutliers`, `minSeverity`, and `maxInvalid` parameters where applicable — letting agents control response size without losing data access. Large datasets include metadata so agents always know the full picture |
| **Dual SQLite Backends**       | WASM (sql.js) for zero-compilation portability, Native (better-sqlite3) for full features including transactions, window functions, and SpatiaLite GIS                                                       |
| **OAuth 2.1 + Access Control** | Enterprise-ready security with RFC 9728/8414 compliance, granular scopes (`read`, `write`, `admin`, `db:*`, `table:*:*`), and Keycloak integration                                                           |
| **Smart Tool Filtering**       | 9 tool groups + 7 shortcuts let you stay within IDE limits while exposing exactly what you need                                                                                                              |
| **HTTP Streaming Transport**   | Streamable HTTP (`/mcp`) for modern clients + legacy SSE (`/sse`) for backward compatibility — both protocols supported simultaneously with security headers, rate limiting, health check, and stateless mode for serverless |
| **Production-Ready Security**  | SQL injection protection, parameterized queries, input validation, sandboxed code execution, HTTP body size enforcement, 7 security headers, server timeouts (slowloris protection), Retry-After rate limiting, `trustProxy` for reverse proxy deployments, opt-in HSTS, non-root Docker execution, and build provenance |
| **Strict TypeScript**          | 100% type-safe codebase with strict mode, no `any` types, 941 tests and 80% coverage                                                                                                                        |
| **Deterministic Error Handling** | Every tool returns structured `{success, error, code, category, suggestion, recoverable}` responses — no raw exceptions, no silent failures. Agents get enriched error context with actionable suggestions instead of cryptic SQLite codes |
| **MCP 2025-03-26 Compliant**   | Full protocol support with tool safety hints, resource priorities, and progress notifications                                                                                                                |

### Backend Options

| Feature              | WASM (sql.js)                                                    | Native (better-sqlite3)         |
| -------------------- | ---------------------------------------------------------------- | ------------------------------- |
| **Tools Available**  | 115                                                              | **139**                         |
| **Transactions**     | ❌                                                               | ✅ 7 tools                      |
| **Window Functions** | ❌                                                               | ✅ 6 tools                      |
| **SpatiaLite GIS**   | ❌                                                               | ✅ 7 tools                      |
| **Cross-platform**   | ✅ Pure JavaScript                                               | Compiled natively in image      |
| **Performance**      | ⚠️ Synchronous execution (Blocks Node Event Loop on heavy loads) | 🚀 High-performance, concurrent |

> ⚠️ **WASM Performance Note:** The WASM (`sql.js`) backend executes queries entirely in JavaScript memory, which synchronously blocks the Node.js event loop during intensive workloads. For safety, the `sqlite_read_query` tool limits unbounded queries to 1,000 rows. For high-throughput production or large datasets, use the Native (`--sqlite-native`) backend.

## 🚀 Quick Start (2 Minutes)

### 1. Pull the Image

```bash
docker pull writenotenow/db-mcp:latest
```

### 2. Run with MCP Client

Add to your `~/.cursor/mcp.json` or Claude Desktop config:

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
        "./data:/app/data",
        "writenotenow/db-mcp:latest",
        "--sqlite-native",
        "/app/data/database.db",
        "--tool-filter",
        "codemode"
      ]
    }
  }
}
```

> **⭐ Code Mode** (`--tool-filter codemode`) is the recommended configuration — it exposes `sqlite_execute_code`, a secure JavaScript sandbox providing access to all 139 tools' worth of capability with up to 90% token savings. See [Tool Filtering](#️-tool-filtering) for alternatives.

### 3. Restart & Query!

Restart Cursor or your MCP client and start querying SQLite databases!

### Prerequisites

- ✅ Docker installed and running
- ✅ ~200MB disk space available

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 139 tools in the native backend, you must use tool filtering to stay within limits. Use **shortcuts** or specify **groups** to enable only what you need.

### Recommended Configurations

The Quick Start above uses **Code Mode** (`--tool-filter codemode`) — the recommended default. If you prefer individual tool calls instead:

#### Starter (50 tools)

`starter` provides Core + JSON + Text:

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
| _(none)_ | Tool     | `read_query`    | **Whitelist Mode:** Enable ONLY this tool     |
| `+`      | Group    | `+vector`       | Add tools from this group to current set      |
| `-`      | Group    | `-admin`        | Remove tools in this group from current set   |
| `+`      | Tool     | `+fuzzy_search` | Add one specific tool                         |
| `-`      | Tool     | `-drop_table`   | Remove one specific tool                      |

#### Custom Tool Selection

You can list individual tool names (without `+` prefix) to create a fully custom whitelist — only the tools you specify will be enabled:

```bash
# Enable exactly 3 tools
--tool-filter "read_query,write_query,list_tables"

# Mix tools from different groups
--tool-filter "read_query,fuzzy_search,vector_search"
```

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

## 🛡️ Supply Chain Security

For enhanced security, use SHA-pinned images:

**Find SHA tags:** https://hub.docker.com/r/writenotenow/db-mcp/tags

**Multi-arch manifest (recommended):**

```bash
docker pull writenotenow/db-mcp:sha256-<manifest-digest>
```

**Direct digest (maximum security):**

```bash
docker pull writenotenow/db-mcp@sha256:<manifest-digest>
```

**Security Features:**

- ✅ **Build Provenance** - Cryptographic proof of build process
- ✅ **SBOM Available** - Complete software bill of materials
- ✅ **Non-root Execution** - Minimal attack surface
- ✅ **Security Scanned** - Docker Scout blocks critical/high CVEs

## 📊 Tool Categories

> **Note:** Counts below show unique tools per category. The [Tool Groups](#️-tool-filtering) table shows per-group totals including the auto-injected Code Mode tool (+1).

| Category             | Native  | Description                     |
| -------------------- | ------- | ------------------------------- |
| Core Database        | 9       | CRUD, schema, indexes, views    |
| JSON Operations      | 23      | JSON/JSONB, schema analysis     |
| Text Processing      | 17      | Regex, fuzzy, phonetic, FTS5    |
| Statistical Analysis | 19      | Stats, outliers, window funcs   |
| Vector/Semantic      | 11      | Embeddings, similarity search   |
| Geospatial           | 11      | Distance, SpatiaLite GIS        |
| Admin/Backup         | 33      | Backup, restore, virtual tables |
| Introspection        | 9       | FK graph, cascade sim, audit    |
| Migration            | 6       | Tracking, apply, rollback       |
| Code Mode            | 1       | Sandboxed JavaScript execution  |
| **Total**            | **139** |                                 |

### 📁 Data Resources (8)

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

### Help Resources (1 + up to 6)

On-demand tool reference documentation, filtered by `--tool-filter`:

| Resource              | URI                  | Description                                              | When Registered       |
| --------------------- | -------------------- | -------------------------------------------------------- | --------------------- |
| `sqlite_help`         | `sqlite://help`      | Gotchas, WASM vs Native, Code Mode API                   | Always                |
| `sqlite_help_json`    | `sqlite://help/json` | JSON/JSONB operations reference                          | When json group on    |
| `sqlite_help_text`    | `sqlite://help/text` | Text processing + FTS5 reference                         | When text group on    |
| `sqlite_help_stats`   | `sqlite://help/stats`| Statistical analysis + window functions reference        | When stats group on   |
| `sqlite_help_vector`  | `sqlite://help/vector`| Vector/semantic search reference                        | When vector group on  |
| `sqlite_help_geo`     | `sqlite://help/geo`  | Geospatial + SpatiaLite reference                        | When geo group on     |
| `sqlite_help_admin`   | `sqlite://help/admin`| Admin, transactions, backup, virtual tables reference    | When admin group on   |

> **Efficiency Tip:** Data resources are always **readable** regardless of tool configuration. Help resources are served on-demand — agents read them only when working with a specific tool group.

### 💬 Prompts (10)

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

### SQLite Extensions

The Docker image includes **FTS5**, **JSON1**, and **R-Tree** built-in. Loadable extensions require additional setup:

| Extension      | Purpose                   | Tools | CLI Flag       |
| -------------- | ------------------------- | ----- | -------------- |
| **CSV**        | CSV virtual tables        | 2     | `--csv`        |
| **SpatiaLite** | Advanced GIS capabilities | 7     | `--spatialite` |

**SpatiaLite** is pre-installed in the Docker image (AMD64 only). Enable it with:

```bash
docker run -i --rm \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --sqlite-native /app/data/database.db --spatialite
```

**CSV** requires setting `CSV_EXTENSION_PATH` to a compiled binary inside the container:

```bash
docker run -i --rm \
  -v ./data:/app/data \
  -v /path/to/csv.so:/app/extensions/csv.so \
  -e CSV_EXTENSION_PATH=/app/extensions/csv.so \
  writenotenow/db-mcp:latest \
  --sqlite-native /app/data/database.db --csv
```

## 🔧 Configuration

### Environment Variables

| Variable                | Default   | Description                                                 |
| ----------------------- | --------- | ----------------------------------------------------------- |
| `MCP_HOST`              | `0.0.0.0` | Host/IP to bind to (`--server-host`)                        |
| `SQLITE_DATABASE`       | —         | SQLite database path (`--sqlite` / `--sqlite-native`)       |
| `DB_MCP_TOOL_FILTER`    | —          | Tool filter string (`--tool-filter`)                        |
| `MCP_AUTH_TOKEN`        | —         | Simple bearer token for HTTP auth (`--auth-token`)          |
| `OAUTH_ENABLED`         | `false`   | Enable OAuth 2.1 (`--oauth-enabled`)                        |
| `OAUTH_ISSUER`          | —         | Authorization server URL (`--oauth-issuer`)                 |
| `OAUTH_AUDIENCE`        | —         | Expected token audience (`--oauth-audience`)                |
| `OAUTH_JWKS_URI`        | —         | JWKS URI, auto-discovered if omitted (`--oauth-jwks-uri`)   |
| `OAUTH_CLOCK_TOLERANCE` | `60`      | Clock tolerance in seconds (`--oauth-clock-tolerance`)      |
| `LOG_LEVEL`             | `info`    | Log verbosity: `debug`, `info`, `warning`, `error`          |
| `METADATA_CACHE_TTL_MS` | `5000`    | Schema cache TTL in ms (auto-invalidated on DDL operations) |
| `CODEMODE_ISOLATION`    | `worker`  | Code Mode sandbox: `worker` (enhanced isolation) or `vm`    |
| `MCP_RATE_LIMIT_MAX`    | `100`     | Max requests/minute per IP (HTTP transport)                 |
| `CSV_EXTENSION_PATH`    | —         | Custom path to CSV extension binary (native only)           |
| `SPATIALITE_PATH`       | —         | Custom path to SpatiaLite extension binary (native only)    |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `1000`), or increase it for production with stable schemas (e.g., `60000` = 1 min). Schema cache is automatically invalidated on DDL operations (CREATE/ALTER/DROP).

### HTTP/SSE Transport

For remote access or web-based clients:

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 --sqlite-native /app/data/database.db
```

> [!IMPORTANT]
> When running in Docker with HTTP transport, use `--server-host 0.0.0.0` to bind to all interfaces. Without this, the server may only listen on `localhost` inside the container, making it unreachable from the host.

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
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 --stateless --sqlite-native /app/data/database.db
```

| Mode                      | Progress Notifications | Legacy SSE | Serverless |
| ------------------------- | ---------------------- | ---------- | ---------- |
| Stateful (default)        | ✅ Yes                 | ✅ Yes     | ⚠️ Complex |
| Stateless (`--stateless`) | ❌ No                  | ❌ No      | ✅ Native  |

### 🔐 Authentication

db-mcp supports two authentication mechanisms for HTTP transport:

#### Simple Bearer Token

Lightweight authentication for development or single-tenant deployments:

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 --auth-token my-secret --sqlite-native /app/data/database.db
```

Clients must include `Authorization: Bearer my-secret` on all requests. `/health` and `/` are exempt.

#### OAuth 2.1 (Enterprise)

Full OAuth 2.1 with RFC 9728/8414 compliance using CLI flags:

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 \
  --oauth-enabled --oauth-issuer http://keycloak:8080/realms/db-mcp --oauth-audience db-mcp-server \
  --sqlite-native /app/data/database.db
```

**Supported Scopes:**

| Scope                | Description                            |
| -------------------- | -------------------------------------- |
| `read`               | Read-only access to all databases      |
| `write`              | Read and write access to all databases |
| `admin`              | Full administrative access             |
| `db:{name}`          | Access to specific database only       |
| `table:{db}:{table}` | Access to specific table only          |

See [Keycloak Setup](https://github.com/neverinfamous/db-mcp/blob/main/docs/KEYCLOAK_SETUP.md) for configuring your OAuth provider.

> **Priority:** When both `--auth-token` and `--oauth-enabled` are set, OAuth 2.1 takes precedence. If neither is configured, the server warns and runs without authentication.

## 📦 Image Details

| Platform                  | Features                            |
| ------------------------- | ----------------------------------- |
| **AMD64** (x86_64)        | Full: 139 tools, native, SpatiaLite |
| **ARM64** (Apple Silicon) | Full: 139 tools, native             |

**Image Benefits:**

- **Node.js 24 on Alpine Linux** - Minimal footprint
- **better-sqlite3** - High-performance native SQLite
- **Multi-stage build** - Optimized size
- **Non-root user** - Security hardened

**Available Tags:**

- `1.0.0` - Specific version (recommended for production)
- `latest` - Always the newest version
- `sha-<commit>` - Git commit pinned

## 🏗️ Build from Source

```bash
git clone https://github.com/neverinfamous/db-mcp.git
cd db-mcp
docker build -t db-mcp-local .
```

Update your MCP config:

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
        "./data:/app/data",
        "db-mcp-local",
        "--sqlite-native",
        "/app/data/database.db"
      ]
    }
  }
}
```

## 📚 Documentation & Resources

- **[GitHub Wiki](https://github.com/neverinfamous/db-mcp/wiki)** - Complete documentation
- **[Issues](https://github.com/neverinfamous/db-mcp/issues)** - Bug reports & feature requests

## 📄 License

MIT License - See [LICENSE](https://github.com/neverinfamous/db-mcp/blob/main/LICENSE)
