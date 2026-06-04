## [Unreleased]

### Added

- `TimeoutError`, `RateLimitError`, and `ConflictError` typed error classes.
- Code Mode errors surface as structured typed errors instead of generic internals.
- HTTP rate limit responses return structured JSON with `code`, `category`, `suggestion`, and `recoverable` fields.
- WASM adapter request serialization via reader-writer lock for concurrent HTTP requests.
- `stream: true` and `chunkSize` parameters to `sqlite_read_query` for streaming large result sets via MCP progress notifications.
- `ALLOWED_IO_ROOTS` sandbox (via env var and CLI flag) to restrict filesystem operations.
- HTTP stateful session enforcement: 30-minute idle timeout, 24-hour absolute TTL, and in-flight request locks.
- Optimistic Concurrency Control (OCC) tools in the `core` group: `sqlite_enable_versioning`, `sqlite_disable_versioning`, `sqlite_check_version`, and `sqlite_conditional_update`.
- Automatic `snake_case` to `camelCase` parameter mapping in validation schemas and the Code Mode V8 proxy.
- `verify-schemas.mjs` and `test-zod-errors.mjs` to `test-server/scripts/` to validate protocol-level `outputSchema` definitions and SDK Zod validation boundary interception.

### Changed

- `sqlite_write_query` and `sqlite_upsert` require an `expectedVersion` parameter for version-enabled tables.
- Bumped `isolated-vm` to `7.0.0` for Node.js 26 compatibility.
- Migrated package manager from `npm` to `pnpm` (v9.15.4), reducing disk footprint and updating `Dockerfile`.
- Simplified `gotchas.md` by moving tool-specific instructions to native tool group URIs.
- Consolidated and expanded agent prompts and E2E tests to validate `ALLOWED_IO_ROOTS`, OCC lifecycle, and chunked streaming.
- Split complex tool handlers (`audit-tools.ts`, `window.ts`) into sub-modules and grouped exports via barrel files to adhere to complexity boundaries.
- Replaced generic `Error` classes with domain-specific `ValidationError`, `ConfigurationError`, etc., in core auth and validation logic.
- Updated server instructions (`gotchas.md`) to formally document structured `ValidationError` responses.
- Added `(opt-in)` annotation to `sqlite.migration` in Code Mode groups list (`gotchas.md`) to match the `(Native-only)` pattern.
- Added cross-group dependency note to `sqlite_hybrid_search` in `text.md` (requires FTS5 + vector column).
- Standardized test prompts (`test-codemode/*.md`, `test-advanced/*.md`, `test-tool-groups/*.md`) to enforce strict sequential numbering and aligned error reporting architecture checks with the latest structured error and Zod validation standards.

### Fixed

- Missing `PROJECT_REGISTRY` and `TEAM_DB_PATH` variables in `mcp-config-example.json` and `.env.example`.
- Fixed `ci-health-monitor` failing in strict mode by updating `issues: write` permission to `issues: read` and explicitly adding `add-comment` to safe-outputs.
- Enforced single quotes in YAML frontmatter for agentic workflows (`docs-drift-detector.md`, `ci-health-monitor.md`, `wiki-drift-detector.md`) and recompiled locks.
- Synchronized tool counts and versions in `DOCKER_README.md` and `SECURITY.md`.
- Refactored `ErrorCategory` enum to a literal union type to reduce runtime footprint.
- Enforced strict parsing (`.strict()`) on empty schema objects in migration, admin, and transaction tools.
- Typecast isolated `any` types to `unknown` in admin schemas and metrics tests.
- Refactored `logger.ts` to be fully synchronous, resolving ESLint suppressions.
- Removed unused `zod-to-json-schema` dependency and `error` variable in lock disposal.
- Code Mode sandbox timeouts now correctly throw `TimeoutError`.
- Native addon crashes during Vitest by changing the execution pool from `threads` to `forks`.
- False-positive Promise rejections in `sqlite-adapter-methods.test.ts`.
- Updated outdated `Last updated` date in `test-server/code-map.md`.
- Synced `AUDIT_REDACT` default to `true` in `.env.example` and `mcp-config-example.json` to match `cli.ts`.
- Synced `tool-reference.md` to the `db-mcp.wiki` repository to ensure accurate tool counts and schemas.
- Configured `ALLOWED_IO_ROOTS` in test scripts (`verify-schemas.mjs` and `test-zod-errors.mjs`) to automatically silence fallback sandbox warnings when executing the stdio transport.
- Generation script README exclusion now uses case-insensitive prefix matching (`readme*`), matching its documented behavior.
- Removed unused devDependency `rimraf` from `package.json` to improve dependency hygiene.
- Inaccurate Native-only tool counts in advanced test suite READMEs and prompt instructions (e.g. FTS5, SpatiaLite, and Window functions).

### Security

- **Hard Gate**: HTTP transports fail to start if `ALLOWED_IO_ROOTS` is omitted.
- Stdio transport defaults to no filesystem access (empty `ALLOWED_IO_ROOTS`) if omitted.
- Hardened all filesystem-touching tools to use symlink-aware realpath resolution (`assertSafeIoPath`).
- Sessions exceeding timeout limits are automatically expired and cleaned up.
