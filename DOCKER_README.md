# db-mcp (SQLite MCP Server)

Production-ready SQLite MCP server with 170+ tools, audit logging, OAuth 2.1, and Code Mode.

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
[![Coverage](https://img.shields.io/badge/Coverage-88.15%25-green.svg)](https://github.com/neverinfamous/db-mcp)

**[GitHub](https://github.com/neverinfamous/db-mcp)** • **[Wiki](https://github.com/neverinfamous/db-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/db-mcp/blob/main/CHANGELOG.md)**

---

## 🎯 What Sets Us Apart

| Feature                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **181+ Specialized Tools**       | The most comprehensive SQLite MCP server available — core CRUD, JSON/JSONB, FTS5 full-text search, statistical analysis, vector search, geospatial/SpatiaLite, introspection, migration, and admin                                                                                                                                                                                                                                             |
| **Deep Observability**           | Built-in Prometheus `/metrics` export, real-time `sqlite://metrics` MCP resource, historical persistence to a `SystemDb` sidecar, and a granular `sqlite_audit_search` tool for compliance and investigation                                                                                                                                                                                                                                   |
| **Dynamic Configuration**        | Full YAML/JSON config file support (`--config`) with precedence rules, plus a `sqlite_server_config` tool for live runtime config updates (e.g., log levels) without server restarts                                                                                                                                                                                                                                                           |
| **Advanced Query & Search**      | O(1) cursor-based keyset pagination, faceted search aggregation, and `sqlite_hybrid_search` orchestrating FTS5 + Vector similarity with Reciprocal Rank Fusion (RRF) in a single tool call                                                                                                                                                                                                                                                     |
| **AI Index Recommendations**     | `sqlite_index_audit` automatically analyzes `EXPLAIN QUERY PLAN` responses to suggest optimized composite and partial indexes based on workload patterns                                                                                                                                                                                                                                                                                       |
| **Real-time Subscriptions**      | Native `resources/subscribe` support pushing event-driven notifications for `sqlite://schema` DDL changes and periodic `sqlite://health` updates directly to clients                                                                                                                                                                                                                                                                           |
| **22 Resources**                 | 11 data resources (schema, tables, table_schema, indexes, views, health, meta, audit, metrics, compile_options, pragma) + 11 help resources (`sqlite://help` + per-group reference) — filtered by `--tool-filter`                                                                                                                                                                                                                              |
| **10 AI-Powered Prompts**        | Guided workflows for schema exploration, query building, data analysis, optimization, migration, debugging, and hybrid FTS5 + vector search                                                                                                                                                                                                                                                                                                    |
| **Code Mode**                    | **Massive Token Savings:** Execute complex, multi-step operations inside a **V8 isolate sandbox** with process-level isolation and hard timeouts. Instead of spending thousands of tokens on back-and-forth tool calls, Code Mode exposes all 181+ capabilities locally, reducing token overhead by 70–90% and supercharging AI agent reasoning                                                                                                |
| **Token-Optimized Payloads**     | Every tool response is designed for minimal token footprint with `compact`, `nodesOnly`, `maxOutliers`, `minSeverity`, and `maxInvalid` parameters — letting agents control response size without losing data access. Every response includes `_meta.tokenEstimate` so agents know their token cost                                                                                                                                            |
| **Dual SQLite Backends**         | WASM (sql.js) for zero-compilation portability, Native (better-sqlite3) for full features including transactions, window functions, and SpatiaLite GIS                                                                                                                                                                                                                                                                                         |
| **OAuth 2.1 + Access Control**   | Enterprise-ready security with RFC 9728/8414 compliance, granular scopes (`full`, `read`, `write`, `admin`, `db:*`, `table:*:*`), and Keycloak integration                                                                                                                                                                                                                                                                                     |
| **Smart Tool Filtering**         | 10 tool groups + 7 shortcuts let you stay within IDE limits while exposing exactly what you need                                                                                                                                                                                                                                                                                                                                               |
| **HTTP Streaming Transport**     | Streamable HTTP (`/mcp`) + legacy SSE (`/sse`) with auth, security headers, rate limiting, health check, and stateless mode for serverless                                                                                                                                                                                                                                                                                                     |
| **Production-Ready Security**    | SQL injection protection (parameterized queries + Unicode-normalized WHERE clause validation), sandboxed code execution (V8 `codeGeneration` restrictions, frozen prototypes, 29 blocked patterns, Proxy nullified, RPC allowlist), CORS deny-all default, fail-closed scope enforcement, JWT claims sanitization, 7 security headers, body size limits, rate limiting, slowloris timeouts, opt-in HSTS, non-root Docker, and build provenance |
| **Encryption at Rest**           | Native SQLCipher support via `--encryption-key` or `DB_ENCRYPTION_KEY`. Dynamically loads `better-sqlite3-multiple-ciphers` and automatically encrypts the sidecar `SystemDb` audit logs to prevent sensitive queries from leaking                                                                                                                                                                                                             |
| **Deterministic Error Handling** | Every tool returns structured `{success, error, code, category, suggestion, recoverable}` responses — no raw exceptions. Agents get enriched error context with actionable suggestions instead of cryptic SQLite codes                                                                                                                                                                                                                         |

### Backend Options

| Feature              | WASM (sql.js)                                                    | Native (better-sqlite3)         |
| -------------------- | ---------------------------------------------------------------- | ------------------------------- |
| **Group Tools**      | 143                                                              | **170**                         |
| **Transactions**     | ❌                                                               | ✅ 8 tools                      |
| **Window Functions** | ❌                                                               | ✅ 6 tools                      |
| **SpatiaLite GIS**   | ❌                                                               | ✅ 7 tools                      |
| **Cross-platform**   | ✅ Pure JavaScript                                               | Compiled natively in image      |
| **Performance**      | ⚠️ Synchronous execution (Blocks Node Event Loop on heavy loads) | 🚀 High-performance, concurrent |

> ⚠️ **WASM Note:** The WASM backend blocks the Node.js event loop during intensive workloads. `sqlite_read_query` limits unbounded queries to 1,000 rows. For production, use Native (`--sqlite-native`).

## 🚀 Quick Start

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

> **⭐ Code Mode** (`--tool-filter codemode`) is the recommended configuration — it exposes `sqlite_execute_code`, a V8 isolate sandbox with process-level isolation providing access to all 170+ tools' worth of capability with 70–90% token savings. See [Tool Filtering](#️-tool-filtering) for alternatives.

> [!TIP]
> **Switching backends:** The config above uses the **Native** backend (better-sqlite3, 181 MCP tools / 170 group tools). To use the **WASM** backend (sql.js, 154 MCP tools / 143 group tools, zero native dependencies), change `--sqlite-native` to `--sqlite` in the args array. See the [Backend Options](#backend-options) table for feature differences.

### 3. Restart & Query!

Restart Cursor or your MCP client and start querying SQLite databases!

### Prerequisites

- ✅ Docker installed and running
- ✅ ~200MB disk space available

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 170+ tools in the native backend, you must use tool filtering to stay within limits. Use **shortcuts** or specify **groups** to enable only what you need.

### Recommended Configurations

The Quick Start above uses **Code Mode** (`--tool-filter codemode`) — the recommended default. If you prefer individual tool calls instead:

#### Starter (core + json + text)

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
| `starter`    | **65** | **70** | +4         | Core, JSON, Text               |
| `analytics`  | 67     | 73     | +4         | Core, JSON, Stats              |
| `search`     | 51     | 56     | +4         | Core, Text, Vector             |
| `spatial`    | 40     | 47     | +4         | Core, Geo, Vector              |
| `dev-schema` | 41     | 41     | +4         | Core, Introspection, Migration |
| `minimal`    | 25     | 25     | +4         | Core only                      |
| `full`       | 143    | 170    | +4         | Everything enabled             |

### Tool Groups (10 Available)

10 granular tool groups (e.g., `core`, `json`, `text`, `stats`, `vector`, `admin`) let you precisely control exposed capabilities. For advanced syntax (whitelisting individual tools, additive `+` and subtractive `-` filters) and the complete tool group list, refer to the [GitHub Repository](https://github.com/neverinfamous/db-mcp).

## 🛡️ Supply Chain Security

For enhanced security, use SHA-pinned multi-arch manifests (`docker pull writenotenow/db-mcp:sha256-<digest>`). Our images feature cryptographic build provenance, SBOMs, non-root execution, and zero critical/high CVEs (Docker Scout scanned). Find exact tags on [Docker Hub](https://hub.docker.com/r/writenotenow/db-mcp/tags).

### 📁 Resources & Prompts

db-mcp exposes 22 resources (including dynamic `sqlite://help` documentation) and 10 AI-powered prompts (for schema exploration, query building, data analysis, optimization, and migration). See the [GitHub README](https://github.com/neverinfamous/db-mcp) for the complete list.

### SQLite Extensions

The Docker image includes **FTS5**, **JSON1**, and **R-Tree** built-in. Enable loadable extensions via CLI flags:

| Extension      | Purpose            | Tools | CLI Flag       | Notes                                 |
| -------------- | ------------------ | ----- | -------------- | ------------------------------------- |
| **CSV**        | CSV virtual tables | 2     | `--csv`        | Requires `CSV_EXTENSION_PATH` env var |
| **SpatiaLite** | Advanced GIS       | 7     | `--spatialite` | Pre-installed (AMD64 only)            |

## 🔧 Configuration

### Environment Variables

| Variable                    | Default     | Description                                                               |
| --------------------------- | ----------- | ------------------------------------------------------------------------- |
| `MCP_HOST`                  | `127.0.0.1` | Host/IP to bind to (`0.0.0.0` in Docker) (`--server-host`)                |
| `SQLITE_DATABASE`           | —           | SQLite database path (`--sqlite` / `--sqlite-native`)                     |
| `DB_ENCRYPTION_KEY`         | —           | SQLCipher encryption key (Native only) (`--encryption-key`)               |
| `DB_MCP_TOOL_FILTER`        | —           | Tool filter string (`--tool-filter`)                                      |
| `METRICS_EXPORT`            | —           | Export metrics at HTTP /metrics (e.g., `prometheus`) (`--metrics-export`) |
| `OAUTH_ENABLED`             | `false`     | Enable OAuth 2.1 (`--oauth-enabled`)                                      |
| `OAUTH_ISSUER`              | —           | Authorization server URL (`--oauth-issuer`)                               |
| `OAUTH_AUDIENCE`            | —           | Expected token audience (`--oauth-audience`)                              |
| `OAUTH_JWKS_URI`            | —           | JWKS URI, auto-discovered if omitted (`--oauth-jwks-uri`)                 |
| `OAUTH_CLOCK_TOLERANCE`     | `60`        | Clock tolerance in seconds (`--oauth-clock-tolerance`)                    |
| `MCP_ENABLE_HSTS`           | `false`     | Enable HSTS header (`--enable-hsts`)                                      |
| `NO_AUTH_ENFORCEMENT`       | `false`     | Explicitly bypass auth enforcement for HTTP (`--no-auth-enforcement`)     |
| `ALLOWED_IO_ROOTS`          | —           | JSON array or comma-separated list of absolute paths allowed for IO operations |
| `LOG_LEVEL`                 | `info`      | Log verbosity: `debug`, `info`, `warning`, `error`                        |
| `METADATA_CACHE_TTL_MS`     | `5000`      | Schema cache TTL in ms (auto-invalidated on DDL)                          |
| `CODEMODE_ISOLATION`        | `isolate`   | Code Mode sandbox: `isolate` (isolated-vm native) or `worker`             |
| `CODE_MODE_MAX_RESULT_SIZE` | `102400`    | Max Code Mode result payload in bytes (default 100KB, cap 50MB)           |
| `MCP_RATE_LIMIT_MAX`        | `100`       | Max requests/minute per IP (HTTP transport)                               |
| `CSV_EXTENSION_PATH`        | —           | Path to CSV extension binary (native only)                                |
| `SPATIALITE_PATH`           | —           | Path to SpatiaLite extension binary (native only)                         |
| `MCP_AUTH_TOKEN`            | —           | Simple bearer token for HTTP auth (`--auth-token`)                        |
| `AUDIT_LOG`                 | —           | Audit log file path, or `stderr` (`--audit-log`)                          |
| `AUDIT_REDACT`              | `true`      | Redact tool arguments from audit entries (`--audit-no-redact` to disable) |
| `AUDIT_READS`               | `false`     | Also log read-scoped tool invocations (`--audit-reads`)                   |
| `AUDIT_BACKUP`              | `false`     | Enable pre-mutation DDL snapshots (`--audit-backup`)                      |
| `AUDIT_BACKUP_DATA`         | `false`     | Include sample data rows in snapshots (`--audit-backup-data`)             |

### HTTP/SSE Transport

For remote access or web-based clients:

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 --sqlite-native /app/data/database.db --allowed-io-roots /app/data
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

**Security:** 7 security headers, server timeouts (slowloris protection), rate limiting (100/min, 429 + Retry-After), CORS deny-all default (explicit `corsOrigins` config required), trust proxy (`trustedProxyIps`), body size limit (`--max-body-bytes`, default 1MB), opt-in HSTS, cross-protocol session guard.

### 🔐 Authentication

Full OAuth 2.1 with RFC 9728/8414 compliance:

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 \
  --oauth-enabled --oauth-issuer http://keycloak:8080/realms/db-mcp --oauth-audience db-mcp-server \
  --sqlite-native /app/data/database.db \
  --allowed-io-roots /app/data
```

**Scopes:** `full`, `read`, `write`, `admin`, `db:{name}`, `table:{db}:{table}`. See [Keycloak Setup](https://github.com/neverinfamous/db-mcp/blob/main/docs/KEYCLOAK_SETUP.md) for provider configuration.

> **Audit identity:** When OAuth is enabled with audit logging (`--audit-log`), write/admin audit entries capture the authenticated user (`claims.sub`) and granted scopes.

## 🔐 Encryption at Rest (Native Only)

db-mcp supports transparent database encryption using SQLCipher via the `--encryption-key` CLI flag or `DB_ENCRYPTION_KEY` environment variable.

For advanced configuration (raw hex keys vs passphrases, dual-backend audit log encryption rules, and migration steps), please see the full [Security Documentation](https://github.com/neverinfamous/db-mcp/blob/main/SECURITY.md).

## 📦 Image Details

| Platform                  | Features                            |
| ------------------------- | ----------------------------------- |
| **AMD64** (x86_64)        | Full: 170 tools, native, SpatiaLite |
| **ARM64** (Apple Silicon) | Full: 170 tools, native             |

Node.js 24 on Alpine Linux • Multi-stage build • Non-root user • better-sqlite3 native

**Available Tags:**

- `v4.0.0` - Specific version (recommended for production)
- `latest` - Always the newest version
- `sha-<commit>` - Git commit pinned

## 📚 Documentation & Resources

- **[GitHub Wiki](https://github.com/neverinfamous/db-mcp/wiki)** — Complete documentation
- **[Build from Source](https://github.com/neverinfamous/db-mcp#-build-from-source)** — Clone, build, and run locally
- **[Issues](https://github.com/neverinfamous/db-mcp/issues)** — Bug reports & feature requests

## 📄 License

MIT License - See [LICENSE](https://github.com/neverinfamous/db-mcp/blob/main/LICENSE)
