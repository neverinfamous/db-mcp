# db-mcp (SQLite MCP Server)

**Last Updated February 10, 2026**

**SQLite MCP Server** with HTTP/SSE Transport, OAuth 2.1 authentication, smart tool filtering, granular access control, 122 specialized tools, 8 resources, and 10 prompts. Available in WASM and better-sqlite3 variants.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/db--mcp-blue?logo=github)](https://github.com/neverinfamous/db-mcp)
[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/db-mcp)](https://github.com/neverinfamous/db-mcp/releases/latest)
[![npm](https://img.shields.io/npm/v/db-mcp)](https://www.npmjs.com/package/db-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/db-mcp)](https://hub.docker.com/r/writenotenow/db-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-Published-green)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/db-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/db-mcp)

**[Wiki](https://github.com/neverinfamous/db-mcp/wiki)** • **[Changelog](CHANGELOG.md)** • **[Security](SECURITY.md)**

---

## 📋 Table of Contents

### Quick Start

- [✅ Quick Test - Verify Everything Works](#-quick-test---verify-everything-works)
- [🚀 Quick Start](#-quick-start)
- [⚡ Install to Cursor IDE](#-install-to-cursor-ide)
- [🎛️ Tool Filtering](#️-tool-filtering) ⭐ **Important for IDE users**

### Configuration & Usage

- [📊 Tool Categories](#-tool-categories)
- [📚 MCP Client Configuration](#-mcp-client-configuration)

### Features & Resources

- [🔥 Core Capabilities](#-core-capabilities)
- [🔐 OAuth 2.1 Implementation](#-oauth-21-implementation)
- [🏆 Why Choose db-mcp?](#-why-choose-db-mcp)

---

## ✅ Quick Test - Verify Everything Works

**Test the server in 30 seconds!**

Build and run:

```bash
npm run build

# Option 1: Native backend (better-sqlite3)
node dist/cli.js --transport stdio --sqlite-native :memory:

# Option 2: WASM backend (sql.js)
node dist/cli.js --transport stdio --sqlite :memory:
```

Expected output (native):

```
[db-mcp] Starting MCP server...
[db-mcp] Registered adapter: Native SQLite Adapter (better-sqlite3) (sqlite:default)
[db-mcp] Server started successfully
```

Expected output (WASM):

```
[db-mcp] Starting MCP server...
[db-mcp] Registered adapter: WASM SQLite Adapter (sql.js) (sqlite:default)
[db-mcp] Server started successfully
```

Run the test suite:

```bash
npm run test
```

### 🛡️ Security Features

- ✅ **SQL Injection Prevention** - Parameter binding on all queries
- ✅ **OAuth 2.1 Authentication** - RFC 9728/8414 compliant
- ✅ **Scope-based Authorization** - Granular read/write/admin access
- ✅ **Strict TypeScript** - Full type safety with no `any` types

[⬆️ Back to Table of Contents](#-table-of-contents)

---

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

> **Backend Choice:** Use `--sqlite-native` for full features (122 tools, transactions, window functions, SpatiaLite). Use `--sqlite` for WASM mode (102 tools, no native dependencies).

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## ⚡ Install to Cursor IDE

### One-Click Installation

Click the button below to install directly into Cursor:

[![Install to Cursor](https://img.shields.io/badge/Install%20to%20Cursor-Click%20Here-blue?style=for-the-badge)](cursor://anysphere.cursor-deeplink/mcp/install?name=db-mcp-sqlite&config=eyJkYi1tY3Atc3FsaXRlIjp7ImFyZ3MiOlsicnVuIiwiLWkiLCItLXJtIiwiLXYiLCIkKHB3ZCk6L3dvcmtzcGFjZSIsIndyaXRlbm90ZW5vdy9kYi1tY3A6bGF0ZXN0IiwiLS1zcWxpdGUtbmF0aXZlIiwiL3dvcmtzcGFjZS9kYXRhYmFzZS5kYiJdLCJjb21tYW5kIjoiZG9ja2VyIn19)

Or copy this deep link:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=db-mcp-sqlite&config=eyJkYi1tY3Atc3FsaXRlIjp7ImFyZ3MiOlsicnVuIiwiLWkiLCItLXJtIiwiLXYiLCIkKHB3ZCk6L3dvcmtzcGFjZSIsIndyaXRlbm90ZW5vdy9kYi1tY3A6bGF0ZXN0IiwiLS1zcWxpdGUtbmF0aXZlIiwiL3dvcmtzcGFjZS9kYXRhYmFzZS5kYiJdLCJjb21tYW5kIjoiZG9ja2VyIn19
```

### Prerequisites

- ✅ Docker installed and running (for Docker method)
- ✅ Node.js 24+ (LTS) (for local installation)

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 122 tools in the native backend, you must use tool filtering to stay within limits. Use **shortcuts** or specify **groups** to enable only what you need.

> **AntiGravity Users:** Server instructions are automatically sent to MCP clients during initialization. However, AntiGravity does not currently support MCP server instructions. For optimal usage in AntiGravity, manually provide the contents of [`src/constants/ServerInstructions.ts`](src/constants/ServerInstructions.ts) to the agent in your prompt or user rules.

### Quick Start: Recommended Configurations

#### Option 1: Starter (48 tools) ⭐ Recommended

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

#### Option 2: Analytics (50 tools)

Core + JSON + Stats + Window functions. For data analysis.

```json
{
  "args": [
    "--transport",
    "stdio",
    "--sqlite-native",
    "C:/path/to/database.db",
    "--tool-filter",
    "analytics"
  ]
}
```

#### Option 3: Search (36 tools)

Core + Text + FTS5 + Vector. For search workloads.

```json
{
  "args": [
    "--transport",
    "stdio",
    "--sqlite-native",
    "C:/path/to/database.db",
    "--tool-filter",
    "search"
  ]
}
```

#### Option 4: Custom Groups

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

---

### Shortcuts (Predefined Bundles)

> **Note:** Native includes transactions (7), window functions (6), and SpatiaLite (7) not available in WASM.

| Shortcut    | WASM   | Native | + Built-in | What's Included    |
| ----------- | ------ | ------ | ---------- | ------------------ |
| `starter`   | **48** | **48** | +3         | Core, JSON, Text   |
| `analytics` | 44     | 50     | +3         | Core, JSON, Stats  |
| `search`    | 36     | 36     | +3         | Core, Text, Vector |
| `spatial`   | 23     | 30     | +3         | Core, Geo, Vector  |
| `minimal`   | 8      | 8      | +3         | Core only          |
| `full`      | 102    | 122    | +3         | Everything enabled |

---

### Tool Groups (7 Available)

> **Note:** +3 built-in tools (server_info, server_health, list_adapters) are always included.

| Group    | WASM | Native | + Built-in | Description                              |
| -------- | ---- | ------ | ---------- | ---------------------------------------- |
| `core`   | 8    | 8      | +3         | Basic CRUD, schema, tables               |
| `json`   | 23   | 23     | +3         | JSON/JSONB operations, analysis          |
| `text`   | 13   | 17     | +3         | Text processing + FTS5 + advanced search |
| `stats`  | 13   | 19     | +3         | Statistical analysis (+ window funcs)    |
| `vector` | 11   | 11     | +3         | Embeddings, similarity search            |
| `admin`  | 26   | 33     | +3         | Backup, restore, virtual tables, pragma  |
| `geo`    | 4    | 11     | +3         | Geospatial + SpatiaLite (Native only)    |

---

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

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 📊 Tool Categories

| Category              | WASM    | Native  | Description                                    |
| --------------------- | ------- | ------- | ---------------------------------------------- |
| Core Database         | 8       | 8       | CRUD, schema, indexes, views                   |
| JSON Helpers          | 8       | 8       | Simplified JSON operations, schema analysis    |
| JSON Operations       | 15      | 15      | Full JSON manipulation, JSONB support          |
| Text Processing       | 13      | 13      | Regex, fuzzy, phonetic, advanced search        |
| FTS5 Full-Text Search | 4       | 4       | Create, search, rebuild, optimize              |
| Statistical Analysis  | 13      | 19      | Stats, outliers, regression + window functions |
| Virtual Tables        | 13      | 13      | CSV, R-Tree, series, views, vacuum, dbstat     |
| Vector/Semantic       | 11      | 11      | Embeddings, similarity search                  |
| Geospatial            | 4       | 11      | Distance, bounding box + SpatiaLite GIS        |
| Admin/PRAGMA          | 13      | 20      | Backup, restore, pragmas, transactions         |
| **Total**             | **102** | **122** |                                                |

### SQLite Backend Options

Choose between two SQLite backends based on your needs:

| Feature                   | WASM (sql.js)     | Native (better-sqlite3)       |
| ------------------------- | ----------------- | ----------------------------- |
| **Tools Available**       | 102               | **122**                       |
| **Transactions**          | ❌                | ✅ 7 tools                    |
| **Window Functions**      | ❌                | ✅ 6 tools                    |
| **FTS5 Full-Text Search** | ⚠️ Limited        | ✅ Full                       |
| **JSON1 Extension**       | ⚠️ Limited        | ✅ Full                       |
| **Cross-platform**        | ✅ No compilation | Requires Node.js native build |
| **In-memory DBs**         | ✅                | ✅                            |
| **File-based DBs**        | ✅                | ✅                            |

Transaction Tools (7) - Native Only

| Tool                             | Description                                           |
| -------------------------------- | ----------------------------------------------------- |
| `sqlite_transaction_begin`       | Start transaction (deferred/immediate/exclusive mode) |
| `sqlite_transaction_commit`      | Commit current transaction                            |
| `sqlite_transaction_rollback`    | Rollback current transaction                          |
| `sqlite_transaction_savepoint`   | Create a savepoint                                    |
| `sqlite_transaction_release`     | Release a savepoint                                   |
| `sqlite_transaction_rollback_to` | Rollback to a savepoint                               |
| `sqlite_transaction_execute`     | Execute multiple statements atomically                |

Window Function Tools (6) - Native Only

| Tool                          | Description                                           |
| ----------------------------- | ----------------------------------------------------- |
| `sqlite_window_row_number`    | Assign sequential row numbers                         |
| `sqlite_window_rank`          | Calculate RANK/DENSE_RANK/PERCENT_RANK                |
| `sqlite_window_lag_lead`      | Access previous or next row values                    |
| `sqlite_window_running_total` | Calculate cumulative sums                             |
| `sqlite_window_moving_avg`    | Calculate rolling averages                            |
| `sqlite_window_ntile`         | Divide rows into N buckets (quartiles, deciles, etc.) |

### SQLite Extensions

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

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## ⚡ Performance Tuning

Schema metadata is cached to reduce repeated queries during tool/resource invocations.

| Variable                | Default | Description                                        |
| ----------------------- | ------- | -------------------------------------------------- |
| `METADATA_CACHE_TTL_MS` | `5000`  | Cache TTL for schema metadata (milliseconds)       |
| `LOG_LEVEL`             | `info`  | Log verbosity: `debug`, `info`, `warning`, `error` |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `1000`), or increase it for production with stable schemas (e.g., `60000` = 1 min). Schema cache is automatically invalidated on DDL operations (CREATE/ALTER/DROP).

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 📚 MCP Client Configuration

### Cursor IDE (Native Backend)

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
        "C:/path/to/your/database.db"
      ]
    }
  }
}
```

### Cursor IDE (WASM Backend)

```json
{
  "mcpServers": {
    "db-mcp-sqlite": {
      "command": "node",
      "args": [
        "C:/path/to/db-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--sqlite",
        "C:/path/to/your/database.db"
      ]
    }
  }
}
```

### Claude Desktop (Native)

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
        "/path/to/database.db"
      ]
    }
  }
}
```

### Claude Desktop (WASM)

```json
{
  "mcpServers": {
    "db-mcp-sqlite": {
      "command": "node",
      "args": [
        "/path/to/db-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--sqlite",
        "/path/to/database.db"
      ]
    }
  }
}
```

### Native with Extensions (CSV + SpatiaLite)

To enable loadable extensions, add CLI flags and set environment variables for extension paths:

**Windows:**

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
        "--csv",
        "--spatialite",
        "--tool-filter",
        "starter"
      ],
      "env": {
        "SPATIALITE_PATH": "C:/path/to/extensions/mod_spatialite.dll"
      }
    }
  }
}
```

**Linux/macOS:**

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
        "--csv",
        "--spatialite",
        "--tool-filter",
        "starter"
      ],
      "env": {
        "CSV_EXTENSION_PATH": "/path/to/extensions/csv.so",
        "SPATIALITE_PATH": "/usr/lib/x86_64-linux-gnu/mod_spatialite.so"
      }
    }
  }
}
```

> **Note:** Extension flags (`--csv`, `--spatialite`) are only available with the native backend (`--sqlite-native`). Set environment variables if extensions are not in standard system paths.

### Docker with Claude Desktop

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

### In-Memory Database

Use `:memory:` for a temporary in-memory database:

```json
{
  "args": ["--transport", "stdio", "--sqlite-native", ":memory:"]
}
```

### HTTP/SSE Transport (Remote Access)

For remote access, web-based clients, or MCP Inspector testing, run the server in HTTP mode:

```bash
node dist/cli.js --transport http --port 3000 --sqlite-native ./database.db
```

**Endpoints:**

| Endpoint      | Description                                   |
| ------------- | --------------------------------------------- |
| `GET /`       | Server info and available endpoints           |
| `POST /mcp`   | JSON-RPC requests (initialize, tools/call)    |
| `GET /mcp`    | SSE stream for server-to-client notifications |
| `DELETE /mcp` | Session termination                           |
| `GET /health` | Health check (always public)                  |

**Session Management:** The server uses stateful sessions by default. Include the `mcp-session-id` header (returned from initialization) in subsequent requests for session continuity.

#### Stateless Mode (Serverless)

For serverless deployments (AWS Lambda, Cloudflare Workers, Vercel), use stateless mode:

```bash
node dist/cli.js --transport http --port 3000 --stateless --sqlite-native :memory:
```

| Mode                      | Progress Notifications | SSE Streaming | Serverless |
| ------------------------- | ---------------------- | ------------- | ---------- |
| Stateful (default)        | ✅ Yes                 | ✅ Yes        | ⚠️ Complex |
| Stateless (`--stateless`) | ❌ No                  | ❌ No         | ✅ Native  |

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🔥 Core Capabilities

- 📊 **Statistical Analysis** - Descriptive stats, percentiles, time series analysis
- 🔍 **Advanced Text Processing** - Regex, fuzzy matching, phonetic search, similarity
- 🧠 **Vector/Semantic Search** - AI-native embeddings, cosine similarity, hybrid search
- 🗺️ **Geospatial Operations** - Distance calculations, bounding boxes, spatial queries
- 🔐 **Transaction Safety** - Full ACID compliance with savepoints (native backend)
- 🎛️ **122 Specialized Tools** - Complete database administration and analytics suite

### 🏢 Enterprise Features

- 🔐 **OAuth 2.1 Authentication** - RFC 9728/8414 compliant token-based authentication
- 🛡️ **Tool Filtering** - Control which database operations are exposed
- 👥 **Access Control** - Granular scopes for read-only, write, and admin access
- 🎯 **Full-Text Search (FTS5)** - Advanced search with BM25 ranking
- ⚡ **Window Functions** - Row numbers, rankings, running totals, moving averages

[⬆️ Back to Table of Contents](#-table-of-contents)

---

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
node dist/cli.js --transport http --port 3000 --sqlite-native ./database.db
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

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🏆 Why Choose db-mcp?

✅ **TypeScript Native** - Full type safety with strict mode, no `any` types  
✅ **122 Specialized Tools** - Most comprehensive SQLite MCP server available  
✅ **OAuth 2.1 Built-in** - Enterprise-grade authentication out of the box  
✅ **Dual Backends** - WASM for portability, native for performance  
✅ **Tool Filtering** - Stay within AI IDE tool limits with preset configurations  
✅ **Window Functions** - Advanced analytics with ROW_NUMBER, RANK, LAG/LEAD  
✅ **Transaction Support** - Full ACID compliance with savepoints  
✅ **Modern Architecture** - Built on MCP SDK with clean, modular design  
✅ **Active Development** - Regular updates and improvements

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 📈 Project Stats

- **122 Tools** in native backend (102 in WASM)
- **13 Tool Groups** for flexible filtering
- **Strict TypeScript** with full type coverage
- **Multi-platform** support (Windows, Linux, macOS)
- **Docker images** available for easy deployment
- **OAuth 2.1** RFC-compliant authentication
- **Active development** with regular updates

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=db-mcp
KEYCLOAK_CLIENT_ID=db-mcp-server
KEYCLOAK_CLIENT_SECRET=your_secret_here
DBMCP_PORT=3000
DBMCP_OAUTH_ENABLED=true
```

### JSON Configuration

See `config/db-mcp.keycloak.json` for a complete example.

---

## 🚧 Planned Improvements

_No pending improvements. All features are up-to-date._

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
