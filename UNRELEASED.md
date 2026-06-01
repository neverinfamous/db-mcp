## [Unreleased]

### Added
- `--metrics-export` CLI flag and `METRICS_EXPORT` environment variable to expose internal server metrics at `/metrics`.
- `sqlite://metrics` MCP resource to expose internal server metrics natively to MCP clients.
- `sqlite_hybrid_search` tool combining FTS5 text search and vector embedding search via Reciprocal Rank Fusion (RRF).
- `sqlite_audit_search` tool (including Code Mode support) to securely query the server's own audit logs.
- `sqlite_server_config` administrative tool to dynamically change server logging levels (`debug`, `info`, `warn`, `error`).
- `includeFacets` faceted search support in `sqlite_fts_search` and `sqlite_advanced_search`.
- FTS5 query sanitization (`sanitizeFtsQuery`) to prevent syntax errors on malformed user input.
- `cursor` parameter support in `sqlite_read_query` and `sqlite_fts_search` for base64 opaque cursor-based pagination.
- `recommendComposite` and `queriesToAnalyze` options in `sqlite_index_audit` to automatically recommend indexes.
- SystemDb observability architecture replacing memory-only logs with a structured SQLite sidecar (`system.db`).
- `MetricsRegistry` persistence of historical snapshots into the SystemDb sidecar to survive server restarts.
- `resources/subscribe` capability support in `McpServer` with a `SubscriptionManager` for automatic session cleanup.
- Database schema modification events (`schemaChanged`) that automatically notify clients subscribed to `sqlite://schema` and `sqlite://tables`.
- `--config <path>` and `--dump-config` CLI flags for advanced configuration file support (`.yaml`, `.json`) and debugging.
- Configuration file support (`db-mcp.config.yaml`) for startup arguments (`--audit-log`, `--enable-admin`, `--cors-origins`) to simplify Docker deployments.
- Encryption at Rest (SQLCipher) support for the Native backend and sidecar `SystemDb` audit logs, configurable via `--encryption-key` or `DB_ENCRYPTION_KEY`.
- `better-sqlite3-multiple-ciphers@12.10.0` optional dependency for SQLCipher support.
- Agent workflow `docs-drift-detector.md` to detect and remediate documentation drift in `README.md` and `DOCKER_README.md`.
- E2E Triple-Path Verification test coverage for `sqlite_server_config` and resource subscriptions.
- Updated `test-server` manifests and test prompts to reflect recent codebase and tool additions.
- Added robust programmatic Vitest coverage for hybrid search, faceted search, and FTS5 query sanitization.
- Capacity Planning Guide in the Wiki covering scaling, memory requirements, and token budget strategies.

### Fixed
- V8 Garbage Collection `STATUS_ACCESS_VIOLATION` (0xC0000005) crashes during `CodeModeSandbox` teardown by explicitly disposing and releasing isolate executions.

### Changed
- Pinned `isolated-vm` to exactly `6.1.2` to prevent native V8 thread leaks on Windows.
- Bumped `tsx` from `4.22.3` to `4.22.4`.
- Updated miscellaneous transitive dependencies.
