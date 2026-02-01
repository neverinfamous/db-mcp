# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **`sqlite_json_group_array` Expression Support** — Added `allowExpressions` option for consistency with `sqlite_json_group_object`
  - When `allowExpressions: true`, SQL expressions like `json_extract(data, '$.name')` are accepted for `valueColumn`
  - Default behavior unchanged (validates as simple column identifier for security)
  - Enables advanced aggregation patterns combining JSON extraction with grouping

- **`sqlite_spatialite_analyze` Error Message Clarity** — Improved error messages for required parameter validation

  - Changed "Target table required" to "Missing required parameter 'targetTable'" for `nearest_neighbor` and `point_in_polygon` analysis types
  - Clearer messaging helps users identify which parameter they need to provide

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
