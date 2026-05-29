## [Unreleased]

### Added

- Native `isolated-vm` execution for Code Mode with graceful fallback to `node:vm` when native compilation fails.
- 15 new tools across Core, Admin, Stats, JSON, and Introspection groups (including DDL operations, WAL management, and Schema Diffing).
- Server Audit tool group with 5 new administrative tools for backup lifecycle management.
- `sqlite.reportProgress()` utility in Code Mode for long-running sandboxed execution feedback.
- Output schema registry and 'gotchas' reference documentation to prevent common LLM invocation errors.

### Changed

- **Dependency Updates**: Bumped npm dependencies (including `@modelcontextprotocol/sdk` to 1.29.0, `zod` to 4.4.3, `redis` to 6.0.0, `typescript-eslint` to 8.60.0) and updated GitHub Actions versions (`trufflehog`, `github-script`, `setup-buildx-action`, `metadata-action`, `trivy-action`).
- Optimized context-window usage by enforcing `limit` parameters on generation tools, defaulting date tools to computed columns only, and explicitly validating wide column counts.
- Implemented MCP 2025 Specification annotations globally (`sensitiveHint` for tools, `ASSISTANT_FOCUSED` for resources).
- Enhanced DDL tools (`sqlite_create_table`, `sqlite_describe_table`) with full support for `STRICT` tables, generated columns, and `sqlite_temp_master` introspection.
- Improved Code Mode performance with LRU eviction for the `SandboxPool` and global WASM engine caching.
- Upgraded schema caching with a 30-second TTL and targeted DDL invalidation.
- Enhanced structural validation by replacing `sqlite-parser` with a robust internal regex parser.
- Filtered internal shadow tables (SpatiaLite, db-mcp) from introspection resources to reduce noise.
- Migrated HTTP transport and Code Mode to support multi-instance Redis rate limiting.
- Standardized canonical names and synchronized tool inventory metrics across all documentation.
- Added prominent backend-switching callouts to README and DOCKER_README, making the `--sqlite` vs `--sqlite-native` flag swap immediately discoverable from the primary config examples.

### Removed

- Simple Bearer Token authentication in favor of strict OAuth 2.1 enforcement.
- Redundant `test-wasm-degradation.md` prompt from the test suite, as WASM graceful degradation behavior is already thoroughly validated during the admin tool group tests.

### Fixed

- Fixed `coerceNumber` helper in `spatialite` and `window` native tools to preserve non-numeric strings for Zod validation instead of silently falling back to `undefined`, ensuring invalid type errors are correctly intercepted and transformed into structured domain errors.
- Fixed missing parameter validation schemas in `sqlite_cascade_simulator`, `sqlite_schema_diff`, `sqlite_migration_risks`, and `sqlite_query_plan` to properly catch empty `{}` invocations, preventing raw `-32602` MCP errors from escaping the SDK boundary.
- Fixed `InvalidIdentifierError` mapping to return structured `VALIDATION_ERROR` instead of internal MCP errors when validation fails for tool arguments like `tableName`.
- Fixed JSON parse errors in JSON tools (like `sqlite_json_pretty`) mapping to return structured `MALFORMED_JSON` instead of generic `UNKNOWN_ERROR`.
- Enforced structured Zod validation to entirely eliminate raw `-32602` MCP error frames globally.
- Restored `RETURNING *` support in batch insert tools and fixed aliasing bugs in date functions.
- Fixed logical data validation errors across `sqlite_json_diff`, numeric tool coercion, and backup path verification.
- Implemented payload pagination (`limit`/`offset`) and result truncation to prevent JSON serialization from exceeding the token context window.
- Replaced brittle Windows `process.env.PATH` mutations for SpatiaLite with a secure native `AddDllDirectory` C++ addon.
- Corrected schema introspection to accurately map temporary table indexes and improved `sqlite_list_triggers` error reporting.
- Secured Code Mode `worker-script.ts` prototype freezing execution order to prevent sandbox escapes.

### Security

- **Sandbox & VM Isolation**: Migrated fallback from `node:vm` to `isolated-vm` for true V8 isolate memory separation. Disabled string code generation, blocked dynamic constructor chain escapes (`Reflect`, `Proxy`, `Symbol`), secured prototype freezing, and required explicit `CODEMODE_ISOLATION_INSECURE=1` flag for VM fallback usage.
- **SQL Injection (SQLi)**: Replaced unparameterized SQL template strings with native parameterized bindings (`?`) across execution paths. Hardened WHERE clause generation to sanitize identifiers and strictly block dangerous functions (`INSTR`, `SUBSTR`, `CAST`, `ABS`, subqueries).
- **Authorization & Scoping**: Enforced explicit OAuth per-tool scopes globally, removing implicit `admin` fallbacks. Bound session IDs strictly to authenticated subjects to prevent cross-client hijacking.
- **Information Disclosure**: Implemented recursive structural JSON redaction to sanitize credentials (AWS, GitHub, tokens) from Code Mode output and audit logs. Stripped stack traces from worker errors and sanitized driver messages.
- **Transport Security**: Bound HTTP server default host to `127.0.0.1` and replaced insecure proxy headers logic. Mitigated side-channel timing attacks in OAuth and bearer token validation. Blocked CORS wildcards combined with authentication.
- **Denial of Service (DoS)**: Upgraded rate limiters to use LRU eviction and UUID tracking, mitigating bucket collision attacks. Capped Code Mode payloads to 50MB and implemented 10KB bounds on query strings. Mitigated Regex DoS in text tools and blocked CPU-starvation SQLite PRAGMAs.
- **Path Traversal**: Explicitly blocked `:memory:`, symlinks, and `..` sequence bypasses in `validateSameDirPath`. Added strict filesystem boundary validations to database backup, restore, dump, and spatial import tools.
- **CI/CD Supply Chain**: Removed persistent credentials and privileged write scopes from workflows. Enforced strict SHA pinning for GitHub Actions, verified lockfile integrity, and pinned npm versions.
