# db-mcp

> **⚠️ UNDER DEVELOPMENT** - This project is actively being developed and is not yet ready for production use.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CodeQL](https://github.com/neverinfamous/db-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/neverinfamous/db-mcp/actions/workflows/codeql.yml)

A multi-database **Model Context Protocol (MCP)** server written in TypeScript, featuring OAuth 2.0 authentication, tool filtering, and granular access control.

## Current Status

| Phase | Status | Progress |
|-------|--------|----------|
| Core Infrastructure | ✅ Complete | 100% |
| OAuth 2.0 Integration | ✅ Complete | 100% |
| SQLite Adapter | 🔄 Next | 0% |
| Other Adapters | ⏳ Pending | 0% |

## Features

- 🔐 **OAuth 2.0 Authentication** - RFC 9728/8414 compliant token-based authentication
- 🛡️ **Tool Filtering** - Control which database operations are exposed
- 👥 **Access Control** - Granular scopes for read-only, write, and admin access
- 🗄️ **Multi-Database Support** - Connect to multiple database types simultaneously
- ⚡ **Code Mode Architecture** - Built using the MCP SDK for maximum flexibility

## OAuth 2.0 Implementation

The server implements MCP-compliant OAuth 2.0 authorization:

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

## Architecture

This server is built in **Code Mode** using the official MCP TypeScript SDK:

| Capability | Benefit |
|------------|---------|
| **Dynamic Tool Registration** | Register/unregister tools based on user permissions |
| **OAuth 2.0 Integration** | Authentication middleware before tool execution |
| **Per-Request Context** | Access user identity, scopes per request |
| **Tool Filtering** | Programmatically control available tools |
| **Multi-Tenancy** | Support multiple users with different access levels |

## Supported Databases

| Database | Status | Priority |
|----------|--------|----------|
| SQLite | 🔄 Next | High |
| MySQL | ⏳ Planned | High |
| PostgreSQL | ⏳ Planned | High |
| MongoDB | ⏳ Planned | High |
| Redis | ⏳ Planned | High |
| SQL Server | ⏳ Planned | Low |

## Installation

```bash
# Coming soon
npm install db-mcp
```

## Quick Start

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

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## Security

For security concerns, please see our [Security Policy](SECURITY.md).

> **⚠️ Never commit credentials** - Store secrets in `.env` (gitignored)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in this project.
