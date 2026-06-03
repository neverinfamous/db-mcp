# db-mcp (SQLite MCP Server)

<!-- mcp-name: io.github.neverinfamous/db-mcp -->

**SQLite MCP Server** with 170+ specialized tools, 11 data resources + 11 help resources, and 10 prompts, audit logging with DDL backup snapshots, HTTP/SSE Transport, OAuth 2.1 authentication, tool filtering, granular access control, and structured error handling with categorized, actionable responses. Available in WASM and better-sqlite3 variants.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/db--mcp-blue?logo=github)](https://github.com/neverinfamous/db-mcp)
![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/db-mcp)
[![npm](https://img.shields.io/npm/v/db-mcp)](https://www.npmjs.com/package/db-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/db-mcp)](https://hub.docker.com/r/writenotenow/db-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/db-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/db-mcp)
[![E2E](https://github.com/neverinfamous/db-mcp/actions/workflows/e2e.yml/badge.svg)](https://github.com/neverinfamous/db-mcp/actions/workflows/e2e.yml)
[![Tests](https://img.shields.io/badge/Tests-1911%20passed-brightgreen.svg)](https://github.com/neverinfamous/db-mcp)
[![Coverage](https://img.shields.io/badge/Coverage-89.72%25-green.svg)](https://github.com/neverinfamous/db-mcp)

**[Wiki](https://github.com/neverinfamous/db-mcp/wiki)** • **[Changelog](CHANGELOG.md)**

---

## 🎯 What Sets Us Apart

| Feature                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **177+ Specialized Tools**       | The most comprehensive SQLite MCP server available — core CRUD, JSON/JSONB, FTS5 full-text search, statistical analysis, vector search, geospatial/SpatiaLite, introspection, migration, and admin                                                                                                                                                                                                                                                                                 |
| **Deep Observability**           | Built-in Prometheus `/metrics` export, real-time `sqlite://metrics` MCP resource, historical persistence to a `SystemDb` sidecar, and a granular `sqlite_audit_search` tool for compliance and investigation                                                                                                                                                                                                                                                                       |
| **Dynamic Configuration**        | Full YAML/JSON config file support (`--config`) with precedence rules, plus a `sqlite_server_config` tool for live runtime config updates (e.g., log levels) without server restarts                                                                                                                                                                                                                                                                                               |
| **Advanced Query & Search**      | O(1) cursor-based keyset pagination, faceted search aggregation, and `sqlite_hybrid_search` orchestrating FTS5 + Vector similarity with Reciprocal Rank Fusion (RRF) in a single tool call                                                                                                                                                                                                                                                                                         |
| **AI Index Recommendations**     | `sqlite_index_audit` automatically analyzes `EXPLAIN QUERY PLAN` responses to suggest optimized composite and partial indexes based on workload patterns                                                                                                                                                                                                                                                                                                                           |
| **Real-time Subscriptions**      | Native `resources/subscribe` support pushing event-driven notifications for `sqlite://schema` DDL changes and periodic `sqlite://health` updates directly to clients                                                                                                                                                                                                                                                                                                               |
| **22 Resources**                 | 11 data resources (schema, tables, table_schema, indexes, views, health, meta, audit, metrics, compile_options, pragma) + 11 help resources (`sqlite://help` + per-group reference) — filtered by `--tool-filter`                                                                                                                                                                                                                                                                  |
| **10 AI-Powered Prompts**        | Guided workflows for schema exploration, query building, data analysis, optimization, migration, debugging, and hybrid FTS5 + vector search                                                                                                                                                                                                                                                                                                                                        |
| **Code Mode**                    | **Massive Token Savings:** Execute complex, multi-step operations inside a **V8 isolate sandbox** with process-level isolation and hard timeouts. Instead of spending thousands of tokens on back-and-forth tool calls, Code Mode exposes all 177+ capabilities locally, reducing token overhead by 70–90% and supercharging AI agent reasoning                                                                                                                                    |
| **Token-Optimized Payloads**     | Every tool response is designed for minimal token footprint with `_meta.tokenEstimate` on every response so agents know their token cost. Tools include `compact`, `nodesOnly`, `maxOutliers`, `minSeverity`, and `maxInvalid` parameters where applicable — letting agents control response size without losing data access                                                                                                                                                       |
| **Dual SQLite Backends**         | WASM (sql.js) for zero-compilation portability, Native (better-sqlite3) for high-performance concurrent execution with full features including transactions, window functions, and SpatiaLite GIS                                                                                                                                                                                                                                                                                  |
| **OAuth 2.1 + Access Control**   | Enterprise-ready security with RFC 9728/8414 compliance, granular scopes (`full`, `read`, `write`, `admin`, `db:*`, `table:*:*`), and Keycloak integration                                                                                                                                                                                                                                                                                                                         |
| **Smart Tool Filtering**         | 10 tool groups + 7 shortcuts let you stay within IDE limits while exposing exactly what you need                                                                                                                                                                                                                                                                                                                                                                                   |
| **HTTP Streaming Transport**     | Streamable HTTP (`/mcp`) for modern clients + legacy SSE (`/sse`) for backward compatibility — both protocols supported simultaneously with security headers, rate limiting, health check, and stateless mode for serverless                                                                                                                                                                                                                                                       |
| **Production-Ready Security**    | SQL injection protection (parameterized queries + Unicode-normalized WHERE clause validation), sandboxed code execution (V8 `codeGeneration` restrictions, frozen prototypes, 29 blocked patterns, Proxy nullified, RPC allowlist), CORS deny-all default, fail-closed scope enforcement, JWT claims sanitization, 7 security headers, body size limits, rate limiting with Retry-After, slowloris timeouts, `trustedProxyIps`, opt-in HSTS, non-root Docker, and build provenance |
| **Encryption at Rest**           | Native SQLCipher support via `--encryption-key` or `DB_ENCRYPTION_KEY`. Dynamically loads `better-sqlite3-multiple-ciphers` and automatically encrypts the sidecar `SystemDb` audit logs to prevent sensitive queries from leaking                                                                                                                                                                                                                                                 |
| **Strict TypeScript**            | 100% type-safe codebase with strict mode, no `any` types, 1911 unit tests + 1136 E2E tests and 90% coverage                                                                                                                                                                                                                                                                                                                                                                        |
| **Deterministic Error Handling** | Every tool returns structured `{success, error, code, category, suggestion, recoverable}` responses — no raw exceptions, no silent failures. Agents get enriched error context with actionable suggestions instead of cryptic SQLite codes                                                                                                                                                                                                                                         |
| **MCP 2025-03-26 Compliant**     | Full protocol support with tool safety hints (`sensitiveHint`, `readOnlyHint`), resource priorities, and progress notifications                                                                                                                                                                                                                                                                                                                                                    |

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

Run the server with **Native backend** (better-sqlite3 — full features, requires Node.js native build):

```bash
node dist/cli.js --transport stdio --sqlite-native ./database.db
```

Or with **WASM backend** (sql.js — cross-platform, no compilation required):

```bash
node dist/cli.js --transport stdio --sqlite ./database.db
```

> **Backend Choice:** Use `--sqlite-native` for full features (177 MCP tools / 166 group tools, transactions, window functions, SpatiaLite). Use `--sqlite` for WASM mode (150 MCP tools / 139 group tools, no native dependencies).

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

## Code Mode: Maximum Efficiency

Code Mode (`sqlite_execute_code`) dramatically reduces token usage (70–90%) and is included by default in all presets.

Code executes in a **worker-thread sandbox** — a separate V8 isolate with its own memory space. All `sqlite.*` API calls are forwarded to the main thread via a `MessagePort`-based RPC bridge, where the actual database operations execute. This provides:

- **Process-level isolation** — user code runs in a separate V8 instance with enforced heap limits
- **Readonly enforcement** — when `readonly: true`, stripped methods throw clear error messages listing available methods via Proxy traps
- **Hard timeouts** — worker termination if execution exceeds the configured limit
- **V8 code generation restrictions** — `eval()` and `Function()` construction from strings disabled at the V8 engine level via `codeGeneration: { strings: false, wasm: false }`
- **RPC allowlist** — host-side validation prevents workers from invoking unauthorized API methods
- **Full API access** — all 10 tool groups are available via `sqlite.*` (e.g., `sqlite.core.readQuery()`, `sqlite.json.extract()`)

Set `CODEMODE_ISOLATION=vm` with `CODEMODE_ISOLATION_INSECURE=1` to fall back to the in-process `vm` module sandbox if needed.

### ⚡ Code Mode Only (Maximum Token Savings)

If you control your own setup, you can run with **only Code Mode enabled** — a single tool that provides access to all 170+ tools' worth of capability through the `sqlite.*` API:

```json
{
  "mcpServers": {
    "db-mcp-sqlite": {
      "command": "node",
      "args": [
        "/path/to/db-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--sqlite-native",
        "/path/to/database.db",
        "--tool-filter",
        "codemode"
      ]
    }
  }
}
```

This exposes just `sqlite_execute_code` plus built-in tools. The agent writes JavaScript against the typed `sqlite.*` SDK — composing queries, chaining operations across all 10 tool groups, and returning exactly the data it needs — in one execution. This mirrors the [Code Mode pattern](https://blog.cloudflare.com/code-mode-mcp/) pioneered by Cloudflare for their entire API: fixed token cost regardless of how many capabilities exist.

> [!TIP]
> **Maximize Token Savings:** Instruct your AI agent to prefer Code Mode over individual tool calls:
>
> _"When using db-mcp, prefer `sqlite_execute_code` (Code Mode) for multi-step database operations to minimize token usage."_

---

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 170+ tools in the native backend, you must use tool filtering to stay within limits. Use **shortcuts** or specify **groups** to enable only what you need.

### Quick Start: Recommended Configurations

#### Starter (core + json + text)

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

> **Note:** Native includes FTS5 (5), window functions (6), transactions (8), and SpatiaLite (7) not available in WASM.

| Shortcut     | WASM   | Native | + Built-in | What's Included                |
| ------------ | ------ | ------ | ---------- | ------------------------------ |
| `starter`    | **61** | **66** | +4         | Core, JSON, Text               |
| `analytics`  | 63     | 69     | +4         | Core, JSON, Stats              |
| `search`     | 47     | 52     | +4         | Core, Text, Vector             |
| `spatial`    | 36     | 43     | +4         | Core, Geo, Vector              |
| `dev-schema` | 37     | 37     | +4         | Core, Introspection, Migration |
| `minimal`    | 21     | 21     | +4         | Core only                      |
| `full`       | 139    | 166    | +4         | Everything enabled             |

### Tool Groups (10 Available)

> **Note:** +4 built-in tools (server_info, server_health, list_adapters, sqlite_execute_code) are injected into every group.

| Group           | WASM | Native | + Built-in | Description                                |
| --------------- | ---- | ------ | ---------- | ------------------------------------------ |
| `core`          | 21   | 21     | +4         | Basic CRUD, schema, tables                 |
| `json`          | 25   | 25     | +4         | JSON/JSONB operations, analysis            |
| `text`          | 15   | 20     | +4         | Text processing + FTS5 + advanced search   |
| `stats`         | 17   | 23     | +4         | Descriptive, inference, window functions   |
| `vector`        | 11   | 11     | +4         | Vector storage, similarity search          |
| `admin`         | 30   | 31     | +4         | DB maintenance, backup, virtual tables     |
| `transactions`  | 0    | 8      | +4         | Commit, rollback, savepoints (Native only) |
| `geo`           | 4    | 11     | +4         | Geospatial + SpatiaLite (Native only)      |
| `introspection` | 10   | 10     | +4         | Schema mapping, FK graph, analysis         |
| `migration`     | 6    | 6      | +4         | Schema migration tracking (opt-in)         |

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

### Custom Tool Selection

You can list individual tool names (without `+` prefix) to create a fully custom whitelist — only the tools you specify will be enabled:

Enable exactly 3 tools (whitelist mode):

```bash
--tool-filter "read_query,write_query,list_tables"
```

Mix tools from different groups:

```bash
--tool-filter "read_query,fuzzy_search,vector_search"
```

Combine with a shortcut or group:

```bash
--tool-filter "starter,+vector_search,+fuzzy_search"
```

This is useful for scripted or automated clients that need a minimal, precise set of capabilities.

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

## 🔌 SQLite Extensions

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

Download a precompiled binary or compile from source: https://www.sqlite.org/csv.html

Set the environment variable (Linux/macOS):

```bash
export CSV_EXTENSION_PATH=/path/to/csv.so
```

On Windows, use `.dll`:

```bash
export CSV_EXTENSION_PATH=/path/to/csv.dll
```

Or use the CLI flag:

```bash
db-mcp --sqlite-native ./data.db --csv
```

**SpatiaLite Extension:**

Install the library for your platform:

- **Linux (apt):** `sudo apt install libspatialite-dev`
- **macOS (Homebrew):** `brew install libspatialite`
- **Windows:** Download from https://www.gaia-gis.it/gaia-sins/

Set the environment variable:

```bash
export SPATIALITE_PATH=/path/to/mod_spatialite.so
```

Or use the CLI flag:

```bash
db-mcp --sqlite-native ./data.db --spatialite
```

> **Note:** Extension binaries must match your platform and architecture. The server searches common paths automatically, or use the `CSV_EXTENSION_PATH` / `SPATIALITE_PATH` environment variables for custom locations.

## 📁 Resources

### Data Resources (11)

MCP resources provide read-only access to database metadata:

| Resource                 | URI                                 | Description                       | Min Config    |
| ------------------------ | ----------------------------------- | --------------------------------- | ------------- |
| `sqlite_schema`          | `sqlite://schema`                   | Full database schema              | `minimal`     |
| `sqlite_tables`          | `sqlite://tables`                   | List all tables                   | `minimal`     |
| `sqlite_table_schema`    | `sqlite://table/{tableName}/schema` | Schema for a specific table       | `minimal`     |
| `sqlite_indexes`         | `sqlite://indexes`                  | All indexes in the database       | `minimal`     |
| `sqlite_views`           | `sqlite://views`                    | All views in the database         | `core,admin`  |
| `sqlite_health`          | `sqlite://health`                   | Database health and status        | _(read-only)_ |
| `sqlite_meta`            | `sqlite://meta`                     | Database metadata and PRAGMAs     | `core,admin`  |
| `sqlite_compile_options` | `sqlite://compile_options`          | SQLite compile-time build options | _(read-only)_ |
| `sqlite_pragma`          | `sqlite://pragma`                   | Runtime PRAGMA config snapshot    | _(read-only)_ |
| `sqlite_audit`           | `sqlite://audit`                    | Recent audit log + backup stats   | `--audit-log` |
| `sqlite_metrics`         | `sqlite://metrics`                  | Internal server metrics           | _(read-only)_ |

### Help Resources (1 + up to 10)

On-demand tool reference documentation, filtered by `--tool-filter`:

| Resource                    | URI                           | Description                                           | When Registered             |
| --------------------------- | ----------------------------- | ----------------------------------------------------- | --------------------------- |
| `sqlite_help`               | `sqlite://help`               | Gotchas, WASM vs Native, Code Mode API                | Always                      |
| `sqlite_help_core`          | `sqlite://help/core`          | Core CRUD and table operations reference              | When core group on          |
| `sqlite_help_json`          | `sqlite://help/json`          | JSON/JSONB operations reference                       | When json group on          |
| `sqlite_help_text`          | `sqlite://help/text`          | Text processing + FTS5 reference                      | When text group on          |
| `sqlite_help_stats`         | `sqlite://help/stats`         | Statistical analysis + window functions reference     | When stats group on         |
| `sqlite_help_vector`        | `sqlite://help/vector`        | Vector/semantic search reference                      | When vector group on        |
| `sqlite_help_geo`           | `sqlite://help/geo`           | Geospatial + SpatiaLite reference                     | When geo group on           |
| `sqlite_help_admin`         | `sqlite://help/admin`         | Admin, backup, virtual tables reference               | When admin group on         |
| `sqlite_help_transactions`  | `sqlite://help/transactions`  | Transaction control reference                         | When transactions group on  |
| `sqlite_help_introspection` | `sqlite://help/introspection` | Schema introspection, FK graph, diagnostics reference | When introspection group on |
| `sqlite_help_migration`     | `sqlite://help/migration`     | Migration tracking, apply, rollback reference         | When migration group on     |

> **Efficiency Tip:** Data resources are always **readable** regardless of tool configuration. The "Min Config" column shows the smallest configuration that provides tools to **act on** what the resource exposes. Help resources are served on-demand — agents read them only when working with a specific tool group.

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

| Variable                    | Default     | Description                                                                    |
| --------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `MCP_HOST`                  | `127.0.0.1` | Host/IP to bind to (`0.0.0.0` in Docker) (CLI: `--server-host`)                |
| `SQLITE_DATABASE`           | —           | SQLite database path (CLI: `--sqlite` / `--sqlite-native`)                     |
| `DB_ENCRYPTION_KEY`         | —           | SQLCipher encryption key (Native only) (CLI: `--encryption-key`)               |
| `DB_MCP_TOOL_FILTER`        | —           | Tool filter string (CLI: `--tool-filter`)                                      |
| `METRICS_EXPORT`            | —           | Export metrics at HTTP /metrics (e.g., `prometheus`) (CLI: `--metrics-export`) |
| `OAUTH_ENABLED`             | `false`     | Enable OAuth 2.1 (CLI: `--oauth-enabled`)                                      |
| `OAUTH_ISSUER`              | —           | Authorization server URL (CLI: `--oauth-issuer`)                               |
| `OAUTH_AUDIENCE`            | —           | Expected token audience (CLI: `--oauth-audience`)                              |
| `OAUTH_JWKS_URI`            | —           | JWKS URI, auto-discovered if omitted (CLI: `--oauth-jwks-uri`)                 |
| `OAUTH_CLOCK_TOLERANCE`     | `60`        | Clock tolerance in seconds (CLI: `--oauth-clock-tolerance`)                    |
| `MCP_ENABLE_HSTS`           | `false`     | Enable HSTS header (CLI: `--enable-hsts`)                                      |
| `NO_AUTH_ENFORCEMENT`       | `false`     | Explicitly bypass auth enforcement for HTTP (CLI: `--no-auth-enforcement`)     |
| `LOG_LEVEL`                 | `info`      | Log verbosity: `debug`, `info`, `warning`, `error`                             |
| `METADATA_CACHE_TTL_MS`     | `5000`      | Schema cache TTL in ms (auto-invalidated on DDL operations)                    |
| `CODEMODE_ISOLATION`        | `isolate`   | Code Mode sandbox: `isolate` (isolated-vm native) or `worker`                  |
| `CODE_MODE_MAX_RESULT_SIZE` | `102400`    | Maximum Code Mode result payload in bytes (default 100KB, cap 50MB)            |
| `MCP_RATE_LIMIT_MAX`        | `100`       | Max requests/minute per IP (HTTP transport)                                    |
| `CSV_EXTENSION_PATH`        | —           | Custom path to CSV extension binary (native only)                              |
| `SPATIALITE_PATH`           | —           | Custom path to SpatiaLite extension binary (native only)                       |
| `ALLOWED_IO_ROOTS`          | —           | JSON array or comma-separated list of absolute paths allowed for IO operations |
| `MCP_AUTH_TOKEN`            | —           | Simple bearer token for HTTP auth (CLI: `--auth-token`)                        |
| `AUDIT_LOG`                 | —           | Audit log file path, or `stderr` (CLI: `--audit-log`)                          |
| `AUDIT_REDACT`              | `true`      | Redact tool arguments from audit entries (CLI: `--audit-no-redact` to disable) |
| `AUDIT_READS`               | `false`     | Also log read-scoped tool invocations (CLI: `--audit-reads`)                   |
| `AUDIT_BACKUP`              | `false`     | Enable pre-mutation DDL snapshots (CLI: `--audit-backup`)                      |
| `AUDIT_BACKUP_DATA`         | `false`     | Include sample data rows in snapshots (CLI: `--audit-backup-data`)             |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `1000`), or increase it for production with stable schemas (e.g., `60000` = 1 min). Schema cache is automatically invalidated on DDL operations (CREATE/ALTER/DROP).

### CLI Reference

```
db-mcp [options]

Transport:    --transport <stdio|http|sse>  --port <N>  --server-host <host>  --stateless
Auth:         --oauth-enabled --oauth-issuer <url> --oauth-audience <aud>
Database:     --sqlite <path>  |  --sqlite-native <path>  [--encryption-key <key>]
Extensions:   --csv  --spatialite                         (native only)
Security:     --allowed-io-roots <paths>
Audit:        --audit-log <path>  --audit-no-redact  --audit-reads  --audit-backup  --audit-backup-data
Server:       --name <name>  --version <ver>  --metrics-export <type>  --tool-filter <filter>
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

> [!TIP]
> **Switching backends:** The config above uses the **Native** backend (better-sqlite3, 177 MCP tools). To use the **WASM** backend (sql.js, 150 MCP tools, zero native dependencies), change `--sqlite-native` to `--sqlite` in the args array. See the [Backend Options table in DOCKER_README](DOCKER_README.md#backend-options) for feature differences.

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

## 🌐 HTTP/SSE Transport (Remote Access)

For remote access, web-based clients, or HTTP-compatible MCP hosts, use the HTTP transport:

```bash
node dist/cli.js \
  --transport http \
  --port 3000 \
  --sqlite-native ./database.db \
  --allowed-io-roots $(pwd)
```

**Docker:**

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 \
  --sqlite-native /app/data/database.db \
  --allowed-io-roots /app/data
```

The server supports **two MCP transport protocols simultaneously**, enabling both modern and legacy clients to connect:

### Streamable HTTP (Recommended)

Modern protocol (MCP 2025-03-26) — single endpoint, session-based:

| Method   | Endpoint | Purpose                                          |
| -------- | -------- | ------------------------------------------------ |
| `POST`   | `/mcp`   | JSON-RPC requests (initialize, tools/list, etc.) |
| `GET`    | `/mcp`   | SSE stream for server notifications              |
| `DELETE` | `/mcp`   | Session termination                              |

Sessions are managed via the `Mcp-Session-Id` header.

### Stateless Mode

For serverless/stateless deployments where sessions are not needed:

```bash
node dist/cli.js --transport http --port 3000 --stateless --sqlite-native ./database.db --allowed-io-roots $(pwd)
```

In stateless mode: `GET /mcp` returns 405, `DELETE /mcp` returns 204, `/sse` and `/messages` return 404. Each `POST /mcp` creates a fresh transport.

### Legacy SSE (Backward Compatibility)

Legacy protocol (MCP 2024-11-05) — for clients like Python `mcp.client.sse`:

| Method | Endpoint                   | Purpose                                                       |
| ------ | -------------------------- | ------------------------------------------------------------- |
| `GET`  | `/sse`                     | Opens SSE stream, returns `/messages?sessionId=<id>` endpoint |
| `POST` | `/messages?sessionId=<id>` | Send JSON-RPC messages to the session                         |

### Utility Endpoints

| Method | Endpoint  | Purpose                                                                |
| ------ | --------- | ---------------------------------------------------------------------- |
| `GET`  | `/health` | Health check (bypasses rate limiting, always available for monitoring) |

## 🔐 Authentication

db-mcp secures the HTTP transport using strict OAuth 2.1 authentication:

### OAuth 2.1 (Enterprise)

Full OAuth 2.1 with RFC 9728/8414 compliance for production multi-tenant deployments:

```bash
node dist/cli.js \
  --transport http \
  --port 3000 \
  --sqlite-native ./database.db \
  --allowed-io-roots $(pwd) \
  --oauth-enabled \
  --oauth-issuer http://localhost:8080/realms/db-mcp \
  --oauth-audience db-mcp-server
```

> **Additional flags:** `--oauth-jwks-uri <url>` (auto-discovered if omitted), `--oauth-clock-tolerance <seconds>` (default: 60).

### OAuth Scopes

Access control is managed through OAuth scopes:

| Scope   | Description                            |
| ------- | -------------------------------------- |
| `full`  | Unrestricted access to all operations  |
| `read`  | Read-only access to all databases      |
| `write` | Read and write access to all databases |
| `admin` | Full administrative access             |

### RFC Compliance

This implementation follows:

- **RFC 9728** — OAuth 2.1 Protected Resource Metadata
- **RFC 8414** — OAuth 2.1 Authorization Server Metadata
- **RFC 7591** — OAuth 2.1 Dynamic Client Registration

The server exposes metadata at `/.well-known/oauth-protected-resource`.

> **Note for Keycloak users:** Add an **Audience mapper** to your client (Client → Client scopes → dedicated scope → Add mapper → Audience) to include the correct `aud` claim in tokens.

> [!NOTE]
> **Per-tool scope enforcement:** Scopes are enforced at the tool level — each tool group maps to a required scope (`read`, `write`, or `admin`). Unknown or unmapped tools default to `admin` (fail-closed). When OAuth is enabled, every tool invocation checks the calling token's scopes before execution. When OAuth is not configured, scope checks are skipped entirely.

> [!TIP]
> **Audit identity integration:** When OAuth is enabled alongside audit logging (`--audit-log`), audit entries for write/admin tools automatically capture the authenticated user (`claims.sub`) and granted scopes. This provides a complete forensic trail linking every mutation to a specific identity. Without OAuth, these fields are `null`/`[]`.

> [!WARNING]
> **HTTP without authentication:** When using `--transport http` without enabling OAuth, all clients have full unrestricted access. Always enable authentication for production HTTP deployments. See [SECURITY.md](SECURITY.md) for details.

## 🔐 Encryption at Rest (Native Only)

db-mcp supports transparent database encryption using SQLCipher via the `better-sqlite3-multiple-ciphers` driver. When encryption is enabled, the server automatically encrypts both your target database (if newly created) and the sidecar `SystemDb` audit log, ensuring your schema, queries, and results are protected at rest.

**Important WASM Limitation**: The WASM backend (`sql.js`) **does not** support encryption. If you supply an encryption key to the WASM backend, it will gracefully ignore it for the target database. However, this can cause conflicts if both a Native and WASM backend share the same `--audit-log` file (since the Native backend will encrypt the shared audit log, causing the WASM backend to crash when reading it). To avoid this in dual-backend setups, assign a separate audit log (e.g., `--audit-log mcp-audit-wasm.db`) for your WASM instance.

**Configuring the Key**:
You can provide the key via the `--encryption-key` CLI flag or the `DB_ENCRYPTION_KEY` environment variable.

1. **Strong Passphrase**: A standard string. SQLCipher will automatically use PBKDF2 key derivation.
   ```bash
   DB_ENCRYPTION_KEY="your-strong-passphrase-here"
   ```
2. **Raw Hex Key (Best Performance)**: To skip PBKDF2 derivation overhead, provide an exact 256-bit raw hex key prefixed with `x` and wrapped in single quotes:
   ```bash
   DB_ENCRYPTION_KEY="x'2DD29CA851E7B56E4697B0E1F08507293D761A05CE4D1B628663F411A8086D99'"
   ```

> [!WARNING]
> **Audit Log Compatibility**: The `DB_ENCRYPTION_KEY` environment variable applies globally and will cause the internal `SystemDb` to attempt to decrypt your audit log (`--audit-log`). If you have an existing unencrypted audit log, the server will fail to start with `file is not a database`. To encrypt ONLY your target database (leaving the audit log unencrypted), use the `--encryption-key` CLI flag instead of the global environment variable.

## 📊 Benchmarks

Performance benchmarks measure framework overhead on critical hot paths using [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) (tinybench). The suite validates that framework plumbing stays negligible relative to actual database I/O:

- **Tool dispatch:** 6–14M ops/sec — Map-based lookup is effectively zero-cost
- **Auth scope checks:** 4–8M ops/sec — OAuth middleware adds no measurable latency
- **Identifier validation:** 4–7M ops/sec — SQL sanitization is near-instant
- **Schema cache hits:** 3–6M ops/sec — metadata lookups avoid redundant queries
- **Debug log (filtered):** 5–11M ops/sec — disabled log levels are true no-ops
- **Code Mode security:** ~0.2–1.3M validations/sec for typical code, blocked patterns rejected in 1-2 µs
- **Sandbox execution:** ~0.5–4.9K executions/sec — trivial code round-trips through V8 isolate in 0.2-1.5 ms

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
