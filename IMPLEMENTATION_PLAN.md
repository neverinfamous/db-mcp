# db-mcp Implementation Plan

> **Last Updated**: December 12, 2025  
> **Status**: Phase 1-2 Complete, SQLite Adapter Complete (89 tools)

A development plan for building database MCP servers with OAuth 2.0 authentication, tool filtering, and code mode architecture in TypeScript.

---

## Critical Limitation: One Database Per MCP Server

> [!WARNING]
> **MCP Tool Limits**: Due to MCP tool limits, we cannot support multiple database systems in a single MCP server—even with tool filtering. Dynamic filtering is not currently supported, so all database tools would need to be registered upfront, exceeding practical limits.

### Architectural Decision

> [!IMPORTANT]
> Each MCP server is **fully independent** with no shared runtime dependencies. Users install only the database server(s) they need.

| Project | Description |
|---------|-------------|
| **db-mcp** | SQLite MCP server (this project) - **89 tools** |
| **postgres-mcp** | Future: Independent PostgreSQL MCP server |
| **mysql-mcp** | Future: Independent MySQL MCP server |
| **mongo-mcp** | Future: Independent MongoDB MCP server |
| **redis-mcp** | Future: Independent Redis MCP server |

Future database servers may use this project as a reference implementation, but will be completely standalone with their own dependencies.

---

## Current Progress Summary

```
Phase 1: Core Infrastructure    ████████████████████ 100% ✅
Phase 2: OAuth 2.0 Integration  ████████████████████ 100% ✅
Phase 3: SQLite Adapter         ████████████████████ 100% ✅
  └─ WASM Backend (sql.js)      ████████████████████  76 tools
  └─ Native Backend (better-sqlite3) ██████████████████  89 tools
```

**Future Independent Servers** (separate projects, no shared dependencies):
- postgres-mcp
- mysql-mcp
- mongo-mcp
- redis-mcp
- sqlserver-mcp

---

## Development Strategy

### Key Principles

1. **One Database Per Server** - Each database system gets its own fully independent MCP server
2. **No Shared Dependencies** - Each server is standalone, users install only what they need
3. **SQLite as Reference** - This implementation serves as the template for future servers

### SQLite Complete (db-mcp)

This project (`db-mcp`) serves as the SQLite MCP server and template for future database servers.

---

## Phase 1: Core Infrastructure ✅ COMPLETE

**Status**: All items complete and verified

### Completed Deliverables

| File | Status | Description |
|------|--------|-------------|
| [package.json](file:///C:/Users/chris/Desktop/db-mcp/package.json) | ✅ | Project config with MCP SDK, TypeScript 5.9.3, ESLint 9.28 |
| [tsconfig.json](file:///C:/Users/chris/Desktop/db-mcp/tsconfig.json) | ✅ | Strict TypeScript configuration |
| [eslint.config.js](file:///C:/Users/chris/Desktop/db-mcp/eslint.config.js) | ✅ | Strict ESLint matching d1-manager |
| [src/types/index.ts](file:///C:/Users/chris/Desktop/db-mcp/src/types/index.ts) | ✅ | Core types (Database, OAuth, Filtering) |
| [src/filtering/ToolFilter.ts](file:///C:/Users/chris/Desktop/db-mcp/src/filtering/ToolFilter.ts) | ✅ | 10 tool groups, env var parsing |
| [src/adapters/DatabaseAdapter.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/DatabaseAdapter.ts) | ✅ | Abstract base class for all adapters |
| [src/server/McpServer.ts](file:///C:/Users/chris/Desktop/db-mcp/src/server/McpServer.ts) | ✅ | Main MCP server with built-in tools |
| [src/cli.ts](file:///C:/Users/chris/Desktop/db-mcp/src/cli.ts) | ✅ | CLI entry point with arg parsing |
| [src/index.ts](file:///C:/Users/chris/Desktop/db-mcp/src/index.ts) | ✅ | Public API exports |

### Verification Results

```bash
npm run lint      # ✅ No errors
npm run typecheck # ✅ No errors
npm run build     # ✅ Success
```

---

## Phase 2: OAuth 2.0 Integration ✅ COMPLETE

**Status**: All items complete and verified  
**Completed**: December 11, 2025

### Overview

MCP-compliant OAuth 2.0/2.1 authorization per the [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).

### Completed Deliverables

| File | Status | Description |
|------|--------|-------------|
| [src/utils/logger.ts](file:///C:/Users/chris/Desktop/db-mcp/src/utils/logger.ts) | ✅ | Centralized structured logging |
| [src/auth/types.ts](file:///C:/Users/chris/Desktop/db-mcp/src/auth/types.ts) | ✅ | OAuth types (RFC 9728, 8414, 7591) |
| [src/auth/errors.ts](file:///C:/Users/chris/Desktop/db-mcp/src/auth/errors.ts) | ✅ | OAuth error classes with HTTP status |
| [src/auth/scopes.ts](file:///C:/Users/chris/Desktop/db-mcp/src/auth/scopes.ts) | ✅ | Scope definitions and enforcement |
| [src/auth/OAuthResourceServer.ts](file:///C:/Users/chris/Desktop/db-mcp/src/auth/OAuthResourceServer.ts) | ✅ | Protected Resource Metadata (RFC 9728) |
| [src/auth/AuthorizationServerDiscovery.ts](file:///C:/Users/chris/Desktop/db-mcp/src/auth/AuthorizationServerDiscovery.ts) | ✅ | Server metadata discovery (RFC 8414) |
| [src/auth/TokenValidator.ts](file:///C:/Users/chris/Desktop/db-mcp/src/auth/TokenValidator.ts) | ✅ | JWT validation with JWKS |
| [src/auth/middleware.ts](file:///C:/Users/chris/Desktop/db-mcp/src/auth/middleware.ts) | ✅ | Request authentication middleware |
| [src/transports/http.ts](file:///C:/Users/chris/Desktop/db-mcp/src/transports/http.ts) | ✅ | Streamable HTTP transport with OAuth |
| [docs/KEYCLOAK_SETUP.md](file:///C:/Users/chris/Desktop/db-mcp/docs/KEYCLOAK_SETUP.md) | ✅ | Keycloak integration guide |

### OAuth Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read-only access to all databases |
| `write` | Read and write access to all databases |
| `admin` | Full administrative access |
| `db:{name}` | Access to specific database only |
| `table:{db}:{table}` | Access to specific table only |

### Verification Results

```bash
npm run lint      # ✅ No errors
npm run typecheck # ✅ No errors
```

### Key Dependencies Added

- `jose` - JWT operations and JWKS validation
- `cors` - Cross-Origin Resource Sharing

---

## Phase 3: SQLite Adapter ✅ COMPLETE

**Status**: Both backends fully functional  
**WASM Backend**: 76 tools (cross-platform, no compilation required)  
**Native Backend**: 89 tools (better-sqlite3, requires Node.js compilation)

### Backend Comparison

| Feature | WASM (sql.js) | Native (better-sqlite3) |
|---------|---------------|-------------------------|
| **Tools** | 76 | 89 |
| **Transactions** | ❌ | ✅ (7 tools) |
| **Window Functions** | ❌ | ✅ (6 tools) |
| **FTS5** | ⚠️ Limited | ✅ Full |
| **JSON1** | ⚠️ Limited | ✅ Full |
| **Cross-platform** | ✅ | Requires compilation |
| **In-memory DBs** | ✅ | ✅ |
| **File-based DBs** | ✅ | ✅ |

### Tool Categories

| Category | WASM | Native | Description |
|----------|------|--------|-------------|
| Core Database | 8 | 8 | CRUD, schema, indexes |
| JSON Helpers | 6 | 6 | Simplified JSON ops |
| JSON Operations | 12 | 12 | Full JSON manipulation |
| Text Processing | 8 | 8 | Regex, matching |
| FTS5 Full-Text Search | 4 | 4 | Search, ranking |
| Statistical Analysis | 8 | 14 | Stats + window functions |
| Virtual Tables | 4 | 4 | Generate series |
| Vector/Semantic | 11 | 11 | Embeddings, similarity |
| Geospatial | 7 | 7 | Distance, bounding box |
| Admin | 4 | 11 | Vacuum, backup, transactions |
| **Total** | **76** | **89** | |

### Native-Only Tools (13 additional)

**Transaction Tools** (7):
- `sqlite_transaction_begin` - Start transaction (deferred/immediate/exclusive)
- `sqlite_transaction_commit` - Commit transaction
- `sqlite_transaction_rollback` - Rollback transaction
- `sqlite_transaction_savepoint` - Create savepoint
- `sqlite_transaction_release` - Release savepoint
- `sqlite_transaction_rollback_to` - Rollback to savepoint
- `sqlite_transaction_execute` - Execute multiple statements atomically

**Window Function Tools** (6):
- `sqlite_window_row_number` - Sequential row numbering
- `sqlite_window_rank` - RANK/DENSE_RANK/PERCENT_RANK
- `sqlite_window_lag_lead` - Previous/next row values
- `sqlite_window_running_total` - Cumulative sum
- `sqlite_window_moving_avg` - Rolling average
- `sqlite_window_ntile` - Divide into buckets/quantiles

### Deliverables ✅

| File | Status | Description |
|------|--------|-------------|
| [SqliteAdapter.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/SqliteAdapter.ts) | ✅ | WASM adapter (sql.js) |
| [NativeSqliteAdapter.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite-native/NativeSqliteAdapter.ts) | ✅ | Native adapter (better-sqlite3) |
| [tools/core.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/core.ts) | ✅ | Core database tools |
| [tools/json-helpers.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/json-helpers.ts) | ✅ | JSON helper tools |
| [tools/json-operations.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/json-operations.ts) | ✅ | JSON operations |
| [tools/text.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/text.ts) | ✅ | Text processing |
| [tools/fts.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/fts.ts) | ✅ | Full-text search |
| [tools/stats.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/stats.ts) | ✅ | Statistical analysis |
| [tools/virtual.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/virtual.ts) | ✅ | Virtual tables |
| [tools/vector.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/vector.ts) | ✅ | Vector operations |
| [tools/geo.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/geo.ts) | ✅ | Geospatial |
| [tools/admin.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/tools/admin.ts) | ✅ | Admin tools |
| [tools/transactions.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite-native/tools/transactions.ts) | ✅ | Transaction tools (native) |
| [tools/window.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite-native/tools/window.ts) | ✅ | Window functions (native) |
| [resources.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/resources.ts) | ✅ | MCP resources (7) |
| [prompts.ts](file:///C:/Users/chris/Desktop/db-mcp/src/adapters/sqlite/prompts.ts) | ✅ | MCP prompts (7) |
- [ ] Document all tools

---

## Phase 4: PostgreSQL Adapter ⏳ PENDING

**Status**: Blocked on Phase 3 (SQLite)  
**Estimated Effort**: 2-3 conversation threads  
**Reference**: [postgres-mcp-server](https://github.com/neverinfamous/postgres-mcp-server) (63 tools)

### Tool Categories (63 Total)

| Category | Tools | Status | Description |
|----------|-------|--------|-------------|
| **Core Database** | 9 | ⏳ | Schema, SQL execution, health |
| **JSON Operations** | 11 | ⏳ | JSONB operations, validation |
| **Text Processing** | 5 | ⏳ | Similarity, full-text, fuzzy |
| **Statistical Analysis** | 8 | ⏳ | Stats, correlation, regression |
| **Performance** | 6 | ⏳ | Query optimization, index tuning |
| **Vector/Semantic** | 8 | ⏳ | pgvector integration |
| **Geospatial** | 7 | ⏳ | PostGIS operations |
| **Backup & Recovery** | 4 | ⏳ | Backup planning, restore |
| **Monitoring** | 5 | ⏳ | Real-time monitoring, alerting |

### Deliverables

| File | Status | Description |
|------|--------|-------------|
| `src/adapters/postgresql/PostgresAdapter.ts` | ⏳ | Main adapter class |
| `src/adapters/postgresql/tools/core.ts` | ⏳ | Core database tools (9) |
| `src/adapters/postgresql/tools/json.ts` | ⏳ | JSONB operations (11) |
| `src/adapters/postgresql/tools/text.ts` | ⏳ | Text processing (5) |
| `src/adapters/postgresql/tools/stats.ts` | ⏳ | Statistical analysis (8) |
| `src/adapters/postgresql/tools/performance.ts` | ⏳ | Performance tools (6) |
| `src/adapters/postgresql/tools/vector.ts` | ⏳ | pgvector (8) |
| `src/adapters/postgresql/tools/geo.ts` | ⏳ | PostGIS (7) |
| `src/adapters/postgresql/tools/backup.ts` | ⏳ | Backup & recovery (4) |
| `src/adapters/postgresql/tools/monitoring.ts` | ⏳ | Monitoring (5) |
| `src/adapters/postgresql/resources/` | ⏳ | MCP resources (10) |
| `src/adapters/postgresql/prompts/` | ⏳ | MCP prompts (10) |

### Extension Support

| Extension | Purpose |
|-----------|---------|
| `pg_stat_statements` | Query performance tracking |
| `pg_trgm` | Text similarity |
| `fuzzystrmatch` | Fuzzy matching |
| `hypopg` | Hypothetical indexes |
| `pgvector` | Vector similarity search |
| `PostGIS` | Geospatial operations |

---

## Phase 5: MySQL Adapter ⏳ PENDING

**Status**: Blocked on Phase 4 (PostgreSQL)  
**Estimated Effort**: 1-2 conversation threads

### Estimated Tool Categories (~45 Tools)

| Category | Estimated Tools | Description |
|----------|-----------------|-------------|
| **Core Database** | 8 | Schema, SQL, transactions |
| **JSON Operations** | 8 | JSON functions (MySQL 5.7+) |
| **Text Processing** | 5 | Full-text, regex |
| **Performance** | 8 | Query analysis, optimization |
| **Replication** | 5 | Master/slave status |
| **Backup** | 4 | mysqldump integration |
| **Monitoring** | 7 | Process list, status vars |

### Deliverables

| File | Status | Description |
|------|--------|-------------|
| `src/adapters/mysql/MysqlAdapter.ts` | ⏳ | Main adapter class |
| `src/adapters/mysql/tools/` | ⏳ | Tool implementations |
| `src/adapters/mysql/resources/` | ⏳ | MCP resources |
| `src/adapters/mysql/prompts/` | ⏳ | MCP prompts |

### Key Dependencies

- `mysql2` - MySQL driver with promise support

---

## Phase 6: MongoDB Adapter ⏳ PENDING

**Status**: Blocked on Phase 5 (MySQL)  
**Estimated Effort**: 1-2 conversation threads

### Estimated Tool Categories (~40 Tools)

| Category | Estimated Tools | Description |
|----------|-----------------|-------------|
| **Document CRUD** | 8 | Insert, find, update, delete |
| **Aggregation** | 10 | Pipeline stages, operators |
| **Index Management** | 5 | Create, drop, analyze |
| **Collection Admin** | 5 | Stats, validation, compact |
| **Change Streams** | 4 | Watch, resume tokens |
| **GridFS** | 4 | File storage operations |
| **Replication** | 4 | Replica set status |

### Deliverables

| File | Status | Description |
|------|--------|-------------|
| `src/adapters/mongodb/MongoAdapter.ts` | ⏳ | Main adapter class |
| `src/adapters/mongodb/tools/` | ⏳ | Tool implementations |
| `src/adapters/mongodb/resources/` | ⏳ | MCP resources |
| `src/adapters/mongodb/prompts/` | ⏳ | MCP prompts |

### Key Dependencies

- `mongodb` - Official MongoDB driver

---

## Phase 7: Redis Adapter ⏳ PENDING

**Status**: Blocked on Phase 6 (MongoDB)  
**Estimated Effort**: 1-2 conversation threads

### Estimated Tool Categories (~35 Tools)

| Category | Estimated Tools | Description |
|----------|-----------------|-------------|
| **String Operations** | 6 | GET, SET, INCR, etc. |
| **List Operations** | 5 | LPUSH, RPOP, LRANGE |
| **Set Operations** | 5 | SADD, SMEMBERS, SINTER |
| **Hash Operations** | 5 | HSET, HGET, HGETALL |
| **Sorted Sets** | 5 | ZADD, ZRANGE, ZRANK |
| **Pub/Sub** | 3 | PUBLISH, SUBSCRIBE |
| **Streams** | 4 | XADD, XREAD, XGROUP |
| **Cluster** | 2 | Cluster info, slots |

### Deliverables

| File | Status | Description |
|------|--------|-------------|
| `src/adapters/redis/RedisAdapter.ts` | ⏳ | Main adapter class |
| `src/adapters/redis/tools/` | ⏳ | Tool implementations |
| `src/adapters/redis/resources/` | ⏳ | MCP resources |
| `src/adapters/redis/prompts/` | ⏳ | MCP prompts |

### Key Dependencies

- `ioredis` - Redis client with cluster support

---

## Phase 8: SQL Server Adapter ⏳ PENDING (Low Priority)

**Status**: Blocked on Phase 7 (Redis)  
**Estimated Effort**: 1-2 conversation threads

### Estimated Tool Categories (~40 Tools)

| Category | Estimated Tools | Description |
|----------|-----------------|-------------|
| **Core Database** | 8 | T-SQL execution, schema |
| **JSON Operations** | 6 | FOR JSON, OPENJSON |
| **Performance** | 8 | DMVs, query plans |
| **Backup** | 5 | BACKUP/RESTORE |
| **Security** | 5 | Logins, permissions |
| **Monitoring** | 8 | Wait stats, sessions |

### Deliverables

| File | Status | Description |
|------|--------|-------------|
| `src/adapters/sqlserver/SqlServerAdapter.ts` | ⏳ | Main adapter class |
| `src/adapters/sqlserver/tools/` | ⏳ | Tool implementations |
| `src/adapters/sqlserver/resources/` | ⏳ | MCP resources |
| `src/adapters/sqlserver/prompts/` | ⏳ | MCP prompts |

### Key Dependencies

- `mssql` - SQL Server driver

---

## Project Structure

```
db-mcp/
├── src/
│   ├── index.ts                      # Public API exports ✅
│   ├── cli.ts                        # CLI entry point ✅
│   ├── server/
│   │   └── McpServer.ts              # Main MCP server ✅
│   ├── types/
│   │   └── index.ts                  # Core type definitions ✅
│   ├── filtering/
│   │   └── ToolFilter.ts             # Tool filtering system ✅
│   ├── auth/                         # 🔄 Phase 2
│   │   ├── OAuthResourceServer.ts    # RFC9728
│   │   ├── AuthorizationServerDiscovery.ts
│   │   ├── TokenValidator.ts
│   │   ├── scopes.ts
│   │   └── middleware.ts
│   ├── transports/                   # 🔄 Phase 2
│   │   ├── stdio.ts                  # (in McpServer.ts currently)
│   │   └── http.ts                   # Streamable HTTP with OAuth
│   └── adapters/
│       ├── DatabaseAdapter.ts        # Base abstract class ✅
│       ├── sqlite/                   # ⏳ Phase 3
│       │   ├── SqliteAdapter.ts
│       │   ├── tools/
│       │   ├── resources/
│       │   └── prompts/
│       ├── postgresql/               # ⏳ Phase 4
│       ├── mysql/                    # ⏳ Phase 5
│       ├── mongodb/                  # ⏳ Phase 6
│       ├── redis/                    # ⏳ Phase 7
│       └── sqlserver/                # ⏳ Phase 8
├── tests/
├── docker/
├── package.json                      # ✅
├── tsconfig.json                     # ✅
├── eslint.config.js                  # ✅
└── README.md                         # ✅
```

---

## Verification Plan

### Per-Phase Testing

| Phase | Test Type | Command |
|-------|-----------|---------|
| Phase 1 | Lint + Type | `npm run check` ✅ |
| Phase 2 | OAuth flows | `npm run test:oauth` |
| Phase 3 | SQLite unit | `npm run test:sqlite` |
| Phase 3 | SQLite integration | `npm run test:integration:sqlite` |
| Phase 4-8 | Per-adapter | `npm run test:{adapter}` |

### Manual Verification Checklist

- [ ] MCP Inspector testing for each adapter
- [ ] Claude Desktop compatibility
- [ ] Cursor IDE tool discovery
- [ ] Tool filtering verification
- [ ] OAuth flow testing (HTTP transport)
- [ ] Docker multi-arch builds

---

## Estimated Timeline

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Core | ✅ Complete | None |
| Phase 2: OAuth 2.0 | 1-2 threads | Phase 1 |
| Phase 3: SQLite | 2-3 threads | Phase 2 |
| Phase 4: PostgreSQL | 2-3 threads | Phase 3 |
| Phase 5: MySQL | 1-2 threads | Phase 4 |
| Phase 6: MongoDB | 1-2 threads | Phase 5 |
| Phase 7: Redis | 1-2 threads | Phase 6 |
| Phase 8: SQL Server | 1-2 threads | Phase 7 |

**Total Estimated**: 11-17 conversation threads

---

## Next Steps

### Immediate (Start Phase 3 - SQLite)

1. Create `src/adapters/sqlite/SqliteAdapter.ts`
2. Implement core database tools (8 tools)
3. Continue with remaining tool categories
4. Use sqlite-mcp-server as reference for tool parity

### After Phase 2

1. Begin SQLite adapter implementation
2. Use sqlite-mcp-server as reference for tool parity
3. Implement all 73 tools + resources + prompts
4. Comprehensive testing before moving to PostgreSQL

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete |
| 🔄 | In Progress / Next |
| ⏳ | Pending / Blocked |
| ❌ | Not Started |
