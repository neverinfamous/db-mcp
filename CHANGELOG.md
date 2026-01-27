# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Changed

- **Node.js 24 LTS Baseline** — Upgraded from Node 20 to Node 24 LTS as the project baseline
  - `package.json` now requires Node.js >=24.0.0 in `engines` field
  - README prerequisites updated to specify Node.js 24+ (LTS)
- **Dependency Updates** — Updated npm dependencies to latest versions
  - `@modelcontextprotocol/sdk`: 1.24.3 → 1.25.3
  - `@types/node`: 25.0.2 → 25.0.10
  - `better-sqlite3`: 12.5.0 → 12.6.2
  - `cors`: 2.8.5 → 2.8.6
  - `globals`: 16.5.0 → 17.2.0 (major version bump)
  - `pg`: 8.16.3 → 8.17.2
  - `typescript-eslint`: 8.49.0 → 8.54.0
  - `vitest`: 4.0.15 → 4.0.18
  - `zod`: 4.1.13 → 4.3.6

### Security

- **Transitive Dependency Fixes** — Resolved high severity vulnerabilities via npm audit fix
- **CodeQL Taint Tracking Fix** — Resolved static analysis alerts in logger
  - Fixed `js/clear-text-logging` by breaking data-flow path in `writeToStderr()`
  - Fixed `js/log-injection` by reconstructing output from static character codes
  - Implemented the "Static Classification" pattern for taint-breaking sanitization

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
