# db-mcp (SQLite MCP Server)

Last Updated February 4, 2026

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/db--mcp-blue?logo=github)](https://github.com/neverinfamous/db-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/db-mcp)](https://hub.docker.com/r/writenotenow/db-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/db-mcp/blob/main/SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/db-mcp)

🎯 **SQLite MCP Server** with OAuth 2.1 authentication, HTTP/SSE transport, smart tool filtering, 122 specialized tools, 8 resources, and 10 prompts.

**[GitHub](https://github.com/neverinfamous/db-mcp)** • **[Wiki](https://github.com/neverinfamous/db-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/db-mcp/blob/main/CHANGELOG.md)**

## 🎯 What This Does

### Key Benefits

- 🔐 **OAuth 2.1 Authentication** - RFC 9728/8414 compliant enterprise security
- 🔥 **122 Specialized Tools** - The most comprehensive SQLite MCP server available
- 🎛️ **Smart Tool Filtering** - Stay within AI IDE tool limits with presets
- 📊 **Statistical Analysis** - Descriptive stats, percentiles, time series
- 🧠 **Vector/Semantic Search** - AI-native embeddings, cosine similarity
- 🗺️ **Geospatial Operations** - Distance calculations, SpatiaLite support
- 🔐 **Transaction Safety** - Full ACID compliance with savepoints

### Backend Options

| Feature              | WASM (sql.js)      | Native (better-sqlite3)    |
| -------------------- | ------------------ | -------------------------- |
| **Tools Available**  | 102                | **122**                    |
| **Transactions**     | ❌                 | ✅ 7 tools                 |
| **Window Functions** | ❌                 | ✅ 6 tools                 |
| **SpatiaLite GIS**   | ❌                 | ✅ 7 tools                 |
| **Cross-platform**   | ✅ Pure JavaScript | Compiled natively in image |

---

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

---

## ⚡ Install to Cursor IDE

### One-Click Installation

Click the button below to install directly into Cursor:

[![Install to Cursor](https://img.shields.io/badge/Install%20to%20Cursor-Click%20Here-blue?style=for-the-badge)](cursor://anysphere.cursor-deeplink/mcp/install?name=db-mcp-sqlite&config=eyJkYi1tY3Atc3FsaXRlIjp7ImFyZ3MiOlsicnVuIiwiLWkiLCItLXJtIiwiLXYiLCIkKHB3ZCk6L3dvcmtzcGFjZSIsIndyaXRlbm90ZW5vdy9kYi1tY3A6bGF0ZXN0IiwiLS1zcWxpdGUtbmF0aXZlIiwiL3dvcmtzcGFjZS9kYXRhYmFzZS5kYiJdLCJjb21tYW5kIjoiZG9ja2VyIn19)

### Prerequisites

- ✅ Docker installed and running
- ✅ ~200MB disk space available

---

## 🎛️ Tool Filtering

> **Important:** AI IDEs like Cursor have tool limits. With 122 tools, use filtering!

### Recommended Configurations

**Starter (48 tools)** - Core + JSON + Text:

```bash
docker run -i --rm -v ./data:/app/data writenotenow/db-mcp:latest \
  --sqlite-native /app/data/database.db --tool-filter starter
```

**Analytics (50 tools)** - Core + JSON + Stats:

```bash
--tool-filter analytics
```

**Search (36 tools)** - Core + Text + Vector:

```bash
--tool-filter search
```

### Available Shortcuts

| Shortcut    | Tools  | What's Included    |
| ----------- | ------ | ------------------ |
| `starter`   | **48** | Core, JSON, Text   |
| `analytics` | 50     | Core, JSON, Stats  |
| `search`    | 36     | Core, Text, Vector |
| `minimal`   | 8      | Core only          |
| `full`      | 122    | Everything         |

---

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

---

## 📊 Tool Categories

| Category             | Native  | Description                     |
| -------------------- | ------- | ------------------------------- |
| Core Database        | 8       | CRUD, schema, indexes, views    |
| JSON Operations      | 23      | JSON/JSONB, schema analysis     |
| Text Processing      | 17      | Regex, fuzzy, phonetic, FTS5    |
| Statistical Analysis | 19      | Stats, outliers, window funcs   |
| Vector/Semantic      | 11      | Embeddings, similarity search   |
| Geospatial           | 11      | Distance, SpatiaLite GIS        |
| Admin/Backup         | 33      | Backup, restore, virtual tables |
| **Total**            | **122** |                                 |

---

## 🔧 Configuration

### Environment Variables

```bash
# Performance tuning
-e METADATA_CACHE_TTL_MS=5000   # Schema cache TTL (default: 5000ms)
-e LOG_LEVEL=info               # Log verbosity: debug, info, warning, error

# OAuth 2.1 (HTTP transport only)
-e KEYCLOAK_URL=http://localhost:8080
-e KEYCLOAK_REALM=db-mcp
-e KEYCLOAK_CLIENT_ID=db-mcp-server
```

### HTTP/SSE Transport

For remote access or web-based clients:

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  writenotenow/db-mcp:latest \
  --transport http --port 3000 --sqlite-native /app/data/database.db
```

**Endpoints:**

- `POST /mcp` — JSON-RPC requests
- `GET /mcp` — SSE stream for notifications
- `DELETE /mcp` — Session termination
- `GET /health` — Health check

---

## 📦 Image Details

| Platform                  | Features                            |
| ------------------------- | ----------------------------------- |
| **AMD64** (x86_64)        | Full: 122 tools, native, SpatiaLite |
| **ARM64** (Apple Silicon) | Full: 122 tools, native             |

**Image Benefits:**

- **Node.js 24 on Alpine Linux** - Minimal footprint
- **better-sqlite3** - High-performance native SQLite
- **Multi-stage build** - Optimized size
- **Non-root user** - Security hardened

**Available Tags:**

- `1.0.0` - Specific version (recommended for production)
- `latest` - Always the newest version
- `sha-<commit>` - Git commit pinned

---

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

---

## 📚 Documentation & Resources

- **[GitHub Wiki](https://github.com/neverinfamous/db-mcp/wiki)** - Complete documentation
- **[Issues](https://github.com/neverinfamous/db-mcp/issues)** - Bug reports & feature requests

---

## 📄 License

MIT License - See [LICENSE](https://github.com/neverinfamous/db-mcp/blob/main/LICENSE)
