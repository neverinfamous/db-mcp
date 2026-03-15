# Unreleased

## Added
- **E2E Tests**: Ported 32 HTTP transport e2e tests from memory-journal-mcp covering streaming (raw SSE for GET /mcp and GET /sse), advanced session management (cross-protocol guard, sequential isolation, post-DELETE rejection), rate limiting (429 burst, Retry-After header, health exemption), and OAuth 2.1 discovery (RFC 9728 metadata, scopes, auth gating). Enriched existing health and security specs with timestamp validation, session ID checks, CORS header assertions, and HSTS opt-in testing. Added `startServer()`/`stopServer()` managed child-process lifecycle helpers.
- **Integration Test Scripts**: Ported `test-instruction-levels.mjs` and `test-tool-annotations.mjs` terminal scripts from memory-journal-mcp to `test-database/`.
- **MCP Compliance**: Added `READ_ONLY` annotations (`openWorldHint: false`) to 3 built-in server tools (`server_info`, `server_health`, `list_adapters`). Added missing `openWorldHint: false` to `sqlite_execute_code` codemode tool. All 118+ tools now have complete MCP annotations.

## Changed
- **Complexity Refactor**: Addressed source code complexity by splitting files exceeding logical grouping boundaries into modular directories with barrel exports:
  - Extracted query execution, initialization, and connection lifecycle handlers from `sqlite-adapter.ts`.
  - modularized authentication routines in `middleware.ts` and `scopes.ts`.
  - Refined administration and stats tools (`backup.ts`, `tracking.ts`, `vtable.ts`, `inference.ts`).
  - Extracted resource, tool, and prompt registration logic from `database-adapter.ts`.
- **Code Quality Audit**: Addressed technical debt across the codebase by replacing generic `any` casts with type-safe structures, normalizing test file naming from `.test` to `kebab-case`, extracting massive `native-sqlite-adapter.ts` tooling logic into `registration`, and removing unsafe type imports.
- **Code Quality Audit**: Removed dead code by deleting unused barrel files (`src/auth/index.ts` and `src/transports/index.ts`).
- **Performance Audit**: Disabled source maps generation in the production build to significantly reduce bundle size (from 3.7MB to 1.5MB), optimized sandbox serialization to reduce runtime memory allocations, and added caching to schema introspection tools via `SchemaManager`.
- **Unified Audit**: Enabled code splitting in `tsup.config.ts` to deduplicate shared modules across the 3 entry points.
- **MCP Compliance**: Added `openWorldHint: false` to all tool annotation presets and `openWorldHint` to the `ToolAnnotations` type interface.
- **MCP Compliance**: Added `title` to built-in server tools (`server_info`, `server_health`, `list_adapters`).
- **MCP Compliance**: Added `error` field to `ErrorResponseFields` mixin (was 5 fields, now 6 per mcp-builder §2.2.2).
- **MCP Compliance**: Created `src/auth/transport-agnostic.ts` re-exporting non-Express auth utilities for transport portability.
- **MCP Compliance**: Renamed `formatHandlerErrorResponse` → `formatHandlerError` across all tool handlers, tests, and barrel exports per mcp-builder §2.2.2 single-formatter standard. Old name preserved as deprecated alias in `format.ts`.
- **MCP Compliance**: Wired prompt `argsSchema` to SDK registration — prompts with required arguments now expose typed schemas via `prompts/list`. All-optional and zero-arg prompts correctly omit `argsSchema` per SDK gotcha (§1.4).
- **MCP Compliance**: Consolidated duplicate `ErrorFieldsMixin` / `ErrorResponseFields` to single source of truth in `src/utils/errors/error-response-fields.ts` with re-export alias.
- **MCP Compliance**: Wired `--instruction-level` CLI flag and `INSTRUCTION_LEVEL` env var to `generateInstructions()` — allows choosing `essential` (~1K tokens), `standard` (default, ~1.2K tokens), or `full` (~4.1K tokens) briefing depth.
- **HSTS**: Wired `--enable-hsts` CLI flag and `MCP_ENABLE_HSTS` env var to the HTTP transport — previously defined in types but never reachable from the CLI.

## Security
- **Strict Validation**: Hardened all Zod tool input schemas across sqlite and native-sqlite adapters using `.strict()` to reject unknown fields.
- **SQL Injection**: Added strong regex validation to `savepoint` names in the Native SQLite transaction methods to prevent potential arbitrary SQL injection.
- **CORS Advisory**: Updated `README.md` and `DOCKER_README.md` to explicitly warn about the permissive `["*"]` default CORS property in production HTTP deployments.
- **Unified Audit**: SHA-pinned all GitHub Actions in `lint-and-test.yml` and `e2e.yml` for supply chain safety. Updated stale v4 SHAs to current v6 in `e2e.yml`. Removed manually-maintained `LABEL version` from `Dockerfile` to prevent version drift. Fixed `flatted` dependency vulnerability (GHSA-25h7-pfq9-p65f).
- **DNS Rebinding**: Added `localhostHostValidation()` middleware from MCP SDK to the HTTP transport to prevent DNS rebinding attacks.
- **Supply Chain**: SHA-pinned remaining 2 un-pinned CI actions (`actions/checkout`, `actions/setup-node`) in the benchmarks job of `lint-and-test.yml`.
- **Supply Chain**: Bumped GitHub Actions to latest major versions (Node 24 runtime):
  - `docker/login-action` v3 → v4
  - `docker/build-push-action` v6 → v7
  - `docker/metadata-action` v5 → v6
  - `actions/upload-artifact` v6 → v7
  - `actions/download-artifact` v7 → v8

### Dependencies
- Bumped `better-sqlite3` from 12.6.2 to 12.8.0
- Bumped `@types/node` from 25.4.0 to 25.5.0
- Bumped `@vitest/coverage-v8` from 4.0.18 to 4.1.0
- Bumped `vitest` from 4.0.18 to 4.1.0

## Fixed
- **Validation Leaks**: Fixed Zod output schema errors in JSON tools (`sqlite_json_valid`, `sqlite_json_validate_path`) and core tools (`sqlite_drop_table`, `sqlite_create_index`, `sqlite_drop_index`) that caused the server to return raw MCP `-32602` validation frames instead of structured domain errors, by marking conditional message fields as optional.
- **Input Coercion**: Handled invalid numeric input types gracefully in JSON operations (`sqlite_json_each`, `sqlite_json_query`, `sqlite_json_analyze_schema`, `sqlite_json_storage_info`) and migration tools (`sqlite_migration_rollback`, `sqlite_migration_history`) by replacing `z.coerce.number()` with `z.preprocess()` for `limit`, `sampleSize`, `id`, and `offset` parameters — non-numeric values now silently fall back to defaults instead of producing raw MCP `-32602` validation frames.
- **JSON Serialization**: Fixed an issue in `sqlite_json_query` where querying a column converted to JSONB would return the raw binary Buffer instead of the parsed JSON string by explicitly wrapping the column selection in `json()`.
- **PRAGMA/EXPLAIN LIMIT**: Fixed `sqlite_read_query` appending `LIMIT 1000` to PRAGMA and EXPLAIN statements, causing syntax errors. Safety limit injection now only applies to SELECT and WITH queries.
