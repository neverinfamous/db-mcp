# db-mcp (SQLite MCP Server)

**Last Updated March 4, 2026**

**SQLite MCP Server** with HTTP/SSE Transport, OAuth 2.1 authentication, smart tool filtering, granular access control, 136 specialized tools, 8 resources, and 10 prompts. Available in WASM and better-sqlite3 variants.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/db--mcp-blue?logo=github)](https://github.com/neverinfamous/db-mcp)
[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/db-mcp)](https://github.com/neverinfamous/db-mcp/releases/latest)
[![npm](https://img.shields.io/npm/v/db-mcp)](https://www.npmjs.com/package/db-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/db-mcp)](https://hub.docker.com/r/writenotenow/db-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-Published-green)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/db-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/db-mcp/blob/main/SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/db-mcp)
![Tests](https://img.shields.io/badge/Tests-941%20passed-brightgreen)
![Coverage](https://img.shields.io/badge/Coverage-80%25-yellow)

**[GitHub](https://github.com/neverinfamous/db-mcp)** • **[Wiki](https://github.com/neverinfamous/db-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/db-mcp/blob/main/CHANGELOG.md)**

---

## 🎯 What Sets Us Apart

| Feature                        | Description                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **136 Specialized Tools**      | The most comprehensive SQLite MCP server available — core CRUD, JSON/JSONB, FTS5 full-text search, statistical analysis, vector search, geospatial/SpatiaLite, introspection, migration, and admin |
| **8 Resources**                | Schema, tables, indexes, views, health status, database metadata, and business insights — always readable regardless of tool configuration                               |
| **10 AI-Powered Prompts**      | Guided workflows for schema exploration, query building, data analysis, optimization, migration, debugging, and hybrid FTS5 + vector search                              |
| **Dual SQLite Backends**       | WASM (sql.js) for zero-compilation portability, Native (better-sqlite3) for full features including transactions, window functions, and SpatiaLite GIS                   |
| **OAuth 2.1 + Access Control** | Enterprise-ready security with RFC 9728/8414 compliance, granular scopes (`read`, `write`, `admin`, `db:*`, `table:*:*`), and Keycloak integration                       |
| **Smart Tool Filtering**       | 9 tool groups + 7 shortcuts let you stay within IDE limits while exposing exactly what you need                                                                          |
| **HTTP Streaming Transport**   | Dual-protocol HTTP with Streamable HTTP + Legacy SSE, security headers, rate limiting, health check, and stateless mode for serverless                                   |
| **Structured Error Handling**  | Tools return `{success, error}` responses with actionable context — designed for agent consumption rather than cryptic error codes                                       |
| **Production-Ready Security**  | SQL injection prevention via parameter binding, input validation, non-root Docker execution, and build provenance                                                        |
| **Strict TypeScript**          | 100% type-safe codebase with strict mode, no `any` types                                                                                                                 |
| **MCP 2025-11-25 Compliant**   | Full protocol support with tool safety hints, resource priorities, and progress notifications                                                                            |

### Backend Options

| Feature              | WASM (sql.js)      | Native (better-sqlite3)    |
| -------------------- | ------------------ | -------------------------- |
| **Tools Available**  | 112                | **136**                    |
| **Transactions**     | ❌                 | ✅ 7 tools                 |
| **Window Functions** | ❌                 | ✅ 6 tools                 |
| **SpatiaLite GIS**   | ❌                 | ✅ 7 tools                 |
| **Cross-platform**   | ✅ Pure JavaScript | Compiled natively in image |

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
        "/app/data/database.db"
      ]
    }
  }
}
```

### 3. Restart & Query!

Restart Cursor or your MCP client and start querying SQLite databases!

## ⚡ Install to Cursor IDE

### One-Click Installation

Click the button below to install directly into Cursor:

[![Install to Cursor](https://img.shields.io/badge/Install%20to%20Cursor-Click%20Here-blue?style=for-the-badge)](cursor://anysphere.cursor-deeplink/mcp/install?name=db-mcp-sqlite&config=eyJkYi1tY3Atc3FsaXRlIjp7ImFyZ3MiOlsicnVuIiwiLWkiLCItLXJtIiwiLXYiLCIkKHB3ZCk6L3dvcmtzcGFjZSIsIndyaXRlbm90ZW5vdy9kYi1tY3A6bGF0ZXN0IiwiLS1zcWxpdGUtbmF0aXZlIiwiL3dvcmtzcGFjZS9kYXRhYmFzZS5kYiJdLCJjb21tYW5kIjoiZG9ja2VyIn19)

### Prerequisites

- ✅ Docker installed and running
- ✅ ~200MB disk space available

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 136 tools in the native backend, you must use tool filtering to stay within limits. Use **shortcuts** or specify **groups** to enable only what you need.

> **AntiGravity Users:** Server instructions are automatically sent to MCP clients during initialization. However, AntiGravity does not currently support MCP server instructions. For optimal usage in AntiGravity, manually provide the contents of [`src/constants/ServerInstructions.ts`](src/constants/ServerInstructions.ts) to the agent in your prompt or user rules.

### Quick Start: Recommended Configurations

#### ⭐ Recommended: Starter (50 tools)

Core + JSON + Text. Best for general development.

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
        "starter"
      ]
    }
  }
}
```

#### Custom Groups

Specify exactly the groups you need:

```json
{
  "args": [
    "--transport",
    "stdio",
    "--sqlite-native",
    "C:/path/to/database.db",
    "--tool-filter",
    "core,json,stats"
  ]
}
```

### Shortcuts (Predefined Bundles)

> **Note:** Native includes FTS5 (4), window functions (6), transactions (7), and SpatiaLite (7) not available in WASM.

| Shortcut    | WASM   | Native | + Built-in | What's Included    |
| ----------- | ------ | ------ | ---------- | ------------------ |
| `starter`   | **46** | **50** | +3         | Core, JSON, Text   |
| `analytics` | 46     | 52     | +3         | Core, JSON, Stats  |
| `search`    | 34     | 38     | +3         | Core, Text, Vector |
| `spatial`   | 25     | 32     | +3         | Core, Geo, Vector              |
| `dev-schema`| 22     | 22     | +3         | Core, Introspection, Migration |
| `minimal`   | 10     | 10     | +3         | Core only                      |
| `full`      | 112    | 136    | +3         | Everything enabled             |

### Tool Groups (9 Available)

> **Note:** +3 built-in tools (server_info, server_health, list_adapters) and +1 code mode are always included.

| Group    | WASM | Native | + Built-in | Description                              |
| -------- | ---- | ------ | ---------- | ---------------------------------------- |
| `core`   | 10   | 10     | +3         | Basic CRUD, schema, tables               |
| `json`   | 24   | 24     | +3         | JSON/JSONB operations, analysis          |
| `text`   | 14   | 18     | +3         | Text processing + FTS5 + advanced search |
| `stats`  | 14   | 20     | +3         | Statistical analysis (+ window funcs)    |
| `vector` | 12   | 12     | +3         | Embeddings, similarity search            |
| `admin`         | 27   | 34     | +3         | Backup, restore, virtual tables, pragma     |
| `geo`           | 5    | 12     | +3         | Geospatial + SpatiaLite (Native only)       |
| `introspection` | 6    | 6      | +3         | Dependency graph, cascade sim, schema audit |
| `migration`     | 6    | 6      | +3         | Migration tracking, apply, rollback (opt-in)|

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
# Use a shortcut
--tool-filter "starter"

# Combine groups (whitelist mode)
--tool-filter "core,json,text,fts5"

# Extend a shortcut
--tool-filter "starter,+stats"

# Exclude from a shortcut
--tool-filter "starter,-fts5"
```

**Legacy Syntax (still supported):**
If you start with a negative filter (e.g., `-vector,-geo`), it assumes you want to start with _all_ tools enabled and then subtract.

```bash
# Legacy: start with all, exclude some
--tool-filter "-stats,-vector,-geo,-backup,-monitoring,-transactions,-window"
```

## 🛡️ Supply Chain Security

For enhanced security, use SHA-pinned images:

**Find SHA tags:** https://hub.docker.com/r/writenotenow/db-mcp/tags

```bash
# Multi-arch manifest (recommended)
docker pull writenotenow/db-mcp:sha256-<manifest-digest>

# Direct digest (maximum security)
docker pull writenotenow/db-mcp@sha256:<manifest-digest>
```

**Security Features:**

- ✅ **Build Provenance** - Cryptographic proof of build process
- ✅ **SBOM Available** - Complete software bill of materials
- ✅ **Non-root Execution** - Minimal attack surface
- ✅ **Security Scanned** - Docker Scout blocks critical/high CVEs

## 📊 Tool Categories

| Category             | Native  | Description                     |
| -------------------- | ------- | ------------------------------- |
| Core Database        | 9       | CRUD, schema, indexes, views    |
| JSON Operations      | 23      | JSON/JSONB, schema analysis     |
| Text Processing      | 17      | Regex, fuzzy, phonetic, FTS5    |
| Statistical Analysis | 19      | Stats, outliers, window funcs   |
| Vector/Semantic      | 11      | Embeddings, similarity search   |
| Geospatial           | 11      | Distance, SpatiaLite GIS        |
| Admin/Backup         | 33      | Backup, restore, virtual tables |
| Introspection        | 6       | FK graph, cascade sim, audit    |
| Migration            | 6       | Tracking, apply, rollback       |
| Code Mode            | 1       | Sandboxed JavaScript execution  |
| **Total**            | **136** |                                 |

### 📁 Resources (8)

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

> **Efficiency Tip:** Resources are always **readable** regardless of tool configuration. The "Min Config" column shows the smallest configuration that provides tools to **act on** what the resource exposes. Use `--tool-filter "core,admin"` (~18 tools) instead of `full` (102+) when you only need resource-related functionality.

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

```bash
# Performance tuning
-e METADATA_CACHE_TTL_MS=5000   # Schema cache TTL (default: 5000ms)
-e LOG_LEVEL=info               # Log verbosity: debug, info, warning, error

# Server binding
-e MCP_HOST=0.0.0.0             # Host/IP to bind to (default: 0.0.0.0)

# OAuth 2.1 (HTTP transport only)
-e KEYCLOAK_URL=http://localhost:8080
-e KEYCLOAK_REALM=db-mcp
-e KEYCLOAK_CLIENT_ID=db-mcp-server
```

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

- **7 Security Headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Cache-Control`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`
- **Rate Limiting** — 100 requests/minute per IP (429 on excess, health checks exempt)
- **CORS** — Configurable via `--cors-origins` (default: `*`)
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

### 🔐 OAuth 2.1

OAuth is automatically enabled when running in HTTP mode with OAuth environment variables configured.

**Supported Scopes:**

| Scope                | Description                            |
| -------------------- | -------------------------------------- |
| `read`               | Read-only access to all databases      |
| `write`              | Read and write access to all databases |
| `admin`              | Full administrative access             |
| `db:{name}`          | Access to specific database only       |
| `table:{db}:{table}` | Access to specific table only          |

**Quick Start with OAuth:**

```bash
# Run with OAuth enabled
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  -e KEYCLOAK_URL=http://localhost:8080 \
  -e KEYCLOAK_REALM=db-mcp \
  -e KEYCLOAK_CLIENT_ID=db-mcp-server \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --server-host 0.0.0.0 --sqlite-native /app/data/database.db
```

See [Keycloak Setup](https://github.com/neverinfamous/db-mcp/blob/main/docs/KEYCLOAK_SETUP.md) for configuring your OAuth provider.

## 📦 Image Details

| Platform                  | Features                            |
| ------------------------- | ----------------------------------- |
| **AMD64** (x86_64)        | Full: 136 tools, native, SpatiaLite |
| **ARM64** (Apple Silicon) | Full: 136 tools, native             |

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
