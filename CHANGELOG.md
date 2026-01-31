# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
