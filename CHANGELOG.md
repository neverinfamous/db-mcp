# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Node.js 24 LTS Baseline** — Upgraded from Node 20 to Node 24 LTS as the project baseline
  - `package.json` now requires Node.js >=24.0.0 in `engines` field
  - README prerequisites updated to specify Node.js 24+ (LTS)
- **Dependency Updates** — Updated npm dependencies to latest versions
  - `@modelcontextprotocol/sdk`: 1.24.3 → 1.25.3
  - `@types/node`: 25.0.2 → 25.0.10
  - `better-sqlite3`: 12.5.0 → 12.6.2
  - `cors`: 2.8.5 → 2.8.6
  - `globals`: 16.5.0 → 17.1.0 (major version bump)
  - `pg`: 8.16.3 → 8.17.2
  - `typescript-eslint`: 8.49.0 → 8.53.1
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

### Added

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
