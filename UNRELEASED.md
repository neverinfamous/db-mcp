## [Unreleased]

### Added
- `TimeoutError`, `RateLimitError`, and `ConflictError` typed error classes with `TIMEOUT` and `RATE_LIMIT` error categories for precise agent error classification
- Code Mode timeout errors now surface as `TimeoutError` (category: `timeout`, recoverable: `true`) instead of generic `InternalError`
- Code Mode rate limit errors now throw typed `RateLimitError` with `retryAfterMs` context instead of inline response literals
- HTTP transport rate limit responses now return structured error shapes with `code`, `category`, `suggestion`, and `recoverable` fields
- WASM adapter request serialization via reader-writer lock for concurrent HTTP deployments
- Added `stream: true` parameter (with optional `chunkSize`) to `sqlite_read_query` for streaming query results via MCP progress notifications, reducing memory pressure for large result sets.
- Implemented `ALLOWED_IO_ROOTS` filesystem boundary sandbox to restrict IO operations (e.g., CSV imports, backup dumps) to explicitly authorized directories.
- Added `--allowed-io-roots` CLI flag and `ALLOWED_IO_ROOTS` environment variable to configure the IO sandbox.
- Session timeout enforcement for HTTP stateful mode: 30-minute idle timeout with 1-minute sweep interval, 24-hour absolute TTL, and in-flight request protection via session locks.
- Added 4 new Optimistic Concurrency Control (OCC) tools to the `core` group: `sqlite_enable_versioning`, `sqlite_disable_versioning`, `sqlite_check_version`, and `sqlite_conditional_update`.
- Implemented universal `snake_case` parameter mapping in `resolveAliases` for automatic validation schema forgiveness.
- Wrapped Code Mode Sandbox bindings and `GroupApi` handlers with a `Proxy` injected directly into the `isolated-vm` sandbox context to automatically map `snake_case` method calls to their `camelCase` implementations without crossing V8 boundaries.
### Changed
- `sqlite_write_query` and `sqlite_upsert` now accept an optional `expectedVersion` parameter. If a table is versioned, this parameter becomes required to prevent lost updates, throwing a `ConflictError` on mismatch.
- Updated `sqlite_read_query` agent testing prompts (`test-core-data.md`, `test-codemode-core.md`, `test-codemode-advanced-core.md`) to natively validate streaming chunk degradation behavior.
- Updated node integration tests (`test-progress.mjs`) to rigorously verify E2E JSON-RPC chunked row emission over stdio for `sqlite_read_query`.
- Updated server instructions (`admin.md`, `gotchas.md`) to explicitly document `ALLOWED_IO_ROOTS` behavior and requirements for backup/restore and CSV operations.
- Updated agent testing prompts (`test-admin-core.md`, `test-admin-extensions.md`, `test-codemode-admin.md`, `test-codemode-advanced-admin.md`) to include explicit absolute path traversal boundary tests for `ALLOWED_IO_ROOTS`.
- Updated `core` agent testing prompts (`test-core-data.md`, `test-codemode-core.md`) to include comprehensive lifecycle and error boundary tests for Optimistic Concurrency Control tools and `expectedVersion` requirements.
- Added Playwright E2E tests for `ALLOWED_IO_ROOTS` boundary enforcement and HTTP startup failures.
- Audited and updated all testing prompt `README.md` files to explicitly mandate `ALLOWED_IO_ROOTS` environment variable usage, document HTTP session timeouts, and require chunked stream verification.
- Refactored and simplified server instructions (`gotchas.md`), redistributing tool-specific gotchas to their native tool group documentation URIs (`sqlite://help/*`) to reduce the root help payload size.
- Bumped `isolated-vm` to `7.0.0` (major version aligns with V8 engine upgrades) for out-of-the-box compatibility with Node.js 26.
- Migrated project package manager from `npm` to `pnpm` (`v9.15.4`) for improved performance, stricter dependency resolution, and reduced disk footprint.
- Updated `Dockerfile` to use `pnpm` exclusively, eliminating the need to manually patch transitively bundled `npm` vulnerabilities.
### Fixed
- Fixed Code Mode sandbox timeouts failing to surface as structured `TimeoutError` responses by catching execution timeouts directly from the sandbox pool execution result.
- Fixed native addon crashes during Vitest execution by migrating the execution pool from `threads` to `forks` in `vitest.config.ts`, ensuring isolated V8 heaps for `isolated-vm`.
- Fixed false-positive test failures in `sqlite-adapter-methods.test.ts` by correcting async `Promise` rejection assertions and `connectionPooling` capability flags.
- Removed unused `error` variable in `read-write-lock.ts` disposal handler.

### Security
- **Hard Gate**: HTTP transports will now fail to start (exit code 1) if `ALLOWED_IO_ROOTS` is not explicitly provided, preventing ambient filesystem access for exposed servers.
- Stdio transport now defaults to an empty `ALLOWED_IO_ROOTS` array (NO filesystem access) if not explicitly provided, and issues a security warning about implied trust.
- Hardened all filesystem-touching tools (`sqlite_backup`, `sqlite_vacuum_into`, `sqlite_dump`, `sqlite_restore`, `sqlite_attach_database`, `sqlite_verify`, `sqlite_create_csv_virtual_table`, `sqlite_analyze_csv`) to use symlink-aware realpath resolution (`assertSafeIoPath`) preventing path traversal attacks.
- Sessions that exceed the idle timeout or absolute TTL are automatically expired, closing the transport and cleaning up all associated state.
