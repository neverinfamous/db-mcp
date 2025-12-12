# db-mcp

> **⚠️ UNDER DEVELOPMENT** - This project is actively being developed and is not yet ready for production use.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CodeQL](https://github.com/neverinfamous/db-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/neverinfamous/db-mcp/actions/workflows/codeql.yml)

A **SQLite MCP Server** with up to 89 tools, OAuth 2.0 authentication, and granular access control. Written in TypeScript.

## Current Status

| Phase | Status | Details |
|-------|--------|---------|
| Core Infrastructure | ✅ Complete | Types, filtering, CLI |
| OAuth 2.0 Integration | ✅ Complete | RFC 9728/8414 compliant |
| SQLite Adapter | ✅ Complete | **89 tools** (native) / **76 tools** (WASM) |

## SQLite Backend Options

Choose between two SQLite backends based on your needs:

| Feature | WASM (sql.js) | Native (better-sqlite3) |
|---------|---------------|-------------------------|
| **Tools Available** | 76 | **89** |
| **Transactions** | ❌ | ✅ 7 tools |
| **Window Functions** | ❌ | ✅ 6 tools |
| **FTS5 Full-Text Search** | ⚠️ Limited | ✅ Full |
| **JSON1 Extension** | ⚠️ Limited | ✅ Full |
| **Cross-platform** | ✅ No compilation | Requires Node.js native build |
| **In-memory DBs** | ✅ | ✅ |
| **File-based DBs** | ✅ | ✅ |

## Tool Categories

| Category | WASM | Native | Description |
|----------|------|--------|-------------|
| Core Database | 8 | 8 | CRUD, schema, indexes, views |
| JSON Helpers | 6 | 6 | Simplified JSON operations |
| JSON Operations | 12 | 12 | Full JSON manipulation |
| Text Processing | 8 | 8 | Regex, case, substring |
| FTS5 Full-Text Search | 4 | 4 | Create, search, rebuild |
| Statistical Analysis | 8 | 8 | Stats, percentiles, histograms |
| Virtual Tables | 4 | 4 | Generate series |
| Vector/Semantic | 11 | 11 | Embeddings, similarity search |
| Geospatial | 7 | 7 | Distance, bounding box, clustering |
| Admin | 4 | 4 | Vacuum, backup, analyze, optimize |
| **Transactions** | — | **7** | Begin, commit, rollback, savepoints |
| **Window Functions** | — | **6** | Row number, rank, lag/lead, running totals |
| **Total** | **76** | **89** | |

### Native-Only Tools (13 additional)

<details>
<summary>Transaction Tools (7)</summary>

| Tool | Description |
|------|-------------|
| `sqlite_transaction_begin` | Start transaction (deferred/immediate/exclusive mode) |
| `sqlite_transaction_commit` | Commit current transaction |
| `sqlite_transaction_rollback` | Rollback current transaction |
| `sqlite_transaction_savepoint` | Create a savepoint |
| `sqlite_transaction_release` | Release a savepoint |
| `sqlite_transaction_rollback_to` | Rollback to a savepoint |
| `sqlite_transaction_execute` | Execute multiple statements atomically |

</details>

<details>
<summary>Window Function Tools (6)</summary>

| Tool | Description |
|------|-------------|
| `sqlite_window_row_number` | Assign sequential row numbers |
| `sqlite_window_rank` | Calculate RANK/DENSE_RANK/PERCENT_RANK |
| `sqlite_window_lag_lead` | Access previous or next row values |
| `sqlite_window_running_total` | Calculate cumulative sums |
| `sqlite_window_moving_avg` | Calculate rolling averages |
| `sqlite_window_ntile` | Divide rows into N buckets (quartiles, deciles, etc.) |

</details>

---

## MCP JSON Configuration

Configure the server in your MCP client's configuration file (e.g., Cursor's `mcp.json`):

### WASM Backend (sql.js) - 76 Tools

```json
{
  "mcpServers": {
    "db-mcp-sqlite": {
      "command": "node",
      "args": [
        "C:/path/to/db-mcp/dist/cli.js",
        "--transport", "stdio",
        "--sqlite", "C:/path/to/your/database.db"
      ]
    }
  }
}
```

### Native Backend (better-sqlite3) - 89 Tools

```json
{
  "mcpServers": {
    "db-mcp-sqlite": {
      "command": "node",
      "args": [
        "C:/path/to/db-mcp/dist/cli.js",
        "--transport", "stdio",
        "--sqlite-native", "C:/path/to/your/database.db"
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

---

## Features

- 🔐 **OAuth 2.0 Authentication** - RFC 9728/8414 compliant token-based authentication
- 🛡️ **Tool Filtering** - Control which database operations are exposed
- 👥 **Access Control** - Granular scopes for read-only, write, and admin access
- ⚡ **Code Mode Architecture** - Built using the MCP SDK for maximum flexibility

## OAuth 2.0 Implementation

| Component | Status | Description |
|-----------|--------|-------------|
| Protected Resource Metadata | ✅ | RFC 9728 `/.well-known/oauth-protected-resource` |
| Auth Server Discovery | ✅ | RFC 8414 metadata discovery with caching |
| Token Validation | ✅ | JWT validation with JWKS support |
| Scope Enforcement | ✅ | Granular `read`, `write`, `admin` scopes |
| HTTP Transport | ✅ | Streamable HTTP with OAuth middleware |

### Supported Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read-only access to all databases |
| `write` | Read and write access to all databases |
| `admin` | Full administrative access |
| `db:{name}` | Access to specific database only |
| `table:{db}:{table}` | Access to specific table only |

### Keycloak Integration

See [docs/KEYCLOAK_SETUP.md](docs/KEYCLOAK_SETUP.md) for setting up Keycloak as your OAuth provider.

---

## Quick Start

### CLI Usage

```bash
# Build the project
npm run build

# WASM backend (76 tools)
node dist/cli.js --transport stdio --sqlite path/to/database.db

# Native backend (89 tools) 
node dist/cli.js --transport stdio --sqlite-native path/to/database.db
```

### Programmatic Usage

```typescript
import { McpServer } from 'db-mcp';

const server = new McpServer({
    name: 'my-db-server',
    transport: 'http',
    port: 3000,
    oauth: {
        enabled: true,
        authorizationServerUrl: 'http://localhost:8080/realms/db-mcp',
        audience: 'db-mcp-server'
    }
});

await server.start();
```

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
