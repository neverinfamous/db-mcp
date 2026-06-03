## [Unreleased]

### Added

- CI/CD workflow documentation and Mermaid diagrams in `.github/workflows/README.md`.
- `Performance-Tuning.md` GitHub Wiki guide covering cache TTLs, WASM vs Native backends, and token efficiency.
- Dependabot verification step in `.github/workflows/ci-health-monitor.md`.
- Internal server metrics exposed at `/metrics` and via `sqlite://metrics` resource.
- `sqlite_hybrid_search` tool combining FTS5 text search and vector embedding search via Reciprocal Rank Fusion (RRF).
- `sqlite_audit_search` tool for querying server audit logs.
- `sqlite_server_config` administrative tool to dynamically manage logging levels.
- `includeFacets` and `cursor` parameters for faceted search and pagination in search/read queries.
- `recommendComposite` and `queriesToAnalyze` options in `sqlite_index_audit` for automatic index recommendations.
- SystemDb observability architecture with structured SQLite sidecar (`system.db`) and `MetricsRegistry` persistence.
- Subscription capability via `SubscriptionManager` with `schemaChanged` events for `sqlite://schema` and `sqlite://tables`.
- Configuration file support (`.yaml`, `.json`) via `--config` and `--dump-config` CLI flags.
- Encryption at rest (SQLCipher) for Native backend and `SystemDb` logs via `--encryption-key` or `DB_ENCRYPTION_KEY`.
- Capacity Planning Guide covering scaling, memory requirements, and token budgets.
- Continuous wiki documentation drift check workflow in `.github/workflows/wiki-drift-detector.md`.
- Data Privacy, Compliance policies, and Supply Chain Security guidance in `SECURITY.md`.

### Changed

- GitHub Actions workflows updated to use `actions/checkout@v6` and `actions/setup-node@v6` via SHA pinning.
- `sqlite_read_query` instructions updated with token conservation guidance.
- Dependencies bumped: `@vitest/coverage-v8` to `4.1.8`, `typescript-eslint` to `8.60.1`, and `vitest` to `4.1.8`.
- Agentic workflows updated to strictly use single quotes in YAML frontmatter and explicitly reference `gh copilot`.
- `mcp-config-example.json` populated with meaningful placeholder values.

### Removed

- `sqlite_append_insight` tool and `memo://insights` resource.

### Fixed

- `MCP_HOST` default documentation discrepancy in `README.md` and `DOCKER_README.md` (`127.0.0.1` locally, `0.0.0.0` in Docker).
- Missing `MCP_ENABLE_HSTS` variable in `DOCKER_README.md` Environment Variables table.
- Silent fallbacks in `introspection` schemas swallowing wrong-type validation errors for enum properties.
- `sqlite_spatialite_load` omitting `version` string required by the schema output.
- Native build failure on Node 26 for Windows caused by LLVM/Clang LTO flags.
- FTS5 syntax errors on malformed user input.
- V8 Garbage Collection `STATUS_ACCESS_VIOLATION` crashes during `CodeModeSandbox` teardown.
- Native V8 thread leaks on Windows.
- SQLCipher `PRAGMA key` syntax errors causing "file is not a database" failures.
- `DB_ENCRYPTION_KEY` environment variable leakage breaking unencrypted Playwright E2E tests.
- `SubscriptionManager` silently dropping subscriptions over stateless `stdio` transports.
- `SchemaManager`/`describeTable` omitting generated columns (resolved by cross-referencing `table_xinfo` and `sqlite_master` DDL).
- Code Mode API normalization regression where parameter arrays were incorrectly processed in `searchRegex`.
- Missing AST validation error trigger in `sandbox.test.ts`.
- Automated subscription test scripts attempting DDL via `sqlite_write_query` instead of dedicated DDL tools and using outdated SDK signatures.
- `reset-database.ps1` crashing with `SQLITE_NOTADB` during encryption when database is locked (now gracefully warns).
- Defunct `--auth-token` argument remaining in `cli.ts` help text.

### Security

- Bumped npm bundled `tar` in Dockerfile to `7.5.16` to apply latest security patches.
