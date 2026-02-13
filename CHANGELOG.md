# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Server Host Binding** — New `--server-host` CLI option and `MCP_HOST` environment variable
  - Configures which host/IP the HTTP transport binds to (default: `0.0.0.0`)
  - Use `--server-host 127.0.0.1` to restrict to local connections only
  - Precedence: CLI flag > `MCP_HOST` env var > `HOST` env var > default (`0.0.0.0`)
  - Essential for containerized deployments where binding to all interfaces is required

### Dependencies

- `@modelcontextprotocol/sdk`: 1.25.3 → 1.26.0
- `@types/node`: 25.2.0 → 25.2.3
- `dotenv`: 17.2.3 → 17.3.1
- `sql.js`: 1.13.0 → 1.14.0
- `typescript-eslint`: 8.54.0 → 8.55.0

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

- **`sqlite_backup` WASM Limitation Clarification** — Backup now clearly indicates ephemeral storage in WASM mode
  - When running in WASM mode, backup success response now includes `wasmLimitation: true` and explanatory `note`
  - Message changed from path-based to "Database backed up to WASM virtual filesystem (ephemeral)"
  - Clarifies that WASM backups go to ephemeral virtual filesystem and won't persist after session ends
  - Previously returned success with user-provided path, misleadingly implying file was saved to host filesystem

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

- **`sqlite_phonetic_match` Documentation** — Clarified first-word matching behavior
  - Added comment noting that Soundex compares only the first word of multi-word values

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
