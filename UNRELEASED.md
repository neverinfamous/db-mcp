## [Unreleased]

### Added
- Fallback to `node:vm` in Code Mode when `isolated-vm` native module is unavailable or incompatible with the current Node.js version.
- `sqlite_list_triggers`, `sqlite_list_constraints`, `sqlite_date_add`, `sqlite_date_diff`, `sqlite_alter_table`, `sqlite_create_trigger`, and `sqlite_drop_trigger` to the Core tool group.
- `sqlite_attach_database`, `sqlite_detach_database`, `sqlite_vacuum_into`, `sqlite_dump` (native only), `sqlite_reindex`, and `sqlite_wal` to the Admin tool group.
- `sqlite_stats_sample` to the Stats tool group.
- `sqlite_json_diff` to the JSON tool group.
- `sqlite_schema_diff` to the Introspection tool group.
- Server Audit tools group with 5 new tools: `sqlite_audit_list_backups`, `sqlite_audit_get_backup`, `sqlite_audit_diff_backup`, `sqlite_audit_restore_backup`, and `sqlite_audit_cleanup`.
- `sqlite.reportProgress(current, total, message)` Code Mode utility for sandboxed JavaScript execution progress reporting.
- Comprehensive DDL rejection tests for `sqlite_write_query` in unit and E2E test suites.
- Vitest tests for timeout enforcement accuracy and `WorkerSandboxPool` concurrency limits.
- Audit tool annotation invariant tests covering all 5 server-level audit tools.
- Suite for WASM graceful degradation testing (`test-wasm-degradation.md`).
- Expanded test coverage for domain errors, Zod validation sweeps, wrong-type numeric coercion, and pagination.
- Expanded `sqlite.reportProgress()` coverage in Code Mode sandbox testing.
- Extracted testing prompt boilerplate in `test-server/prompt-template.md`.
- Three new gotchas for `sqlite_batch_insert` key alignment, `sqlite_schema_diff` parameter format, and `sqlite_upsert` conflict column behavior.
- `outputSchema` registry section in `tool-reference.md`.
- `dockerfile-patch-drift.yml` CI workflow to detect stale Dockerfile transitive dependency patches.

### Changed
- Added guidance to all testing prompts instructing agents to gracefully handle missing cross-group tools without failing the test suite.
- Added `includeRowData` parameter to `sqlite_fts_search` and `sqlite_fts_match_info` schemas (default true) to conserve LLM context.
- Updated `text.md` server instructions to properly document parameter support for `sqlite_text_sentiment`.
- Added `limit` parameter to `sqlite_generate_series` schema to prevent oversized JSON arrays.
- Changed default select behavior in `sqlite_date_add` and `sqlite_date_diff` to only return the computed column to mitigate oversized payloads.
- Implemented `sensitiveHint` tool annotation across all tool groups [MCP 2025 Spec].
- Implemented `ASSISTANT_FOCUSED` resource annotations for dynamically generated help resources [MCP 2025 Spec].
- Updated invariant tests to strictly enforce `sensitiveHint` definitions on all tools.
- Disabled Dependabot version updates and auto-merge workflow to prefer local dependency management.
- Updated `sqlite_create_table` to natively support `STRICT` tables, `foreignKeys`, and `checkConstraints`.
- Updated `sqlite_describe_table` to detect virtual or stored generated columns via `PRAGMA table_xinfo`.
- Updated DDL tools and schema introspection to query `sqlite_temp_master` for temporary tables, indexes, and constraints.
- Filtered internal SpatiaLite shadow tables and db-mcp system tables from resources.
- Refactored `mcp-server.ts` and `session.ts` to adhere to the 500-line modularity limit.
- Extracted `validateSameDirPath()` and `captureSchemaSnapshot()` to consolidate utility functions.
- Standardized testing prompts across all test suites and automated formatting.
- Replaced hardcoded native mode note with auto-detection instruction in prompt template.
- Updated WASM Mode text dynamically across codemode prompts.
- Synchronized inventory tool counts and file counts across all documentation and source files.
- Consolidated testing documentation and added Tool Count Taxonomy to `tool-reference.md`.
- Replaced deprecated alias method names with canonical names in testing prompts and documentation.
- Synchronized sandbox security documentation to reflect code generation restrictions, Proxy nullification, and RPC allowlists.
- Added missing `full` OAuth scope to scope tables and updated `SECURITY.md`.
- Separated TypeScript declaration generation from Javascript bundling to improve build times.
- Optimized `SandboxPool` to use an LRU eviction strategy for `isolated-vm` contexts.
- Refactored `CodeModeSecurityManager` validation for O(1) best-case rejection.
- Implemented global WASM `initSqlJs` promise caching to prevent redundant engine initializations.
- Added context-window protection by explicitly validating wide column counts.
- Increased schema cache TTL to 30 seconds and implemented targeted DDL invalidation.
- Replaced unmaintained `sqlite-parser` with enhanced internal regex structural validation.
- Updated HTTP transport and Code Mode to explicitly support `rate-limit-redis` for multi-instance deployments.
- Refactored `scope-map.ts` to use dynamic `registerToolScope()` string registration, deprecating static group evaluation.

### Removed
- Hard-removed the Simple Bearer Token authentication to enforce OAuth 2.1 as the sole HTTP authentication mechanism.

### Fixed
- **Error Handling**: Eliminated raw MCP `-32602` error frames by enforcing structured Zod validation and domain-specific errors across all tool groups (migration, json, introspection, core, codemode).
- **Payload Optimization**: Added `limit` and `offset` pagination, and truncated large `SELECT` results to prevent oversized JSON payloads in `admin-audit`, `json`, `transactions`, and `core` tool groups.
- **Data Validation**: Fixed logic errors in JSON equality checks (`sqlite_json_diff`), syntax validation in offline DDL tools (`sqlite_migration_risks`), and path validation in administrative backup tools. Added strict column existence validation to `sqlite_count`, `sqlite_date_add`, and `sqlite_date_diff` to prevent silent success with string literal fallbacks.
- **Test Suites**: Fixed test runner artifact cleanup logic, Playwright E2E execution bugs during DDL blocks, and mocked adapter missing methods.
- **Adapter Parity**: Ensured `transactions` tool group is registered in `native-sqlite-adapter.ts`, improved WASM graceful degradation handling, and fixed WAL flush synchronization issues during tests.
- **SQL Execution**: Restored `RETURNING *` support in batch insert tools, fixed syntax errors when `whereClause` is missing in text and JSON tools, and resolved aliasing bugs in date functions.
- **Admin & Schema**: Fixed validation return shapes for `sqlite_create_view`, improved `sqlite_list_triggers` error reporting, and ensured accurate temporary table indexing.
- **Sandbox/Codemode**: Resolved TypeScript dynamic assignment typing errors and secured `worker-script.ts` prototype freezing order.
- **Native Modules**: Replaced brittle `process.env.PATH` mutation for loading SpatiaLite on Windows with a secure native `AddDllDirectory` C++ addon.

### Security
- **Sandbox & VM Isolation**: Migrated fallback from `node:vm` to `isolated-vm` for true V8 isolate memory separation. Disabled string code generation, blocked dynamic constructor chain escapes (`Reflect`, `Proxy`, `Symbol`), secured prototype freezing, and required explicit `CODEMODE_ISOLATION_INSECURE=1` flag for VM fallback usage.
- **SQL Injection (SQLi)**: Replaced unparameterized SQL template strings with native parameterized bindings (`?`) across execution paths (vector, text, stats, core). Hardened WHERE clause generation to sanitize identifiers and strictly block dangerous functions (`INSTR`, `SUBSTR`, `CAST`, `ABS`, subqueries, etc.).
- **Authorization & Scoping**: Enforced explicit OAuth per-tool scopes globally, removing implicit `admin` fallbacks. Bound session IDs strictly to authenticated subjects to prevent cross-client hijacking. Derived tool scopes dynamically from metadata.
- **Information Disclosure**: Implemented recursive structural JSON redaction to sanitize credentials (AWS, GitHub, tokens) from Code Mode output and audit logs. Stripped stack traces from worker errors and sanitized driver messages to prevent internal infrastructure leakage.
- **Transport Security**: Bound HTTP server default host to `127.0.0.1` and replaced insecure proxy headers logic. Mitigated side-channel timing attacks in OAuth and bearer token validation. Blocked CORS wildcards combined with authentication.
- **Denial of Service (DoS)**: Upgraded rate limiters to use LRU eviction and UUID tracking, mitigating bucket collision attacks. Capped Code Mode payloads to 50MB and implemented 10KB bounds on query strings. Mitigated Regex DoS in text tools and blocked CPU-starvation SQLite PRAGMAs.
- **Path Traversal**: Explicitly blocked `:memory:`, symlinks, and `..` sequence bypasses in `validateSameDirPath`. Added strict filesystem boundary validations to database backup, restore, dump, and spatial import tools.
- **CI/CD Supply Chain**: Removed persistent credentials and privileged write scopes from workflows. Enforced strict SHA pinning for GitHub Actions, verified lockfile integrity, and pinned npm versions.
