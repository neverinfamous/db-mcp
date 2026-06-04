## [Unreleased]

### Added

- Contextual `README.md` files to core directories (`.agents`, `.github`, `config`, `extensions`, `scripts`, `src`, `tests`).
- `TimeoutError`, `RateLimitError`, and `ConflictError` typed error classes.
- WASM adapter request serialization via reader-writer lock for concurrent HTTP requests.
- `stream: true` and `chunkSize` parameters to `sqlite_read_query` for streaming large result sets.
- `ALLOWED_IO_ROOTS` sandbox via env var and CLI flag to restrict filesystem operations.
- HTTP stateful session enforcement with 30-minute idle timeout, 24-hour absolute TTL, and in-flight request locks.
- Optimistic Concurrency Control (OCC) tools in the `core` group: `sqlite_enable_versioning`, `sqlite_disable_versioning`, `sqlite_check_version`, and `sqlite_conditional_update`.
- Automatic `snake_case` to `camelCase` parameter mapping in validation schemas and the Code Mode V8 proxy.
- `verify-schemas.mjs` and `test-zod-errors.mjs` to `test-server/scripts/` to validate protocol-level `outputSchema` definitions and SDK validation boundaries.

### Changed

- Updated `prompt-template.md` to strictly clarify Code Mode testing rules (enforcing direct payload injection and prohibiting monolithic `try/catch` wrappers) and propagated to all 22 test scripts.
- Surface Code Mode errors as structured typed errors instead of generic internals.
- HTTP rate limit responses now return structured JSON with `code`, `category`, `suggestion`, and `recoverable` fields.
- `sqlite_write_query` and `sqlite_upsert` require an `expectedVersion` parameter for version-enabled tables.
- Bumped `isolated-vm` to `7.0.0` for Node.js 26 compatibility.
- Migrated package manager from `npm` to `pnpm` (v9.15.4) and updated `Dockerfile`.
- Simplified `gotchas.md` by moving tool-specific instructions to native tool group URIs.
- Consolidated and expanded agent prompts and E2E tests to validate `ALLOWED_IO_ROOTS`, OCC, and chunked streaming.
- Split complex tool handlers (`audit-tools.ts`, `window.ts`) into sub-modules and grouped exports via barrel files.
- Extracted inner-loop RegExp constants, added match extraction caching, and simplified string error heuristics to reduce error serialization overhead.
- Optimized `ReadWriteLock` under high-concurrency WASM loads with queue-head indexing and enforced reader-writer fairness boundaries.
- Accelerated Code Mode AST parsing with an LRU cache and single-pass batched script API injections inside `isolated-vm`.
- Replaced generic `Error` classes with domain-specific errors (`ValidationError`, `ConfigurationError`, etc.) in core logic.
- Updated server instructions (`gotchas.md`) to formally document structured `ValidationError` responses.
- Added `(opt-in)` annotation to `sqlite.migration` in Code Mode groups list to match the `(Native-only)` pattern.
- Added cross-group dependency note to `sqlite_hybrid_search` in `text.md`.
- Standardized test prompts to enforce strict sequential numbering and aligned error reporting architecture checks.
- Optimized `sqlite_schema_snapshot` to use `compact: true` by default to reduce LLM context token consumption.

### Fixed

- `sqlite_read_query` now degrades gracefully to full buffering and correctly returns `rows` when `stream: true` is requested inside Code Mode.
- Missing `PROJECT_REGISTRY` and `TEAM_DB_PATH` variables in `mcp-config-example.json` and `.env.example`.
- `ci-health-monitor` failing in strict mode by updating `issues: write` permission to `issues: read` and explicitly adding `add-comment` to safe-outputs.
- Enforced single quotes in YAML frontmatter for agentic workflows and recompiled locks.
- Synchronized tool counts and versions in `DOCKER_README.md` and `SECURITY.md`.
- Refactored `ErrorCategory` enum to a literal union type.
- Enforced strict parsing (`.strict()`) on empty schema objects in migration, admin, and transaction tools.
- Typecast isolated `any` types to `unknown` in admin schemas and metrics tests.
- Refactored `logger.ts` to be fully synchronous to resolve ESLint suppressions.
- Removed unused `zod-to-json-schema` dependency and `error` variable in lock disposal.
- Code Mode sandbox timeouts now correctly throw `TimeoutError`.
- Native addon crashes during Vitest by changing the execution pool from `threads` to `forks`.
- False-positive Promise rejections in `sqlite-adapter-methods.test.ts`.
- Updated outdated `Last updated` date in `test-server/code-map.md`.
- Synced `AUDIT_REDACT` default to `true` in `.env.example` and `mcp-config-example.json`.
- Synced `tool-reference.md` to the `db-mcp.wiki` repository to ensure accurate tool counts and schemas.
- Configured `ALLOWED_IO_ROOTS` in test scripts to automatically silence fallback sandbox warnings when executing the stdio transport.
- Generation script README exclusion now uses case-insensitive prefix matching (`readme*`).
- Removed unused devDependency `rimraf` from `package.json`.
- Fixed inaccurate Native-only tool counts in advanced test suite READMEs and prompt instructions.
- Refactored vector tool handlers to throw proper `ValidationError` and `ResourceNotFoundError` subclasses instead of returning raw error objects, ensuring structured responses include `category` and `recoverable` properties.
- Fixed missing error codes and categories for structured error responses in the `admin-audit` tool group, ensuring `sqlite_server_config` and backup tools meet the Structured Error Response Pattern requirements.
- Fixed `sqlite_cascade_simulator` schema to case-insensitively parse the `operation` parameter instead of failing Zod validation on lowercase inputs.
- Fixed `sqlite_schema_diff` schema to dynamically coerce empty array payloads (`[]`) into empty schema snapshot objects, fixing validation errors for empty baseline/target inputs.

### Security

- **Hard Gate**: Code Mode strictly fail-closes if `isolated-vm` native bindings fail to load (configurable via `CODE_MODE_STRICT_ISOLATION`), preventing insecure fallbacks to `node:vm`.
- **Hard Gate**: HTTP transports fail to start if `ALLOWED_IO_ROOTS` is omitted.
- Stdio transport defaults to no filesystem access (empty `ALLOWED_IO_ROOTS`) if omitted.
- Hardened all filesystem-touching tools to use symlink-aware realpath resolution (`assertSafeIoPath`).
- Sessions exceeding timeout limits are automatically expired and cleaned up.
