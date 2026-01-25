# db-mcp

Last Updated January 14, 2026

_Enterprise-grade SQLite MCP Server with OAuth 2.1 authentication & 89 specialized tools_

> **Beta** - This project is actively being developed and is not yet ready for production use.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/db--mcp-blue?logo=github)](https://github.com/neverinfamous/db-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CodeQL](https://github.com/neverinfamous/db-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/neverinfamous/db-mcp/actions/workflows/codeql.yml)
![Version](https://img.shields.io/badge/version-0.1.0-green)
![Status](https://img.shields.io/badge/status-Under%20Development-orange)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)

A **SQLite MCP Server** with up to 89 tools, OAuth 2.1 authentication, and granular access control. Written in TypeScript.

**[Wiki](https://github.com/neverinfamous/db-mcp/wiki)** • **[Changelog](CHANGELOG.md)** • **[Security](SECURITY.md)**

---

## 📋 Table of Contents

### Quick Start

- [✅ Quick Test - Verify Everything Works](#-quick-test---verify-everything-works)
- [🚀 Quick Start](#-quick-start)
- [⚡ Install to Cursor IDE](#-install-to-cursor-ide)

### Configuration & Usage

- [📚 MCP Client Configuration](#-mcp-client-configuration)
- [🎛️ Tool Filtering Presets](#️-tool-filtering-presets)
- [🎨 Usage Examples](#-usage-examples)
- [📊 Tool Categories](#-tool-categories)

### Features & Resources

- [🔥 Core Capabilities](#-core-capabilities)
- [🔐 OAuth 2.1 Implementation](#-oauth-20-implementation)
- [🏆 Why Choose db-mcp?](#-why-choose-db-mcp)
- [📈 Project Stats](#-project-stats)

---

## ✅ Quick Test - Verify Everything Works

**Test the server in 30 seconds!**

Build and run:

```bash
npm run build
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
node dist/cli.js --transport stdio --sqlite-native ./database.db
```

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

## 📊 Tool Categories

| Category              | WASM   | Native | Description                                |
| --------------------- | ------ | ------ | ------------------------------------------ |
| Core Database         | 8      | 8      | CRUD, schema, indexes, views               |
| JSON Helpers          | 6      | 6      | Simplified JSON operations                 |
| JSON Operations       | 12     | 12     | Full JSON manipulation                     |
| Text Processing       | 8      | 8      | Regex, case, substring                     |
| FTS5 Full-Text Search | 4      | 4      | Create, search, rebuild                    |
| Statistical Analysis  | 8      | 8      | Stats, percentiles, histograms             |
| Virtual Tables        | 4      | 4      | Generate series                            |
| Vector/Semantic       | 11     | 11     | Embeddings, similarity search              |
| Geospatial            | 7      | 7      | Distance, bounding box, clustering         |
| Admin                 | 4      | 4      | Vacuum, backup, analyze, optimize          |
| Transactions          | —      | 7      | Begin, commit, rollback, savepoints        |
| Window Functions      | —      | 6      | Row number, rank, lag/lead, running totals |
| **Total**             | **76** | **89** |                                            |

### SQLite Backend Options

Choose between two SQLite backends based on your needs:

| Feature                   | WASM (sql.js)     | Native (better-sqlite3)       |
| ------------------------- | ----------------- | ----------------------------- |
| **Tools Available**       | 76                | **89**                        |
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

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 📚 MCP Client Configuration

### Cursor IDE

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

### Claude Desktop

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

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 89 tools in the native backend, you must use tool filtering to stay within limits. Use **shortcuts** or specify **groups** to enable only what you need.

### Quick Start: Recommended Configurations

#### Option 1: Starter (~26 tools) ⭐ Recommended

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

#### Option 2: Analytics (~34 tools)

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

#### Option 3: Search (~27 tools)

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

| Shortcut    | Tools   | Use Case           | What's Included           |
| ----------- | ------- | ------------------ | ------------------------- |
| `starter`   | **~26** | 🌟 **Recommended** | Core, JSON, Text          |
| `analytics` | ~34     | Data Analysis      | Core, JSON, Stats, Window |
| `search`    | ~27     | Search Workloads   | Core, Text, FTS5, Vector  |
| `spatial`   | ~27     | Geospatial         | Core, JSON, Geo           |
| `minimal`   | ~9      | Bare Minimum       | Core only                 |
| `full`      | ~89     | All Tools          | Everything enabled        |

---

### Tool Groups (13 Available)

| Group          | Tools | Description                       |
| -------------- | ----- | --------------------------------- |
| `core`         | 9     | Basic CRUD, schema, tables        |
| `json`         | 11    | JSON operations                   |
| `text`         | 6     | Text processing (regex, fuzzy)    |
| `fts5`         | 4     | Full-text search                  |
| `stats`        | 8     | Statistical analysis              |
| `performance`  | 6     | Query analysis, optimization      |
| `vector`       | 8     | Embeddings, similarity search     |
| `geo`          | 7     | Geospatial operations             |
| `backup`       | 4     | Database backup/restore           |
| `monitoring`   | 5     | Health checks, resource usage     |
| `admin`        | 10    | Vacuum, analyze, pragmas          |
| `transactions` | 7     | Transaction control (native only) |
| `window`       | 6     | Window functions (native only)    |

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

## 🎨 Usage Examples

### Data Analysis Workflow

1. Build the project:

```bash
npm run build
```

2. Start with your data:

```bash
node dist/cli.js --transport stdio --sqlite-native ./sales_data.db
```

3. Use with Claude/Cursor for:
   - Statistical analysis of your datasets
   - Text processing and pattern extraction
   - Vector similarity search
   - Geospatial analysis and mapping

### JSON Operations

```javascript
// Insert JSON data
sqlite_write_query({
  query: "INSERT INTO products (metadata) VALUES (?)",
  params: [JSON.stringify({ name: "Product", price: 29.99 })],
});

// Query JSON with path extraction
sqlite_json_extract({
  table: "products",
  column: "metadata",
  path: "$.price",
});
```

### Vector/Semantic Search

```javascript
// Store embeddings
sqlite_vector_store({
  table: "documents",
  id_column: "id",
  embedding_column: "embedding",
  id: 1,
  embedding: [0.1, 0.2, 0.3, ...]
})

// Find similar items
sqlite_vector_search({
  table: "documents",
  embedding_column: "embedding",
  query_embedding: [0.15, 0.25, 0.35, ...],
  top_k: 10
})
```

### Full-Text Search (FTS5)

```javascript
// Create FTS5 index
sqlite_fts_create({
  table: "articles",
  columns: ["title", "content"],
});

// Search with BM25 ranking
sqlite_fts_search({
  table: "articles",
  query: "machine learning",
  limit: 10,
});
```

### Statistical Analysis

```javascript
// Get descriptive statistics for a column
sqlite_describe_stats({
  table: "employees",
  column: "salary",
});
// Returns: count, mean, std, min, 25%, 50%, 75%, max

// Calculate percentiles
sqlite_percentile({
  table: "sales",
  column: "revenue",
  percentiles: [25, 50, 75, 90, 95, 99],
});

// Generate histogram
sqlite_histogram({
  table: "products",
  column: "price",
  bins: 10,
});
```

### Geospatial Operations

```javascript
// Calculate distance between two points (Haversine formula)
sqlite_geo_distance({
  lat1: 40.7128,
  lon1: -74.006, // New York
  lat2: 34.0522,
  lon2: -118.2437, // Los Angeles
});
// Returns: distance in kilometers

// Find locations within bounding box
sqlite_geo_bounding_box({
  table: "stores",
  lat_column: "latitude",
  lon_column: "longitude",
  min_lat: 40.0,
  max_lat: 41.0,
  min_lon: -75.0,
  max_lon: -73.0,
});

// Cluster nearby points
sqlite_geo_cluster({
  table: "customers",
  lat_column: "lat",
  lon_column: "lon",
  distance_km: 5,
});
```

### Window Functions (Native Only)

```javascript
// Add row numbers to query results
sqlite_window_row_number({
  table: "employees",
  order_by: "hire_date",
  partition_by: "department",
});

// Calculate rankings
sqlite_window_rank({
  table: "sales",
  value_column: "revenue",
  partition_by: "region",
  rank_type: "dense_rank", // or "rank", "percent_rank"
});

// Calculate running totals
sqlite_window_running_total({
  table: "transactions",
  value_column: "amount",
  order_by: "date",
  partition_by: "account_id",
});

// Moving averages
sqlite_window_moving_avg({
  table: "stock_prices",
  value_column: "close_price",
  order_by: "date",
  window_size: 7, // 7-day moving average
});
```

### Transactions (Native Only)

```javascript
// Execute multiple statements atomically
sqlite_transaction_execute({
  statements: [
    "UPDATE accounts SET balance = balance - 100 WHERE id = 1",
    "UPDATE accounts SET balance = balance + 100 WHERE id = 2",
    "INSERT INTO transfers (from_id, to_id, amount) VALUES (1, 2, 100)",
  ],
});
// All statements succeed or all are rolled back

// Manual transaction control with savepoints
sqlite_transaction_begin({ mode: "immediate" });
sqlite_transaction_savepoint({ name: "before_update" });
// ... perform operations ...
sqlite_transaction_rollback_to({ name: "before_update" }); // Undo if needed
sqlite_transaction_commit();
```

### Text Processing

```javascript
// Regex pattern matching
sqlite_regex_match({
  table: "logs",
  column: "message",
  pattern: "ERROR:\\s+(\\w+)",
});

// Fuzzy search for misspellings
sqlite_fuzzy_search({
  table: "products",
  column: "name",
  query: "laptp", // Misspelled "laptop"
  threshold: 0.6,
});

// Text similarity scoring
sqlite_text_similarity({
  text1: "machine learning",
  text2: "deep learning",
  algorithm: "levenshtein", // or "jaro_winkler", "cosine"
});
```

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🔥 Core Capabilities

- 📊 **Statistical Analysis** - Descriptive stats, percentiles, time series analysis
- 🔍 **Advanced Text Processing** - Regex, fuzzy matching, phonetic search, similarity
- 🧠 **Vector/Semantic Search** - AI-native embeddings, cosine similarity, hybrid search
- 🗺️ **Geospatial Operations** - Distance calculations, bounding boxes, spatial queries
- 🔐 **Transaction Safety** - Full ACID compliance with savepoints (native backend)
- 🎛️ **89 Specialized Tools** - Complete database administration and analytics suite

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

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🏆 Why Choose db-mcp?

✅ **TypeScript Native** - Full type safety with strict mode, no `any` types  
✅ **89 Specialized Tools** - Most comprehensive SQLite MCP server available  
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

- **89 Tools** in native backend (76 in WASM)
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

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## Security

For security concerns, please see our [Security Policy](SECURITY.md).

> **⚠️ Never commit credentials** - Store secrets in `.env` (gitignored)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in this project.
