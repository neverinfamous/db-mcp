## [Unreleased]

### Added

- Contextual `README.md` files to core directories (`.agents`, `.github`, `config`, `extensions`, `scripts`, `src`, `tests`).
- `TimeoutError`, `RateLimitError`, and `ConflictError` typed error classes.
- WASM adapter request serialization via reader-writer lock.
- `stream: true` and `chunkSize` parameters to `sqlite_read_query`.
- `ALLOWED_IO_ROOTS` sandbox via env var and CLI flag.
- HTTP stateful session enforcement with 30-minute idle timeout and in-flight request locks.
- Optimistic Concurrency Control (OCC) tools in the `core` group: `sqlite_enable_versioning`, `sqlite_disable_versioning`, `sqlite_check_version`, and `sqlite_conditional_update`.
- Automatic `snake_case` to `camelCase` parameter mapping in validation schemas and the Code Mode V8 proxy.
- Test scripts `verify-schemas.mjs`, `test-zod-errors.mjs`, and `test-tool-annotations.mjs`.
- Comprehensive vitest coverage suites for HTTP session initialization, system db, OAuth resource server, vector schemas, and SpatiaLite loader to achieve >90% overall project coverage.

### Changed

- Deprecated `worker` Code Mode isolation options in `.env.example`.
- Updated default `CODE_MODE_MAX_RESULT_SIZE` limit documentation to match 10MB runtime default.
- Updated dependencies: GitHub Actions and npm packages.
- Clarified Code Mode testing rules in `prompt-template.md` and test scripts.
- Surfaced Code Mode errors as structured typed errors instead of generic internals.
- Returned structured JSON for HTTP rate limit responses.
- `sqlite_write_query` and `sqlite_upsert` require an `expectedVersion` parameter for version-enabled tables.
- Bumped `isolated-vm` to `7.0.0` for Node.js 26 compatibility.
- Migrated package manager from `npm` to `pnpm` (v9.15.4) and updated `Dockerfile`.
- Simplified `gotchas.md` by moving tool-specific instructions to native tool group URIs.
- Expanded agent prompts and E2E tests to validate `ALLOWED_IO_ROOTS`, OCC, and chunked streaming.
- Split complex tool handlers (`audit-tools.ts`, `window.ts`) into sub-modules and grouped exports via barrel files.
- Optimized error serialization overhead by extracting RegExp constants and adding match extraction caching.
- Optimized `ReadWriteLock` for WASM concurrency.
- Accelerated Code Mode AST parsing with an LRU cache.
- Replaced generic `Error` classes with domain-specific errors in core logic.
- Updated server instructions (`gotchas.md`) to formally document structured `ValidationError` responses.
- Added `(opt-in)` annotation to `sqlite.migration` in Code Mode groups list.
- Optimized `sqlite_schema_snapshot` to use `compact: true` by default.
- Reduced `sqlite_stats_sample` default `sampleSize` to 20 and max cap to 50.
- Truncated `sqlite_transaction_execute` results array to a maximum of 50 items.
- Changed `sqlite_dbstat` default `summarize` to `true`.
- Reduced `sqlite_audit_search` default limit to 10.
- Converted `test-server/reset-database.ps1` to `reset-database.mjs`.
- Refactored `ErrorCategory` enum to a literal union type.

### Fixed

- Clean up orphaned SQLite Write-Ahead Log (`-wal`) and Shared Memory (`-shm`) files during test environment resets.
- `sqlite_read_query` degrades gracefully to full buffering in Code Mode when `stream: true` is requested.
- Missing `PROJECT_REGISTRY` and `TEAM_DB_PATH` variables in `mcp-config-example.json` and `.env.example`.
- `ci-health-monitor` permissions in strict mode.
- Enforced single quotes in YAML frontmatter for agentic workflows.
- Enforced strict parsing (`.strict()`) on empty schema objects in migration, admin, and transaction tools.
- Typecast isolated `any` types to `unknown` in admin schemas and metrics tests.
- Refactored `logger.ts` to be fully synchronous.
- Removed unused `zod-to-json-schema` dependency.
- Code Mode sandbox timeouts now correctly throw `TimeoutError`.
- Native addon crashes during Vitest by changing the execution pool from `threads` to `forks`.
- False-positive Promise rejections in `sqlite-adapter-methods.test.ts`.
- Synced `AUDIT_REDACT` default to `true` in `.env.example` and `mcp-config-example.json`.
- Configured `ALLOWED_IO_ROOTS` in test scripts to automatically silence fallback sandbox warnings.
- Generation script README exclusion now uses case-insensitive prefix matching.
- Removed unused devDependency `rimraf` from `package.json`.
- Structured error responses in vector tool handlers.
- Structured error responses in the `admin-audit` tool group.
- Case-insensitive `operation` parsing in `sqlite_cascade_simulator`.
- Coerce empty arrays in `sqlite_schema_diff` schema.
- Optional `table` parameter filtering in `sqlite_dependency_graph`.
- Descriptive messages in `json-write` output.
- `findSuggestion` regex pattern for missing column errors.
- Strict validation in `transactions` tool schemas.
- `ifExists` default in `DisableVersioningSchema`.
- Context extraction in `sqlite_fts_headline` when `column` is omitted.
- Structured error category in `sqlite_analyze_csv_schema` for IO rejections.
- Structured error fields in `sqlite_virtual_table_info`.
- `sqlite_audit_search` documentation parameter naming.

### Security

- **Hard Gate**: Code Mode strictly fail-closes if `isolated-vm` native bindings fail to load.
- **Hard Gate**: HTTP transports fail to start if `ALLOWED_IO_ROOTS` is omitted.
- Stdio transport defaults to no filesystem access if omitted.
- Hardened all filesystem-touching tools to use symlink-aware realpath resolution (`assertSafeIoPath`).
- Sessions exceeding timeout limits are automatically expired and cleaned up.
