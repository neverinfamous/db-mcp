## [Unreleased]

### Added
- `--metrics-export` CLI flag and `METRICS_EXPORT` environment variable to expose internal server metrics at `/metrics`.
- `sqlite://metrics` MCP resource to expose internal server metrics natively to MCP clients.
- `sqlite_hybrid_search` tool combining FTS5 text search and vector embedding search via Reciprocal Rank Fusion (RRF).
- `sqlite_audit_search` tool (including Code Mode support) to securely query the server's own audit logs.
- `sqlite_server_config` administrative tool to dynamically change server logging levels (`debug`, `info`, `warn`, `error`).
- `includeFacets` faceted search support in `sqlite_fts_search` and `sqlite_advanced_search`.
- `cursor` parameter support in `sqlite_read_query` and `sqlite_fts_search` for base64 opaque cursor-based pagination.
- `recommendComposite` and `queriesToAnalyze` options in `sqlite_index_audit` to automatically recommend indexes.
- SystemDb observability architecture replacing memory-only logs with a structured SQLite sidecar (`system.db`).
- `MetricsRegistry` persistence of historical snapshots into the SystemDb sidecar to survive server restarts.
- `resources/subscribe` capability support in `McpServer` with a `SubscriptionManager` for automatic session cleanup.
- Database schema modification events (`schemaChanged`) that automatically notify clients subscribed to `sqlite://schema` and `sqlite://tables`.
- Configuration file support (`.yaml`, `.json`) via `--config` and `--dump-config` CLI flags to simplify deployments.
- Encryption at Rest (SQLCipher) support for the Native backend and sidecar `SystemDb` audit logs, configurable via `--encryption-key` or `DB_ENCRYPTION_KEY`.
- Capacity Planning Guide in the Wiki covering scaling, memory requirements, and token budget strategies.

### Fixed
- FTS5 syntax errors on malformed user input by introducing query sanitization.
- V8 Garbage Collection `STATUS_ACCESS_VIOLATION` (0xC0000005) crashes during `CodeModeSandbox` teardown.
- Native V8 thread leaks on Windows by pinning `isolated-vm` to exactly `6.1.2`.
- Fixed SQLCipher `PRAGMA key` syntax error causing `file is not a database` failures by wrapping the encryption key in double quotes in `native-sqlite-adapter.ts` and `system-db.ts`.
- Documented SQLCipher encryption options in READMEs and added a warning regarding `DB_ENCRYPTION_KEY`'s interaction with the audit log.
- Prevented `DB_ENCRYPTION_KEY` environment variable leakage from breaking unencrypted Playwright E2E tests by unsetting the variable in `playwright.config.ts` and restricting auto-injection in `cli.ts`.
- Fixed numbering discontinuity and duplicate list items in the `test-codemode`, `test-advanced`, and `test-tool-groups` prompt suites.
