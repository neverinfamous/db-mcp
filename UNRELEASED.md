## [Unreleased]

### Added

- 20 new tools across Core, Admin, Stats, JSON, Introspection, and Server Audit groups.
- `sqlite.reportProgress()` utility in Code Mode for sandboxed execution feedback.
- `onlyDifferences` flag in `sqlite_json_diff` tool to filter identical rows.
- Output schema registry and reference documentation for LLM invocations.

### Changed

- Migrated Code Mode execution to native `isolated-vm` for V8 memory separation (with `node:vm` fallback).
- Bumped dependencies, including `@modelcontextprotocol/sdk` to 1.29.0 and `zod` to 4.4.3.
- Optimized token context-window usage via pagination, result truncation, wide-column validation, and computed date columns.
- Optimized `sqlite_text_replace` to skip rows without matches, saving DB I/O.
- Enhanced DDL tools with support for `STRICT` tables, generated columns, and `sqlite_temp_master`.
- Improved Code Mode performance with LRU eviction and global WASM engine caching.
- Upgraded schema caching with a 30-second TTL and targeted DDL invalidation.
- Replaced `sqlite-parser` with an internal regex parser for structural validation.
- Added MCP 2025 Specification annotations globally (`sensitiveHint`, `ASSISTANT_FOCUSED`).
- Filtered internal shadow tables from introspection resources.
- Migrated HTTP transport and Code Mode to support multi-instance Redis rate limiting.
- Standardized canonical names and tool inventory metrics across documentation.
- Clarified backend-switching documentation in READMEs.

### Removed

- Simple Bearer Token authentication (replaced by strict OAuth 2.1).
- Redundant `test-wasm-degradation.md` prompt from the test suite.

### Fixed

- Fixed raw `-32602` MCP errors by enforcing structured Zod validation across all tools.
- Fixed numeric coercion falling back to `undefined` on invalid strings.
- Restored `RETURNING *` support in batch insert tools and fixed aliasing bugs in date functions.
- Fixed Windows SpatiaLite loading by replacing `process.env.PATH` mutations with a native C++ addon.
- Fixed schema introspection failing to accurately map temporary table indexes.
- Fixed `sqlite_audit_restore_backup` crashing on comment-only snapshots.
- Fixed false-positive path traversal violations on Windows caused by drive letter case sensitivity.
- Fixed WASM degradation test assertions for Code Mode.
- Fixed `sqlite_wal` failing to enable WAL mode.
- Fixed `sqlite_describe_table` failing to accurately report the `strict` property.
- Fixed incorrect index assertion in Code Mode introspection queryPlan test prompt.

### Security

- **Sandbox Isolation**: Secured prototype freezing, disabled string code generation, and blocked constructor chain escapes.
- **SQL Injection**: Replaced template strings with native parameterized bindings and hardened WHERE clause generation.
- **Authorization**: Enforced explicit OAuth per-tool scopes and bound session IDs to authenticated subjects.
- **Information Disclosure**: Implemented recursive JSON redaction to sanitize credentials from outputs and logs.
- **Transport**: Bound HTTP server to `127.0.0.1`, replaced insecure proxy headers, and mitigated timing attacks.
- **DoS**: Upgraded rate limiters, capped Code Mode payloads to 50MB, and implemented 10KB query string bounds.
- **Path Traversal**: Blocked `:memory:`, symlinks, and `..` sequence bypasses, and added filesystem boundary validations.
- **Supply Chain**: Removed persistent credentials from workflows, enforced SHA pinning for actions, and verified lockfile integrity.
