# db-mcp Code Map

> **Agent-optimized navigation reference.** Read this before searching the codebase. Covers directory layout, handler→tool mapping, type/schema locations, error hierarchy, and key constants.
>
> Last updated: March 16, 2026

---

## Directory Tree

```
src/
├── cli.ts                          # CLI entry point (arg parsing, transport selection)
├── index.ts                        # Barrel re-export for library consumers
├── version.ts                      # SSoT version constant (reads package.json)
│
├── server/
│   └── mcp-server.ts               # McpServer setup, adapter registration, tool/resource/prompt wiring
│
├── types/                          # Core TypeScript types (barrel: types/index.ts)
│   ├── adapter.ts                  # ToolDefinition, ResourceDefinition, PromptDefinition, AdapterCapabilities
│   ├── auth.ts                     # OAuthConfig, OAuthScope, TokenClaims, RequestContext
│   ├── database.ts                 # DatabaseConfig, QueryResult, ColumnInfo, TableInfo, SchemaInfo, IndexInfo
│   ├── filtering.ts                # ToolGroup, MetaGroup, ToolFilterRule, ToolFilterConfig
│   ├── server.ts                   # TransportType, McpServerConfig (incl. authToken, oauth)
│   └── index.ts                    # Barrel — also re-exports error classes from utils/errors
│
├── constants/
│   ├── server-instructions.ts      # Generated: slim INSTRUCTIONS constant (~680 chars) + HELP_CONTENT map (per-group help)
│   └── server-instructions/        # Source .md files for each help resource (overview, gotchas, json, text, stats, etc.)
│
├── filtering/
│   ├── tool-constants.ts           # TOOL_GROUPS arrays, META_GROUPS shortcuts, group→tools map
│   └── tool-filter.ts              # ToolFilter class — parse/apply --tool-filter expressions
│
├── utils/
│   ├── annotations.ts              # MCP tool annotation helpers (readOnly, destructive hints)
│   ├── icons.ts                    # MCP icon definitions per tool group
│   ├── identifiers.ts              # SQL identifier validation/sanitization (table names, columns)
│   ├── insights-manager.ts         # memo://insights resource accumulator
│   ├── progress-utils.ts           # MCP progress notification helpers
│   ├── resource-annotations.ts     # MCP resource annotation helpers
│   ├── where-clause.ts             # WHERE clause builder/validator
│   ├── index.ts                    # Barrel re-export
│   ├── errors/                     # Error class hierarchy (see § Error Classes below)
│   │   ├── base.ts                 # DbMcpError (abstract base)
│   │   ├── categories.ts           # ErrorCategory enum + ErrorResponse interface
│   │   ├── classes.ts              # 8 concrete error subclasses
│   │   ├── error-response-fields.ts # ErrorResponseFields mixin (SSoT, re-exported from format.ts)
│   │   ├── format.ts               # formatErrorResponse() — structured {success:false} builder
│   │   ├── suggestions.ts          # Error suggestion helpers (typo hints, table/column suggestions)
│   │   └── index.ts                # Barrel
│   └── logger/
│       ├── logger.ts               # Logger class (structured JSON, severity filtering)
│       ├── module-logger.ts        # createModuleLogger() factory
│       ├── error-codes.ts          # Module-prefixed error code constants
│       ├── types.ts                # LogLevel, LogEntry types
│       └── index.ts                # Barrel
│
├── auth/                           # OAuth 2.1 implementation
│   ├── auth-context.ts             # Auth context utilities
│   ├── middleware/                  # Express-style OAuth middleware (split from middleware.ts)
│   │   └── index.ts
│   ├── token-validator.ts          # JWT/JWKS token validation
│   ├── scopes/                     # Scope parsing, enforcement (split from scopes.ts)
│   │   └── index.ts
│   ├── scope-map.ts                # Tool→scope mapping
│   ├── oauth-resource-server.ts    # RFC 9728 /.well-known/oauth-protected-resource
│   ├── authorization-server-discovery.ts  # RFC 8414 auth server metadata discovery
│   ├── transport-agnostic.ts       # Non-Express auth re-exports for transport portability
│   ├── errors.ts                   # OAuth-specific error classes
│   └── types.ts                    # OAuth TypeScript types
│
├── transports/
│   └── http/
│       ├── transport.ts            # HTTP/SSE transport (Streamable HTTP + legacy SSE)
│       ├── session.ts              # Session management (stateful + stateless modes)
│       ├── middleware.ts            # Security headers, rate limiting, CORS, body parsing
│       ├── oauth.ts                # OAuth 2.1 integration + simple bearer auth middleware
│       ├── type-adapters.ts        # Hono→Express type bridges
│       ├── types.ts                # HTTP transport types
│       └── index.ts                # Barrel
│
├── codemode/                       # Code Mode sandbox (secure JS execution)
│   ├── sandbox.ts                  # SandboxPool lifecycle manager
│   ├── sandbox-factory.ts          # Sandbox creation factory
│   ├── worker-sandbox.ts           # Worker thread sandbox (MessagePort RPC bridge)
│   ├── worker-script.ts            # Worker thread entry point (runs inside vm)
│   ├── api.ts                      # sqlite.* API bridge (exposes tools to sandbox)
│   ├── api-constants.ts            # API bridge constants and JSON-RPC codes
│   ├── security.ts                 # Code validation (blocked patterns, injection prevention)
│   ├── types.ts                    # Sandbox TypeScript types
│   └── index.ts                    # Barrel
│
├── adapters/
│   ├── database-adapter.ts         # Abstract DatabaseAdapter base class
│   ├── query-validation.ts         # Shared query validation (SELECT vs write detection)
│   ├── sqlite-helpers.ts           # Shared SQLite helper utilities
│   │
│   ├── sqlite/                     # ── WASM adapter (sql.js) ──
│   │   ├── sqlite-adapter.ts       # SqliteAdapter class (extends DatabaseAdapter)
│   │   ├── query-executor.ts       # WASM query execution
│   │   ├── schema-manager.ts       # Schema cache + metadata (TTL-based)
│   │   ├── json-utils.ts           # JSON column detection and normalization
│   │   ├── types.ts                # WASM-specific Zod schemas + TS types
│   │   ├── resources.ts            # 8 data MCP resources (schema, tables, indexes, etc.)
│   │   ├── index.ts                # Barrel
│   │   ├── output-schemas/         # Zod outputSchema definitions per group (see § below)
│   │   ├── prompts/                # 10 MCP prompts (see § below)
│   │   └── tools/                  # Tool handler files (see § Handler Map below)
│   │       ├── column-validation.ts  # Shared column existence validation utility
│   │       ├── geo.ts                # 4 Haversine geo tools (WASM, no SpatiaLite)
│   │       └── ...                   # Group subdirectories below
│   │
│   └── sqlite-native/              # ── Native adapter (better-sqlite3) ──
│       ├── native-sqlite-adapter.ts     # NativeSqliteAdapter class (extends DatabaseAdapter)
│       ├── native-query-executor.ts     # Native query execution
│       ├── extensions.ts               # Extension loader (CSV, SpatiaLite)
│       ├── transaction-methods.ts      # Transaction state management
│       ├── registration/               # Extracted tool/resource registration logic
│       │   └── index.ts
│       ├── index.ts                    # Barrel
│       └── tools/                      # Native-only tool handlers (see § below)
```

---

## Handler → Tool Mapping

Each file below registers tools with `group` labels. Native-only tools are marked.

### WASM Handlers (`src/adapters/sqlite/tools/`)

| Group | Handler File(s) | Tools | Key Exports |
|-------|----------------|-------|-------------|
| **codemode** | `codemode.ts` | 1 | `sqlite_execute_code` |
| **core** | `core/queries.ts` | 2 | `sqlite_read_query`, `sqlite_write_query` |
| | `core/tables.ts` | 4 | `create_table`, `list_tables`, `describe_table`, `drop_table` |
| | `core/indexes.ts` | 3 | `get_indexes`, `create_index`, `drop_index` |
| **json** | `json-operations/crud.ts` | 3 | `json_insert`, `json_update`, `json_select` |
| | `json-operations/query.ts` | 4 | `json_query`, `json_validate_path`, `json_merge`, `json_analyze_schema` |
| | `json-operations/transform.ts` | 4 | `json_valid`, `json_extract`, `json_set`, `json_remove` |
| | `json-helpers/read.ts` | 7 | `json_type`, `json_array_length`, `json_keys`, `json_each`, `json_pretty`, `json_storage_info`, `json_group_array` |
| | `json-helpers/write.ts` | 5 | `json_array_append`, `json_group_object`, `jsonb_convert`, `json_normalize_column`, `create_json_collection` |
| **text** | `text/regex.ts` | 2 | `regex_extract`, `regex_match` |
| | `text/formatting.ts` | 6 | `text_split`, `text_concat`, `text_replace`, `text_trim`, `text_case`, `text_substring` |
| | `text/search.ts` | 3 | `fuzzy_match`, `phonetic_match`, `advanced_search` |
| | `text/validate.ts` | 2 | `text_normalize`, `text_validate` |
| **text** (FTS5) | `fts.ts` | 4 | `fts_create`, `fts_search`, `fts_rebuild`, `fts_match_info` |
| **stats** | `stats/basic.ts` | 7 | `stats_basic`, `stats_count`, `stats_group_by`, `stats_histogram`, `stats_percentile`, `stats_correlation`, `stats_top_n` |
| | `stats/advanced.ts` | 6 | `stats_distinct`, `stats_summary`, `stats_frequency`, `stats_outliers`, `stats_regression`, `stats_hypothesis` |
| **vector** | `vector/storage.ts` | 4 | `vector_create_table`, `vector_store`, `vector_batch_store`, `vector_delete` |
| | `vector/search.ts` | 2 | `vector_search`, `vector_get` |
| | `vector/metadata.ts` | 5 | `vector_count`, `vector_stats`, `vector_dimensions`, `vector_normalize`, `vector_distance` |
| **geo** | `geo.ts` | 4 | `geo_distance`, `geo_nearby`, `geo_bounding_box`, `geo_cluster` |
| **admin** | `admin/backup/create.ts` | 1 | `backup` |
| | `admin/backup/restore.ts` | 1 | `restore` |
| | `admin/backup/analyze.ts` | 1 | `analyze` |
| | `admin/backup/integrity.ts` | 1 | `integrity_check` |
| | `admin/backup/optimize.ts` | 1 | `optimize` |
| | `admin/verify.ts` | 2 | `verify_backup`, `index_stats` |
| | `admin/pragma.ts` | 6 | `pragma_compile_options`, `pragma_database_list`, `pragma_optimize`, `pragma_settings`, `pragma_table_info`, `append_insight` |
| | `virtual/views.ts` | 3 | `create_view`, `list_views`, `drop_view` |
| | `virtual/vtable.ts` | 5 | `list_virtual_tables`, `virtual_table_info`, `drop_virtual_table`, `create_csv_table`, `analyze_csv_schema` |
| | `virtual/extensions.ts` | 2 | `create_rtree_table`, `create_series_table` |
| | `virtual/analysis.ts` | 3 | `generate_series`, `dbstat`, `vacuum` |
| **introspection** | `introspection/graph/tools.ts` | 3 | `dependency_graph`, `topological_sort`, `cascade_simulator` |
| | `introspection/analysis/constraints.ts` | 1 | `constraint_analysis` |
| | `introspection/analysis/risks.ts` | 1 | `migration_risks` |
| | `introspection/analysis/snapshot.ts` | 1 | `schema_snapshot` |
| | `introspection/diagnostics/storage.ts` | 1 | `storage_analysis` |
| | `introspection/diagnostics/indexes.ts` | 1 | `index_audit` |
| | `introspection/diagnostics/query-plan.ts` | 1 | `query_plan` |
| **migration** | `migration/tracking/init.ts` | 1 | `migration_init` |
| | `migration/tracking/record.ts` | 1 | `migration_record` |
| | `migration/tracking/apply.ts` | 1 | `migration_apply` |
| | `migration/tracking/rollback.ts` | 1 | `migration_rollback` |
| | `migration/tracking/history.ts` | 1 | `migration_history` |
| | `migration/tracking/status.ts` | 1 | `migration_status` |

### Native-Only Handlers (`src/adapters/sqlite-native/tools/`)

| Group | Handler File | Tools | Notes |
|-------|-------------|-------|-------|
| **stats** (window) | `window.ts` | 6 | `window_row_number`, `window_rank`, `window_lag_lead`, `window_running_total`, `window_moving_avg`, `window_ntile` |
| **admin** (transactions) | `transactions.ts` | 7 | `transaction_begin/commit/rollback/savepoint/release/rollback_to/execute` |
| **geo** (SpatiaLite) | `spatialite/tools.ts` | 4 | `spatialite_load/create_table/query/index` |
| | `spatialite/analysis.ts` | 3 | `spatialite_analyze/transform/import` |

### Utility Files (no tools, shared helpers)

Files that provide shared logic but do **not** register tools:

| File | Purpose |
|------|---------|
| `core/tables.ts` | Also exports `isSpatialiteSystemTable()`, `isSpatialiteSystemView()`, `isSpatialiteSystemIndex()` — used by core + introspection tools for `excludeSystemTables` filtering |
| `column-validation.ts` | `validateColumnExists()` — used by geo, stats, text |
| `json-operations/helpers.ts` | JSON path/value normalization |
| `json-helpers/helpers.ts` | JSON helper utilities |
| `text/helpers.ts` | Text processing shared logic |
| `stats/helpers.ts` | Stats calculation utilities |
| `stats/inference.ts` | Statistical type inference engine |
| `stats/math-helpers.ts` | Math utility functions (median, std dev) |
| `vector/helpers.ts` | Vector math utilities |
| `vector/schemas.ts` | Zod schemas for vector tools |
| `vector/tools.ts` | Vector tool registration barrel |
| `admin/helpers.ts` | Admin tool shared utilities |
| `migration/schemas.ts` | Zod input schemas for migration tools |
| `virtual/helpers.ts` | Virtual table helper utilities |
| `introspection/graph/helpers.ts` | FK graph traversal helpers |
| `spatialite/schemas.ts` (native) | Zod schemas for SpatiaLite tools |
| `spatialite/loader.ts` (native) | SpatiaLite extension loader + path resolution |

---

## Output Schemas (`src/adapters/sqlite/output-schemas/`)

Zod schemas that define the `outputSchema` for MCP tool responses:

| File | Groups Covered |
|------|---------------|
| `common.ts` | Shared base schemas (e.g., success/error shape) |
| `error-mixin.ts` | `ErrorFieldsMixin` — 6 optional error fields merged into all output schemas |
| `core.ts` | Core group output schemas |
| `json.ts` | JSON group output schemas |
| `text.ts` | Text group output schemas |
| `fts.ts` | FTS5 output schemas |
| `stats.ts` | Stats group output schemas |
| `vector.ts` | Vector group output schemas |
| `admin.ts` | Admin group output schemas |
| `geo.ts` | Geo group output schemas |
| `virtual.ts` | Virtual table output schemas |
| `native.ts` | Native-only output schemas (transactions, window functions) |
| `spatialite.ts` | SpatiaLite output schemas (7 tools — native only) |
| `server.ts` | Type aliases for core output schemas (built-in tools use `content` pattern, not `structuredContent`) |
| `index.ts` | Barrel re-export |

---

## Prompts (`src/adapters/sqlite/prompts/`)

| File | Prompts |
|------|---------| 
| `analysis.ts` | `sqlite_data_analysis`, `sqlite_summarize_table`, `sqlite_demo` |
| `query.ts` | `sqlite_query_builder`, `sqlite_debug_query`, `sqlite_hybrid_search_workflow` |
| `schema.ts` | `sqlite_explain_schema`, `sqlite_documentation`, `sqlite_migration` |
| `index.ts` | Barrel + `sqlite_optimization` |

---

## Error Class Hierarchy

All errors extend `DbMcpError` (defined in `src/utils/errors/base.ts`). Every tool returns structured `{success: false, error, code, category, suggestion, recoverable}` via `formatErrorResponse()` — never raw MCP exceptions.

```
DbMcpError (base.ts)
├── ValidationError         code: VALIDATION_ERROR      category: validation
├── ConnectionError         code: CONNECTION_ERROR       category: connection      recoverable: true
├── QueryError              code: QUERY_ERROR            category: query            accepts: sql option
├── PermissionError         code: PERMISSION_ERROR       category: permission
├── ResourceNotFoundError   code: RESOURCE_NOT_FOUND     category: resource         accepts: resourceType, resourceName
├── ConfigurationError      code: CONFIG_ERROR           category: config
├── InternalError           code: INTERNAL_ERROR         category: internal
├── AuthenticationError     code: AUTHENTICATION_ERROR   category: authentication
└── AuthorizationError      code: AUTHORIZATION_ERROR    category: authorization
```

**Usage pattern** — all tool handlers:
```typescript
import { ValidationError } from "../../utils/errors/index.js";
import { formatHandlerError } from "../../utils/errors/index.js";

// Throw typed errors:
throw new ValidationError("Table name required", "TABLE_NAME_REQUIRED", {
  suggestion: "Provide a valid table name",
});

// Catch at handler boundary:
catch (error) {
  return formatHandlerError(error);
}
```

**Error suggestions** — `src/utils/errors/suggestions.ts` provides:
- `suggestTableName(input, existingTables)` — fuzzy-matches typos
- `suggestColumnName(input, existingColumns)` — fuzzy-matches columns
- `suggestToolName(input)` — suggests similar tool names

---

## Key Constants & Config

| What | Where | Notes |
|------|-------|-------|
| Server instructions (agent prompt) | `src/constants/server-instructions.ts` | Generated: slim `INSTRUCTIONS` (~680 chars) + `HELP_CONTENT` map. Source: `server-instructions/*.md` |
| Tool group arrays | `src/filtering/tool-constants.ts` | `TOOL_GROUPS` map, `META_GROUPS` shortcuts |
| Tool filter logic | `src/filtering/tool-filter.ts` | `ToolFilter` class |
| JSON-RPC constants | `src/codemode/api-constants.ts` | Error codes, method names for sandbox RPC |
| Logger error codes | `src/utils/logger/error-codes.ts` | Module-prefixed codes (`DB_`, `AUTH_`, etc.) |
| Version SSoT | `src/version.ts` | Reads from `package.json` at build time |

---

## Architecture Patterns (Quick Reference)

| Pattern | Description |
|---------|-------------|
| **Structured Errors** | Every tool returns `{success: false, error}` — never raw exceptions. Uses `formatHandlerError()`. |
| **Adapter Pattern** | `DatabaseAdapter` (abstract) → `SqliteAdapter` (WASM) / `NativeSqliteAdapter` (Native). Both share tool handler files from `sqlite/tools/`. |
| **Schema Cache** | `SchemaManager` caches table/column metadata with configurable TTL. Auto-invalidates on DDL ops. |
| **Code Mode Bridge** | `sqlite.*` API in worker thread communicates via MessagePort RPC to main thread tool handlers. |
| **Tool Filtering** | `ToolFilter` parses `--tool-filter` string → whitelist/blacklist of tool names. `codemode` auto-injected unless excluded. |
| **Output Schemas** | Zod schemas in `output-schemas/` define response shapes per MCP `outputSchema` spec. |
| **Barrel Re-exports** | Every directory has `index.ts` barrel. Import from `./module/index.js` (with `.js` extension for ESM). |
| **Module Logger** | `createModuleLogger("moduleName")` → structured logs with `[module]` prefix. |

---

## Import Path Conventions

- All imports use **`.js` extension** (ESM requirement): `import { x } from "./foo/index.js"`
- After splitting `foo.ts` → `foo/` directory: update imports from `./foo.js` → `./foo/index.js`
- Error classes can be imported from either:
  - `../../utils/errors/index.js` (direct)
  - `../../types/index.js` (re-exported subset: `DbMcpError`, `ValidationError`, `ConnectionError`, `QueryError`, `AuthenticationError`, `AuthorizationError`)

---

## Test Infrastructure

| File / Directory | Purpose |
|-----------------|---------|
| `test-server/README.md` | Agent testing orchestration doc |
| `test-server/test-database.sql` | Seed DDL+DML (10 tables, ~400 rows) |
| `test-server/reset-database.ps1` | Reset script — drops + re-seeds `test.db` |
| `test-server/tool-reference.md` | Complete 139/115 tool inventory with descriptions |
| `test-server/test-group-tools.md` | Per-group deterministic checklists |
| `test-server/test-tools.md` | Entry-point protocol (schema ref, reporting format) |
| `test-server/test-agent-experience.md` | 20 open-ended scenarios — validates help resource sufficiency |
| `test-server/test-help-resources.mjs` | Integration test — slim instructions + help resource filtering |
| `test-server/test-tool-annotations.mjs` | Integration test — openWorldHint annotation verification |
| `tests/` | Vitest unit tests (per-module) |
| `tests/e2e/` | Playwright E2E tests (HTTP/SSE transport parity) |
| `benchmarks/` | Vitest bench performance benchmarks |
