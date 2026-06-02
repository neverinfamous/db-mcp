## [Unreleased]

### Added

- Internal server metrics exposed at `/metrics` (via `--metrics-export` or `METRICS_EXPORT`) and natively to clients via the `sqlite://metrics` resource.
- `sqlite_hybrid_search` tool combining FTS5 text search and vector embedding search via Reciprocal Rank Fusion (RRF).
- `sqlite_audit_search` tool (with Code Mode support) to securely query the server's own audit logs.
- `sqlite_server_config` administrative tool to dynamically change server logging levels (`debug`, `info`, `warn`, `error`).
- `includeFacets` for faceted search and `cursor` for base64 pagination in search and read queries (`sqlite_fts_search`, `sqlite_advanced_search`, `sqlite_read_query`).
- `recommendComposite` and `queriesToAnalyze` options in `sqlite_index_audit` to automatically recommend indexes.
- SystemDb observability architecture replacing memory-only logs with a structured SQLite sidecar (`system.db`), including `MetricsRegistry` persistence across server restarts.
- `resources/subscribe` capability (via `SubscriptionManager`) with `schemaChanged` events to automatically notify clients subscribed to `sqlite://schema` and `sqlite://tables`.
- Configuration file support (`.yaml`, `.json`) via `--config` and `--dump-config` CLI flags.
- Encryption at rest (SQLCipher) support for the Native backend and sidecar `SystemDb` audit logs, configurable via `--encryption-key` or `DB_ENCRYPTION_KEY` (includes README documentation and interaction warnings).
- Capacity Planning Guide covering scaling, memory requirements, and token budget strategies.

### Fixed

- Fixed silent fallbacks in `introspection` Zod schemas (`sqlite_schema_snapshot`, `sqlite_schema_diff`, `sqlite_topological_sort`, `sqlite_cascade_simulator`, `sqlite_constraint_analysis`) that swallowed wrong-type validation errors for enum properties.
- Fixed `sqlite_spatialite_load` not returning the `version` string as required by the schema output.
- Fixed native build failure on Node 26 for Windows caused by LLVM/Clang LTO flags being inappropriately passed to MSVC via `node-gyp`.
- FTS5 syntax errors on malformed user input.
- V8 Garbage Collection `STATUS_ACCESS_VIOLATION` crashes during `CodeModeSandbox` teardown.
- Native V8 thread leaks on Windows.
- SQLCipher `PRAGMA key` syntax errors causing `file is not a database` failures.
- `DB_ENCRYPTION_KEY` environment variable leakage breaking unencrypted Playwright E2E tests.
- Documentation drift: removed unsupported `ENABLE_ADMIN` and `--cors-origins` references from examples and DOCKER_README, and added missing `MCP_ENABLE_HSTS` to README environment variables table.

### Security

- Bumped npm bundled `tar` in Dockerfile from `7.5.15` to `7.5.16` to apply latest security patches.

### Changed

- CI/CD: Enforced single quotes in YAML frontmatter for `ci-health-monitor.md` and `docs-drift-detector.md` agentic workflows.
- Added token conservation guidance to `sqlite_read_query` instructions, advising agents to avoid `SELECT *` on wide tables with JSON payloads to preserve context window depth.

**Dependency Updates**

- Bumped `@vitest/coverage-v8` to `4.1.8`.
- Bumped `typescript-eslint` to `8.60.1`.
- Bumped `vitest` to `4.1.8`.
