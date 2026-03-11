# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Introspection Tools WASM FTS5 Crash** — 5 introspection tools no longer crash when the database contains FTS5 virtual tables in WASM mode
  - `sqlite_dependency_graph`, `sqlite_topological_sort`, `sqlite_cascade_simulator`, `sqlite_schema_snapshot`, `sqlite_constraint_analysis` all failed with "no such module: fts5" because internal queries (`SELECT COUNT(*)`, `PRAGMA table_info`, `PRAGMA foreign_key_list`) hit FTS5 virtual tables that WASM SQLite can't resolve
  - Added try/catch around per-table queries in `buildForeignKeyGraph()` (graph.ts) and `schemaSnapshot`/`constraintAnalysis` handlers (analysis.ts)
  - FTS5 tables are still included in results (with rowCount 0 and columnCount 0) but no longer crash the entire operation

### Added

- **Playwright E2E Test Suite** — 4 spec files verifying dual HTTP/SSE transport layer
  - `health.spec.ts`: Health endpoint and MCP initialization handshake
  - `protocols.spec.ts`: Streamable HTTP and Legacy SSE protocol validation (session IDs, invalid JSON, missing params)
  - `tools.spec.ts`: Tool listing, execution (`sqlite_list_tables`), and P154 structured error validation via MCP SDK Client
  - `security.spec.ts`: 404 handler, 413 payload limit, security headers, CORS preflight, OAuth status, Referrer-Policy
  - `playwright.config.ts` with webServer auto-launch, `test:e2e` npm script, dedicated `e2e.yml` CI workflow
  - E2E badge added to README
- **Introspection Tool Group (6 tools)** — Read-only schema analysis and dependency mapping
  - `sqlite_dependency_graph`: Build directed FK dependency graphs with depth/direction control
  - `sqlite_topological_sort`: Determine safe creation/drop order for tables
  - `sqlite_cascade_simulator`: Preview cascade effects before running DELETE/DROP
  - `sqlite_schema_snapshot`: Capture full or partial schema with SHA-256 fingerprinting
  - `sqlite_constraint_analysis`: Analyze FK constraints, detect orphans, unindexed FKs
  - `sqlite_migration_risks`: Assess risk levels for DDL migration statements
  - All tools are strictly read-only (no database modifications)
- **Migration Tool Group (6 tools)** — Opt-in schema migration lifecycle management
  - `sqlite_migration_init`: Create `_mcp_migrations` tracking table
  - `sqlite_migration_record`: Record a migration without executing (audit/tracking)
  - `sqlite_migration_apply`: Execute + record migration atomically with rollback SQL
  - `sqlite_migration_rollback`: Reverse a migration using stored rollback SQL
  - `sqlite_migration_history`: Query migration history with status/version filters
  - `sqlite_migration_status`: Dashboard summary of migration state
  - SHA-256 deduplication prevents accidental re-application
  - All tools require `write` or `admin` scope
- **`dev-schema` Meta-Group Shortcut** — New shortcut enabling `core + introspection + migration + codemode` for schema development workflows
- **Code Mode Introspection/Migration Support** — `sqlite.introspection.*` and `sqlite.migration.*` groups added to sandbox API
  - Method aliases: `deps`, `toposort`, `cascade`, `snapshot`, `constraints`, `risks`, `setup`, `log`, `run`, `undo`
  - Positional parameter support and help() examples for both groups
  - Groups listed in `sqlite_execute_code` tool description and `ServerInstructions.ts`
- **Tool Icons (MCP 2025-11-25)** — All tools, resources, and prompts now include visual icons
  - 8 group-level icons from Material Design Icons (CDN-hosted SVG via jsDelivr)
  - Built-in server tools (`server_info`, `server_health`, `list_adapters`) get a server icon
  - New `src/utils/icons.ts` utility with `getToolGroupIcon()` and `SERVER_ICONS`
  - Icon passthrough in both WASM and Native adapter `registerTool()`/`registerResource()`/`registerPrompt()` methods
  - `McpIcon` type added to `types/index.ts`; `icons` field added to `ToolDefinition`, `ResourceDefinition`, `PromptDefinition`
  - **Dual HTTP Transport** — HTTP transport now supports both Streamable HTTP (MCP 2025-03-26) and Legacy SSE (MCP 2024-11-05) protocols simultaneously
  - `GET /sse` — Opens Legacy SSE connection for backward-compatible clients
  - `POST /messages?sessionId=<id>` — Routes messages to Legacy SSE transport
  - Cross-protocol guard: SSE session IDs rejected on `/mcp` and vice versa
- **Security Headers** — All HTTP responses now include 7 security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`, `Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy`, `Strict-Transport-Security`
- **Rate Limiting** — Per-IP sliding-window rate limiting (100 requests/minute, health endpoint exempt)
- **Body Size Enforcement** — JSON body limited to 1 MB via `express.json({ limit })`, returns 413 for oversized payloads
- **404 Handler** — Unknown paths now return `404 { error: "Not found" }` instead of Express default HTML
- **Code Mode (Sandboxed Execution)** — New `sqlite_execute_code` tool for executing JavaScript in a sandboxed environment
  - Agents write code using `sqlite.*` API to access all 7 tool groups (core, json, text, stats, vector, admin, geo)
  - 70-90% token reduction by replacing multiple sequential tool calls with a single code execution
  - Dual sandbox support: `worker_threads` (default, enhanced isolation) and `vm` module
  - Worker sandbox uses MessagePort RPC bridge for secure API proxy between threads
  - Security: code validation against blocked patterns, rate limiting (60 exec/min), result sanitization (10MB cap), audit logging
  - Built-in `help()` for discoverability: `sqlite.help()` for groups, `sqlite.<group>.help()` for methods
  - Positional parameter support: `sqlite.core.readQuery("SELECT 1")` maps to `{ query: "SELECT 1" }`
  - Method aliases for ergonomic use (e.g., `sqlite.core.query()` → `readQuery`)
  - New `codemode` tool group added to all meta-group shortcuts (starter, analytics, search, spatial, minimal, full)
  - Environment variable `CODEMODE_ISOLATION=vm|worker` to select sandbox mode (default: `worker`)
  - New files: `src/codemode/` (types, security, sandbox, worker-sandbox, worker-script, sandbox-factory, api, index)
  - Updated: `ToolGroup` type, `LogModule`, `ToolConstants`, `ServerInstructions`, tool index
  - Auto-injected into all tool filter configurations (whitelist mode) — opt out with `-codemode`
  - **`sqlite_drop_index` Tool** — New core tool to drop indexes from the database
  - Validates index existence before dropping
  - Supports `ifExists` flag (default `true`) for graceful no-op when index doesn't exist
  - Registered in core group with `DropIndexSchema` / `DropIndexOutputSchema`
  - Added to `ToolConstants.ts`, `ServerInstructions.ts`, and positional param map
  - Core tool count: 8 → 9 (minimal meta-group: 9 → 10)
- **Server Host Binding** — New `--server-host` CLI option and `MCP_HOST` environment variable
  - Configures which host/IP the HTTP transport binds to (default: `0.0.0.0`)
  - Use `--server-host 127.0.0.1` to restrict to local connections only
  - Precedence: CLI flag > `MCP_HOST` env var > `HOST` env var > default (`0.0.0.0`)
  - Essential for containerized deployments where binding to all interfaces is required
  - **Server Host Binding** — New `--server-host` CLI option and `MCP_HOST` environment variable
  - Configures which host/IP the HTTP transport binds to (default: `0.0.0.0`)
  - Use `--server-host 127.0.0.1` to restrict to local connections only
  - Precedence: CLI flag > `MCP_HOST` env var > `HOST` env var > default (`0.0.0.0`)
  - Essential for containerized deployments where binding to all interfaces is required

### Performance

- **NativeSqliteAdapter SchemaManager Integration** — Schema metadata operations now use TTL-based caching
  - `listTables()`, `describeTable()`, `getSchema()`, `getAllIndexes()` delegate through `SchemaManager` (5s TTL)
  - Eliminates redundant `PRAGMA table_info()` queries on every metadata request
  - Auto-invalidates schema cache on DDL operations (`CREATE`, `ALTER`, `DROP`)
  - Matches the caching pattern already used by the WASM `SqliteAdapter`
- **Cached Tool Definitions** — `NativeSqliteAdapter.getToolDefinitions()` now lazily caches results
  - Tool definitions are immutable per adapter instance; avoids 13-way array spread on repeat calls
- **Logger Taint-Breaking Optimization** — `writeToStderr()` uses `"".concat()` instead of per-character copy
  - Previous O(n) character-by-character array+join replaced with single string concatenation
  - Still breaks CodeQL taint tracking without the allocation overhead
- **Logger Sensitive Key Matching** — Pre-computed `SENSITIVE_KEYS_ARRAY` at module scope
  - Avoids spreading `Set` into a new array on every context key during `sanitizeContext()`
- **Logger Regex Pre-Compilation** — `sanitizeMessage()` and `sanitizeStack()` regex patterns hoisted to module scope
  - Avoids re-constructing `RegExp` objects (via `String.fromCharCode()`) on every log call
- **SQL Validation Regex Pre-Compilation** — `DANGEROUS_SQL_PATTERNS` hoisted to module scope in `DatabaseAdapter.ts`
  - Avoids re-allocating 5 `RegExp` objects per `validateQuery()` call
- **CORS Preflight Caching** — Added `Access-Control-Max-Age: 86400` to OPTIONS responses
  - Browsers cache preflight results for 24 hours, reducing repeated OPTIONS roundtrips
- **Docker HTTP Healthcheck** — Healthcheck now validates `/health` endpoint for HTTP transport
  - Falls back to basic Node.js check for stdio mode

### Dependencies

- `@types/node`: 25.3.5 → 25.4.0
- `jose`: 6.2.0 → 6.2.1
- `typescript-eslint`: 8.56.1 → 8.57.0
- Dockerfile `tar` dependency pinned to `7.5.11` for security compliance
- `@types/node`: 25.3.3 → 25.3.5
- `eslint`: 10.0.2 → 10.0.3
- `jose`: 6.1.3 → 6.2.0
- Dockerfile `tar` dependency pinned to `7.5.10` for security compliance
- Removed unused `pg` and `@types/pg` dependencies (never imported in source)
- `@eslint/js`: 9.39.2 → 10.0.1 (major)
- `eslint`: 9.39.2 → 10.0.2 (major/patch)
- `@types/node`: 25.3.0 → 25.3.3
- `rimraf`: 6.1.2 → 6.1.3
- `typescript-eslint`: 8.55.0 → 8.56.1
- `@modelcontextprotocol/sdk`: 1.27.0 → 1.27.1
- `@types/pg`: 8.16.0 → 8.18.0
- `globals`: 17.3.0 → 17.4.0
- `pg`: 8.18.0 → 8.20.0
- `sql.js`: 1.14.0 → 1.14.1
- `@modelcontextprotocol/sdk`: 1.25.3 → 1.26.0
- `@types/node`: 25.2.0 → 25.2.3
- `dotenv`: 17.2.3 → 17.3.1
- `sql.js`: 1.13.0 → 1.14.0
- `typescript-eslint`: 8.54.0 → 8.55.0

### Changed

- **Tier 2 File Refactoring** — Split 4 large files (700–986 lines) into modular directory structures
  - **Phase 1 — Adapter Deduplication**: Extracted shared `registerTool`/`registerResource`/`registerPrompt` logic into `DatabaseAdapter` base class, reducing `NativeSqliteAdapter.ts` (956→727) and `SqliteAdapter.ts` (945→721)
  - **Phase 2 — Transport Split**: Split `http.ts` (986 lines) into `http/` directory with 6 files: `types.ts`, `middleware.ts`, `session.ts`, `oauth.ts`, `transport.ts`, `index.ts`
  - **Phase 3 — Tool File Splits**: Split 3 tool files into directory modules:
    - `spatialite.ts` (915) → `spatialite/` (4 files: `schemas.ts`, `loader.ts`, `tools.ts`, `index.ts`)
    - `vector.ts` (826) → `vector/` (4 files: `schemas.ts`, `helpers.ts`, `tools.ts`, `index.ts`)
    - `core.ts` (770) → `core/` (4 files: `queries.ts`, `tables.ts`, `indexes.ts`, `index.ts`)
  - All consumer imports updated (6 source files + 1 test); no public API changes

- **Configurable CORS Origins** — CORS refactored from hardcoded `Access-Control-Allow-Origin: *` to configurable `corsOrigins` array; supports explicit origins with `Access-Control-Allow-Credentials: true`; removed duplicated CORS middleware
- **Root Endpoint** — `GET /` now lists Legacy SSE endpoints and updated description to "dual HTTP transport"
- **Deterministic Error Handling** — Structured error responses across all tools
  - `registerTool()` catch block now uses `formatError()` to surface `code`, `category`, `suggestion`, `recoverable` fields
  - Applies to both WASM (`SqliteAdapter`) and native (`NativeSqliteAdapter`) adapters
  - Codemode error paths enriched: `CODEMODE_VALIDATION_FAILED`, `CODEMODE_RATE_LIMITED`, `CODEMODE_EXECUTION_FAILED`
  - Added 4 codemode-specific patterns to `ERROR_SUGGESTIONS` for auto-suggestion matching
- **Core Tool Handler-Level Error Handling** — 5 core tool handlers now catch errors locally and return `{success: false}` responses
  - `sqlite_read_query`, `sqlite_write_query`, `sqlite_describe_table`, `sqlite_create_index`: Catch errors with `formatError()` and return structured `{success: false, error, code, suggestion}` instead of propagating as `isError: true` MCP exceptions
  - `sqlite_drop_table`: Checks table existence before DROP; returns `"does not exist (no changes made)"` when `ifExists` is true and table is absent, or `{success: false}` when `ifExists` is false
  - `sqlite_describe_table`: Pre-checks table existence and returns `TABLE_NOT_FOUND` error code instead of generic `UNKNOWN_ERROR`
  - `sqlite_get_indexes`: Validates table existence when `tableName` is specified; returns `{success: false, code: "TABLE_NOT_FOUND"}` instead of empty `{success: true}`
- **Text Tool Handler-Level Error Handling** — All 13 text tool handlers now catch errors locally and return `{success: false}` responses
  - `sqlite_regex_match`, `sqlite_regex_extract`, `sqlite_text_split`, `sqlite_text_concat`, `sqlite_text_replace`, `sqlite_text_trim`, `sqlite_text_case`, `sqlite_text_substring`, `sqlite_fuzzy_match`, `sqlite_phonetic_match`, `sqlite_text_normalize`, `sqlite_text_validate`, `sqlite_advanced_search`: Catch errors with `formatError()` and return structured `{success: false, error, code, suggestion}` instead of propagating as raw MCP exceptions
  - Mirrors the same pattern already applied to core and JSON tool groups
- **Text Tool Column Existence Validation** — All 13 text tools now validate column existence before query execution
  - Prevents silent success on nonexistent columns (SQLite treats double-quoted nonexistent identifiers as string literals)
  - Returns `{success: false, code: "COLUMN_NOT_FOUND"}` with suggestion to use `sqlite_describe_table`
  - `validateColumnExists()` uses `PRAGMA table_info()` to verify column presence
  - `validateColumnsExist()` handles multi-column tools (`sqlite_text_concat`)
  - Identifier validation (`sanitizeIdentifier`) runs first for security, then column existence check
  - 12 new error path tests added for nonexistent column on valid table scenarios
- **Stats Tool Handler-Level Error Handling** — All 13 stats tool handlers now catch errors locally and return `{success: false}` responses
  - `sqlite_stats_basic`, `sqlite_stats_count`, `sqlite_stats_group_by`, `sqlite_stats_histogram`, `sqlite_stats_percentile`, `sqlite_stats_correlation`, `sqlite_stats_top_n`, `sqlite_stats_distinct`, `sqlite_stats_summary`, `sqlite_stats_frequency`, `sqlite_stats_outliers`, `sqlite_stats_regression`, `sqlite_stats_hypothesis`: Catch errors with `formatError()` and return structured `{success: false, error, code, suggestion}` instead of propagating as raw MCP exceptions
  - Mirrors the same pattern already applied to core, JSON, and text tool groups
- **Stats Tool Column Existence Validation** — All 13 stats tools now validate column existence before query execution
  - Prevents silent success on nonexistent columns (SQLite treats double-quoted nonexistent identifiers as string literals)
  - Returns `{success: false, code: "COLUMN_NOT_FOUND"}` with suggestion to use `sqlite_describe_table`
  - `sqlite_stats_summary` validates user-specified columns; auto-detected columns skip validation
  - `sqlite_stats_correlation` validates both `column1` and `column2`; `sqlite_stats_regression` validates both `xColumn` and `yColumn`
  - `sqlite_stats_hypothesis` validates `column`, `column2` (ttest_two), and `groupColumn` (chi_square)
  - 15 new error path tests added for nonexistent table and column scenarios
- **Security Test Pattern Update** — Updated security integration tests for stats tool structured error handling
  - `tool-integration.test.ts`: 57 stats injection tests now use `assertRejectsInjection()` helper accepting either throws or `{success: false}` responses
  - `identifier-integration.test.ts`: 4 stats identifier injection tests updated from `rejects.toThrow()` to structured error assertions
  - Fixed `stats_group_by` identifier test using wrong parameter names (`column`/`groupColumn` → `valueColumn`/`groupByColumn`/`stat`)

### Fixed

- **`sqlite_json_normalize_column` WASM Compatibility** — Fixed all rows silently failing in WASM mode
  - Root cause: `SELECT rowid, ...` doesn't expose `rowid` as a named column in sql-js when the table has an INTEGER PRIMARY KEY
  - Handler received `undefined` for `row["rowid"]`, causing all per-row UPDATE queries to fail in the inner try/catch
  - Fix: Changed to `SELECT _rowid_ AS _rid_` which SQLite guarantees to work across all backends
  - Added `firstErrorDetail` field to response when errors occur, making per-row failures diagnosable without reading source code
- **Security Test Assertion Migration** — Updated 11 tests from `.rejects.toThrow()` to structured error assertions
  - `pragma-security.test.ts`: 3 `sqlite_pragma_table_info` injection tests now assert `{success: false, error: /invalid/i}`
  - `identifier-integration.test.ts`: 6 FTS tool injection tests and 2 admin tool injection tests (`pragma_table_info`, `index_stats`) updated
  - These tests were stale after handlers were migrated to return structured `{success: false}` instead of throwing
- **`sqlite_index_stats` Structured Error Handling** — Handler now wrapped in try/catch with `formatError()`
  - `sanitizeIdentifier()` and `Schema.parse()` were outside any try/catch, causing raw `InvalidIdentifierError` throws
  - Now returns `{success: false, indexes: [], error: "Invalid identifier..."}` consistent with all other admin tools
- **FTS Security Test Assertion Migration** — Updated 7 FTS injection tests from `.rejects.toThrow()` to structured error assertions
  - `fts-injection.test.ts`: 4 `sqlite_fts_create`, 1 `sqlite_fts_search`, 1 `sqlite_fts_rebuild`, 1 `sqlite_fts_match_info` injection tests updated
- **Core Query Tool Validation Hardening** — `sqlite_read_query` and `sqlite_write_query` handlers now catch Zod validation errors as structured `{success: false}` responses
  - Wrapped `Schema.parse(params)` inside try/catch blocks in both `createReadQueryTool` and `createWriteQueryTool` handlers
  - `sqlite_read_query`: Added empty query guard — empty string `""` previously returned `{success: true, rowCount: 0}` instead of a validation error
  - Now returns `{success: false, error: "Query cannot be empty. Provide a valid SELECT, PRAGMA, EXPLAIN, or WITH statement."}`
- **Text/FTS Tool Zod Validation Error Handling** — All 17 text and FTS tool handlers now catch Zod validation errors as structured `{success: false}` responses
  - 13 text tools (`regex.ts`, `formatting.ts`, `search.ts`): Moved `Schema.parse(params)` inside try/catch blocks with `formatError()`
  - 4 FTS tools (`fts.ts`): Moved `Schema.parse(params)` plus FTS5 availability checks and identifier validation inside try/catch blocks
  - Previously, calling these tools with invalid parameters returned raw MCP error frames instead of structured handler errors
- **Introspection Tool Zod Validation Error Handling** — All 9 introspection tool handlers now catch Zod validation errors as structured `{success: false}` responses
  - `sqlite_dependency_graph`, `sqlite_topological_sort`, `sqlite_cascade_simulator`, `sqlite_schema_snapshot`, `sqlite_constraint_analysis`, `sqlite_migration_risks`, `sqlite_storage_analysis`, `sqlite_index_audit`, `sqlite_query_plan`: Moved `Schema.parse(params)` inside try/catch blocks with `formatError()`
  - Previously, calling tools with invalid parameters (wrong types, missing required fields, out-of-range values) returned raw MCP error frames instead of structured handler errors
- **`sqlite_query_plan` min(1) Refinement Leak** — Removed `.min(1)` from `QueryPlanSchema.sql` and added handler-level validation
  - `.partial()` in `DatabaseAdapter.registerTool()` makes keys optional for SDK validation, but doesn't strip refinements like `min(1)`
  - When `sql: ""` was passed, the `min(1)` check fired at the SDK level, producing raw MCP error -32602
  - Now validates empty `sql` inside the handler and returns structured `{success: false, error: "Parameter 'sql' is required..."}`
- **Geo Tool Zod Validation Error Handling** — All 4 Haversine geo tool handlers now catch Zod validation errors as structured `{success: false}` responses
  - `sqlite_geo_distance`, `sqlite_geo_nearby`, `sqlite_geo_bounding_box`, `sqlite_geo_cluster`: Moved `Schema.parse(params)` inside try/catch blocks with `formatError()`
  - Previously, calling these tools with empty or invalid parameters returned raw MCP error frames instead of structured handler errors
- **Geo Tool Coordinate Range Validation** — Moved `.min(-90).max(90)` / `.min(-180).max(180)` refinements from Zod schemas to handler-level validation
  - `sqlite_geo_distance`: lat1, lon1, lat2, lon2 range validation via `validateCoordinates()` helper
  - `sqlite_geo_nearby`: centerLat, centerLon range validation
  - `sqlite_geo_bounding_box`: minLat, maxLat, minLon, maxLon range validation
  - Previously, out-of-range coordinates (e.g., `lat1: 91`) triggered raw MCP `-32602` errors at the SDK boundary before the handler ran
  - Now returns structured `{success: false, error: "Invalid lat1: 91. Must be between -90 and 90."}`
- **Admin Tool Zod Validation Error Handling** — 11 admin tool handlers now catch Zod/sanitizeIdentifier errors as structured `{success: false}` responses
  - `sqlite_pragma_table_info`, `sqlite_virtual_table_info`, `sqlite_create_csv_table`, `sqlite_create_rtree_table`, `sqlite_create_series_table`, `sqlite_append_insight`: Added try/catch around `Schema.parse(params)` and `sanitizeIdentifier()` calls
  - `sqlite_backup`, `sqlite_restore`, `sqlite_generate_series`, `sqlite_analyze_csv_schema`, `sqlite_transaction_execute`: Added try/catch around `Schema.parse(params)` calls
  - Previously, calling these tools with empty or invalid parameters returned raw MCP error frames instead of structured handler errors
  - `AppendInsightSchema.insight` now requires `.min(1)` to reject empty strings (previously accepted `""` silently)
- **Migration Tool Zod Validation Error Handling** — `sqlite_migration_record` and `sqlite_migration_apply` handlers now catch Zod validation errors as structured `{success: false}` responses
  - Moved `Schema.parse(params)` inside existing try/catch blocks in `tracking.ts`
  - Previously, calling these tools with empty `{}` params returned raw MCP error frames instead of structured handler errors
- **Code Mode `log` Alias Mapping** — Fixed `sqlite.migration.log()` pointing to `migrationRecord` instead of `migrationHistory`
  - `log` semantically means "show the log of migrations", not "record a new migration"
  - Calling `sqlite.migration.log()` previously required `version` and `migrationSql` params (record) — now correctly returns migration history with no required params
- **JSON Tool Zod Validation Error Handling** — All 23 JSON tool handlers now catch Zod validation errors as structured `{success: false}` responses
  - Previously, calling any JSON tool with empty or invalid parameters returned raw MCP error `-32602` instead of a structured handler error
  - Root cause: MCP SDK validates `inputSchema` at the transport layer before the handler runs, rejecting required-field violations as `-32602`
  - Fix: `DatabaseAdapter.registerTool()` now wraps inputSchema with `.partial()` so the SDK accepts any param subset; handler-level `Schema.parse()` validates strictly and returns structured errors via `formatError()`
  - Added try/catch around `Schema.parse(params)` in all 23 JSON handlers across 4 files: `crud.ts` (7), `query.ts` (4), `transform.ts` (4), `json-helpers.ts` (8)
- **Core Table Tool Zod Validation Error Handling** — 3 table handlers (`sqlite_create_table`, `sqlite_describe_table`, `sqlite_drop_table`) now catch Zod validation errors as structured `{success: false}` responses
  - Previously, calling these tools with missing required parameters (e.g., empty `{}`) threw raw MCP errors instead of returning structured handler errors
  - Added try/catch around `Schema.parse(params)` in all 3 handlers in `tables.ts` with `formatError()` for consistent error responses
- **Index Tool Zod Validation Error Handling** — All 3 index handlers (`sqlite_get_indexes`, `sqlite_create_index`, `sqlite_drop_index`) now catch Zod validation errors as structured `{success: false}` responses
  - Root cause: `CreateIndexSchema.columns` had `.min(1)` which the MCP SDK validates before the handler runs, surfacing as raw MCP error `-32602`
  - Moved `min(1)` check to handler-level validation returning `{success: false, message: "At least one column is required..."}`
  - Wrapped all `Schema.parse()` calls in try/catch blocks with `formatError()` for defense-in-depth
- **Multi-Session Streamable HTTP Crash** — Fixed `Already connected to a transport` error when creating 2+ concurrent sessions
  - SDK's `McpServer.connect()` only supports one active transport; second `connect()` threw
  - Added close-before-reconnect pattern wrapping `server.connect()` in try-catch
- **`sqlite_spatialite_index` Check Returns `valid: false` for Valid Indexes** — Now treats `CheckSpatialIndex` null result as indeterminate
  - SpatiaLite 5.x's `CheckSpatialIndex()` commonly returns `null` instead of `1` for valid indexes
  - Previously interpreted `null` as `false`, producing misleading message "Spatial index exists but may be invalid"
  - Now returns `valid: null` with message "Spatial index exists (validation inconclusive — common in SpatiaLite 5.x)"
  - Explicit `valid: false` now only shown when `CheckSpatialIndex` returns `0` (actually invalid index)
- **`sqlite_spatialite_create_table` Misleading Success on Existing Table** — Now returns `alreadyExists: true` when table already exists
  - Previously used `CREATE TABLE IF NOT EXISTS` and always reported `"Spatial table 'X' created"` even when table already existed
  - Now pre-checks table existence and returns accurate message: `"Spatial table 'X' already exists"` with `alreadyExists: true` flag
  - Prevents confusion about whether data was reset or preserved
- **`sqlite_spatialite_index` Create/Drop/Check Idempotency** — All 3 index actions now report accurate state
  - `create`: Returns `alreadyExists: true` when index already exists instead of silently running `CreateSpatialIndex` again
  - `drop`: Returns `alreadyDropped: true` when no index exists instead of misleadingly reporting `"Spatial index dropped"`
  - `check`: Returns `{ indexed: false }` when no index exists, or `{ indexed: true, valid: true/false }` when index exists — previously returned raw `{ result: [{ "CheckSpatialIndex(...)": null }] }`
  - Index existence checked via `idx_{table}_{column}` in `sqlite_master`
- **`sqlite_spatialite_analyze` Distance Matrix `targetTable` Support** — Now uses `targetTable` parameter when provided
  - Previously, the `distance_matrix` analysis type always used `sourceTable` for both sides of the cross-join, ignoring `targetTable`
  - Now uses `targetTable` (defaulting to `sourceTable` when omitted) and only applies `a.id < b.id` dedup filter for same-table queries
- **SpatiaLite Tool Structured Error Responses** — All 7 SpatiaLite handlers now return structured errors instead of throwing raw MCP exceptions
  - Added `formatError` import and try/catch blocks to all 7 handlers: `sqlite_spatialite_load`, `sqlite_spatialite_create_table`, `sqlite_spatialite_query`, `sqlite_spatialite_analyze`, `sqlite_spatialite_index`, `sqlite_spatialite_transform`, `sqlite_spatialite_import`
  - `sqlite_spatialite_query`: Nonexistent table errors now return `{success: false, error, code, suggestion}` instead of propagating as raw MCP exceptions
  - `sqlite_spatialite_analyze`: Same fix — structured error response for nonexistent tables and invalid table names
  - `sqlite_spatialite_index`: Added table existence validation — previously returned `{success: true}` for nonexistent tables; now returns `{success: false, error: "Table 'x' does not exist"}`
  - `sqlite_spatialite_transform`: Added null-result validation — previously returned `{success: true, result: null}` for invalid WKT geometry; now returns `{success: false, error: "Invalid geometry..."}`
  - `sqlite_spatialite_import`: Added WKT pre-validation via `GeomFromText()` — previously silently accepted invalid WKT strings like `"INVALID_WKT"`; now returns `{success: false, error: "Invalid WKT geometry..."}`
  - `sqlite_spatialite_create_table`: Validation errors (invalid table/column names) now return structured responses instead of throwing
  - Tests updated to expect structured error responses instead of catching thrown errors; 11 tests covering all 7 tools
  - Previously threw raw MCP exception when called with a nonexistent table
  - Now returns `{success: false, error, code, suggestion}` consistent with all other tool groups
  - Security test updated to assert structured error response instead of `.rejects.toThrow()`
- **`sqlite_restore` Relative Path Resolution** — Now resolves relative paths to absolute before file existence check
  - Previously used raw `input.sourcePath` with `fs.existsSync`, which resolved against the MCP server's CWD (e.g., Antigravity IDE directory)
  - Stale 0-byte files left by SQLite `ATTACH DATABASE` at the server CWD could cause false-positive `{success: true}` responses
  - Now uses `nodePath.resolve()` consistent with the existing `sqlite_verify_backup` handler
- **`sqlite_backup` Relative Path Resolution** — Now resolves relative paths to absolute before `VACUUM INTO`
  - Previously used raw `input.targetPath` for `VACUUM INTO`, causing backups to be written to the MCP server's CWD instead of the expected location
  - Now uses `nodePath.resolve()` consistent with `sqlite_verify_backup` and `sqlite_restore`
- **`sqlite_drop_view` Misleading Success Message** — Now reports "did not exist (no action taken)" for nonexistent views
  - Previously always returned `View 'x' dropped` regardless of whether the view existed (when `ifExists: true`)
  - Now checks view existence before dropping, consistent with `sqlite_drop_virtual_table` pattern
- **`sqlite_verify_backup` Relative Path False Positive** — Now resolves relative paths to absolute before `fs.existsSync` check
  - Previously, relative paths like `"nonexistent_file.db"` bypassed the file existence check (resolved against MCP server CWD, not database directory) and `ATTACH DATABASE` silently created an empty DB, returning `{success: true, valid: true, pageCount: 0}`
  - Now uses `nodePath.resolve()` to convert to absolute path before checking, ensuring consistent behavior regardless of server CWD
- **`sqlite_pragma_settings` Nonexistent PRAGMA Error Message** — Returns user-friendly error for unknown PRAGMAs
  - Previously, querying a nonexistent PRAGMA like `nonexistent_pragma_xyz` returned the confusing better-sqlite3 internal error: `"This statement does not return data. Use run() instead"` with `UNKNOWN_ERROR` code
  - Now detects this specific error pattern and returns `{success: false, error: "Unknown or write-only PRAGMA: 'nonexistent_pragma_xyz'"}`
  - `input` parsing moved before try/catch block to ensure PRAGMA name is accessible in error handler
- **`sqlite_pragma_settings` Structured Error Response** — Handler now wrapped in try/catch with `formatError()`
  - Previously, invalid PRAGMA names threw raw MCP exceptions instead of structured error responses
  - Now returns `{success: false, error: "Invalid PRAGMA name"}` for validation failures
  - Catches all SQLite errors and returns structured `{success: false, error, code, suggestion}` responses
- **`sqlite_verify_backup` Nonexistent File Validation** — Now pre-validates file existence before ATTACH
  - Previously, ATTACH silently created an empty DB for nonexistent files, returning false-positive `{success: true, valid: true, pageCount: 0}`
  - Now returns `{success: false, message: "Backup file not found: ..."}` when file doesn't exist
  - Outer try/catch with `formatError()` added for unexpected errors
- **`sqlite_restore` Nonexistent File Validation** — Now pre-validates source file existence before ATTACH
  - Previously, ATTACH silently created an empty DB for nonexistent files, returning false-positive `{success: true}`
  - Now returns `{success: false, message: "Source file not found: ..."}` when file doesn't exist
- **Transaction Tool Structured Error Responses** — All 6 transaction handlers now return structured errors instead of throwing raw MCP exceptions
  - `sqlite_transaction_begin`, `sqlite_transaction_commit`, `sqlite_transaction_rollback`: Errors like double-begin and no-active-transaction now return `{success: false, error, code, suggestion}` instead of propagating as unhandled exceptions
  - `sqlite_transaction_savepoint`, `sqlite_transaction_release`, `sqlite_transaction_rollback_to`: Invalid savepoint names return `{success: false, error: "Invalid savepoint name"}` instead of throwing; nonexistent savepoint errors return structured responses
  - Added `formatError` import to `transactions.ts`
  - Security tests updated to assert structured error responses instead of `.rejects.toThrow()`
- **`sqlite_vector_distance` Missing Error Handling** — Handler now wrapped in try/catch with `formatError()`
  - Previously, Zod validation errors from malformed input threw raw MCP exceptions instead of structured error responses
  - Now consistent with `sqlite_vector_normalize` and all other vector tool handlers
- **`sqlite_vector_batch_store` Empty Items Table Validation** — Now validates table existence even when items array is empty
  - Previously, `batch_store({table: "nonexistent", items: []})` returned `{success: true, stored: 0}` without checking if the table exists
  - Now queries `sqlite_master` to verify table existence before returning the empty-items early response
  - Returns `{success: false, error: "Table 'x' does not exist"}` for nonexistent tables
- **`sqlite_vector_get` Column Not Found Error** — Provides clear error when vector column doesn't exist in row data
  - Previously returned misleading `"Invalid vector format"` with `UNKNOWN_ERROR` code when the specified vector column was not found in the row
  - Now returns descriptive error: `"Column 'x' not found or contains NULL. Available columns: ..."` listing actual column names
- **`sqlite_vector_count` Dimensions Filter** — `dimensions` parameter now filters results instead of being silently ignored
  - Previously `sqlite_vector_count({table: "t", dimensions: 8})` returned total row count regardless of dimensions value
  - Now adds `WHERE dimensions = N` clause when dimensions parameter is specified
- **`sqlite_vector_normalize` Error Handling** — Handler now wrapped in try/catch with `formatError()`
  - Previously threw raw Zod validation errors instead of returning structured error responses
  - Now consistent with all other vector tool handlers
- **`sqlite_vector_batch_store` Empty Items Validation** — Returns early with `{stored: 0, message: "No items provided"}` for empty items array
  - Previously, empty items array on a nonexistent table silently returned `{success: true, stored: 0}` without touching the database
  - Now short-circuits before any SQL execution, preventing misleading success responses
- **Vector Tool Structured Error Responses** — All 11 vector handlers now return structured errors instead of throwing raw MCP exceptions
  - `sqlite_vector_create_table`, `sqlite_vector_store`, `sqlite_vector_batch_store`, `sqlite_vector_search`, `sqlite_vector_get`, `sqlite_vector_delete`, `sqlite_vector_count`, `sqlite_vector_stats`, `sqlite_vector_dimensions`, `sqlite_vector_normalize`, `sqlite_vector_distance`: Errors like nonexistent tables, invalid identifiers, and invalid input now return `{success: false, error, code, suggestion}` instead of propagating as unhandled exceptions
  - Added `formatError` import from `utils/errors.js` and wrapped all 11 handlers in try/catch blocks
  - Security tests in `identifier-integration.test.ts` updated to assert structured error responses instead of `.rejects.toThrow()`
  - Consistent with the structured error pattern already used by all other tool groups
- **`sqlite_vector_search` Negative Cosine Similarity Filter** — Search no longer silently drops results with negative cosine similarity
  - Previously, the search filter `_similarity >= 0` excluded rows with negative cosine similarity (dissimilar vectors)
  - Negative cosine similarity is valid (ranges from -1 to 1) and should be returned when within the limit
  - Now filters only rows where vector parsing failed (returns `null`), preserving all valid similarity scores
- **`sqlite_vector_create_table` Dimensions Validation** — Now rejects dimensions < 1 with structured error
  - Previously accepted `dimensions: 0` creating a table with meaningless `DEFAULT 0` dimension column
- **`sqlite_vector_distance` Cosine Metric** — Now returns cosine distance (`1 - similarity`) instead of raw cosine similarity
  - Previously returned cosine similarity (0 for orthogonal, 1 for identical) despite the tool being named "distance"
  - Now returns cosine distance (1.0 for orthogonal, 0 for identical) consistent with euclidean distance semantics
  - Does not affect `sqlite_vector_search` which correctly uses `_similarity` as a ranking score
- **Window Function Structured Error Responses** — All 6 window function handlers now return structured errors instead of throwing raw MCP exceptions
  - `sqlite_window_row_number`, `sqlite_window_rank`, `sqlite_window_lag_lead`, `sqlite_window_running_total`, `sqlite_window_moving_avg`, `sqlite_window_ntile`: Errors like nonexistent tables, invalid identifiers, and bad SQL now return `{success: false, error, code, suggestion}` instead of propagating as unhandled exceptions
  - Added `formatError` import from `utils/errors.js` and wrapped all 6 handlers in try/catch blocks
  - Window function tests updated to assert structured error responses instead of `.rejects.toThrow()`
  - Consistent with the structured error pattern already used by all 13 stats tools
- **`server_health` FTS5 Detection False Negative** — Health check now correctly reports `fts5: true` when FTS5 is compiled in
  - `hasFts5()` previously created a `_fts5_test` virtual table as a probe, which silently failed when SpatiaLite extensions were loaded
  - Replaced with lightweight `PRAGMA compile_options` check for `ENABLE_FTS5` flag
  - More reliable and efficient than the virtual table creation/drop approach
- **FTS5 Tool Structured Error Responses** — All 4 FTS5 handlers now return structured errors instead of throwing raw MCP exceptions
  - `sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`: Errors like nonexistent tables, bad SQL, and invalid columns now return `{success: false, error, code, suggestion}` instead of propagating as unhandled exceptions
  - Previously, only `isFts5UnavailableError` (WASM mode) was caught; all other errors were re-thrown
  - Consistent with the structured error pattern already used by all 13 text tools, core tools, stats tools, and JSON tools
  - Security tests in `fts-injection.test.ts` updated to assert structured error responses instead of `.rejects.toThrow()`
- **`sqlite_execute_code` Per-Call Timeout Enforcement** — The `timeout` parameter is now respected per-call instead of being silently ignored
  - Previously, `timeout` was parsed from input but never passed to the sandbox pool; all executions used the fixed 30000ms default
  - Added `timeoutMs?: number` parameter to `ISandbox.execute()` and `ISandboxPool.execute()` interfaces
  - All 4 implementations updated: `CodeModeSandbox`, `SandboxPool`, `WorkerSandbox`, `WorkerSandboxPool`
  - `codemode.ts` now passes the user-specified timeout through to `pool.execute(code, bindings, timeoutMs)`
- **`sqlite_create_index` Table Existence Pre-Validation** — Now returns `TABLE_NOT_FOUND` error instead of raw SQL error for nonexistent tables
  - Previously returned `{success: false, message: "Write query failed: no such table: main.xyz"}` (leaking implementation detail)
  - Now pre-validates table existence and returns `{success: false, message: "Table 'xyz' does not exist", code: "TABLE_NOT_FOUND"}`
  - Consistent with `sqlite_describe_table` and `sqlite_get_indexes` which already pre-validate table existence
- **`sqlite_create_index` Empty Columns Validation** — `CreateIndexSchema.columns` now requires `.min(1)`
  - Previously, an empty columns array passed Zod validation and produced invalid SQL `CREATE INDEX ... ON table ()`
  - Now rejected at schema validation level with clear "Array must contain at least 1 element(s)" message
- **`formatError` Category-Based Error Codes** — Native SQLite errors now get category-specific codes instead of generic `UNKNOWN_ERROR`
  - `no such table` errors now return `RESOURCE_ERROR` code (previously `UNKNOWN_ERROR` despite correct category detection)
  - Maps detected `ErrorCategory` to descriptive codes: `VALIDATION_ERROR`, `CONNECTION_ERROR`, `QUERY_ERROR`, `PERMISSION_ERROR`, `CONFIG_ERROR`, `RESOURCE_ERROR`
  - Only applies to plain `Error` objects caught from SQLite; `DbMcpError` subclasses retain their explicit codes
- **`ERROR_SUGGESTIONS` Query Error Pattern Coverage** — 3 new patterns added for query errors that previously fell through to `UNKNOWN_ERROR`
  - `incomplete input` → `QUERY_ERROR` with suggestion to check for missing clauses or closing parentheses
  - `more than one statement` → `QUERY_ERROR` with suggestion to split into separate calls or use `sqlite_execute_code`
  - `too few parameter` → `QUERY_ERROR` with suggestion to match params array to placeholder count
- **`sqlite_read_query` Statement Type Validation** — Now rejects non-SELECT statements with clear error messages
  - Previously, INSERT/UPDATE/DELETE/DDL passed to `read_query` leaked internal better-sqlite3 message: `"This statement does not return data. Use run() instead"`
  - Now validates upfront and returns: `"Statement type not allowed: INSERT is not a SELECT query. Use sqlite_write_query for INSERT/UPDATE/DELETE, or appropriate admin tools for DDL."`
  - Allows SELECT, PRAGMA, EXPLAIN, and WITH statements; mirrors `write_query` validation pattern
- **`reset-database.ps1` Verification Table List** — Removed orphaned `temp_text_test` entry from expected tables map
  - `temp_text_test` is not created by the seed SQL and was dead code (verification query only checks `test_%` tables)
- **Native Adapter Missing Codemode Tool** — `sqlite_execute_code` was not registered in Native mode
  - `NativeSqliteAdapter.getToolDefinitions()` was missing `getCodeModeTools()` from its tool list
  - WASM adapter (`SqliteAdapter`) already included it via `getAllToolDefinitions()`
  - Tool filter correctly auto-injected `codemode` into enabled groups, but the tool definition was never produced so it couldn't be registered
- **Core Tool Input Validation** — 5 core tool handlers now return structured errors for invalid identifiers instead of throwing raw MCP exceptions
  - `sqlite_create_table`: Added `sanitizeIdentifier` validation for table names and empty columns array check (previously accepted empty string names and empty columns, causing orphaned tables or SQL syntax errors)
  - `sqlite_drop_table`, `sqlite_drop_index`: Wrapped existing `sanitizeIdentifier` calls in try/catch to return `{success: false, message: "..."}` instead of propagating `InvalidIdentifierError`
  - `sqlite_get_indexes`, `sqlite_create_index`: Same try/catch wrapping for identifier validation
  - All 5 handlers now follow the structured error response pattern: `{success: false, message: "Invalid ... name"}`
- **`sqlite_geo_nearby` `returnColumns` Column Leakage** — Lat/lon columns no longer leak into results when `returnColumns` is specified
  - Previously, internally-added lat/lon columns (needed for Haversine distance calculation) were included in the response even when the user didn't request them
  - Now strips lat/lon columns from results unless the user explicitly includes them in `returnColumns`
  - Consistent with `sqlite_geo_bounding_box` which already respected `returnColumns` exactly
- **Geo Tool Structured Error Responses** — All 3 database-accessing geo handlers now return structured errors instead of throwing raw MCP errors
  - `sqlite_geo_nearby`, `sqlite_geo_bounding_box`, `sqlite_geo_cluster`: Wrap handler logic in try-catch with `formatError()` for consistent `{success: false, error: "..."}` responses
  - Added `validateColumnExists()` to validate lat/lon column existence before query execution; previously nonexistent columns silently returned 0 results
  - 6 new error path tests added for nonexistent table and column scenarios
- **Admin Tool Structured Error Responses** — 4 admin tool handlers now return structured errors instead of throwing raw MCP errors
  - `sqlite_virtual_table_info`: Returns `{success: false, error: "Virtual table 'x' not found"}` instead of throwing for nonexistent virtual tables
  - `sqlite_create_view`: Catches duplicate view errors, invalid SQL, and identifier validation failures; returns `{success: false, message: "..."}` with context
  - `sqlite_drop_view`: Catches nonexistent view errors (when `ifExists: false`) and identifier validation failures
  - `sqlite_drop_virtual_table`: Catches nonexistent table errors (when `ifExists: false`) and returns structured response
  - Security tests updated to assert `{success: false, message: /invalid/i}` instead of `.rejects.toThrow()`
- **`sqlite_verify_backup` WASM False Positive** — Now returns WASM limitation error upfront before attempting ATTACH
  - Previously, ATTACH succeeded silently in WASM (creating empty DB in virtual filesystem), causing verify to return `{success: true, valid: true}` for any path including nonexistent files
  - Now checks `isNativeBackend()` first and returns `{success: false, wasmLimitation: true}` immediately
- **`sqlite_restore` WASM False Positive** — Now returns WASM limitation error upfront before attempting ATTACH
  - Previously, ATTACH succeeded silently in WASM, causing restore to "succeed" by copying empty tables from a nonexistent backup
  - Now checks `isNativeBackend()` first and returns `{success: false, wasmLimitation: true}` immediately
- **`sqlite_pragma_table_info` Nonexistent Table Detection** — Returns `{success: false}` for nonexistent tables
  - Previously returned `{success: true, columns: []}` for tables that don't exist
  - Now checks if columns array is empty and returns `{success: false, error: "Table 'x' not found or has no columns"}`
- **Admin Code Mode Positional Parameters** — Added 12 missing entries in `api.ts` for admin group methods
  - `generateSeries`, `createView`, `dropView`, `createSeriesTable`, `virtualTableInfo`, `dropVirtualTable`, `verifyBackup`, `pragmaCompileOptions`, `createRtreeTable`, `createCsvTable`, `analyzeCsvSchema` now support positional arg syntax
  - Example: `sqlite.admin.createView("my_view", "SELECT 1")` now works instead of requiring object syntax
- **Code Mode `normalizeParams` Primitive Type Handling** — Fixed single number/boolean args being passed raw to tool handlers
  - Previously, `sqlite.admin.generateSeries(1, 5, 1)` passed `1` directly instead of `{start: 1, stop: 5, step: 1}`
  - `normalizeParams` now wraps number and boolean single args using the positional parameter mapping, same as strings
  - Affects any method with non-string first positional params (e.g., `generateSeries`, `dbstat`)
  - **`sqlite_stats_correlation` Non-Numeric Column Validation** — Now returns structured error for non-numeric columns
  - Previously returned `{success: true, correlation: null}` when correlating text columns (e.g., `name`, `description`)
  - Now validates column types via `PRAGMA table_info()` and returns `{success: false, code: "INVALID_INPUT"}` with suggestion to use numeric columns
  - Correlation description says "numeric columns" — behavior now enforces this
- **Stats Tool Zod Refinement Leak Fixes** — Moved `.min()/.max()` refinements from Zod schemas to handler-level validation for 3 tools
  - `sqlite_stats_histogram`: Removed `.min(1)` from `buckets` schema parameter; handler now returns `{success: false, error: "'buckets' must be at least 1"}` for invalid values
  - `sqlite_stats_percentile`: Removed `.min(0).max(100)` from `percentiles` array element schema; handler now validates each percentile value is between 0 and 100
  - `sqlite_stats_regression`: Removed `.min(1).max(3)` from `degree` schema parameter; handler now returns structured error for values outside 1-3 range
  - Previously, out-of-range values triggered raw MCP `-32602` errors at the SDK boundary before the handler ran
- **Stats Code Mode Positional Parameters** — Fixed `statsGroupBy` and added 5 missing entries in `api.ts`
  - `statsGroupBy`: Was mapped to `["table", "column"]` but actual params are `["table", "valueColumn", "groupByColumn", "stat"]`
  - Added missing positional mappings for `statsDistinct`, `statsSummary`, `statsFrequency`, `statsOutliers`, `statsHypothesis`
  - All 13 stats methods now support positional arg syntax in `sqlite_execute_code`
- **Code Mode `help()` Write Method Discoverability** — `help()` now lists all methods regardless of `readonly` flag
  - Previously, `readonly: true` filtered write tools before API construction, hiding them from `help()` output
  - Now builds full API surface first, then wraps write methods with readonly guards returning `CODEMODE_READONLY_VIOLATION` errors
  - Users can discover all available methods via `sqlite.core.help()` and get clear error messages when invoking write methods in readonly mode
- **Text Tool Code Mode Positional Parameters** — Fixed 8 broken positional parameter mappings for text tools in `api.ts`
  - `textSplit`, `textConcat`, `textReplace` renamed to `split`, `concat`, `replace` (matching actual method names after prefix stripping)
  - Added 5 missing entries: `trim`, `case`, `substring`, `validate`, `normalize`
  - All text tools now support positional arg syntax in `sqlite_execute_code` (e.g., `sqlite.text.split("table", "col", "@")`)
- **Text Tool Code Mode Alias** — Removed broken `normalize → textNormalize` alias from `METHOD_ALIASES`
  - The canonical method name is `normalize` (not `textNormalize`), so the alias was a no-op pointing to nothing
- **`sqlite_advanced_search` Error Code** — Changed from `executeQuery` to `executeReadQuery` for consistent error codes
  - Nonexistent table errors now return `DB_QUERY_FAILED` code instead of `UNKNOWN_ERROR`
- **Security Integration Tests** — Updated 4 text tool injection tests in `identifier-integration.test.ts`
  - Tests now check for `{success: false, error: /invalid/i}` pattern instead of `.rejects.toThrow()`
  - Consistent with structured error handling across all tool groups
  - Fixed `text_replace` test to use correct parameter names (`searchPattern`/`replaceWith` instead of `search`/`replace`)
- **`createIndex` Code Mode Positional Parameter** — Added missing `indexName` to positional parameter mapping
  - `createIndex` was mapped as `["tableName", "columns"]` but `indexName` is required
  - Code mode calls like `sqlite.core.createIndex("table", ["col"], "idx_name")` now work correctly
- **Text Tool `TABLE_NOT_FOUND` Error Priority** — `validateColumnExists` now checks table existence before column existence
  - Previously returned `COLUMN_NOT_FOUND` when table didn't exist (because `pragma_table_info` returns empty for nonexistent tables)
  - Now returns `TABLE_NOT_FOUND` with suggestion to run `sqlite_list_tables`
  - Gives users a more actionable error message for the root cause
- **`sqlite_phonetic_match` Word-Level Matching** — Now splits column values into words and matches any word
  - Previously computed soundex/metaphone on the entire column value, missing multi-word matches (e.g., "Mouse" didn't match "Mouse Pad XL")
  - Now consistent with `sqlite_advanced_search` phonetic behavior which already matched per-word
  - Both Soundex and Metaphone paths updated; native SQLite soundex query replaced with JS-based word splitting
  - Documentation updated from "compares FIRST word only" to "matches against any word in value"
- **Stats Tool Output Schema Error Responses** — All 13 stats output schemas now accommodate `{success: false}` error responses
  - 10 exported schemas in `output-schemas.ts` and 3 inline schemas in `stats.ts` (outliers, regression, hypothesis) updated
  - Success-specific fields made optional; `error`, `code`, `suggestion` fields added
  - Previously, `formatError()` responses failed Zod output validation because required fields like `column`, `stats`, `count` were missing
  - Mirrors the pattern already used by JSON tool schemas for structured error handling
- **Stats Tools Non-Numeric Column Validation** — `sqlite_stats_percentile`, `sqlite_stats_outliers`, and `sqlite_stats_hypothesis` now validate column types upfront
  - `sqlite_stats_percentile`: Previously produced raw MCP output validation error (string values in numeric schema); now returns `{success: false, code: "INVALID_INPUT"}`
  - `sqlite_stats_outliers`: Previously generated SQL with `NaN` values causing `DB_QUERY_FAILED`; now returns structured error before query execution
  - `sqlite_stats_hypothesis`: Previously returned `UNKNOWN_ERROR` with vague message; now returns `INVALID_INPUT` with clear suggestion
  - Shared `validateNumericColumn()` helper extracted from `createCorrelationTool` for reuse across all three handlers
- **Stats Code Mode Positional Parameters (Round 2)** — Fixed 2 remaining positional parameter mappings in `api.ts`
  - `statsTopN`: Was `["table", "column"]`, missing `n` and `orderDirection` — fixed to `["table", "column", "n", "orderDirection"]`
  - `statsHypothesis`: Had `column` and `testType` swapped — fixed to `["table", "column", "testType"]`
  - `statsHypothesis`: Added missing `expectedMean` as 4th positional param — enables `sqlite.stats.statsHypothesis("table", "col", "ttest_one", 25)` without object syntax
- **Stats Code Mode Positional Parameters (Round 3)** — Added `whereClause` and `selectColumns` to positional parameter mappings in `api.ts`
  - 12 stats methods (`statsBasic`, `statsCount`, `statsGroupBy`, `statsHistogram`, `statsPercentile`, `statsCorrelation`, `statsRegression`, `statsDistinct`, `statsSummary`, `statsFrequency`, `statsOutliers`, `statsHypothesis`) now accept trailing `whereClause` positional arg
  - `statsTopN`: Added `selectColumns` as 5th positional param — enables `sqlite.stats.statsTopN("table", "col", 3, "desc", ["id", "name"])` without object syntax
  - Previously, trailing positional args for `whereClause` and `selectColumns` were silently dropped
- **Stats Code Mode Help Examples** — Fixed incorrect method names in `GROUP_EXAMPLES` for stats group
  - `sqlite.stats.basic()` → `sqlite.stats.statsBasic()`, `.histogram()` → `.statsHistogram()`, `.percentile()` → `.statsPercentile()`
  - Stats group uses `KEEP_PREFIX_GROUPS` so methods retain the `stats` prefix; examples now match actual API
- **Stats Tools Numeric Column Validation (Round 2)** — Added `validateNumericColumn` to 4 additional stats tools
  - `sqlite_stats_basic`: Previously returned meaningless results (sum: 0, avg: 0, min/max: null) for text columns; now returns structured `INVALID_INPUT` error
  - `sqlite_stats_histogram`: Previously generated corrupt SQL with NaN bucket boundaries for text columns; now returns structured error before query execution
  - `sqlite_stats_regression`: Previously returned raw MCP output validation error (NaN coefficients) for text columns; now validates both xColumn and yColumn upfront
  - `sqlite_stats_group_by`: Previously returned `stat_value: 0` for AVG/SUM/MIN/MAX on text columns; now validates valueColumn is numeric for non-count aggregations (count stat remains unrestricted)
- **Stats Code Mode Positional Parameters (Round 4)** — Fixed `statsCount` missing `distinct` in positional parameter mapping
  - Was `["table", "column", "whereClause"]` — `distinct` boolean passed as 3rd arg was mapped to `whereClause`, causing Zod validation error
  - Fixed to `["table", "column", "distinct", "whereClause"]` — enables `sqlite.stats.statsCount("table", "col", true)` syntax
- **Codemode Positional Parameter Mapping** — Fixed incorrect parameter name mappings in `api.ts`
  - `readQuery` and `writeQuery` mapped to `"sql"` but actual schema uses `"query"` — corrected
  - `describeTable`, `dropTable`, `getIndexes` mapped to `"table"` but actual schema uses `"tableName"` — corrected
  - `createTable`, `createIndex` first positional param mapped to `"table"` instead of `"tableName"` — corrected
  - `ServerInstructions.ts` examples updated to match corrected mappings
- **Codemode JSON Positional Parameter Mapping** — Fixed 16 incorrect parameter mappings for JSON code mode methods
  - `validatePath`, `pretty`, `valid` were mismapped to `["table", "column", ...]` instead of `"path"`, `"json"`, `"json"` respectively
  - `extract`, `set`, `remove`, `type`, `arrayLength`, `arrayAppend`, `keys`, `each`, `update`, `merge` were missing `whereClause` positional param
  - `insert` missing `data`, `select` missing `paths`, `query` missing `filterPaths` params
  - Calling `sqlite.json.extract("table", "col", "$.path", "id = 1")` now correctly maps the 4th arg to `whereClause`
- **`sqlite_create_index` Misleading Message for Duplicate Index Name** — Fixed IF NOT EXISTS returning false "created" message
  - When an index name already exists, `CREATE INDEX IF NOT EXISTS` silently does nothing but the handler always reported "created on table(column)"
  - Now checks index existence before executing and returns `"already exists (no changes made)"` when the index is pre-existing
  - Mirrors the pattern already used by `sqlite_create_table` for duplicate table names
- **`sqlite_execute_code` Negative `memoryUsedMb` Values** — Clamped memory metric to `Math.max(0, ...)`
  - Both `worker-sandbox.ts` and `sandbox.ts` measured heap delta on the main thread, which could go negative due to GC during worker execution
  - Values like `-4.76 MB` are now reported as `0 MB` instead
- **`sqlite_write_query` Statement Type Validation** — Now rejects non-DML statements with structured errors
  - Only allows INSERT, UPDATE, DELETE, and REPLACE statements
  - SELECT, PRAGMA, EXPLAIN, and DDL (CREATE, ALTER, DROP, TRUNCATE) are rejected with clear error messages
  - Prevents accidental data loss from DDL via write_query (previously accepted and executed `DROP TABLE`)
- **WASM FTS5 Tool Exclusion** — FTS5 tools no longer registered in WASM mode
  - Removed `getFtsTools()` from shared WASM tool index (`tools/index.ts`)
  - FTS5 tools (`sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`) remain available in native mode only
  - Previously, 4 FTS5 tools were registered in WASM but always returned `{success: false, error: "FTS5 module unavailable"}`
  - WASM tool counts corrected: `starter` 48→44, `search` 36→32, `full` 102→98, `text` group 17→13
  - Updated README.md, DOCKER_README.md, ToolConstants.ts, ServerInstructions.ts
  - Updated fts.test.ts and index.test.ts to verify exclusion
- **`sqlite_create_json_collection` Non-Atomic Table Creation** — Index path validation now runs before table creation
  - Previously, the table was created first, then index paths were validated one-by-one
  - An invalid index path returned `{success: false}` but left the table behind (partial creation)
  - Now validates all index paths upfront before executing `CREATE TABLE`
  - **DOCKER_README Documentation Sync** — Synchronized Docker Hub README with main README content
  - Added Resources (8) table with efficiency tip and Prompts (10) table
  - Added SQLite Extensions section with Docker-specific SpatiaLite/CSV instructions
  - Added OAuth 2.1 supported scopes table and Docker quick start example
  - Added stateless mode section for serverless Docker deployments
  - Added performance tuning tip for schema cache TTL configuration
  - Expanded HTTP endpoints from bullet list to table format with session management details
  - Fixed formatting bug: unclosed 4-backtick code block in legacy syntax section
- **README Streamlining** — Removed redundant sections to reduce README from 712 to ~590 lines
  - Removed Table of Contents (GitHub renders one natively)
  - Merged Quick Test into Quick Start as a "Verify It Works" substep
  - Removed Security Features checklist (duplicated by "What Sets Us Apart" table)
  - Removed Tool Categories table (redundant with Tool Groups table in Tool Filtering)
  - Removed Backend Options table and Transaction/Window tool listings (reference-level detail for Wiki)
  - Merged standalone Configuration section into OAuth section as a one-liner
  - Promoted Extensions, Resources, and Prompts to top-level sections
- **ESLint v10 Compatibility** — Fixed 11 new lint errors introduced by the ESLint v10 major upgrade
  - Added `{ cause }` to re-thrown errors in `NativeSqliteAdapter.ts`, `spatialite.ts`, `SqliteAdapter.ts` (`preserve-caught-error`)
  - Removed useless initial assignments in `SchemaManager.ts`, `SqliteAdapter.ts`, `admin.ts`, `stats.ts` (`no-useless-assignment`)
  - Fixed unsafe `express.json()` call in `http.ts` (`no-unsafe-call`)
- Added `lint:json` npm script for agent-readable ESLint output (`eslint-results.json`)
- Added `.gitattributes` to normalize line endings to LF on all platforms
- Added test suite badges (941 tests, 80% coverage) to both READMEs

### Security

- **NPM Audit Remediation** — Patched high severity vulnerabilities in transitive dependencies
  - `@hono/node-server`: updated to 1.19.11
  - `hono`: updated to 4.12.5
- **Docker CVE Remediation** — Patched npm-bundled transitive dependencies in Dockerfile (both stages)
  - `tar`: 7.5.7 → 7.5.8 (CVE-2026-26960: path traversal, HIGH 7.1)
  - `minimatch`: 10.1.2 → 10.2.4 (CVE-2026-26996: ReDoS, HIGH 8.7)
- **Security Audit Remediation** — Addressed findings from exhaustive codebase security audit
  - CI `npm audit` gate now hard-fails on moderate+ vulnerabilities (removed `continue-on-error`)
  - Added `Referrer-Policy` and `Strict-Transport-Security` HTTP security headers (5 → 7 total)
  - WHERE clause validation now blocks `; SELECT` stacked query injection
  - Removed dead `new InvalidTokenError()` construction in auth middleware
  - Updated `SECURITY.md` supported versions to `1.x.x`
  - Fixed Dockerfile labels (version `1.0.2`, tool count `124`)

---

## [1.0.2] - 2026-02-04

### Added

- GitHub Release badge to READMEs (dynamic version display)

---

## [1.0.1] - 2026-02-04

### Added

- **npm Publishing** — Automated npm publishing workflow on GitHub releases
  - `publish-npm.yml`: NPM publish workflow triggered on release events
  - `.npmignore`: Reduces npm package size from 2.5MB to ~200KB
- **README Badges** — npm version, Docker pulls, MCP Registry badges
- **MCP Registry Integration** — `server.json` with npm + Docker packages

### Fixed

- MIT license badge color (yellow → blue) for consistency

---

## [1.0.0] - 2026-02-04

### Added

- **Docker Release Infrastructure** — Complete CI/CD pipeline for Docker Hub publishing
  - `lint-and-test.yml`: CI workflow with Node.js 22/24/25 matrix testing, ESLint, TypeScript checks
  - `docker-publish.yml`: Docker deploy workflow with security scanning, multi-platform builds (amd64/arm64), manifest merge
  - `Dockerfile`: Multi-stage build with better-sqlite3 native compilation, non-root user, security patches
  - `.dockerignore`: Excludes dev files, tests, and databases from image
  - `DOCKER_README.md`: Docker Hub README with quick start, tool filtering, security documentation
  - `DOCKER_DEPLOYMENT_SETUP.md`: Setup guide for GitHub secrets and deployment workflow

### Added

- **Security Test Coverage Expansion** — 12 new/enhanced test files improving coverage for security-critical utilities
  - `tests/utils/quoteIdentifier.test.ts`: 32 tests for identifier sanitization edge cases (empty, whitespace, control chars, quotes)
  - `tests/security/validateQuery.test.ts`: 23 tests for `DatabaseAdapter.validateQuery` security patterns
  - `tests/adapters/sqlite/resources.test.ts`: 10 tests for all 8 MCP resource handlers
  - `tests/adapters/sqlite/prompts.test.ts`: 16 tests for all 10 MCP prompt handlers
  - `tests/utils/insightsManager.test.ts`: 16 tests for the insights memo singleton
  - `tests/utils/progress-utils.test.ts`: 17 tests for MCP progress notification utilities
  - `tests/utils/annotations.test.ts`: 21 tests for tool and resource annotation presets
  - `tests/adapters/sqlite/json-utils.test.ts`: 67 tests for JSON normalization, JSONB support, SQL generation, validation
  - `tests/adapters/sqlite-native/NativeSqliteAdapter.test.ts`: 39 tests for native adapter (connection, queries, schema, capabilities)
  - Enhanced `logger.test.ts` with 7 additional ModuleLogger convenience method tests (notice, warn, warning, critical, alert, emergency)
  - Enhanced `security-injection.test.ts` with `sanitizeWhereClause` tests
  - Enhanced `ToolFilter.test.ts` with edge case tests (comma-only strings, meta-group exclusion, summary generation)
  - Coverage improvements: `identifiers.ts` 65→97%, `where-clause.ts` 80→100%, `ToolFilter.ts` 91→96%, `resources.ts` 22→97%, `prompts.ts` 23→87%, `insightsManager.ts` 22→100%, `progress-utils.ts` 0→100%, `annotations.ts` 90→100%, `resourceAnnotations.ts` 66→100%, `json-utils.ts` 43→97%, `logger.ts` 85→97%, `NativeSqliteAdapter.ts` 49→65%+

### Changed

- **ServerInstructions.ts Admin Tool Documentation** — Improved admin tool documentation clarity
  - `sqlite_dbstat`: Clarified JS fallback provides counts only (not per-table stats); updated WASM vs Native table
  - `sqlite_pragma_compile_options`: Added note that WASM may show FTS3, not FTS5
  - R-Tree and CSV tools: Clarified these return graceful errors with `wasmLimitation: true` in WASM mode

- **ServerInstructions.ts Text Tool Documentation** — Improved fuzzy_match and phonetic_match examples
  - Clarified tokenize behavior: `tokenize:false` for full-string matching vs default token mode
  - Added `includeRowData:false` tip for phonetic matching to reduce payload size
  - Fixed example search term ("laptop" instead of "laptp" for clearer demonstration)

- **`sqlite_dbstat` Response Field Naming** — Renamed response fields for clarity when using `summarize: true`
  - Changed `tableCount` to `objectCount` and `tables` to `objects`
  - dbstat returns storage stats for all database objects (tables and indexes), not just tables
  - More accurately reflects the actual content of the response

### Added

- **`sqlite_spatialite_analyze` Geometry Output Control** — New `includeGeometry` parameter to reduce payload size
  - When `false` (default), omits full WKT geometry from `nearest_neighbor` and `point_in_polygon` results
  - When `true`, includes `source_geom` and `target_geom` WKT fields as before
  - Significantly reduces payload size for proximity analysis (geometry can be 100+ characters per row)

### Changed

- **`sqlite_spatialite_transform` Adaptive Buffer Simplification** — Buffer tolerance now scales with buffer distance
  - Default tolerance changed from fixed 0.0001 to adaptive `max(0.0001, distance * 0.01)`
  - Larger buffers (e.g., 0.1 degrees) now produce ~50 vertices instead of 96+ for more compact WKT
  - Smaller buffers retain precision with the 0.0001 floor

- **`sqlite_index_stats` System Index Filter** — New `excludeSystemIndexes` parameter to hide SpatiaLite system indexes
  - When `true` (default), filters out SpatiaLite system indexes (`idx_spatial_ref_sys`, `idx_srid_geocols`, `idx_viewsjoin`, `idx_virtssrid`)
  - Provides parity with `sqlite_dbstat` and `sqlite_list_tables` system table filtering
  - Set to `false` to include all indexes

### Changed

- **`sqlite_pragma_compile_options` Description** — Enhanced tool description to mention filter parameter
  - Description now notes "Use the filter parameter to reduce output (~50+ options by default)"
  - Helps agents know upfront how to avoid large payloads

- **`sqlite_dbstat` Parameter Clarification** — Updated `excludeSystemTables` description for accuracy
  - Description now clarifies it filters "SpatiaLite system tables and indexes" (not just tables)
  - Reflects actual filtering behavior which includes SpatiaLite indexes in dbstat output

- **`sqlite_dbstat` FTS5 Shadow Table Filtering** — Now filters FTS5 shadow tables when `excludeSystemTables: true`
  - Previously `excludeSystemTables` only filtered SpatiaLite system tables/indexes
  - Now also filters FTS5 shadow tables (`*_fts_data`, `*_fts_config`, `*_fts_docsize`, `*_fts_idx`, etc.)
  - Applies to both summarize mode and raw page-level mode

- **JSON Tool Naming Consistency** — Renamed `sqlite_analyze_json_schema` to `sqlite_json_analyze_schema`
  - Aligns with the `sqlite_json_*` prefix pattern used by all other tools in the JSON group
  - Updated ToolConstants.ts, ServerInstructions.ts, json-helpers.ts, and output-schemas.ts

- **ServerInstructions.ts Core Tools Documentation** — Removed confusing `sqlite_list_views` reference from `sqlite_list_tables` description
  - `sqlite_list_views` is in the admin group, not core; reference was misleading in core tools table
  - Simplified description to: "List tables with column counts (excludeSystemTables hides SpatiaLite tables)"

- **Modern MCP SDK API Migration** — Removed all `eslint-disable` comments
  - `McpServer.ts`: Migrated built-in tools (`server_info`, `server_health`, `list_adapters`) from deprecated `server.tool()` to `server.registerTool()` API
  - `SqliteAdapter.ts` and `NativeSqliteAdapter.ts`: Migrated from deprecated `server.resource()` and `server.prompt()` to modern `server.registerResource()` and `server.registerPrompt()` APIs
  - `middleware.ts`: Replaced global namespace extension with proper Express module augmentation pattern (`declare module "express-serve-static-core"`)
  - `progress-utils.ts`: Replaced deprecated `Server` type import with structural interface (`NotificationSender`)
  - `logger.ts`: Replaced control character regex literals with dynamically constructed `RegExp` using `String.fromCharCode()` to satisfy `no-control-regex` rule

- **`sqlite_generate_series` Pure JS Implementation** — Removed unnecessary native SQLite attempt
  - better-sqlite3's bundled SQLite lacks `SQLITE_ENABLE_SERIES` compile option
  - Native `generate_series()` virtual table was always failing, wasting a database call
  - Now generates directly in JavaScript, eliminating the failed native attempt overhead

### Fixed

- **`sqlite_vector_search` returnColumns Consistency** — Fixed `returnColumns` being ignored for euclidean/dot metrics
  - Previously, `returnColumns` only filtered output when using cosine similarity; euclidean and dot returned all columns
  - Now consistently applies column filtering after similarity calculation for all three metrics
  - Reduces payload size for non-cosine searches (previously ~3x larger due to full embedding vectors in output)

### Changed

- **ServerInstructions.ts `sqlite_stats_top_n` Documentation** — Strengthened payload optimization guidance
  - Changed comment from passive note to explicit ⚠️ warning: "Always use selectColumns to avoid returning all columns (large payloads with text fields)"
  - Emphasizes importance of column selection to reduce token usage

### Added

- **`sqlite_dbstat` System Table Filter** — New `excludeSystemTables` parameter to hide SpatiaLite metadata
  - When `true`, filters out SpatiaLite system tables from storage statistics (57 tables → ~12 user tables)
  - Applies to both summarize mode and default raw page-level mode
  - Provides parity with `sqlite_list_tables` and `sqlite_get_indexes` system table filtering
  - Default is `false` to preserve backward compatibility

- **`sqlite_list_tables` Tool Description** — Fixed misleading "row counts" description
  - Changed tool description in `core.ts` from "row counts" to "column counts" to match actual output
  - Tool returns `columnCount` per table, not row counts

- **`sqlite_json_normalize_column` Output Format Control** — New `outputFormat` parameter for normalization output
  - `preserve` (default): Keeps original format (text→text, JSONB→JSONB)
  - `text`: Always outputs normalized JSON as text
  - `jsonb`: Outputs normalized JSON in JSONB binary format
  - Enables normalizing JSONB columns without losing binary format efficiency
  - Response includes `outputFormat` field indicating which format was applied

### Changed

- **`sqlite_json_normalize_column` Default Behavior** — Changed default `outputFormat` from `text` to `preserve`
  - Prevents accidental JSONB-to-text conversion when normalizing columns that were previously converted to JSONB
  - Use explicit `outputFormat: "text"` when text output is specifically needed

### Changed

- **ServerInstructions.ts `sqlite_json_each` Payload Warning** — Added explicit warning about output row multiplication
  - Comment now reads: "Note: json_each multiplies output rows—use limit param for large arrays"
  - Example updated to include `limit: 50` parameter to demonstrate payload control

- **ServerInstructions.ts SpatiaLite Analyze Documentation** — Improved tool documentation clarity
  - Added explicit `analysisType` options: `spatial_extent | point_in_polygon | nearest_neighbor | distance_matrix`
  - Documented `excludeSelf` parameter for same-table nearest_neighbor/distance_matrix queries
  - Added note clarifying that distances are returned in **Cartesian (degrees)**, not geodetic (km/miles)

### Changed

- **`sqlite_drop_virtual_table` Regular Table Validation** — Now validates target is actually a virtual table
  - Returns helpful error message if attempting to drop a regular table, directing to use `sqlite_drop_table` instead
  - Prevents accidental misuse of virtual table drop tool on regular tables

- **`sqlite_dbstat` WASM Fallback Enhancement** — Added table count to basic stats in WASM mode
  - When dbstat virtual table is unavailable, now returns `tableCount` in addition to `pageCount`
  - Provides more useful context about database contents

- **CSV Tool Messages WASM Clarity** — Improved error messages for `sqlite_create_csv_table` and `sqlite_analyze_csv_schema`
  - When running in WASM mode, now explicitly states "CSV extension not available in WASM mode"
  - Previously showed generic message about loading extension, which was misleading in WASM context
  - `wasmLimitation` flag is now dynamic based on actual runtime environment

- **ServerInstructions.ts CSV Documentation** — Added WASM limitation note to CSV tool examples
  - Comment now reads "Native only - not available in WASM" for clarity

- **ServerInstructions.ts `sqlite_list_tables` Documentation** — Clarified that views are listed via `sqlite_list_views`
  - Updated description to note that views require `sqlite_list_views` from admin group

### Changed

- **`sqlite_vector_search` Payload Optimization** — Vector data now excluded from results when not explicitly requested
  - When `returnColumns` is specified without the vector column, results omit vector data for smaller payloads
  - Reduces response size significantly for high-dimensional vectors (e.g., 384+ dimensions)
  - Vector data still included when `returnColumns` is empty or explicitly includes the vector column

- **ServerInstructions.ts Vector Tool Documentation** — Expanded vector section with all 11 tool examples
  - Added missing tools: `sqlite_vector_batch_store`, `sqlite_vector_get`, `sqlite_vector_delete`, `sqlite_vector_count`, `sqlite_vector_dimensions`
  - Added documentation note about `returnColumns` payload optimization

- **ServerInstructions.ts Admin Tool Documentation** — Expanded Database Administration section with all admin tool examples
  - Added 20+ missing examples: views (`sqlite_create_view/drop_view/list_views`), virtual tables, backup/restore/verify
  - Added PRAGMA utilities (`sqlite_pragma_compile_options/database_list/optimize`), `sqlite_index_stats`, `sqlite_dbstat`
  - Added `sqlite_generate_series`, `sqlite_create_series_table`, `sqlite_create_rtree_table`, `sqlite_append_insight`

### Fixed

- **`sqlite_backup` WASM Consistent Error Response** — Backup now returns `success: false` upfront in WASM mode
  - Previously, backup attempted `VACUUM INTO` then caught errors, leading to inconsistent behavior: sometimes succeeding to ephemeral VFS, sometimes failing on path resolution
  - Now checks `isNativeBackend()` first and returns `{success: false, wasmLimitation: true}` immediately
  - Consistent with `sqlite_restore` and `sqlite_verify_backup` which already had upfront WASM checks
  - Native mode behavior unchanged: backup still uses `VACUUM INTO` and returns structured errors on failure

- **Stats Tool Group Bug Fixes** — Resolved 6 issues from comprehensive tool testing
  - `sqlite_stats_histogram`: Fixed off-by-one bucket boundary that excluded max values (now uses `<=` for final bucket)
  - `sqlite_stats_summary`: Auto-filters to numeric columns when no columns specified (prevents string min/max errors)
  - `sqlite_stats_correlation`: Returns `null` instead of `NaN` for invalid correlations (schema-safe)
  - `sqlite_stats_hypothesis`: Validates t-statistic is finite before returning (catches zero variance/non-numeric columns)
  - `sqlite_stats_basic`: Ensures numeric type coercion for all stat values (converts strings to numbers or null)
  - `sqlite_stats_group_by`: Validates both `valueColumn` and `groupByColumn` exist in table before execution

- **NativeSqliteAdapter Missing Method** — Added `getConfiguredPath()` to match SqliteAdapter interface
  - `sqlite_pragma_database_list` tool was failing in native mode due to missing method
  - Now returns configured database path consistently across WASM and Native adapters

- **`sqlite_dbstat` Table-Specific WASM Fallback** — Improved fallback when dbstat virtual table unavailable
  - Previously, the `table` parameter was ignored in WASM mode, returning only total database page count
  - Now provides table-specific estimates: `rowCount`, `estimatedPages` (~100 rows/page), and `totalDatabasePages`
  - Returns `success: false` with appropriate message if specified table doesn't exist

- **`sqlite_drop_virtual_table` Accurate Messaging** — Fixed misleading success message for non-existent tables
  - Previously, dropping a non-existent table with `ifExists: true` reported "Dropped virtual table 'x'"
  - Now returns accurate message: "Virtual table 'x' did not exist (no action taken)"
  - Helps distinguish between actual drops and no-op operations

- **FTS5 Tools WASM Upfront Check** — `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info` now check FTS5 availability upfront
  - Previously, these tools threw raw "no such table" SQL errors in WASM mode when FTS tables couldn't be created
  - Now return graceful error response with hint before attempting any SQL execution
  - Consistent with `sqlite_fts_create` which already had upfront FTS5 detection

- **WASM Adapter Templated Resource Support** — Fixed `sqlite://table/{name}/schema` resource returning "not found" in WASM mode
  - Ported `ResourceTemplate` handling from `NativeSqliteAdapter` to `SqliteAdapter`
  - Templated resources now properly register with MCP SDK's `ResourceTemplate` class
  - Both static and templated resources now work consistently across WASM and Native backends

- **Index Column Population in WASM Adapter** — Fixed `sqlite://indexes` resource returning empty `columns` array
  - Added `PRAGMA index_info()` queries to populate column names for each index
  - Updated both `SchemaManager.getAllIndexes()` and `SqliteAdapter.getIndexes()` fallback
  - Index metadata now matches Native adapter behavior

### Changed

- **`sqlite_pragma_database_list` Configured Path Visibility** — Added `configuredPath` field to output
  - WASM mode shows internal virtual filesystem paths (e.g., `/dbfile_3503536817`) which can confuse users
  - Now includes `configuredPath` showing the user's original database file path
  - Adds explanatory `note` when internal path differs from configured path

### Dependencies

- **Dependency Updates** — Updated npm dependencies to latest versions
  - `@types/node`: 25.1.0 → 25.2.0
  - `globals`: 17.2.0 → 17.3.0
  - `pg`: 8.17.2 → 8.18.0

### Changed

- **ServerInstructions.ts FTS5 Documentation** — Added note that FTS5 virtual tables and shadow tables are hidden from `sqlite_list_tables` for cleaner output

- **`sqlite_fuzzy_match` Token-Based Matching** — Now matches against word tokens by default instead of entire column value
  - New `tokenize` parameter (default: `true`) splits column values into words for per-token comparison
  - "laptop" now matches "Laptop Pro 15" (distance 0 on first token)
  - Output includes `matchedToken` and `tokenDistance` for transparency
  - Set `tokenize: false` to restore legacy behavior (match entire column value)
  - Removed full row data from output for token efficiency (just `value` and match info)
  - Updated `ServerInstructions.ts` documentation with new behavior

- **ServerInstructions.ts `generate_series` Documentation** — Clarified JS fallback behavior
  - Changed WASM vs Native table entry from "✅ native | ❌ | JS" to "JS fallback | JS fallback | —"
  - The generate_series extension is not compiled into SQLite, so both environments use the JavaScript fallback

- **`sqlite_phonetic_match` Documentation** — Updated matching behavior description
  - Changed from "compares FIRST word only" to "matches against any word in value"

- **`sqlite_json_keys` Documentation** — Clarified distinct key behavior
  - Updated description to note tool returns unique keys across all matching rows, not per-row keys

- **ServerInstructions.ts Stats Group Documentation** — Clarified window function grouping
  - Line 70: Changed "Window functions (6 tools)" to "Window functions (6 tools in stats group)"
  - Line 89: Changed "Stats(13-19)" to "Stats(19: 13 core + 6 window)" for clearer tool count breakdown

### Added

- **`sqlite_list_views` System View Filter** — New `excludeSystemViews` parameter to hide SpatiaLite views
  - When `true` (default), filters out SpatiaLite system views (`geom_cols_ref_sys`, `spatial_ref_sys_all`, `vector_layers`, etc.)
  - Reduces noise in view listings for spatial databases (7 views → 1 user view)
  - Set to `false` to include all views

- **`sqlite_get_indexes` System Index Filter** — New `excludeSystemIndexes` parameter to hide SpatiaLite indexes
  - When `true`, filters out SpatiaLite system indexes (`idx_spatial_ref_sys`, `idx_srid_geocols`, `idx_viewsjoin`, `idx_virtssrid`, etc.)
  - Provides parity with `sqlite_list_tables` parameter `excludeSystemTables`
  - Default is `false` to preserve backward compatibility

- **`sqlite_list_tables` System Table Filter** — New `excludeSystemTables` parameter to hide SpatiaLite metadata
  - When `true`, filters out SpatiaLite system tables (`geometry_columns`, `spatial_ref_sys`, `spatialite_history`, `vector_layers`, etc.)
  - Reduces noise in table listings for spatial databases (38 tables → 12 user tables)
  - Default is `false` to preserve backward compatibility

### Changed

- **CSV Tools Path Validation** — Improved error messages for `sqlite_create_csv_table` and `sqlite_analyze_csv_schema`
  - Now validates that file paths are absolute before attempting to create virtual table
  - Returns helpful error message with suggested absolute path when relative path is provided
  - Example: `"Relative path not supported. Please use an absolute path. Example: C:\\path\\to\\file.csv"`

- **ServerInstructions.ts FTS5 Documentation** — Fixed incomplete FTS5 example
  - Added required `sqlite_fts_rebuild` call after `sqlite_fts_create` (indexes are empty until rebuild)
  - Fixed parameter names: `table` → `tableName`/`sourceTable` to match actual tool schema
  - Added clarifying comment explaining that triggers sync future changes but don't populate existing data

### Fixed

- **`sqlite_list_tables` KNN2 Virtual Table** — KNN2 SpatiaLite virtual table now filtered by `excludeSystemTables`
  - Added "KNN2" to the SpatiaLite system table exclusion list
  - Previously KNN2 was shown despite `excludeSystemTables=true`

- **`sqlite_json_group_object` Aggregate Function Support** — New `aggregateFunction` parameter for aggregate values
  - Enables `COUNT(*)`, `SUM(amount)`, `AVG(price)`, and other aggregate functions as object values
  - Uses subquery pattern to pre-aggregate results before wrapping in `json_group_object()`
  - Example: `sqlite_json_group_object({ table: "events", keyColumn: "event_type", aggregateFunction: "COUNT(*)" })`
  - `allowExpressions` parameter clarified: supports column extraction only, NOT aggregate functions
  - **New**: Returns `hint` warning when using `allowExpressions` without `groupByColumn` (duplicate keys may result if key values aren't unique)

### Fixed

- **`server_health` SpatiaLite Status** — Health check now reports accurate SpatiaLite extension status
  - Previously hardcoded `spatialite: false` regardless of actual extension state
  - Now calls exported `isSpatialiteLoaded()` to reflect runtime extension status
  - Helps users confirm SpatiaLite is loaded before using spatial tools

### Changed

- **`sqlite_list_tables` Documentation** — Updated tool description in ServerInstructions.ts
  - Now mentions `excludeSystemTables` parameter for filtering SpatiaLite metadata

- **ServerInstructions.ts SpatiaLite Tool Count** — Improved documentation clarity
  - Changed "SpatiaLite GIS (7 of 11 geo tools)" to "SpatiaLite GIS (7 tools; 4 basic geo always work)"
  - Clarifies that 7 tools require SpatiaLite while 4 basic Haversine-based tools work in any mode

- **`sqlite_json_normalize_column` JSONB Conversion Consistency** — JSONB rows now always converted to normalized text format
  - Previously, JSONB rows with already-normalized content were left unchanged (still in JSONB binary format)
  - Handler now detects original storage format and forces text output for all JSONB rows
  - Ensures uniform text JSON format after normalization, avoiding mixed format scenarios

- **`sqlite_stats_hypothesis` Chi-Square Validation** — Added validation for insufficient categories
  - Chi-square test now throws descriptive error when df=0 (fewer than 2 categories in either column)
  - Previously returned mathematically meaningless results (p=1, df=0) without warning
  - Error message includes actual category counts for both columns to help users diagnose the issue

- **`sqlite_json_storage_info` Mixed Format Recommendation** — Fixed misleading recommendation when column has both text and JSONB rows
  - Now detects mixed format scenarios and recommends running `sqlite_jsonb_convert` to unify storage
  - Previously reported "Column already uses JSONB format" even when 50% of rows were still text JSON

### Changed

- **`sqlite_spatialite_transform` Buffer Auto-Simplification** — Buffer operation now auto-simplifies output by default
  - Reduces verbose WKT payload from ~2KB (64-point circle) to ~200 bytes
  - Default tolerance 0.0001 is suitable for lat/lon coordinates
  - Set `simplifyTolerance: 0` to disable auto-simplification for full precision output
  - Updated `ServerInstructions.ts` with clarified documentation on distance parameter usage

- **`sqlite_transaction_execute` SELECT Row Data** — SELECT statements now return actual row data
  - Results include `rowCount` and `rows` fields for SELECT statements instead of just `rowsAffected: 0`
  - Enables read-modify-read patterns within atomic transactions
  - Write statements continue to return `rowsAffected` as before

- **`sqlite_dbstat` Limit Parameter** — Added configurable `limit` parameter (default: 100)
  - Controls maximum number of tables/pages returned in both summarized and raw modes
  - Helps reduce payload size for large databases
  - Previously hardcoded to 100; now user-configurable

### Changed

- **`sqlite_fuzzy_match` Documentation** — Clarified that Levenshtein distance is computed against entire column values
  - Updated description to note comparison is against whole values, not word tokens
  - Added guidance to use maxDistance 1-3 for similar-length strings
  - This is expected behavior; documentation now makes it explicit

- **`sqlite_advanced_search` Parameter Guidance** — Added threshold tuning guidance for `fuzzyThreshold`
  - Parameter description now includes: "0.3-0.4 for loose matching, 0.6-0.8 for strict matching"
  - Added inline example: "e.g., 'laptob' matches 'laptop'"
  - Helps users understand how to tune the similarity threshold for their use case

- **ServerInstructions.ts Stats Tool Documentation** — Added `selectColumns` example for `sqlite_stats_top_n`
  - Documents payload optimization pattern for retrieving only required columns
  - Helps reduce response size when querying tables with large text fields

- **ServerInstructions.ts Text Processing Documentation** — Expanded TOOL_REFERENCE examples
  - Added `sqlite_regex_extract` example with capture groups
  - Added `sqlite_text_split`, `sqlite_text_concat`, `sqlite_text_normalize` examples
  - Added `sqlite_phonetic_match` example with soundex algorithm
  - Clarified fuzzy match behavior: "compares against ENTIRE column value, not word tokens"
  - Added `fuzzyThreshold` tuning guidance comment in `sqlite_advanced_search` example

- **`sqlite_spatialite_analyze` Self-Match Filtering** — Added `excludeSelf` parameter (default: true)
  - When sourceTable equals targetTable in nearest_neighbor analysis, self-matches (distance=0) are now filtered
  - Set `excludeSelf: false` to include self-matches in results
  - Reduces noise in proximity analysis results

- **`sqlite_spatialite_transform` Buffer Simplification** — Added `simplifyTolerance` parameter
  - Optional simplification applied to buffer operation output to reduce vertex count
  - Recommended values: 0.0001-0.001 for lat/lon coordinates
  - Reduces payload size for large buffer polygons (96+ vertices → fewer)

- **`sqlite_spatialite_analyze` Documentation** — Improved tool description
  - Clarified that point_in_polygon requires POINTs in sourceTable and POLYGONs in targetTable
  - Updated targetTable parameter description with geometry type guidance

- **ServerInstructions.ts Vector Tool Documentation** — Expanded vector section with utility tool examples
  - Added `sqlite_vector_normalize`, `sqlite_vector_distance`, and `sqlite_vector_stats` examples
  - Utility tools help with pre-processing embeddings before storage

- **`sqlite_text_split` Per-Row Output Structure** — Improved output for row traceability
  - Changed from flat `parts[]` array to structured per-row results
  - Each row now includes `rowid`, `original` value, and `parts` array
  - Enables correlation between split results and source rows

### Fixed

- **`sqlite_text_split` WASM Rowid Bug** — Fixed rows returning `rowid: 0` for all results
  - Changed SQL query from `SELECT rowid, column` to `SELECT rowid as id, column` for consistent behavior
  - SQL.js (WASM) does not handle unaliased `rowid` column correctly; aliasing ensures proper value retrieval
  - Native SQLite (better-sqlite3) was unaffected, but now uses consistent query pattern

- **`sqlite_list_tables` FTS5 Table Visibility** — FTS5 virtual tables and shadow tables now hidden
  - Virtual tables ending with `_fts` (e.g., `articles_fts`) are now filtered from output
  - Shadow tables containing `_fts_` (e.g., `articles_fts_config`, `articles_fts_data`) already filtered
  - Internal FTS5 implementation details no longer clutter table listings in native mode

- **`sqlite_text_validate` Null Value Display** — Improved accuracy for invalid null/empty values
  - Null/undefined values now display as `null` instead of artificial `"(empty)"` placeholder
  - Long values (>100 chars) are truncated with "..." for readability

### Changed

- **ServerInstructions.ts WASM Tool Count** — Corrected `starter` preset count for WASM mode
  - Changed from 48 to 44 (4 FTS5 tools unavailable in WASM)
  - Added footnote: "_17_ = 13 in WASM (4 FTS5 tools require native)"

### Fixed

- **`sqlite_json_group_array` and `sqlite_json_group_object` groupByColumn Expressions** — Extended `allowExpressions` to also apply to `groupByColumn` parameter
  - Previously `allowExpressions: true` only bypassed validation for `valueColumn`/`keyColumn`, not `groupByColumn`
  - Now enables grouping by JSON path expressions like `json_extract(data, '$.type')`
  - When using expressions for `groupByColumn`, output uses `group_key` alias for clarity

### Changed

- **ServerInstructions.ts JSONB Documentation** — Added note that `sqlite_json_normalize_column` converts JSONB back to text format
  - The `json()` function used for normalization returns text JSON, not JSONB binary
  - Users should run `sqlite_jsonb_convert` after normalization if JSONB format is desired

- **ServerInstructions.ts Text Processing Documentation** — Added inline comment for regex escaping clarity
  - Explains that regex patterns require double-escaping backslashes (`\\\\`) when passing through JSON/MCP transport

### Fixed

- **`sqlite_json_group_array` Expression Support** — Added `allowExpressions` option for consistency with `sqlite_json_group_object`
  - When `allowExpressions: true`, SQL expressions like `json_extract(data, '$.name')` are accepted for `valueColumn`
  - Default behavior unchanged (validates as simple column identifier for security)
  - Enables advanced aggregation patterns combining JSON extraction with grouping

- **`sqlite_json_update` String Value Escaping** — Fixed "malformed JSON" error when updating string values
  - String values now wrapped with `JSON.stringify()` before SQL escaping to produce valid JSON
  - Previously `'New Title'` (invalid JSON) was passed to `json()` instead of `'"New Title"'`

- **`sqlite_spatialite_analyze` Error Message Clarity** — Improved error messages for required parameter validation
  - Changed "Target table required" to "Missing required parameter 'targetTable'" for `nearest_neighbor` and `point_in_polygon` analysis types
  - Clearer messaging helps users identify which parameter they need to provide

- **`sqlite_json_group_array` and `sqlite_json_group_object` Column Naming** — Fixed quoted identifier names appearing in output
  - When using `groupByColumn`, the result column was showing `"type"` (with escaped quotes) instead of `type`
  - Added explicit column aliases (e.g., `"type" AS type`) to produce clean column names in output
  - Affects both tools when `groupByColumn` is specified

- **`sqlite_dbstat` Page Count Inconsistency** — Fixed JS fallback returning inconsistent page counts
  - Properly extracts page_count from PRAGMA result (handles both named and indexed column access)
  - Ensures consistent numeric return value via explicit type coercion

- **False WASM Limitation Detection in Native Mode** — Fixed backup/restore/verify tools incorrectly reporting WASM limitations when running in native mode
  - Added `isNativeBackend()` method to both `SqliteAdapter` (returns false) and `NativeSqliteAdapter` (returns true)
  - `sqlite_backup`, `sqlite_restore`, `sqlite_verify_backup` now only return `wasmLimitation: true` when actually running in WASM mode
  - `sqlite_restore` now attempts to recreate virtual tables (FTS5, R-Tree) in native mode instead of unconditionally skipping them
  - In native mode, actual file system errors are now properly thrown instead of being masked as WASM limitations

### Changed

- **ServerInstructions.ts CSV Path Documentation** — Added absolute path requirement note for CSV tools
  - Updated WASM vs Native table: CSV virtual tables now note "(requires absolute paths)"
  - Added CSV Virtual Tables examples to Database Administration section showing `sqlite_analyze_csv_schema` and `sqlite_create_csv_table` with absolute path usage

- **ServerInstructions.ts Statistical Analysis Examples** — Added missing stats tool examples to TOOL_REFERENCE
  - Added `sqlite_stats_outliers` example with IQR/Z-score method options
  - Added `sqlite_stats_hypothesis` example with one-sample t-test usage

- **JSON Aggregation Tool Documentation** — Clarified `groupByColumn` usage for JSON collection tables
  - Updated `sqlite_json_group_array` and `sqlite_json_group_object` parameter descriptions
  - For JSON collections, must use `allowExpressions: true` with `json_extract(data, '$.field')` for groupByColumn
  - Updated ServerInstructions.ts examples to show both regular table and JSON collection patterns

- **Tool Count Documentation Accuracy** — Fixed tool counts across all documentation files
  - `text` group: 16 → 17 (added fuzzy_match, phonetic_match, text_normalize, text_validate, advanced_search, fts_rebuild, fts_match_info)
  - `admin` group: 32 → 33
  - `starter` preset: 47 → 48
  - `search` preset: 35 → 36
  - `full` preset: 120 → 122 Native, 100 → 102 WASM
  - Updated ToolConstants.ts, ServerInstructions.ts, and README.md

- **ServerInstructions.ts Text Processing Examples** — Updated TOOL_REFERENCE section
  - Fixed `sqlite_fuzzy_search` example to correct tool name `sqlite_fuzzy_match` with proper parameters
  - Replaced generic `sqlite_text_similarity` example with practical `sqlite_text_validate` (email/phone/url/uuid/ipv4)
  - Added `sqlite_advanced_search` example demonstrating multi-technique search (exact/fuzzy/phonetic)

### Fixed

- **`sqlite_create_table` SQL Expression Default Values** — Fixed syntax error when using SQL expressions as default values
  - Expressions like `datetime('now')`, `CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_TIME` now wrapped in parentheses
  - Literal string values continue to be properly single-quoted with escape handling for embedded quotes
  - Added regex detection for function calls (pattern `function_name(...)`) and SQL keywords

- **JSONB Normalize Corruption Fix** — Fixed `sqlite_json_normalize_column` corrupting JSONB columns
  - Changed query to use `json(${column})` SQL function to convert JSONB binary to text before JavaScript processing
  - Previously, JSONB binary blobs were being serialized as numbered-key objects (`{"0":204,"1":95,...}`)
  - Now properly handles both text JSON and JSONB binary format without data loss

- **ServerInstructions.ts Core Tools Table** — Added missing tools to documentation
  - Added `sqlite_drop_table` and `sqlite_get_indexes` to Core Tools table (was only showing 6 of 8 tools)

### Fixed

- **WASM Mode Admin Tool Graceful Handling** — 4 admin tools now return structured errors instead of throwing in WASM mode
  - `sqlite_virtual_table_info`: Returns `moduleAvailable: false` with partial metadata when module unavailable (e.g., FTS5)
  - `sqlite_backup`: Returns `wasmLimitation: true` when file system access unavailable
  - `sqlite_restore`: Returns `wasmLimitation: true` when file system access unavailable
  - `sqlite_verify_backup`: Returns `wasmLimitation: true` when file system access unavailable
  - Added `wasmLimitation` field to `BackupOutputSchema`, `RestoreOutputSchema`, `VerifyBackupOutputSchema`
  - Updated `ServerInstructions.ts` WASM vs Native table with backup/restore, R-Tree, CSV limitations

- **Restore Tool Security Bypass** — `sqlite_restore` now bypasses SQL validation for internal operations
  - Added `skipValidation` optional parameter to `executeWriteQuery()` method signature
  - Internal restore operations (ATTACH, DROP, CREATE, INSERT, DETACH, PRAGMA) pass `skipValidation=true`
  - Prevents false-positive "dangerous patterns" errors from internal SQL comments or multi-statement patterns
  - Security remains intact: bypass only applies to trusted internal operations, not user-provided queries

- **WASM Mode R-Tree/CSV/Restore Graceful Handling** — 4 additional admin tools now return structured errors instead of throwing
  - `sqlite_create_rtree_table`: Returns `success: false` with `wasmLimitation: true` when R-Tree module unavailable
  - `sqlite_analyze_csv_schema`: Returns `success: false` with `wasmLimitation: true` when CSV extension not loaded
  - `sqlite_create_csv_table`: Returns `success: false` with `wasmLimitation: true` when CSV extension not loaded
  - `sqlite_restore`: Now skips virtual tables with unavailable modules (FTS5, R-Tree) instead of failing entire restore
  - Added `skippedTables` and `note` fields to `RestoreOutputSchema` for partial restore reporting

### Changed

- **ServerInstructions.ts Documentation Improvements** — Updated tool filtering reference for accuracy
  - Corrected tool counts to match README (was showing outdated single-column counts)
  - Added WASM/Native columns to shortcut table showing accurate counts per backend
  - Added `spatial` shortcut (23 WASM / 30 Native tools)
  - Added `geo` to groups list (was missing from documentation)
  - Added Fallback column to WASM vs Native table documenting JS fallback availability
  - Documented `generate_series`, `dbstat`, `soundex` JS fallbacks vs extension tools with no fallback
  - Added Database Administration examples section with 6 common admin tools

- **WASM Mode FTS5 Graceful Handling** — FTS5 tools now return helpful errors instead of crashes in WASM mode
  - All 4 FTS5 tools (`sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`) detect "no such module: fts5" errors
  - Returns structured error with `hint` directing to native SQLite backend (`--sqlite-native`)
  - Prevents tool failures when running in WASM mode (sql.js) which lacks FTS5 module

- **WASM Mode Soundex Fallback** — `sqlite_phonetic_match` now works with soundex algorithm in WASM mode
  - JavaScript-based soundex implementation used as fallback when SQLite's native `soundex()` function unavailable
  - Behavior matches metaphone algorithm path (fetch rows, filter in JS)
  - Same output format and accuracy as native soundex
  - Gracefully handles "no such function: soundex" error without user intervention

### Added

- **WASM vs Native Documentation** — Added feature comparison table to `ServerInstructions.ts`
  - Lists FTS5, transactions, window functions, SpatiaLite, and soundex availability
  - Token-efficient format optimized for AI agent consumption

- **Polynomial Regression Support** — `sqlite_stats_regression` now supports degree 1-3 polynomial fits
  - Linear (degree=1), quadratic (degree=2), and cubic (degree=3) regression via OLS normal equation
  - Matrix operations (transpose, multiply, Gauss-Jordan inverse) implemented in pure TypeScript
  - Output includes named coefficients (`intercept`, `linear`, `quadratic`, `cubic`) instead of generic `slope`
  - R² calculation uses sum of squared residuals for accurate goodness-of-fit measurement
  - Equation string displays polynomial terms (e.g., `y = 2.0000x² + 3.0000x + 5.0000`)

- **WASM Mode Core Tool Compatibility** — Fixed issues discovered during WASM mode testing
  - `server_health` now correctly reports `filePath` from `connectionString` when `filePath` is not set
  - `sqlite_list_tables` now gracefully handles FTS5 virtual tables in WASM mode (sql.js lacks FTS5 module)
  - FTS5 shadow tables (`_fts_*`) are automatically skipped in table listings
  - Tables that fail `PRAGMA table_info()` are skipped rather than failing the entire operation
  - `COUNT(*)` errors on virtual tables return `rowCount: 0` instead of throwing

- **MCP Resource Template Registration** — Fixed `sqlite_table_schema` templated resource not matching client requests
  - Updated `registerResource()` in `NativeSqliteAdapter` to detect URI templates (containing `{param}` placeholders)
  - Template resources now use MCP SDK's `ResourceTemplate` class for proper URI matching
  - Static resources continue using simple string URI registration
  - Allows clients to request resources like `sqlite://table/test_products/schema` and have them matched correctly

- **Missing `getAllIndexes()` Method** — Added `getAllIndexes()` to `NativeSqliteAdapter`
  - Required by `sqlite_indexes` resource but was missing in native adapter
  - Returns all user-created indexes with table name, column list, and uniqueness info
  - Queries `sqlite_master` and `PRAGMA index_info()` for complete index metadata

### Added

- **PRAGMA Compile Options Filter** — `sqlite_pragma_compile_options` now supports `filter` parameter
  - Case-insensitive substring match to limit returned options (e.g., `filter: "FTS"` returns only FTS-related options)
  - Reduces payload size for targeted queries (58 options → filtered subset)

- **Database Stats Summarize Mode** — `sqlite_dbstat` now supports `summarize` parameter
  - When `summarize: true`, returns aggregated per-table stats instead of raw page-level data
  - Summary includes: `pageCount`, `totalPayload`, `totalUnused`, `totalCells`, `maxPayload` per table
  - Reduces response size (27 rows → 1 row per table) while providing actionable storage metrics

- **Stats Tool Column Selection** — `sqlite_stats_top_n` now supports `selectColumns` parameter
  - Limits returned columns to only those specified (reduces payload size for large tables)
  - Default behavior unchanged: returns all columns when `selectColumns` is not provided
  - Columns are validated and sanitized for SQL injection protection

- **FTS5 Auto-Sync Triggers** — `sqlite_fts_create` now automatically creates sync triggers
  - INSERT/UPDATE/DELETE triggers keep FTS5 index synchronized with source table in real-time
  - New `createTriggers` option (default: `true`) to control trigger creation
  - FTS tables are automatically populated with existing data on creation via `rebuild`
  - Trigger naming convention: `{ftsTable}_ai` (insert), `{ftsTable}_ad` (delete), `{ftsTable}_au` (update)
  - Response includes `triggersCreated` array listing created trigger names

- **FTS5 Wildcard Query Support** — `sqlite_fts_search` now supports list-all queries
  - Query `*` or empty string returns all FTS table contents without MATCH filtering
  - Useful for browsing FTS index contents or debugging FTS configuration
  - Returns rows ordered by rowid with `rank: null`

- **Phonetic Match Verbosity Control** — `sqlite_phonetic_match` now supports `includeRowData` option
  - New `includeRowData` parameter (default: `true`) to control full row data inclusion
  - Set to `false` for compact responses with only `value` and `phoneticCode` per match
  - Backward compatible: existing calls behave identically

- **SQLite Extension Support** — Added CLI flags and configuration for loadable SQLite extensions
  - `--csv` flag to load CSV extension for CSV virtual tables
  - `--spatialite` flag to load SpatiaLite extension for GIS capabilities
  - `CSV_EXTENSION_PATH` and `SPATIALITE_PATH` environment variables for custom extension paths
  - Platform-aware extension binary detection (Windows/Linux/macOS)
  - README documentation for built-in vs loadable extensions with installation instructions
- **Test Infrastructure** — Migrated tests to native SQLite adapter for full feature coverage
  - Added `tests/utils/test-adapter.ts` factory for centralized adapter instantiation
  - All 9 SQLite test files now use `NativeSqliteAdapter` (better-sqlite3) instead of sql.js WASM
  - FTS5 tests now execute properly (previously skipped due to WASM limitations)

### Changed

- **SQLite-Focused Branding** — Updated project descriptions to reflect SQLite-only focus
  - `package.json`: Updated description and removed unused database keywords (postgresql, mysql, mongodb, redis)
  - `src/cli.ts`: Updated help text, removed dead CLI options and environment variable parsing for unsupported databases
  - Updated header comments in `src/index.ts`, `src/server/McpServer.ts`, `src/adapters/DatabaseAdapter.ts`

### Security

- **Identifier Validation Centralization** — Migrated 83 tool handlers to use centralized `sanitizeIdentifier()` utility
  - Replaced inline regex validations with type-safe `InvalidIdentifierError` handling
  - Consistent security pattern across 10 files: `geo.ts`, `admin.ts`, `text.ts`, `vector.ts`, `virtual.ts`, `stats.ts`, `fts.ts`, `json-operations.ts`, `json-helpers.ts`, `core.ts`
  - Updated security tests to expect new error message format

### Fixed

- **SpatiaLite Analyze WKT Output** — Fixed `sqlite_spatialite_analyze` binary geometry output
  - `nearest_neighbor` and `point_in_polygon` analysis types now return WKT via `AsText()` instead of raw binary blobs
  - Changed from `s.*` wildcard select to explicit `source_id`, `source_geom`, `target_id`, `target_geom` columns
  - Reduces payload size and improves readability (binary arrays → human-readable WKT strings)

- **Restore Virtual Table Handling** — Fixed `sqlite_restore` failing with virtual table shadow tables
  - Added pre-restore phase to drop existing virtual tables before attempting restore
  - Virtual table deletion automatically cleans up associated shadow tables (R-Tree: `_node`, `_rowid`, `_parent`)
  - Excludes R-Tree shadow tables from copy list in addition to FTS5 shadow tables
  - Prevents \"may not be dropped\" error when backup contains virtual table artifacts

- **Custom Regex Validation Double-Escaping Fix** — Fixed `sqlite_text_validate` custom pattern handling
  - Normalizes double-escaped backslashes (`\\\\` → `\\`) from JSON transport
  - Patterns like `.*@.*\.com$` now work correctly as expected
  - Added error message with both original and normalized pattern for debugging invalid regex

- **JSON Each Ambiguous Column Fix** — Fixed `sqlite_json_each` "ambiguous column name: id" error
  - Added table alias (`t`) and `CROSS JOIN` syntax to prevent column name conflicts with `json_each()` TVF output
  - `json_each()` returns columns: `key`, `value`, `type`, `atom`, `id`, `parent`, `fullkey`, `path`
  - Source table columns (especially `id`) now properly qualified with table alias
  - Added automatic `id =` → `t.id =` rewriting for user-provided WHERE clauses
  - Updated `JsonEachOutputSchema` to include optional `row_id` field for row identification

- **JSON Group Object Expression Support** — Added `allowExpressions` option to `sqlite_json_group_object`
  - When `allowExpressions: true`, SQL expressions like `json_extract(data, '$.name')` are accepted for `keyColumn` and `valueColumn`
  - Default behavior unchanged (validates as simple column identifiers for security)
  - Enables advanced aggregation patterns combining JSON extraction with grouping

- **JSONB Text Serialization Fix** — Fixed `sqlite_json_select` returning binary Buffer for JSONB data
  - Wrapped column selection with `json()` function to convert JSONB binary to readable text JSON
  - Works seamlessly with both text JSON (no-op) and JSONB (converts to text)
  - API consumers now receive readable JSON instead of raw binary buffers

- **JSONB Schema Analysis Fix** — Fixed `sqlite_analyze_json_schema` returning byte indexes for JSONB columns
  - Wrapped column with `json()` function to decode JSONB binary before schema inference
  - Was returning numeric keys (0, 1, 2, ..., 100) representing blob bytes instead of actual JSON structure
  - Now correctly infers object properties, types, and nullability for JSONB-formatted data

- **Core Tool Bug Fixes** — Resolved 3 issues discovered during comprehensive MCP tool testing
  - `sqlite_describe_table` now correctly returns an error for non-existent tables (was returning `success: true` with empty columns)
  - `sqlite_write_query` and other query methods now auto-convert boolean parameters (`true`/`false`) to integers (`1`/`0`) since SQLite doesn't have native boolean type
  - `sqlite_create_table` message now accurately indicates when table already exists (using IF NOT EXISTS): "Table 'x' already exists (no changes made)"
  - `sqlite_list_tables` now correctly returns `columnCount` for each table (was always returning 0 in native adapter because `PRAGMA table_info()` was not being called)

- **JSON Path Column Naming** — Fixed column naming in `json_select` and `json_query` tools
  - Columns now use meaningful names extracted from JSONPath expressions (e.g., `$.user.email` → `email`)
  - Was returning generic indexed names (`path_0`, `result_0`)
  - Added `extractColumnNameFromPath()` and `getUniqueColumnNames()` helpers in `json-helpers.ts`
  - Duplicate path segments get numeric suffixes (e.g., `name`, `name_2`)

- **Text Tool Output Schema Fixes** — Fixed 6 tools with output validation errors
  - `sqlite_regex_extract`: Added safe rowid coercion (Number/String/undefined → Number) to prevent NaN in output
  - `sqlite_regex_match`: Added safe rowid coercion (Number/String/undefined → Number) to prevent NaN in output
  - `sqlite_text_split`: Changed `rowCount`/`results` to `parts`/`count` to match schema
  - `sqlite_advanced_search`: Fixed NaN bug when coercing rowid to number
  - `sqlite_fts_create`: Changed `sql` to `tableName` in response to match schema
  - `sqlite_fts_rebuild`: Added missing `tableName` field to response

- **Text Tool Bug Fixes** — Resolved issues discovered during comprehensive MCP tool testing
  - `sqlite_text_concat`: Fixed SQL generation to use `||` operator for concatenation (was generating comma-separated SELECT which only returns last column)
  - `sqlite_regex_extract`, `sqlite_regex_match`, `sqlite_advanced_search`: Fixed rowid extraction by aliasing `rowid as id` in SQL queries (was returning 0 for all rows)
  - `sqlite_phonetic_match`: Fixed empty `searchCode` for soundex algorithm by computing locally upfront (was only extracting from matches, returning empty when no matches found)

- **Test Database FTS5 Table** — Added pre-built FTS5 table for testing
  - `test_articles_fts`: FTS5 virtual table indexing `test_articles` (title, body)
  - Updated `test-database.sql` to create and populate the FTS index
  - Updated `reset-database.md` documentation with new table

- **JSONB Support in Native Adapter** — Fixed JSONB detection missing in `NativeSqliteAdapter`
  - `NativeSqliteAdapter.connect()` now detects SQLite version and sets JSONB support flag
  - `sqlite_jsonb_convert` and other JSONB tools now work correctly with better-sqlite3 backend
  - better-sqlite3 includes SQLite 3.51.2 which fully supports JSONB (requires 3.45+)

- **JSONB-Compatible Collection Tables** — Updated `sqlite_create_json_collection` CHECK constraint
  - Changed from `CHECK(json_valid("data"))` to `CHECK(json_type("data") IS NOT NULL)`
  - `json_valid()` only works on text JSON; `json_type()` works on both text and JSONB formats
  - Collections can now store JSONB data after `sqlite_jsonb_convert`

- **JSON Tool Output Schema Fixes** — Fixed 6 tools with output validation errors
  - `sqlite_json_keys`: Added missing `rowCount` field and fixed `keys` array type
  - `sqlite_json_group_array`: Changed `results` to `rows` to match schema
  - `sqlite_json_group_object`: Changed `results` to `rows` to match schema
  - `sqlite_jsonb_convert`: Created dedicated `JsonbConvertOutputSchema`
  - `sqlite_json_storage_info`: Created dedicated `JsonStorageInfoOutputSchema`
  - `sqlite_json_normalize_column`: Created dedicated `JsonNormalizeColumnOutputSchema`
  - Added `JsonPrettyOutputSchema` for `sqlite_json_pretty`
  - Updated `ToolConstants.ts` with correct list of all 23 JSON tool names

- **Stats Tool Output Schema Fixes** — Fixed 8 tools with output validation errors
  - Created dedicated output schemas: `StatsBasicOutputSchema`, `StatsCountOutputSchema`, `StatsGroupByOutputSchema`, `StatsTopNOutputSchema`, `StatsDistinctOutputSchema`, `StatsSummaryOutputSchema`, `StatsFrequencyOutputSchema`
  - Updated `StatsPercentileOutputSchema` to support array of percentiles (was single value)
  - Updated `StatsHistogramOutputSchema` with optional `range`, `bucketSize`, and `bucket` fields
  - Updated `StatsCorrelationOutputSchema` with optional `n` and `message` fields
  - Tools fixed: `sqlite_stats_basic`, `sqlite_stats_count`, `sqlite_stats_group_by`, `sqlite_stats_percentile`, `sqlite_stats_top_n`, `sqlite_stats_distinct`, `sqlite_stats_summary`, `sqlite_stats_frequency`

- **Vector Tool Output Schema Fixes** — Fixed 10 tools with output validation errors
  - Created dedicated output schemas: `VectorStoreOutputSchema`, `VectorBatchStoreOutputSchema`, `VectorGetOutputSchema`, `VectorDeleteOutputSchema`, `VectorCountOutputSchema`, `VectorStatsOutputSchema`, `VectorDimensionsOutputSchema`, `VectorNormalizeOutputSchema`, `VectorDistanceOutputSchema`
  - Updated `VectorSearchOutputSchema` to match handler return structure (`metric`, `count`, `results` with `_similarity`)
  - Tools fixed: `sqlite_vector_store`, `sqlite_vector_batch_store`, `sqlite_vector_get`, `sqlite_vector_search`, `sqlite_vector_delete`, `sqlite_vector_count`, `sqlite_vector_stats`, `sqlite_vector_dimensions`, `sqlite_vector_normalize`, `sqlite_vector_distance`

- **Admin Tool Bug Fixes** — Fixed 4 tools with output schema and logic errors
  - `sqlite_create_view`: Fixed syntax error by using DROP+CREATE pattern (SQLite doesn't support `CREATE OR REPLACE VIEW`)
  - `sqlite_list_views`: Created dedicated `ListViewsOutputSchema` (was using `ListTablesOutputSchema` expecting `tables` instead of `views`)
  - `sqlite_optimize`: Added required `message` field to handler return object
  - `sqlite_restore`: Fixed PRAGMA query that caused "no such table: 1" error (simplified to `PRAGMA integrity_check(1)`)

- **Geo Tool Output Schema Fixes** — Fixed 3 tools with output validation errors
  - `sqlite_geo_nearby`: Changed `count` field to `rowCount`, removed extra metadata fields
  - `sqlite_geo_bounding_box`: Changed `count` field to `rowCount`, removed extra metadata fields
  - `sqlite_geo_cluster`: Restructured return to match schema with `clusterId`, `center: {latitude, longitude}`, `pointCount`

- **SpatiaLite Windows DLL Loading** — Fixed extension loading on Windows
  - Added runtime PATH modification to prepend SpatiaLite directory before `loadExtension()` call
  - Windows requires dependency DLLs (libgeos, libproj, etc.) to be discoverable via PATH
  - Applied to both `NativeSqliteAdapter.ts` (startup) and `spatialite.ts` (on-demand loading)
  - Following pattern from Python sqlite-mcp-server implementation

- **SpatiaLite Tool Bug Fixes** — Fixed 3 tools that silently failed due to incorrect method usage
  - `sqlite_spatialite_create_table`: Changed `executeWriteQuery` to `executeReadQuery` for `AddGeometryColumn()` call
  - `sqlite_spatialite_index` (create/drop): Changed to `executeReadQuery` for `CreateSpatialIndex()` and `DisableSpatialIndex()` calls
  - Root cause: better-sqlite3's `.run()` method only works for INSERT/UPDATE/DELETE, not SELECT statements
  - Added verification step after geometry column creation to ensure column exists before reporting success
  - Cascading fix enables `sqlite_spatialite_import` and `sqlite_spatialite_analyze` to work correctly

- **SpatiaLite Metadata Initialization** — Fixed missing `geometry_columns` table on pre-loaded databases
  - `isSpatialiteLoaded()` now calls `InitSpatialMetaData(1)` when detecting a pre-loaded SpatiaLite extension
  - Ensures SpatiaLite metadata tables (`geometry_columns`, `spatial_ref_sys`) exist even if extension was loaded in previous session
  - Fixes `sqlite_spatialite_analyze` "no such table: geometry_columns" error
  - Fixes `sqlite_spatialite_create_table` returning 0 from `AddGeometryColumn()` call

- **SpatiaLite GeoJSON Import Fix** — Fixed SRID constraint violation when importing GeoJSON data
  - Wrapped `GeomFromGeoJSON()` with `SetSRID(..., srid)` to ensure SRID is set correctly
  - GeoJSON import now supports `additionalData` columns (was only available for WKT import)
  - Fixes "geom violates Geometry constraint [geom-type or SRID not allowed]" error

### Changed

- **Simplified SpatiaLite Instructions** — Removed manual `sqlite_spatialite_load` step requirement
  - SpatiaLite extension and metadata tables are now auto-initialized on first use of any spatial tool
  - Removed "IMPORTANT" warning and step numbering from `ServerInstructions.ts`
  - Added GeoJSON import example to instructions

### Added

- **Comprehensive Test Infrastructure** — Test database setup for systematic tool group testing
  - `test-database/test-database.sql`: Seed data with 10 tables and 409 rows covering all 7 tool groups
  - `test-database/reset-database.ps1`: PowerShell script to reset database to clean state with verification
  - `test-database/test-groups/`: Individual test guides for each tool group (core, json, text, stats, vector, admin, geo)
  - Uses ESM-compatible Node.js scripts with better-sqlite3 for cross-platform reset
  - Test tables: products, orders, json_docs, articles, users, measurements, embeddings, locations, categories, events

- **HTTP/SSE Streaming Transport** — Enhanced HTTP transport with session management and SSE
  - **Stateful mode (default)**: Multi-session management with SSE streaming for notifications
  - **Stateless mode (`--stateless`)**: Lightweight serverless-compatible mode for Lambda/Workers
  - `POST /mcp`: JSON-RPC requests with session management
  - `GET /mcp`: SSE stream for server-to-client notifications
  - `DELETE /mcp`: Session termination endpoint
  - Enhanced CORS headers for `mcp-session-id` and `Last-Event-ID`
  - Health endpoint reports active session count and transport mode
- **Business Insights Memo** — New tool and resource for capturing analysis insights
  - `sqlite_append_insight` tool: Add business insights discovered during data analysis
  - `memo://insights` resource: Synthesized memo of all captured insights
  - Insights manager singleton for in-memory insight storage
- **Summarize Table Prompt** — Intelligent table analysis workflow
  - `sqlite_summarize_table` prompt with configurable analysis depth
  - Supports basic, detailed, and comprehensive analysis modes
- **Advanced Search Tool** — Multi-mode text search
  - `sqlite_advanced_search` tool combining exact, fuzzy (Levenshtein), and phonetic (Soundex) matching
  - Configurable threshold and technique selection
- **Hybrid Search Workflow Prompt** — Combined FTS5 + vector search
  - `sqlite_hybrid_search_workflow` prompt for hybrid search implementation
  - Guides through schema setup, query structure, and weight tuning
- **Interactive Demo Prompt** — Flagship MCP demonstration
  - `sqlite_demo` prompt for interactive capability walkthrough
  - Guides through data creation, querying, and insight capture
- **MCP Progress Notifications (2025-11-25)** — Real-time progress updates for long-running operations
  - New `src/utils/progress-utils.ts` module with `sendProgress()` and `buildProgressContext()` utilities
  - Extended `RequestContext` interface with optional `server` and `progressToken` fields
  - `sqlite_restore`: 3-phase progress (prepare → restore → verify)
  - `sqlite_optimize`: Dynamic multi-phase progress (start → reindex → analyze → complete)
  - `sqlite_vacuum`: 2-phase progress (start → complete)
  - Notifications are best-effort and require client support for `progressToken` in `_meta`
- **Modern Tool Registration** — Migrated from deprecated `server.tool()` to `server.registerTool()` API
  - Both `SqliteAdapter` and `NativeSqliteAdapter` now use modern pattern
  - Full `inputSchema`/`outputSchema` passed (not just `.shape`)
  - MCP 2025-11-25 `structuredContent` returned when `outputSchema` is present
  - Progress token extraction from `extra._meta` enables progress notifications
  - Removed all eslint-disable comments for deprecated API usage
- **Metadata Caching Pattern** — TTL-based schema caching ported from mysql-mcp
  - New `SchemaManager.ts` module with configurable cache TTL (default: 5s)
  - Schema, tables, and indexes cached to reduce repeated introspection queries
  - Auto-invalidation on DDL operations (CREATE/ALTER/DROP) in all query methods
  - Fixed N+1 query pattern in `sqlite://indexes` resource
  - ToolFilter caching for O(1) tool group lookups
  - `METADATA_CACHE_TTL_MS` environment variable for tuning (documented in README)

### Changed

- **Node.js 24 LTS Baseline** — Upgraded from Node 20 to Node 24 LTS as the project baseline
  - `package.json` now requires Node.js >=24.0.0 in `engines` field
  - README prerequisites updated to specify Node.js 24+ (LTS)
- **Dependency Updates** — Updated npm dependencies to latest versions
  - `@modelcontextprotocol/sdk`: 1.24.3 → 1.25.3
  - `@types/node`: 25.0.2 → 25.1.0
  - `better-sqlite3`: 12.5.0 → 12.6.2
  - `cors`: 2.8.5 → 2.8.6
  - `globals`: 16.5.0 → 17.2.0 (major version bump)
  - `pg`: 8.16.3 → 8.17.2
  - `typescript-eslint`: 8.49.0 → 8.54.0
  - `vitest`: 4.0.15 → 4.0.18
  - `zod`: 4.1.13 → 4.3.6

### Security

- **Transitive Dependency Fixes** — Resolved vulnerabilities via npm audit fix
  - `hono`: 4.11.5 → 4.11.7 (moderate severity fix via `@modelcontextprotocol/sdk`)
- **Log Injection Prevention** — Control character sanitization for log messages
  - Strips all ASCII control characters (0x00-0x1F) and DEL (0x7F) from messages
  - Prevents log forging and escape sequence attacks
  - Dedicated `sanitizeStack()` function replaces newlines with arrow delimiters for safe stack trace logging
- **Sensitive Data Redaction** — Automatic redaction of security-sensitive fields in log context
  - Sensitive keys redacted: password, secret, token, authorization, apikey, access_token, refresh_token, credential, client_secret
  - OAuth 2.1 fields redacted: issuer, audience, jwks_uri, oauth_config, scopes_supported, bearer_format
  - Supports recursive sanitization for nested configuration objects
  - Prevents exposure of OAuth configuration data in log output
- **CodeQL Taint Tracking Fix** — Resolved static analysis alerts in logger
  - Fixed `js/clear-text-logging` by breaking data-flow path in `writeToStderr()`
  - Fixed `js/log-injection` by reconstructing output from static character codes
  - Implemented the "Static Classification" pattern for taint-breaking sanitization
- **SQL Injection Protection** — WHERE clause validation and identifier sanitization (adapted from postgres-mcp)
  - New `src/utils/where-clause.ts` utility with SQLite-specific dangerous pattern detection
  - Blocks: ATTACH DATABASE, load_extension, PRAGMA, fileio functions, hex literals, comments, UNION attacks
  - New `src/utils/identifiers.ts` with centralized identifier validation and quoting
  - Integrated `validateWhereClause` into 36 tool handlers (text, window, vector, stats, geo)
  - New `tests/security/security-injection.test.ts` test suite (49 comprehensive test cases)
  - New `tests/security/tool-integration.test.ts` test suite (67 end-to-end handler tests)
- **Handler Security Hardening** — Added missing WHERE clause validation to tool handlers
  - `geo.ts`: Added `validateWhereClause()` to `sqlite_geo_cluster`
  - `stats.ts`: Added `validateWhereClause()` to `sqlite_stats_outliers`, `sqlite_stats_top_n`, `sqlite_stats_distinct`, `sqlite_stats_frequency`

### Fixed

- **MCP SDK 1.25.2 Compatibility** — Fixed stricter transport type requirements
  - Added onclose handler to StreamableHTTPServerTransport before connecting
  - Used type assertion to satisfy SDK's narrower Transport type constraints

### Verified

- **OAuth 2.1 Implementation** — Tested with Keycloak 26.4.7
  - Token validation with JWKS endpoint verified
  - Scope enforcement (`read`, `write`, `admin`) working correctly
  - RFC 9728 Protected Resource Metadata endpoint operational
  - Added OAuth Quick Start section to README with usage examples

### Added

- **SpatiaLite Geospatial Tools (Native-only)** — 7 new tools for GIS capabilities
  - `sqlite_spatialite_load` — Load SpatiaLite extension
  - `sqlite_spatialite_create_table` — Create tables with geometry columns
  - `sqlite_spatialite_query` — Execute spatial SQL (ST_Distance, ST_Within, etc.)
  - `sqlite_spatialite_analyze` — Spatial analysis (nearest neighbor, point-in-polygon)
  - `sqlite_spatialite_index` — Create/manage spatial R-Tree indexes
  - `sqlite_spatialite_transform` — Geometry operations (buffer, union, intersection)
  - `sqlite_spatialite_import` — Import WKT/GeoJSON data
  - Tools gracefully fail with helpful error if SpatiaLite extension not installed
- **Geo Tool Group** — New dedicated group for geospatial tools
  - Moved 4 Haversine-based geo tools from `admin` to `geo` group
  - SpatiaLite tools also in `geo` group (7 Native-only tools)
  - New `spatial` shortcut: Core + Geo + Vector (23 WASM / 30 Native tools)
  - 7 tool groups now available (was 6)

- **Admin/PRAGMA Tools** — Added 8 new database administration tools (100 total)
  - `sqlite_restore`: Restore database from backup file
  - `sqlite_verify_backup`: Verify backup file integrity without restoring
  - `sqlite_index_stats`: Get detailed index statistics with column info
  - `sqlite_pragma_compile_options`: List SQLite compile-time options
  - `sqlite_pragma_database_list`: List all attached databases
  - `sqlite_pragma_optimize`: Run PRAGMA optimize for performance tuning
  - `sqlite_pragma_settings`: Get or set PRAGMA values
  - `sqlite_pragma_table_info`: Get detailed table column metadata
- **MCP Tool Annotations (2025-11-25 spec)** — Added behavioral hints to all 73 tools
  - `readOnlyHint`: Indicates read-only tools (SELECT queries, schema inspection)
  - `destructiveHint`: Warns about irreversible operations (DROP, DELETE, TRUNCATE)
  - `idempotentHint`: Marks safe-to-retry operations (CREATE IF NOT EXISTS)
  - Annotation presets in `src/utils/annotations.ts`: READ_ONLY, WRITE, DESTRUCTIVE, IDEMPOTENT, ADMIN
  - Helper functions: `readOnly()`, `write()`, `destructive()`, `idempotent()`, `admin()`
- **MCP Resource Annotations (2025-11-25 spec)** — Added metadata hints to all 7 resources
  - `audience`: Intended consumer (`user`, `assistant`, or both)
  - `priority`: Display ordering hint (0-1 range)
  - `lastModified`: ISO 8601 timestamp for cache invalidation
  - Annotation presets in `src/utils/resourceAnnotations.ts`: HIGH_PRIORITY, MEDIUM_PRIORITY, LOW_PRIORITY
- **Whitelist-Style Tool Filtering** — Enhanced tool filtering to match postgres-mcp syntax
  - **Whitelist mode**: Specify only the groups you want (e.g., `core,json,text`)
  - **Shortcuts**: Predefined bundles (`starter`, `analytics`, `search`, `spatial`, `minimal`, `full`)
  - **Mixed mode**: Combine whitelist with exclusions (e.g., `starter,-fts5`)
  - **Backward compatible**: Legacy exclusion syntax (`-vector,-geo`) still works
  - See README "Tool Filtering" section for documentation
- **ServerInstructions for AI Agents** — Added automated instruction delivery to MCP clients
  - New `src/constants/ServerInstructions.ts` with tiered instruction levels (essential/standard/full)
  - Instructions automatically passed to MCP server during initialization
  - Includes usage examples for JSON, Vector, FTS5, Stats, Geo, Window Functions, and Transactions
  - Following patterns from memory-journal-mcp and postgres-mcp
- **MCP Enhanced Logging** — Full MCP protocol-compliant structured logging
  - RFC 5424 severity levels: debug, info, notice, warning, error, critical, alert, emergency
  - Module-prefixed error codes (e.g., `DB_CONNECT_FAILED`, `AUTH_TOKEN_INVALID`)
  - Structured log format: `[timestamp] [LEVEL] [MODULE] [CODE] message {context}`
  - Module-scoped loggers via `logger.forModule()` and `logger.child()`
  - Sensitive data redaction for OAuth 2.1 configuration fields
  - Stack trace inclusion for error-level logs with sanitization
  - Log injection prevention via control character sanitization
- Initial repository setup
- Project documentation (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
- GitHub workflows (CodeQL, Dependabot)
- Issue and PR templates
