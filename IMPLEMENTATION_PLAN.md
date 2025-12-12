# db-mcp Implementation Plan

> **Last Updated**: December 11, 2025  
> **Status**: Phase 1 Complete, Phase 2 In Progress

A sequential development plan for building a multi-database MCP server with OAuth 2.0 authentication, tool filtering, and code mode architecture in TypeScript.

---

## Current Progress Summary

```
Phase 1: Core Infrastructure    ████████████████████ 100% ✅
Phase 2: OAuth 2.0 Integration  ░░░░░░░░░░░░░░░░░░░░   0% 🔄
Phase 3: SQLite Adapter         ░░░░░░░░░░░░░░░░░░░░   0% ⏳
Phase 4: PostgreSQL Adapter     ░░░░░░░░░░░░░░░░░░░░   0% ⏳
Phase 5: MySQL Adapter          ░░░░░░░░░░░░░░░░░░░░   0% ⏳
Phase 6: MongoDB Adapter        ░░░░░░░░░░░░░░░░░░░░   0% ⏳
Phase 7: Redis Adapter          ░░░░░░░░░░░░░░░░░░░░   0% ⏳
Phase 8: SQL Server Adapter     ░░░░░░░░░░░░░░░░░░░░   0% ⏳
```

---

## Development Strategy

### Key Principles

1. **Sequential Database Development** - Complete each database adapter to 100% before starting the next
2. **OAuth 2.0 First** - Build authentication layer before database adapters
3. **SQLite as Template** - First adapter serves as the reference implementation for all others
4. **Single Thread Per Phase** - One conversation context per major phase for focus

### Execution Order

```
Core → OAuth 2.0 → SQLite (100%) → PostgreSQL (100%) → MySQL (100%) → MongoDB (100%) → Redis (100%) → SQL Server (100%)
```

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

## Phase 2: OAuth 2.0 Integration 🔄 NEXT

**Status**: Not started  
**Estimated Effort**: 1-2 conversation threads

### Overview

Implement MCP-compliant OAuth 2.0/2.1 authorization per the [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).

### Required RFC Compliance

| RFC | Requirement | Description |
|-----|-------------|-------------|
| [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) | **MUST** | OAuth 2.0 Protected Resource Metadata |
| [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) | **MUST** | Authorization Server Metadata |
| [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) | **SHOULD** | Dynamic Client Registration |

### Deliverables

| File | Status | Description |
|------|--------|-------------|
| `src/auth/OAuthResourceServer.ts` | ⏳ | Protected Resource Metadata (RFC9728) |
| `src/auth/AuthorizationServerDiscovery.ts` | ⏳ | Server metadata discovery (RFC8414) |
| `src/auth/DynamicClientRegistration.ts` | ⏳ | Client registration (RFC7591) |
| `src/auth/TokenValidator.ts` | ⏳ | JWT/access token validation |
| `src/auth/scopes.ts` | ⏳ | Scope definitions and enforcement |
| `src/auth/middleware.ts` | ⏳ | Request authentication middleware |
| `src/transports/http.ts` | ⏳ | Streamable HTTP transport with OAuth |

### OAuth Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read-only access to all databases |
| `write` | Read and write access to all databases |
| `admin` | Full administrative access |
| `db:{name}` | Access to specific database only |
| `table:{db}:{table}` | Access to specific table only |

### Implementation Tasks

- [ ] Implement Protected Resource Metadata endpoint (`/.well-known/oauth-protected-resource`)
- [ ] Implement Authorization Server discovery
- [ ] Add access token validation (JWT support)
- [ ] Create scope-to-tool mapping
- [ ] Add authentication middleware to tool handlers
- [ ] Implement Dynamic Client Registration (optional)
- [ ] Complete HTTP transport with OAuth integration
- [ ] Add integration tests for OAuth flows

---

## Phase 3: SQLite Adapter ⏳ PENDING

**Status**: Blocked on Phase 2 (OAuth)  
**Estimated Effort**: 2-3 conversation threads  
**Reference**: [sqlite-mcp-server](https://github.com/neverinfamous/sqlite-mcp-server) (73 tools)

### Tool Categories (73 Total)

| Category | Tools | Status | Description |
|----------|-------|--------|-------------|
| **Core Database** | 8 | ⏳ | CRUD, schema management, transactions |
| **JSON Helper** | 6 | ⏳ | Simplified JSON operations |
| **JSON Operations** | 12 | ⏳ | Full JSON/JSONB manipulation |
| **Text Processing** | 8 | ⏳ | Regex, fuzzy matching, phonetic |
| **Statistical Analysis** | 8 | ⏳ | Stats, percentiles, time series |
| **Virtual Tables** | 8 | ⏳ | CSV, R-Tree, series generation |
| **Full-Text Search** | 4 | ⏳ | FTS5, BM25, hybrid search |
| **Vector/Semantic** | 11 | ⏳ | Embeddings, similarity search |
| **Geospatial** | 7 | ⏳ | SpatiaLite operations |
| **Admin** | 1 | ⏳ | Vacuum, PRAGMA |

### Deliverables

| File | Status | Description |
|------|--------|-------------|
| `src/adapters/sqlite/SqliteAdapter.ts` | ⏳ | Main adapter class |
| `src/adapters/sqlite/tools/core.ts` | ⏳ | Core database tools |
| `src/adapters/sqlite/tools/json.ts` | ⏳ | JSON operations |
| `src/adapters/sqlite/tools/text.ts` | ⏳ | Text processing |
| `src/adapters/sqlite/tools/stats.ts` | ⏳ | Statistical analysis |
| `src/adapters/sqlite/tools/virtual.ts` | ⏳ | Virtual tables |
| `src/adapters/sqlite/tools/fts.ts` | ⏳ | Full-text search |
| `src/adapters/sqlite/tools/vector.ts` | ⏳ | Vector operations |
| `src/adapters/sqlite/tools/geo.ts` | ⏳ | Geospatial (SpatiaLite) |
| `src/adapters/sqlite/resources/` | ⏳ | MCP resources (7) |
| `src/adapters/sqlite/prompts/` | ⏳ | MCP prompts (7) |

### MCP Resources (7)

| Resource URI | Description |
|--------------|-------------|
| `database://schema` | Complete database schema |
| `database://tables` | Table listing |
| `database://indexes` | Index information |
| `database://stats` | Database statistics |
| `database://health` | Health status |
| `database://capabilities` | Adapter capabilities |
| `database://extensions` | Installed extensions |

### MCP Prompts (7)

| Prompt | Description |
|--------|-------------|
| `optimize_query` | Query optimization workflow |
| `design_schema` | Schema design guidance |
| `migrate_data` | Data migration assistance |
| `analyze_performance` | Performance analysis |
| `setup_fts` | FTS5 setup guide |
| `json_operations` | JSON best practices |
| `backup_strategy` | Backup planning |

### Implementation Tasks

- [ ] Create `SqliteAdapter` extending `DatabaseAdapter`
- [ ] Implement connection management with sql.js
- [ ] Implement core tools (8 tools)
- [ ] Implement JSON helper tools (6 tools)
- [ ] Implement JSON operations (12 tools)
- [ ] Implement text processing (8 tools)
- [ ] Implement statistical analysis (8 tools)
- [ ] Implement virtual tables (8 tools)
- [ ] Implement FTS5 tools (4 tools)
- [ ] Implement vector/semantic tools (11 tools)
- [ ] Implement geospatial tools (7 tools)
- [ ] Implement admin tool (1 tool)
- [ ] Create MCP resources (7)
- [ ] Create MCP prompts (7)
- [ ] Add comprehensive test suite
- [ ] Verify with MCP Inspector
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

### Immediate (Start Phase 2)

1. Create `src/auth/` directory structure
2. Implement OAuth Protected Resource Metadata (RFC9728)
3. Implement Authorization Server Discovery (RFC8414)
4. Create token validation logic
5. Add scope-based access control
6. Complete HTTP transport with OAuth

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
