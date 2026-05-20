# db-mcp (SQLite MCP Server)

Production-ready SQLite MCP server with 151 tools, audit logging, OAuth 2.1, and Code Mode.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/db--mcp-blue?logo=github)](https://github.com/neverinfamous/db-mcp)
![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/db-mcp)
[![npm](https://img.shields.io/npm/v/db-mcp)](https://www.npmjs.com/package/db-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/db-mcp)](https://hub.docker.com/r/writenotenow/db-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/db-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/db-mcp/blob/main/SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/db-mcp)
[![E2E](https://github.com/neverinfamous/db-mcp/actions/workflows/e2e.yml/badge.svg)](https://github.com/neverinfamous/db-mcp/actions/workflows/e2e.yml)
[![Tests](https://img.shields.io/badge/Tests-1911%20passed-brightgreen.svg)](https://github.com/neverinfamous/db-mcp)
[![Coverage](https://img.shields.io/badge/Coverage-85.29%25-green.svg)](https://github.com/neverinfamous/db-mcp)

**[GitHub](https://github.com/neverinfamous/db-mcp)** • **[Wiki](https://github.com/neverinfamous/db-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/db-mcp/blob/main/CHANGELOG.md)**

---

## 🎯 What Sets Us Apart

| Feature                          | Description                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **151 Specialized Tools**        | The most comprehensive SQLite MCP server available — core CRUD, JSON/JSONB, FTS5 full-text search, statistical analysis, vector search, geospatial/SpatiaLite, introspection, migration, and admin                                                                                                                       |
| **20 Resources**                 | 11 data resources (schema, tables, indexes, views, health, metadata, insights, audit, compile_options, pragma) + 9 help resources (`sqlite://help` + per-group reference) — filtered by `--tool-filter`                                                                                                                                            |
| **10 AI-Powered Prompts**        | Guided workflows for schema exploration, query building, data analysis, optimization, migration, debugging, and hybrid FTS5 + vector search                                                                                                                                                                              |
| **Code Mode**                    | **Massive Token Savings:** Execute complex, multi-step operations inside a fast, secure JavaScript sandbox. Instead of spending thousands of tokens on back-and-forth tool calls, Code Mode exposes all 151 capabilities locally, reducing token overhead by up to 90% and supercharging AI agent reasoning              |
| **Token-Optimized Payloads**     | Every tool response is designed for minimal token footprint with `compact`, `nodesOnly`, `maxOutliers`, `minSeverity`, and `maxInvalid` parameters — letting agents control response size without losing data access                                                                                                     |
| **Dual SQLite Backends**         | WASM (sql.js) for zero-compilation portability, Native (better-sqlite3) for full features including transactions, window functions, and SpatiaLite GIS                                                                                                                                                                   |
| **OAuth 2.1 + Access Control**   | Enterprise-ready security with RFC 9728/8414 compliance, granular scopes (`read`, `write`, `admin`, `db:*`, `table:*:*`), and Keycloak integration                                                                                                                                                                       |
| **Smart Tool Filtering**         | 10 tool groups + 7 shortcuts let you stay within IDE limits while exposing exactly what you need                                                                                                                                                                                                                         |
| **HTTP Streaming Transport**     | Streamable HTTP (`/mcp`) + legacy SSE (`/sse`) with security headers, rate limiting, health check, and stateless mode for serverless                                                                                                                                                                                     |
| **Production-Ready Security**    | SQL injection protection, parameterized queries, input validation, sandboxed code execution, HTTP body size enforcement, 7 security headers, server timeouts, rate limiting, `trustProxy`, opt-in HSTS, non-root Docker execution, and build provenance                                                                  |
| **Deterministic Error Handling** | Every tool returns structured `{success, error, code, category, suggestion, recoverable}` responses — no raw exceptions. Agents get enriched error context with actionable suggestions instead of cryptic SQLite codes                                                                                                   |

### Backend Options

| Feature              | WASM (sql.js)                                                    | Native (better-sqlite3)         |
| -------------------- | ---------------------------------------------------------------- | ------------------------------- |
| **Tools Available**  | 125                                                              | **151**                         |
| **Transactions**     | ❌                                                               | ✅ 8 tools                      |
| **Window Functions** | ❌                                                               | ✅ 6 tools                      |
| **SpatiaLite GIS**   | ❌                                                               | ✅ 7 tools                      |
| **Cross-platform**   | ✅ Pure JavaScript                                               | Compiled natively in image      |
| **Performance**      | ⚠️ Synchronous execution (Blocks Node Event Loop on heavy loads) | 🚀 High-performance, concurrent |

> ⚠️ **WASM Note:** The WASM backend blocks the Node.js event loop during intensive workloads. `sqlite_read_query` limits unbounded queries to 1,000 rows. For production, use Native (`--sqlite-native`).

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

> **⭐ Code Mode** (`--tool-filter codemode`) is the recommended configuration — it exposes `sqlite_execute_code`, a secure JavaScript sandbox providing access to all 151 tools' worth of capability with up to 90% token savings. See [Tool Filtering](#️-tool-filtering) for alternatives.

### 3. Restart & Query!

Restart Cursor or your MCP client and start querying SQLite databases!

### Prerequisites

- ✅ Docker installed and running
- ✅ ~200MB disk space available

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 151 tools in the native backend, you must use tool filtering to stay within limits. Use **shortcuts** or specify **groups** to enable only what you need.

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

| Shortcut     | WASM   | Native | + Built-in | What's Included                |
| ------------ | ------ | ------ | ---------- | ------------------------------ |
| `starter`    | **53** | **58** | +3         | Core, JSON, Text               |
| `analytics`  | 55     | 61     | +3         | Core, JSON, Stats              |
| `search`     | 40     | 45     | +3         | Core, Text, Vector             |
| `spatial`    | 30     | 37     | +3         | Core, Geo, Vector              |
| `dev-schema` | 30     | 30     | +3         | Core, Introspection, Migration |
| `minimal`    | 15     | 15     | +3         | Core only                      |
| `full`       | 125    | 151    | +3         | Everything enabled             |

### Tool Groups (10 Available)

> +3 built-in tools (server_info, server_health, list_adapters) and +1 code mode are always included.

| Group           | WASM | Native | Description                                  |
| --------------- | ---- | ------ | -------------------------------------------- |
| `codemode`      | 1    | 1      | Code Mode (sandboxed code execution) 🌟      |
| `core`          | 14   | 14     | Basic CRUD, schema, tables                   |
| `json`          | 24   | 24     | JSON/JSONB operations, analysis              |
| `text`          | 14   | 19     | Text processing + FTS5 + advanced search     |
| `stats`         | 16   | 22     | Statistical analysis (+ window funcs)        |
| `vector`        | 11   | 11     | Embeddings, similarity search                |
| `admin`         | 26   | 26     | Backup, restore, virtual tables, pragma      |
| `transactions`  | 0    | 8      | Transaction control and atomic execution     |
| `geo`           | 4    | 11     | Geospatial + SpatiaLite (Native only)        |
| `introspection` | 9    | 9      | FK graph, cascade sim, storage/index audit   |
| `migration`     | 6    | 6      | Migration tracking, apply, rollback (opt-in) |

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

**Examples:**

```bash
--tool-filter "starter"
--tool-filter "core,json,text,fts5"
--tool-filter "starter,+stats"
--tool-filter "starter,-fts5"
--tool-filter "read_query,write_query,list_tables"  # Custom whitelist
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

- ✅ **Build Provenance** — Cryptographic proof of build process
- ✅ **SBOM Available** — Complete software bill of materials
- ✅ **Non-root Execution** — Minimal attack surface
- ✅ **Security Scanned** — Docker Scout blocks critical/high CVEs

## 📊 Tool Categories

| Category             | Native  | Description                     |
| -------------------- | ------- | ------------------------------- |
| Core Database        | 14      | CRUD, schema, indexes, views, convenience |
| JSON Operations      | 24      | JSON/JSONB, schema analysis, security scan |
| Text Processing      | 19      | Regex, fuzzy, phonetic, sentiment, FTS5    |
| Statistical Analysis | 22      | Stats, outliers, window funcs   |
| Vector/Semantic      | 11      | Embeddings, similarity search   |
| Geospatial           | 11      | Distance, SpatiaLite GIS        |
| Admin/Backup         | 26      | Backup, restore, virtual tables, pragma       |
| Transactions         | 8       | Transaction control and atomic execution      |
| Introspection        | 9       | FK graph, cascade sim, audit    |
| Migration            | 6       | Tracking, apply, rollback       |
| Code Mode            | 1       | Sandboxed JavaScript execution  |
| **Total**            | **151** |                                 |

### 📁 Resources (11 Data + 9 Help)

Data resources provide read-only access to database metadata. Help resources (`sqlite://help/*`) provide on-demand per-group tool reference, filtered by `--tool-filter`.

| Resource              | URI                                 | Description                  |
| --------------------- | ----------------------------------- | ---------------------------- |
| `sqlite_schema`       | `sqlite://schema`                   | Full database schema         |
| `sqlite_tables`       | `sqlite://tables`                   | List all tables              |
| `sqlite_table_schema` | `sqlite://table/{tableName}/schema` | Schema for a specific table  |
| `sqlite_indexes`      | `sqlite://indexes`                  | All indexes in the database  |
| `sqlite_views`        | `sqlite://views`                    | All views in the database    |
| `sqlite_health`       | `sqlite://health`                   | Database health and status   |
| `sqlite_meta`         | `sqlite://meta`                     | Database metadata and PRAGMAs|
| `sqlite_compile_options`| `sqlite://compile_options`          | Compile-time build options   |
| `sqlite_pragma`       | `sqlite://pragma`                   | Runtime PRAGMA snapshot      |
| `sqlite_insights`     | `memo://insights`                   | Business insights memo       |
| `sqlite_audit`        | `sqlite://audit`                    | Recent audit log + backup stats |
| `sqlite_help`         | `sqlite://help`                     | Main help + per-group refs   |

### 💬 Prompts (10)

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

The Docker image includes **FTS5**, **JSON1**, and **R-Tree** built-in. Enable loadable extensions via CLI flags:

| Extension      | Purpose             | Tools | CLI Flag       | Notes                                  |
| -------------- | ------------------- | ----- | -------------- | -------------------------------------- |
| **CSV**        | CSV virtual tables  | 2     | `--csv`        | Requires `CSV_EXTENSION_PATH` env var  |
| **SpatiaLite** | Advanced GIS        | 7     | `--spatialite` | Pre-installed (AMD64 only)             |

## 🔧 Configuration

### Environment Variables

| Variable                | Default   | Description                                                 |
| ----------------------- | --------- | ----------------------------------------------------------- |
| `MCP_HOST`              | `0.0.0.0` | Host/IP to bind to (`--server-host`)                        |
| `SQLITE_DATABASE`       | —         | SQLite database path (`--sqlite` / `--sqlite-native`)       |
| `DB_MCP_TOOL_FILTER`    | —         | Tool filter string (`--tool-filter`)                        |
| `MCP_AUTH_TOKEN`        | —         | Simple bearer token for HTTP auth (`--auth-token`)          |
| `OAUTH_ENABLED`         | `false`   | Enable OAuth 2.1 (`--oauth-enabled`)                        |
| `OAUTH_ISSUER`          | —         | Authorization server URL (`--oauth-issuer`)                 |
| `OAUTH_AUDIENCE`        | —         | Expected token audience (`--oauth-audience`)                |\
| `OAUTH_JWKS_URI`        | —         | JWKS URI, auto-discovered if omitted (`--oauth-jwks-uri`)   |
| `OAUTH_CLOCK_TOLERANCE` | `60`      | Clock tolerance in seconds (`--oauth-clock-tolerance`)      |
| `LOG_LEVEL`             | `info`    | Log verbosity: `debug`, `info`, `warning`, `error`          |
| `METADATA_CACHE_TTL_MS` | `5000`    | Schema cache TTL in ms (auto-invalidated on DDL)            |
| `CODEMODE_ISOLATION`    | `worker`  | Code Mode sandbox: `worker` (enhanced) or `vm`              |
| `MCP_RATE_LIMIT_MAX`    | `100`     | Max requests/minute per IP (HTTP transport)                 |
| `CSV_EXTENSION_PATH`    | —         | Path to CSV extension binary (native only)                  |
| `SPATIALITE_PATH`       | —         | Path to SpatiaLite extension binary (native only)           |
| `AUDIT_LOG`             | —         | Audit log file path, or `stderr` (`--audit-log`)            |
| `AUDIT_REDACT`          | `false`   | Redact tool arguments from audit entries (`--audit-redact`) |
| `AUDIT_READS`           | `false`   | Also log read-scoped tool invocations (`--audit-reads`)     |
| `AUDIT_BACKUP`          | `false`   | Enable pre-mutation DDL snapshots (`--audit-backup`)        |
| `AUDIT_BACKUP_DATA`     | `false`   | Include sample data rows in snapshots (`--audit-backup-data`) |

### HTTP/SSE Transport

For remote access or web-based clients:

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 --sqlite-native /app/data/database.db
```

> [!IMPORTANT]
> Use `--server-host 0.0.0.0` to bind to all interfaces. Without this, the server may only listen on `localhost` inside the container. Add `--stateless` for serverless deployments (disables SSE and progress notifications).

**Endpoints:**

| Endpoint         | Description                                      | Mode     |
| ---------------- | ------------------------------------------------ | -------- |
| `POST /mcp`      | JSON-RPC requests (initialize, tools/call, etc.) | Both     |
| `GET /mcp`       | SSE stream for server-to-client notifications    | Stateful |
| `DELETE /mcp`    | Session termination                              | Stateful |
| `GET /sse`       | Legacy SSE connection (MCP 2024-11-05)           | Stateful |
| `POST /messages` | Legacy SSE message endpoint                      | Stateful |
| `GET /health`    | Health check (always public)                     | Both     |
| `GET /`          | Server info and available endpoints              | Both     |

**Security:** 7 security headers, server timeouts (slowloris protection), rate limiting (100/min, 429 + Retry-After), CORS (`--cors-origins`), trust proxy (`trustProxy`), body size limit (`--max-body-bytes`, default 1MB), opt-in HSTS, cross-protocol session guard.

### 🔐 Authentication

#### Simple Bearer Token

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 --auth-token my-secret --sqlite-native /app/data/database.db
```

Clients must include `Authorization: Bearer my-secret` on all requests. `/health` and `/` are exempt.

#### OAuth 2.1 (Enterprise)

Full OAuth 2.1 with RFC 9728/8414 compliance:

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 \
  --oauth-enabled --oauth-issuer http://keycloak:8080/realms/db-mcp --oauth-audience db-mcp-server \
  --sqlite-native /app/data/database.db
```

**Scopes:** `read`, `write`, `admin`, `db:{name}`, `table:{db}:{table}`. See [Keycloak Setup](https://github.com/neverinfamous/db-mcp/blob/main/docs/KEYCLOAK_SETUP.md) for provider configuration.

> When both `--auth-token` and `--oauth-enabled` are set, OAuth 2.1 takes precedence.

> **Audit identity:** When OAuth is enabled with audit logging (`--audit-log`), write/admin audit entries capture the authenticated user (`claims.sub`) and granted scopes — providing a forensic trail linking mutations to identities.

## 📦 Image Details

| Platform                  | Features                            |
| ------------------------- | ----------------------------------- |
| **AMD64** (x86_64)        | Full: 151 tools, native, SpatiaLite |
| **ARM64** (Apple Silicon) | Full: 151 tools, native             |

Node.js 24 on Alpine Linux • Multi-stage build • Non-root user • better-sqlite3 native

**Available Tags:**

- `v1.1.1` - Specific version (recommended for production)
- `latest` - Always the newest version
- `sha-<commit>` - Git commit pinned

## 📚 Documentation & Resources

- **[GitHub Wiki](https://github.com/neverinfamous/db-mcp/wiki)** — Complete documentation
- **[Build from Source](https://github.com/neverinfamous/db-mcp#-build-from-source)** — Clone, build, and run locally
- **[Issues](https://github.com/neverinfamous/db-mcp/issues)** — Bug reports & feature requests

## 📄 License

MIT License - See [LICENSE](https://github.com/neverinfamous/db-mcp/blob/main/LICENSE)
