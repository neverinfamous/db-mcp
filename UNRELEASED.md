## [Unreleased]

### Added

- Comprehensive CI/CD workflow documentation with Mermaid diagrams at `.github/workflows/README.md`.
- `Performance-Tuning.md` guide to the GitHub Wiki covering cache TTLs, WASM vs Native backends, and token efficiency.
- Dependabot verification step to `.github/workflows/ci-health-monitor.md`.
- Internal server metrics exposed at `/metrics` and natively to clients via the `sqlite://metrics` resource.
- `sqlite_hybrid_search` tool combining FTS5 text search and vector embedding search via Reciprocal Rank Fusion (RRF).
- `sqlite_audit_search` tool to securely query the server's own audit logs.
- `sqlite_server_config` administrative tool to dynamically change server logging levels (`debug`, `info`, `warn`, `error`).
- `includeFacets` for faceted search and `cursor` for base64 pagination in search and read queries.
- `recommendComposite` and `queriesToAnalyze` options in `sqlite_index_audit` to automatically recommend indexes.
- SystemDb observability architecture replacing memory-only logs with a structured SQLite sidecar (`system.db`) including `MetricsRegistry` persistence.
- `resources/subscribe` capability (via `SubscriptionManager`) with `schemaChanged` events to automatically notify clients subscribed to `sqlite://schema` and `sqlite://tables`.
- Configuration file support (`.yaml`, `.json`) via `--config` and `--dump-config` CLI flags.
- Encryption at rest (SQLCipher) support for the Native backend and sidecar `SystemDb` audit logs, configurable via `--encryption-key` or `DB_ENCRYPTION_KEY`.
- Capacity Planning Guide covering scaling, memory requirements, and token budget strategies.

### Changed

- Updated `actions/checkout` and `actions/setup-node` to `v6` across all GitHub Actions workflows via SHA pinning.
- Updated `sqlite_read_query` instructions with token conservation guidance.
- Bumped `@vitest/coverage-v8` to `4.1.8`, `typescript-eslint` to `8.60.1`, and `vitest` to `4.1.8`.

### Removed

- `sqlite_append_insight` tool and `memo://insights` partially ported resource.

### Fixed

- Resolved documentation drift by updating the wiki `Home.md` architecture to reflect the current `src/` directory layout.
- Removed hallucinated configuration variables (`CORS_ORIGINS`, `MCP_REQUEST_TIMEOUT`, etc.) from wiki documentation.
- Corrected the omission of `NO_AUTH_ENFORCEMENT` from `.env.example` and `mcp-config-example.json` templates.
- Fixed stale tool token counts in `src/filtering/tool-constants.ts` comments to properly exclude built-in codemode from group math.
- Documentation limits: Shortened `DOCKER_README.md` to safely conform to Docker Hub's 25,000 character limit, and corrected the tool count math in the groupings table.
- Template usability: Populated `mcp-config-example.json` with meaningful placeholder values instead of empty strings for encryption keys, extensions, and auth variables.
- Corrected documentation drift regarding Code Mode being moved to a built-in tool. Removed redundant codemode tool group row from Tool Groups tables in READMEs and Wiki.
- Added missing `MCP_ENABLE_HSTS` variable to the Environment Variables table in `DOCKER_README.md`.
- Fixed the stale `// Admin Tools` comment in `src/filtering/tool-constants.ts`.
- Updated the version comment for `peter-evans/dockerhub-description` in `.github/workflows/docker-publish.yml` from `# v4.0.0` to `# v5.0.0`.

- Updated agentic workflows to strictly use single quotes in YAML frontmatter and explicitly reference `gh copilot` in instructions.
- Populated `mcp-config-example.json` with meaningful placeholder values instead of empty strings.
- Silent fallbacks in `introspection` Zod schemas that swallowed wrong-type validation errors for enum properties.
- `sqlite_spatialite_load` not returning the `version` string as required by the schema output.
- Native build failure on Node 26 for Windows caused by LLVM/Clang LTO flags.
- FTS5 syntax errors on malformed user input.
- V8 Garbage Collection `STATUS_ACCESS_VIOLATION` crashes during `CodeModeSandbox` teardown.
- Native V8 thread leaks on Windows.
- SQLCipher `PRAGMA key` syntax errors causing `file is not a database` failures.
- `DB_ENCRYPTION_KEY` environment variable leakage breaking unencrypted Playwright E2E tests.
- `SubscriptionManager` silently dropping subscriptions over the stateless `stdio` transport.
- `SchemaManager`/`describeTable` omitting generated columns by cross-referencing `table_xinfo` and `sqlite_master` DDL.
- Code Mode API normalization regression where parameter arrays were incorrectly processed for methods like `searchRegex`.
- Missing AST validation error trigger in `sandbox.test.ts`.
- Automated subscription test scripts (`test-subscriptions-raw.mjs`, `test-subscriptions-sdk.mjs`) attempting DDL via `sqlite_write_query` instead of dedicated DDL tools, and using an outdated SDK signature for `setNotificationHandler`.
- Fixed `test-server/reset-database.ps1` to gracefully abort and warn the user when the database is locked (e.g., by an active MCP server or IDE) instead of crashing with a `SQLITE_NOTADB` error during encryption.

### Security

- Bumped npm bundled `tar` in Dockerfile to `7.5.16` to apply latest security patches.
- Added explicit Data Privacy and Compliance policies to `SECURITY.md`.
- Added explicit Supply Chain Security guidance (SHA-pinning) to `SECURITY.md`.
