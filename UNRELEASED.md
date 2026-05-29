## [Unreleased]

### Added

- Migrated Code Mode execution to native `isolated-vm` for true V8 memory separation (with `node:vm` fallback).
- 20 new tools across Core, Admin, Stats, JSON, Introspection, and Server Audit groups (including DDL operations, WAL management, schema diffing, and backup lifecycle).
- `sqlite.reportProgress()` utility in Code Mode for long-running sandboxed execution feedback.
- Output schema registry and reference documentation for LLM invocations.
- Expanded Vitest test coverage for `Core`, `Admin`, and `Introspection` tool handlers.

### Changed

- Bumped npm dependencies (including `@modelcontextprotocol/sdk` to 1.29.0, `zod` to 4.4.3) and GitHub Actions versions.
- Optimized token context-window usage by enforcing `limit`/`offset` pagination, result truncation, explicit wide-column validation, and defaulting date tools to computed columns.
- Implemented MCP 2025 Specification annotations globally (`sensitiveHint` for tools, `ASSISTANT_FOCUSED` for resources).
- Enhanced DDL tools (`sqlite_create_table`, `sqlite_describe_table`) with support for `STRICT` tables, generated columns, and `sqlite_temp_master`.
- Improved Code Mode performance with LRU eviction for the `SandboxPool` and global WASM engine caching.
- Upgraded schema caching with a 30-second TTL and targeted DDL invalidation.
- Enhanced structural validation by replacing `sqlite-parser` with an internal regex parser.
- Filtered internal shadow tables (SpatiaLite, db-mcp) from introspection resources.
- Migrated HTTP transport and Code Mode to support multi-instance Redis rate limiting.
- Standardized canonical names and synchronized tool inventory metrics across documentation.
- Clarified backend-switching (`--sqlite` vs `--sqlite-native`) documentation in READMEs.

### Removed

- Simple Bearer Token authentication (replaced by strict OAuth 2.1).
- Redundant `test-wasm-degradation.md` prompt from the test suite.

### Fixed

- Optimized `sqlite_text_replace` to skip rows without matches via an intrinsic predicate, saving DB I/O.
- Enforced structured Zod validation across all tools to eliminate raw `-32602` MCP errors and correctly map invalid identifiers or JSON parse errors to structured domain errors.
- Fixed numeric coercion to properly fail Zod validation on invalid strings instead of falling back to `undefined`.
- Restored `RETURNING *` support in batch insert tools and fixed aliasing bugs in date functions.
- Replaced Windows `process.env.PATH` mutations for SpatiaLite with a secure native `AddDllDirectory` C++ addon.
- Corrected schema introspection to accurately map temporary table indexes.
- Fixed `sqlite_audit_restore_backup` crashing on comment-only snapshots.
- Fixed false-positive path traversal violation on Windows due to drive letter case sensitivity.
- Fixed WASM degradation test assertions for Code Mode.
- Fixed `sqlite_wal` failing to enable WAL mode due to the internal query validation layer erroneously blocking `PRAGMA journal_mode`; now leverages `rawQuery` to execute admin actions correctly.
- Fixed `sqlite_describe_table` to accurately report the `strict` property for SQLite 3.37.1+ STRICT tables by parsing `PRAGMA table_list` with a DDL fallback.
- Fixed incorrect index assertion in Code Mode introspection queryPlan test prompt.

### Security

- **Sandbox Isolation**: Secured execution order for prototype freezing, disabled string code generation, blocked dynamic constructor chain escapes (`Reflect`, `Proxy`, `Symbol`), and required explicit `CODEMODE_ISOLATION_INSECURE=1` flag for `node:vm` fallback usage.
- **SQL Injection**: Replaced template strings with native parameterized bindings (`?`). Hardened WHERE clause generation to strictly block dangerous functions (`INSTR`, `SUBSTR`, `CAST`, `ABS`, subqueries) and sanitize identifiers.
- **Authorization**: Enforced explicit OAuth per-tool scopes globally. Bound session IDs to authenticated subjects to prevent cross-client hijacking.
- **Information Disclosure**: Implemented recursive JSON redaction to sanitize credentials from outputs and logs. Stripped stack traces and sanitized driver messages.
- **Transport**: Bound HTTP server to `127.0.0.1` and replaced insecure proxy headers. Mitigated side-channel timing attacks and blocked CORS wildcards with authentication.
- **DoS**: Upgraded rate limiters to use LRU eviction and UUID tracking. Capped Code Mode payloads to 50MB and implemented 10KB query string bounds. Mitigated Regex DoS.
- **Path Traversal**: Blocked `:memory:`, symlinks, and `..` sequence bypasses. Added strict filesystem boundary validations to database export/import tools.
- **Supply Chain**: Removed persistent credentials from workflows, enforced strict SHA pinning for GitHub Actions, and verified lockfile integrity.
