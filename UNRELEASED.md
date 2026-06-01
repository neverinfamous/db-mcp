## [Unreleased]

### Added
- `--metrics-export` CLI flag and `METRICS_EXPORT` environment variable to expose internal server metrics at `/metrics` (e.g., Prometheus format).
- `sqlite://metrics` MCP resource to expose internal server metrics natively to MCP clients.
- `sqlite_hybrid_search` tool combining FTS5 text search and vector embedding search via Reciprocal Rank Fusion (RRF).
- `includeFacets` faceted search support added to `sqlite_fts_search`, `sqlite_advanced_search`, and `sqlite_hybrid_search`.
- FTS5 query sanitization to prevent syntax errors on malformed user input (`sanitizeFtsQuery`).
- `cursor` parameter support in `sqlite_read_query` and `sqlite_fts_search` for base64 opaque cursor-based pagination.
- `recommendComposite` and `queriesToAnalyze` options in `sqlite_index_audit` to automatically recommend composite and partial indexes using `EXPLAIN QUERY PLAN` heuristics.
- New SystemDb observability architecture replacing legacy JSONL and memory-only logs with a structured SQLite sidecar (`system.db`).
- `sqlite_audit_search` tool allowing native structured searches against the server's own audit logs.
- `MetricsRegistry` now persists historical snapshots directly into the SystemDb sidecar to survive server restarts.
- Added `resources/subscribe` capability support in `McpServer`.
- Added `SubscriptionManager` for robust resource tracking with automatic cleanup on session disconnect for both HTTP and Legacy SSE transports.
- Exposed database schema modification events through the new `schemaChanged` event in `DatabaseAdapter`, automatically notifying clients subscribed to `sqlite://schema` and `sqlite://tables`.
- Added `docs-drift-detector.md` agent workflow for automated validation of `db-mcp` documentation.
- Added new `sqlite_server_config` administrative tool to change server logging levels dynamically (`debug`, `info`, `warn`, `error`).
- Expanded startup CLI arguments (`--audit-log`, `--enable-admin`, `--cors-origins`) to `db-mcp.config.yaml` to simplify Docker deployments.
- Implemented `sqlite_audit_search` Code Mode tool exclusively accessible via `agent` workflows to query the SQLite internal log securely.
- `--dump-config` CLI flag to securely print the fully resolved configuration hierarchy (redacting secrets) for debugging.
- `--config <path>` flag parsing supporting configuration via `.yaml` and `.json` files.
- Ported `docs-drift-detector.md` agentic workflow to detect and remediate documentation drift in `README.md` and `DOCKER_README.md`.

### Fixed
- Fixed V8 Garbage Collection `STATUS_ACCESS_VIOLATION` (0xC0000005) crashes during teardown of `CodeModeSandbox` by rigorously wrapping isolate executions in `try...finally` blocks with explicit object `.dispose()` and `.release()` calls.

### Changed
**Dependency Updates**
- Pinned `isolated-vm` to exactly `6.1.2` (reverting from 7.0.0) to prevent uncontrolled minor/patch updates from introducing native V8 thread leaks on Windows.
- Bumped `tsx` from 4.22.3 to 4.22.4
- Miscellaneous transitive dependencies updated via `npm update`
