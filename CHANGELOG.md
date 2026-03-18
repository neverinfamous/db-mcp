# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased](https://github.com/neverinfamous/db-mcp/compare/v1.1.0...HEAD)

## [1.1.0](https://github.com/neverinfamous/db-mcp/releases/tag/v1.1.0) - 2026-03-18

### Added

- **E2E Tests**: Ported 32 HTTP transport e2e tests from memory-journal-mcp covering streaming (raw SSE for GET /mcp and GET /sse), advanced session management (cross-protocol guard, sequential isolation, post-DELETE rejection), rate limiting (429 burst, Retry-After header, health exemption), and OAuth 2.1 discovery (RFC 9728 metadata, scopes, auth gating). Enriched existing health and security specs with timestamp validation, session ID checks, CORS header assertions, and HSTS opt-in testing. Added `startServer()`/`stopServer()` managed child-process lifecycle helpers.
- **Integration Test Scripts**: Ported `test-instruction-levels.mjs` and `test-tool-annotations.mjs` terminal scripts from memory-journal-mcp to `test-server/`.
- **MCP Compliance**: Added `READ_ONLY` annotations (`openWorldHint: false`) to 3 built-in server tools (`server_info`, `server_health`, `list_adapters`). Added missing `openWorldHint: false` to `sqlite_execute_code` codemode tool. All 118+ tools now have complete MCP annotations.
- **Help Resources**: Added `sqlite://help` and `sqlite://help/{group}` MCP resources for on-demand tool reference documentation. Agents receive a slim ~680-char `instructions` payload pointing to these resources, instead of the previous ~3.5K+ payload that exceeded MCP client character limits and was silently truncated. Help resources are filtered by `--tool-filter` — only enabled groups get help resources registered.
- **Help Resources**: Added `sqlite://help/introspection` and `sqlite://help/migration` help resources — these tool groups were missing dedicated help content, leaving HTTP/SSE/streaming users without access to reference documentation for 15 tools.
- **E2E Tests**: Added 6 new spec files (~209 tests) automating the deterministic portions of manual agent testing prompts: `zod-sweep.spec.ts` (Zod validation sweep — every tool with required params called with `{}`), `errors-extended.spec.ts` (per-group domain error paths), `codemode.spec.ts` (sandbox lifecycle, security, readonly, workflows), `codemode-groups.spec.ts` (all 9 groups via `sqlite.*` API), `numeric-coercion.spec.ts` (string-typed numeric params), `boundary.spec.ts` (empty tables, NULLs, idempotency, edge cases). Added `expectHandlerError` and `callToolRaw` helpers to `helpers.ts`.
- **E2E Tests**: Added 3 native-only spec files expanding systematic validation coverage to native-exclusive tools: `zod-sweep-native.spec.ts` (20 tools — FTS5, window functions, transactions, SpatiaLite called with `{}`), `errors-native.spec.ts` (20 error path tests — nonexistent tables/columns, invalid SQL/WKT, bad savepoints), `numeric-coercion-native.spec.ts` (8 tests — string-typed numeric params for window `windowSize`/`buckets`/`offset`/`limit`, FTS `limit`, transaction `mode`). Raises Zod sweep coverage from 83% to 98% of all tools.
- **E2E Tests**: Added `help-resources.spec.ts` (11 tests — validates `sqlite://help` root + all 8 group help resources are listed, readable, and return non-empty markdown) and `aliases.spec.ts` (14 tests — validates backward-compatible parameter aliases `tableName`→`table`, `sql`→`query`, `name`→`indexName` across all 8 core tools including precedence and error paths).
- **Annotation Invariant Tests**: Added `tool-annotations.test.ts` that enforces every tool in both WASM and Native adapters has `annotations` with explicit `readOnlyHint`. Includes per-group checks (all stats/introspection tools must be `readOnly`), specific window function assertions, and title validation. Would have caught the 6 missing window function annotations and the 7 missing transaction annotations.
- **Output Schema Invariant Tests**: Added `tool-output-schemas.test.ts` that enforces every tool has an `outputSchema` defined, every schema is a valid Zod schema, every schema accepts error responses (`{success: false, error: "..."}`), schemas reference centralized `output-schemas/` exports (not inline `z.object()`), specific tool-to-schema wiring for ~70 tools, and no orphan schemas exist. Covers both WASM and Native adapters.
- **E2E Tests**: Added 6 window function readonly smoke tests to `codemode.spec.ts` — verifies all window tools (`windowRowNumber`, `windowRank`, `windowLagLead`, `windowRunningTotal`, `windowMovingAvg`, `windowNtile`) work in `readonly: true` mode on native and are correctly unavailable on WASM. Uses dual-branch assertions (zero skips).
- **Window Tool Tests**: Added annotation assertions to `ranking.test.ts` — verifies all 6 window tools have `readOnly` annotations with titles.
- **E2E Tests (Prompt Audit)**: Added 12 gap-closing tests identified by auditing manual testing prompts against automated suites: (1) `codemode.spec.ts` — API discoverability tests for `sqlite.help()`, per-group `help()`, method aliases, convenience aliases, and all 9 groups returning `>0` methods; timeout enforcement for infinite loops. (2) `payloads-stats-advanced.spec.ts` — self-correlation edge case (column1 === column2 → ≈1.0). (3) `payloads-fts.spec.ts` — FTS5 boolean AND/NOT operators. (4) `payloads-migration.spec.ts` — duplicate version string rejection. (5) `boundary.spec.ts` — vector empty table edge cases (count, search, stats, dimensions on table with 0 vectors). (6) New `codemode-introspection.spec.ts` (~16 tests) — introspection code-mode-only params (`sections`, `compact`, `checks`, `table`, `includeTableDetails`, `limit`, `direction`). (7) New `transactions-nested.spec.ts` (~4 tests) — nested savepoint data correctness (rollback_to sp2 keeps sp1 data; rollback_to sp1 undoes everything after sp1). (8) New `integration-workflows.spec.ts` (~8 tests) — cross-group pipelines (Core→JSON→Stats, Core→Vector→Text, Admin→Introspection health check, Core+Stats cross-validation, data integrity verification).
- **E2E Tests (Resource + Prompt Depth)**: Added 13 gap-closing tests by auditing `test-resources.md` and `test-prompts.md` against existing specs. Resources (R1–R9): schema table count + names, templated reads (`sqlite://table/test_products/schema` + `test_orders`), nonexistent table error, index name assertions (`idx_orders_status`, `idx_products_category`), health backend info, meta PRAGMA fields (`page_size`), views empty array, insights write+read cycle via `sqlite_append_insight`, help keyword assertions ("gotcha", "code mode", "wasm"). Prompts (P1–P4): data-fetching prompts embed real table names (`explain_schema` contains "test_products"), argsSchema on prompts with required args (query_builder ≥3, data_analysis ≥1, explain_schema 0), missing required args graceful handling, deeper content assertions (debug_query reflects submitted SQL, migration reflects change description).
- **Error Handling — `TransactionError` Subclass** — New `TransactionError` class in `utils/errors/classes.ts` for commit/rollback/savepoint failures, using `QUERY` category with `recoverable: true`
- **Error Handling — `ErrorContext` Interface** — New `ErrorContext` interface in `utils/errors/format.ts` for optional tool/table/sql context on error formatting calls
- **Error Handling — `formatHandlerError` Export** — Canonical cross-project name for the primary error formatter; `formatError` remains as an alias
- **Error Handling — Zod Path Extraction** — `formatHandlerError` now extracts field paths from ZodErrors (e.g., `table: Required` instead of raw JSON issue arrays)
- **OAuth — `FULL` Scope** — Added `full` scope that grants unrestricted access to all operations, completing the `full ⊃ admin ⊃ write ⊃ read` hierarchy
- **OAuth — `TOOL_GROUP_SCOPES` Mapping** — Declarative `Record<ToolGroup, StandardScope>` replaces imperative `*_SCOPE_GROUPS` arrays as single source of truth
- **OAuth — Scope Utilities** — Added `hasScope()`, `hasAnyScope()`, `hasAllScopes()`, `getScopeForToolGroup()`, `getScopeDisplayName()` for hierarchical scope checks
- **OAuth — Scope Map** — New `scope-map.ts` with `getRequiredScope()` for O(1) tool-name-to-scope reverse lookup
- **OAuth — Auth Context** — New `auth-context.ts` using `AsyncLocalStorage` for per-request auth context threading to tool handlers
- **OAuth — Transport-Agnostic Auth** — Added `AuthenticatedContext`, `createAuthenticatedContext()`, `validateAuth()`, `formatOAuthError()` to decouple auth from Express
- **OAuth — Resource Server Enhancements** — Added `isScopeSupported()`, `getWellKnownPath()`, `resource_documentation`, `resource_signing_alg_values_supported` to RFC 9728 metadata
- **OAuth — Unit Test Coverage** — Added 8 unit test files for complete auth module coverage: scopes, scope-map, auth-context, errors, oauth-resource-server, middleware, token-validator, authorization-server-discovery
- **Transport Feature Backport** — `trustProxy` config option for X-Forwarded-For client IP extraction behind reverse proxies
- **Transport Feature Backport** — `enableHSTS` / `hstsMaxAge` config options (HSTS now opt-in, was always-on)
- **Transport Feature Backport** — Wildcard subdomain CORS matching (e.g., `*.example.com`)
- **Transport Feature Backport** — New `middleware.test.ts` with 14 unit tests for `getClientIp()` and `matchesCorsOrigin()`
- **Playwright E2E Test Suite** — 12 spec files, dual-adapter (WASM + Native) and dual-transport (SSE + Streamable HTTP) coverage
  - `health.spec.ts`: Health endpoint and MCP initialization handshake
  - `protocols.spec.ts`: Streamable HTTP and Legacy SSE protocol validation (session IDs, invalid JSON, missing params)
  - `tools.spec.ts`: Tool listing, read/write execution, validation errors, Code Mode, and cross-group coverage (all 9 tool groups) via MCP SDK Client
  - `security.spec.ts`: 404 handler, 413 payload limit, security headers, CORS preflight, OAuth status, Referrer-Policy
  - `sessions.spec.ts`: Full Streamable HTTP session lifecycle — init, notifications, tool calls with session ID, SSE/DELETE rejection, termination
  - `stateless.spec.ts`: Stateless mode (`--stateless`) — session-free POST, SSE 405, DELETE no-op, legacy SSE 404, health
  - `resources.spec.ts`: All 7 static MCP resources (`sqlite://schema`, `tables`, `health`, `indexes`, `views`, `meta`, `memo://insights`) and resource templates via SDK Client
  - `prompts.spec.ts`: List + get all 10 MCP prompts with representative arguments
  - `streamable-http.spec.ts`: Streamable HTTP transport (MCP 2025-03-26) — init, tools, resources, prompts via modern transport
  - `native.spec.ts`: Native-only tools — transactions (begin/rollback), FTS5 search, window functions (row_number)
  - `wasm.spec.ts`: WASM graceful degradation — transactions rejected, backup/restore/verify return `wasmLimitation`
  - `errors.spec.ts`: Structured error response contract — TABLE_NOT_FOUND, COLUMN_NOT_FOUND, statement type mismatches, coordinate validation, non-numeric column detection
  - Dual-project `playwright.config.ts`: WASM adapter (port 3000) + Native adapter (port 3001) with `--tool-filter +all`
  - `test:e2e` npm script, dedicated `e2e.yml` CI workflow, E2E badge added to README
- **Performance Benchmark Suite** — 9 benchmark files measuring framework overhead on critical hot paths
  - `handler-dispatch.bench.ts`: Tool lookup, error construction, progress notification overhead
  - `utilities.bench.ts`: Identifier sanitization, WHERE clause validation, SQL validation, metadata caching
  - `tool-filtering.bench.ts`: Filter parsing, group lookups, meta-group catalog generation
  - `schema-parsing.bench.ts`: Zod schema validation for simple/complex/large payloads and failure paths
  - `logger-sanitization.bench.ts`: Log call overhead, message sanitization, stack trace processing, sensitive data redaction
  - `transport-auth.bench.ts`: Token extraction, scope checking, error formatting, rate limiting
  - `codemode.bench.ts`: Sandbox creation/disposal, pool lifecycle, security validation, execution overhead
  - `database-operations.bench.ts`: PRAGMA operations, table metadata, query result processing, JSON path validation, schema caching
  - `resource-prompts.bench.ts`: Resource URI matching, content assembly, prompt generation, tool index generation
  - `npm run bench` and `npm run bench:verbose` scripts; `vitest.config.ts` benchmark configuration
- **Introspection Tool Group (6 tools)** — Read-only schema analysis and dependency mapping
  - `sqlite_dependency_graph`: Build directed FK dependency graphs with depth/direction control
  - `sqlite_topological_sort`: Determine safe creation/drop order for tables
  - `sqlite_cascade_simulator`: Preview cascade effects before running DELETE/DROP
  - `sqlite_schema_snapshot`: Capture full or partial schema with SHA-256 fingerprinting
  - `sqlite_constraint_analysis`: Analyze FK constraints, detect orphans, unindexed FKs
  - `sqlite_migration_risks`: Assess risk levels for DDL migration statements
  - All tools are strictly read-only (no database modifications)
- **Migration Tool Group (6 tools)** — Opt-in schema migration lifecycle management
  - `sqlite_migration_init`: Create `_mcp_migrations` tracking table
  - `sqlite_migration_record`: Record a migration without executing (audit/tracking)
  - `sqlite_migration_apply`: Execute + record migration atomically with rollback SQL
  - `sqlite_migration_rollback`: Reverse a migration using stored rollback SQL
  - `sqlite_migration_history`: Query migration history with status/version filters
  - `sqlite_migration_status`: Dashboard summary of migration state
  - SHA-256 deduplication prevents accidental re-application
  - All tools require `write` or `admin` scope
- **`dev-schema` Meta-Group Shortcut** — New shortcut enabling `core + introspection + migration + codemode` for schema development workflows
- **Code Mode Introspection/Migration Support** — `sqlite.introspection.*` and `sqlite.migration.*` groups added to sandbox API
  - Method aliases: `deps`, `toposort`, `cascade`, `snapshot`, `constraints`, `risks`, `setup`, `log`, `run`, `undo`
  - Positional parameter support and help() examples for both groups
  - Groups listed in `sqlite_execute_code` tool description and `ServerInstructions.ts`
- **Tool Icons (MCP 2025-11-25)** — All tools, resources, and prompts now include visual icons
  - 8 group-level icons from Material Design Icons (CDN-hosted SVG via jsDelivr)
  - Built-in server tools (`server_info`, `server_health`, `list_adapters`) get a server icon
  - New `src/utils/icons.ts` utility with `getToolGroupIcon()` and `SERVER_ICONS`
  - Icon passthrough in both WASM and Native adapter `registerTool()`/`registerResource()`/`registerPrompt()` methods
  - `McpIcon` type added to `types/index.ts`; `icons` field added to `ToolDefinition`, `ResourceDefinition`, `PromptDefinition`
  - **Dual HTTP Transport** — HTTP transport now supports both Streamable HTTP (MCP 2025-03-26) and Legacy SSE (MCP 2024-11-05) protocols simultaneously
  - `GET /sse` — Opens Legacy SSE connection for backward-compatible clients
  - `POST /messages?sessionId=<id>` — Routes messages to Legacy SSE transport
  - Cross-protocol guard: SSE session IDs rejected on `/mcp` and vice versa
- **Security Headers** — All HTTP responses now include 7 security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`, `Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy`, `Strict-Transport-Security`
- **Rate Limiting** — Per-IP sliding-window rate limiting (100 requests/minute, health endpoint exempt)
- **Body Size Enforcement** — JSON body limited to 1 MB via `express.json({ limit })`, returns 413 for oversized payloads
- **404 Handler** — Unknown paths now return `404 { error: "Not found" }` instead of Express default HTML
- **Code Mode (Sandboxed Execution)** — New `sqlite_execute_code` tool for executing JavaScript in a sandboxed environment
  - Agents write code using `sqlite.*` API to access all 7 tool groups (core, json, text, stats, vector, admin, geo)
  - 70-90% token reduction by replacing multiple sequential tool calls with a single code execution
  - Dual sandbox support: `worker_threads` (default, enhanced isolation) and `vm` module
  - Worker sandbox uses MessagePort RPC bridge for secure API proxy between threads
  - Security: code validation against blocked patterns, rate limiting (60 exec/min), result sanitization (10MB cap), audit logging
  - Built-in `help()` for discoverability: `sqlite.help()` for groups, `sqlite.<group>.help()` for methods
  - Positional parameter support: `sqlite.core.readQuery("SELECT 1")` maps to `{ query: "SELECT 1" }`
  - Method aliases for ergonomic use (e.g., `sqlite.core.query()` → `readQuery`)
  - New `codemode` tool group added to all meta-group shortcuts (starter, analytics, search, spatial, minimal, full)
  - Environment variable `CODEMODE_ISOLATION=vm|worker` to select sandbox mode (default: `worker`)
  - New files: `src/codemode/` (types, security, sandbox, worker-sandbox, worker-script, sandbox-factory, api, index)
  - Updated: `ToolGroup` type, `LogModule`, `ToolConstants`, `ServerInstructions`, tool index
  - Auto-injected into all tool filter configurations (whitelist mode) — opt out with `-codemode`
  - **`sqlite_drop_index` Tool** — New core tool to drop indexes from the database
  - Validates index existence before dropping
  - Supports `ifExists` flag (default `true`) for graceful no-op when index doesn't exist
  - Registered in core group with `DropIndexSchema` / `DropIndexOutputSchema`
  - Added to `ToolConstants.ts`, `ServerInstructions.ts`, and positional param map
  - Core tool count: 8 → 9 (minimal meta-group: 9 → 10)
- **Server Host Binding** — New `--server-host` CLI option and `MCP_HOST` environment variable
  - Configures which host/IP the HTTP transport binds to (default: `0.0.0.0`)
  - Use `--server-host 127.0.0.1` to restrict to local connections only
  - Precedence: CLI flag > `MCP_HOST` env var > `HOST` env var > default (`0.0.0.0`)
  - Essential for containerized deployments where binding to all interfaces is required

### Changed

- **Inline Schema Consolidation**: Relocated 7 migration output schemas (`MigrationRecordEntry`, `MigrationInitOutputSchema`, `MigrationRecordOutputSchema`, `MigrationApplyOutputSchema`, `MigrationRollbackOutputSchema`, `MigrationHistoryOutputSchema`, `MigrationStatusOutputSchema`) from `tools/migration/schemas.ts` to centralized `output-schemas/migration.ts` — the last tool group without dedicated output schema files. Original location now re-exports for backward compatibility.
- **Inline Schema Consolidation**: Extracted 9 inline `outputSchema: z.object()` definitions from introspection tool handlers into centralized `output-schemas/introspection.ts` — `DependencyGraphOutputSchema`, `TopologicalSortOutputSchema`, `CascadeSimulatorOutputSchema`, `SchemaSnapshotOutputSchema`, `ConstraintAnalysisOutputSchema`, `MigrationRisksOutputSchema`, `StorageAnalysisOutputSchema`, `IndexAuditOutputSchema`, `QueryPlanOutputSchema`. All output schemas are now consistently defined in centralized files with named exports — zero inline definitions remain across all tool groups.
- **Inline Schema Consolidation**: Extracted 8 remaining inline `outputSchema: z.object()` definitions from tool handlers into centralized `output-schemas/` files — `virtual.ts` (7 schemas: `ListVirtualTablesOutputSchema`, `VirtualTableInfoOutputSchema`, `DropVirtualTableOutputSchema`, `CreateCsvTableOutputSchema`, `AnalyzeCsvSchemaOutputSchema`, `CreateRtreeTableOutputSchema`, `CreateSeriesTableOutputSchema`), `text.ts` (1 schema: `TextValidateOutputSchema`), and `stats.ts` (1 schema: `StatsHypothesisOutputSchema`). All output schemas are now consistently defined in centralized files with named exports — zero inline definitions remain.
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
- **Help Resource Architecture**: Replaced tiered `--instruction-level` CLI flag and `INSTRUCTION_LEVEL` env var with pull-based `sqlite://help` resources. Removed `instructionLevel` from `McpServerConfig`. Replaced monolithic `server-instructions.md` with per-group `.md` files in `src/constants/server-instructions/`. Generate script updated to produce slim `INSTRUCTIONS` constant + `HELP_CONTENT` map.
- **HSTS**: Wired `--enable-hsts` CLI flag and `MCP_ENABLE_HSTS` env var to the HTTP transport — previously defined in types but never reachable from the CLI.
- **Error Handling — Output Schema Migration** — All 10 output schema files (~115 schemas) now include `ErrorFieldsMixin` via `.extend(ErrorFieldsMixin.shape)`
  - New `error-mixin.ts` defines shared mixin with all 6 `ErrorResponse` fields (`error`, `code`, `category`, `suggestion`, `recoverable`, `details`)
  - Replaces inconsistent inline error fields (some schemas had `error`+`code`+`suggestion`, others had none)
  - Ensures every tool's output schema can accommodate structured error responses
- **Error Handling — Handler Migration to `formatHandlerError`** — ~108 catch blocks across ~25 handler files migrated to use `formatHandlerError()` directly
  - Eliminates Pattern A re-wrapping (`const structured = formatError(error); return { success: false, message: structured.error }`)
  - Eliminates Pattern B inline error construction
  - All handler catch blocks now use `return formatHandlerError(error)` for consistent structured error responses
  - Affected groups: core, admin, text, json-helpers, json-operations, introspection, fts, codemode, stats, vector, geo, migration
  - 3 synchronous handlers wrapped with `Promise.resolve()` to satisfy `handler: () => Promise<unknown>` type constraint
- **Performance Audit Fix — Async File I/O** — Replaced synchronous `fs.readFileSync` and `fs.writeFileSync` with `fs.promises.readFile` and `fs.promises.writeFile` in `sqlite-adapter.ts` to prevent event loop blocking during database initialization and teardown.
- **Code Quality Audit — Standardized Error** — Replaced an instance of generic `Error` in `sqlite_stats_regression` (inference.ts) with `DbMcpError` using `STATS_INSUFFICIENT_SAMPLE` and `VALIDATION` category.
- **Code Quality Audit — Logger Module Split** — Split monolithic `logger.ts` (543 lines) into `utils/logger/` directory
  - `types.ts`: `LogLevel`, `LogModule`, `LogContext` type definitions
  - `error-codes.ts`: `ErrorCode` type, `createErrorCode()`, and `ERROR_CODES` constant map
  - `module-logger.ts`: `ModuleLogger` class for module-scoped logging
  - `logger.ts`: Core `Logger` class with sanitization and dual-mode output
  - `index.ts`: Barrel re-export with default logger instance and env initialization
  - Updated 30 consumer imports across source and test files
- **Code Quality Audit — Enhanced Error Handling** — Replaced 35+ instances of generic `throw new Error()` with enhanced `DbMcpError` (and subclasses like `ValidationError`) across the codebase
  - Affected areas: `HttpTransport`, `DbMcpServer`, `SandboxPool`, `SchemaManager`, `native-sqlite-adapter`, and numerous tool modules (`window.ts`, `geo.ts`, `inference.ts`, `validate.ts`, etc.)
  - Ensures all errors follow the structured `DbMcpError` format with appropriate module-prefixed error codes and ErrorCategory classifications
- **Code Quality Audit — Shared WAL/JSONB Helpers** — Extracted `autoEnableWal()` and `detectAndSetJsonbSupport()` into `sqlite-helpers.ts`
  - Both WASM and native adapters now delegate to shared helpers instead of duplicating logic
- **Code Quality Audit — Native Query Executor** — Extracted `nativeExecuteRead()`, `nativeExecuteWrite()`, `nativeExecuteGeneral()` into `native-query-executor.ts`
  - Mirrors the existing WASM `query-executor.ts` pattern; `native-sqlite-adapter.ts` reduced from 653 to ~555 lines
- **Code Quality Audit — Transport Type Adapters** — Created `type-adapters.ts` with `asIncoming()` and `asServerResponse()`
  - Replaced 16 inline `as unknown as` casts across `session.ts`
- **Code Quality Audit — Query Validation Extraction** — Extracted `validateQuery()` and `DANGEROUS_SQL_PATTERNS` into `query-validation.ts`
  - `database-adapter.ts` reduced from 564 to ~520 lines
- **Code Quality Audit — LogModule Type** — Added `NATIVE_SQLITE` and `HTTP` to the `LogModule` union type
- **Code Quality Audit — JSON-RPC Constants** — Added `JSONRPC_SERVER_ERROR` and `JSONRPC_INTERNAL_ERROR` to `transports/http/types.ts`
  - Replaced inline magic numbers in `session.ts`
- **Code Quality Audit — Base Class `ensureConnected()`** — Concrete `ensureConnected()` method on `DatabaseAdapter` with `ConnectionError`
  - Both adapters override with `protected override` calling `super.ensureConnected()` + db-null check
  - Eliminates duplicated connection-check logic between WASM and native adapters
- **Code Quality Audit — Transaction Method Extraction** — Extracted 6 transaction functions into `transaction-methods.ts`
  - `beginTransaction`, `commitTransaction`, `rollbackTransaction`, `savepoint`, `releaseSavepoint`, `rollbackToSavepoint`
  - `native-sqlite-adapter.ts` delegates via thin one-liner methods; reduces file from 645 to ~605 lines
- **Code Quality Audit — PRAGMA Deduplication** — Extracted `PragmaExecutor` interface and `applyCommonPragmas()` into `sqlite-helpers.ts`
  - Eliminates duplicated walMode/foreignKeys/busyTimeout/cacheSize PRAGMA logic between WASM and native adapters
  - Both adapters now delegate to the shared helper with a thin PragmaExecutor wrapper
- **Code Quality Audit — Extension Loading Extraction** — Created `sqlite-native/extensions.ts` with `loadSpatialite()` and `loadCsvExtension()`
  - Moved SpatiaLite and CSV extension loading (candidate paths, Windows PATH augmentation, try-next-path loop) out of `native-sqlite-adapter.ts`
  - `native-sqlite-adapter.ts` reduced from 731 to 578 lines; `sqlite-adapter.ts` from 556 to 484 lines
- **Code Quality Audit — Row Mapping Deduplication** — Extracted `rowsFromSqlJsResult()` helper in `sqlite-adapter.ts`
  - Replaced 2 identical row-mapping closures in `executeReadQuery` and `executeQuery`
- **Code Quality Audit — Query Executor Extraction** — Extracted `executeRead`, `executeWrite`, `executeGeneral` into `adapters/sqlite/query-executor.ts`
  - `sqlite-adapter.ts` reduced from 679 to ~510 lines; adapter retains validation, connection, and schema cache responsibility
- **Code Quality Audit — HTTP Timeout Constants** — Named magic timeout values in `transports/http/types.ts`
  - `HTTP_REQUEST_TIMEOUT_MS` (120s), `HTTP_KEEP_ALIVE_TIMEOUT_MS` (65s), `HTTP_HEADERS_TIMEOUT_MS` (66s)
  - `transport.ts` now imports named constants instead of using inline numbers
- **Code Quality Audit — Types File Split** — Split `types/index.ts` (528 lines) into 5 sub-modules
  - `database.ts`, `server.ts`, `auth.ts`, `filtering.ts`, `adapter.ts` with barrel re-export
  - Zero consumer import changes — all continue importing from `types/index.js`
- **Code Quality Audit** — Fixed stale `--postgresql` reference in CLI no-database warning; server only supports SQLite
- **Code Quality Audit** — Removed extraneous blank lines in `sqlite-adapter.ts`
- **Code Quality Audit** — Removed duplicate "Server Host Binding" CHANGELOG entry
- **Code Quality Audit — Native Adapter Error Handling** — Replaced plain `Error` throws with typed error classes in `native-sqlite-adapter.ts`
  - `connect()`: `ConfigurationError` for type mismatch, `ConnectionError` for connection failures
  - `executeReadQuery()` / `executeWriteQuery()`: `QueryError` with SQL context and module-prefixed error codes
  - Matches the WASM adapter's error handling, which already used typed errors
- **Code Quality Audit — Extension Loading Deduplication** — Extracted `tryLoadExtension()` helper and `EXTENSIONS_DIR` constant in `native-sqlite-adapter.ts`
  - SpatiaLite and CSV extension loading shared identical try-next-path loop, logging, and `__dirname` computation
  - Both now call the shared helper; ~50 lines of duplication removed
- **Code Quality Audit — Migration Record Mapping** — Extracted `toMigrationRecord()` into `migration/schemas.ts`
  - Replaced 5 identical inline row→record mapping blocks in `tracking.ts`
- **Code Quality Audit — API Constants Extraction** — Moved `METHOD_ALIASES`, `GROUP_EXAMPLES`, `POSITIONAL_PARAM_MAP`, `GROUP_PREFIX_MAP`, `KEEP_PREFIX_GROUPS` from `api.ts` to new `codemode/api-constants.ts`
  - `api.ts` reduced from 610 to ~330 lines
- **Code Quality Audit — `validateColumnExists` Deduplication** — Extracted shared `validateColumnExists()` and `validateColumnsExist()` into `adapters/sqlite/tools/column-validation.ts`
  - Removed identical 40-line copies from `geo.ts`, `text/helpers.ts`, and `stats/helpers.ts`
  - All three modules now re-export from the shared utility; no consumer import changes needed
- **Code Quality Audit — `normalizeParams` Deduplication** — Extracted shared `normalizeSqliteParams()` into `adapters/sqlite-helpers.ts`
  - Removed identical copies from `sqlite-adapter.ts` and `native-sqlite-adapter.ts`
  - Both adapters now import from the shared module
  - Also removed unnecessary `DatabaseType as DbType` alias in native adapter
- **Code Quality Audit — `DatabaseType` Narrowing** — Narrowed `DatabaseType` union from 6 variants (`sqlite | postgresql | mysql | mongodb | redis | sqlserver`) to `"sqlite"` only
  - Other database types would require separate MCP server projects; unused variants were dead code
- **Code Quality Audit — `DatabaseConfig` Cleanup** — Removed unused `host`, `port`, `database`, `username`, `password` fields
  - SQLite uses `connectionString` (file path) and `options`; relational connection fields were never referenced
- **Code Quality Audit — `SqliteAdapter.getInfo()` Override Removed** — Deleted override that silently dropped `capabilities` and `toolGroups` fields from the parent `DatabaseAdapter.getInfo()`
- **Code Quality Audit — Magic Values Named** — Replaced inline magic numbers with named constants
  - `geo.ts`: `111` → `KM_PER_DEGREE_LAT` (km per degree of latitude for bounding box pre-filter)
  - `worker-sandbox.ts`: `1000` → `TIMEOUT_GRACE_MS` (extra grace period for worker cleanup)
- **Code Quality Audit — Stale TODO Removed** — Removed misleading `TODO: Add other database adapters` from `cli.ts`
  - Additional adapters belong in separate MCP server projects, not this codebase
- **File Naming Convention (Round 2)** — Renamed 3 camelCase files to lowercase-with-dashes per project convention
  - Source: `insightsManager.ts` → `insights-manager.ts`, `resourceAnnotations.ts` → `resource-annotations.ts`
  - Test: `insightsManager.test.ts` → `insights-manager.test.ts`
  - Updated 6 files with corrected import paths
- **`isDDL()` Helper Deduplication** — Extracted shared `isDDL()` function into `adapters/sqlite-helpers.ts`
  - Removed identical copies from `sqlite-adapter.ts` and `native-sqlite-adapter.ts`
  - Both adapters now import from the shared module
- **Version Constant Deduplication** — `VERSION` and `NAME` now read from `package.json` at runtime via new `version.ts` module
  - Eliminated 3 hardcoded `"1.0.2"` strings in `index.ts`, `mcp-server.ts`, and `cli.ts`
  - `index.ts` re-exports from `version.ts`; `mcp-server.ts` and `cli.ts` import directly
  - Future version bumps only need to update `package.json`
- **File Size Refactoring** — Split 4 oversized files into modular subdirectories
  - `utils/errors.ts` (559 lines) → `errors/` directory (5 modules + barrel), updated 43 import paths
  - `introspection/diagnostics.ts` (738 lines) → `diagnostics/` directory (3 tool modules + barrel)
  - `introspection/analysis.ts` (720 lines) → `analysis/` directory (3 tool modules + barrel)
  - `introspection/graph.ts` (590 lines) → `graph/` directory (helpers + tools + barrel)
- **File Naming Convention** — Renamed 16 PascalCase files (11 source + 5 test) to lowercase-with-dashes per project convention
  - Source: `DatabaseAdapter.ts`, `McpServer.ts`, `SqliteAdapter.ts`, `NativeSqliteAdapter.ts`, `SchemaManager.ts`, `ToolFilter.ts`, `ToolConstants.ts`, `ServerInstructions.ts`, `OAuthResourceServer.ts`, `AuthorizationServerDiscovery.ts`, `TokenValidator.ts`
  - Tests: `DatabaseAdapter.test.ts`, `SchemaManager.test.ts`, `SqliteAdapter.test.ts`, `NativeSqliteAdapter.test.ts`, `ToolFilter.test.ts`
  - Updated 82 files with corrected import paths
- **Dead Code Cleanup** — Removed extra blank lines in `native-sqlite-adapter.ts`
- **Dockerfile Builder Stage** — Removed unnecessary `apk upgrade --no-cache` from builder stage (DK-3)
  - Builder is discarded after multi-stage build; security patches only needed in production stage
  - Saves ~5-10s per Docker build
- **Dockerfile Label Accuracy** — Fixed tool count in LABEL from 124 to 139 (DK-2)
- **Tier 2 File Refactoring** — Split 4 large files (700–986 lines) into modular directory structures
  - **Phase 1 — Adapter Deduplication**: Extracted shared `registerTool`/`registerResource`/`registerPrompt` logic into `DatabaseAdapter` base class, reducing `NativeSqliteAdapter.ts` (956→727) and `SqliteAdapter.ts` (945→721)
  - **Phase 2 — Transport Split**: Split `http.ts` (986 lines) into `http/` directory with 6 files: `types.ts`, `middleware.ts`, `session.ts`, `oauth.ts`, `transport.ts`, `index.ts`
  - **Phase 3 — Tool File Splits**: Split 3 tool files into directory modules:
    - `spatialite.ts` (915) → `spatialite/` (4 files: `schemas.ts`, `loader.ts`, `tools.ts`, `index.ts`)
    - `vector.ts` (826) → `vector/` (4 files: `schemas.ts`, `helpers.ts`, `tools.ts`, `index.ts`)
    - `core.ts` (770) → `core/` (4 files: `queries.ts`, `tables.ts`, `indexes.ts`, `index.ts`)
  - All consumer imports updated (6 source files + 1 test); no public API changes
- **Configurable CORS Origins** — CORS refactored from hardcoded `Access-Control-Allow-Origin: *` to configurable `corsOrigins` array; supports explicit origins with `Access-Control-Allow-Credentials: true`; removed duplicated CORS middleware
- **Root Endpoint** — `GET /` now lists Legacy SSE endpoints and updated description to "dual HTTP transport"
- **Deterministic Error Handling** — Structured error responses across all tools
  - `registerTool()` catch block now uses `formatError()` to surface `code`, `category`, `suggestion`, `recoverable` fields
  - Applies to both WASM (`SqliteAdapter`) and native (`NativeSqliteAdapter`) adapters
  - Codemode error paths enriched: `CODEMODE_VALIDATION_FAILED`, `CODEMODE_RATE_LIMITED`, `CODEMODE_EXECUTION_FAILED`
  - Added 4 codemode-specific patterns to `ERROR_SUGGESTIONS` for auto-suggestion matching
- **Core Tool Handler-Level Error Handling** — 5 core tool handlers now catch errors locally and return `{success: false}` responses
  - `sqlite_read_query`, `sqlite_write_query`, `sqlite_describe_table`, `sqlite_create_index`: Catch errors with `formatError()` and return structured `{success: false, error, code, suggestion}` instead of propagating as `isError: true` MCP exceptions
  - `sqlite_drop_table`: Checks table existence before DROP; returns `"does not exist (no changes made)"` when `ifExists` is true and table is absent, or `{success: false}` when `ifExists` is false
  - `sqlite_describe_table`: Pre-checks table existence and returns `TABLE_NOT_FOUND` error code instead of generic `UNKNOWN_ERROR`
  - `sqlite_get_indexes`: Validates table existence when `tableName` is specified; returns `{success: false, code: "TABLE_NOT_FOUND"}` instead of empty `{success: true}`
- **Text Tool Handler-Level Error Handling** — All 13 text tool handlers now catch errors locally and return `{success: false}` responses
  - `sqlite_regex_match`, `sqlite_regex_extract`, `sqlite_text_split`, `sqlite_text_concat`, `sqlite_text_replace`, `sqlite_text_trim`, `sqlite_text_case`, `sqlite_text_substring`, `sqlite_fuzzy_match`, `sqlite_phonetic_match`, `sqlite_text_normalize`, `sqlite_text_validate`, `sqlite_advanced_search`: Catch errors with `formatError()` and return structured `{success: false, error, code, suggestion}` instead of propagating as raw MCP exceptions
  - Mirrors the same pattern already applied to core and JSON tool groups
- **Text Tool Column Existence Validation** — All 13 text tools now validate column existence before query execution
  - Prevents silent success on nonexistent columns (SQLite treats double-quoted nonexistent identifiers as string literals)
  - Returns `{success: false, code: "COLUMN_NOT_FOUND"}` with suggestion to use `sqlite_describe_table`
  - `validateColumnExists()` uses `PRAGMA table_info()` to verify column presence
  - `validateColumnsExist()` handles multi-column tools (`sqlite_text_concat`)
  - Identifier validation (`sanitizeIdentifier`) runs first for security, then column existence check
  - 12 new error path tests added for nonexistent column on valid table scenarios
- **Stats Tool Handler-Level Error Handling** — All 13 stats tool handlers now catch errors locally and return `{success: false}` responses
  - `sqlite_stats_basic`, `sqlite_stats_count`, `sqlite_stats_group_by`, `sqlite_stats_histogram`, `sqlite_stats_percentile`, `sqlite_stats_correlation`, `sqlite_stats_top_n`, `sqlite_stats_distinct`, `sqlite_stats_summary`, `sqlite_stats_frequency`, `sqlite_stats_outliers`, `sqlite_stats_regression`, `sqlite_stats_hypothesis`: Catch errors with `formatError()` and return structured `{success: false, error, code, suggestion}` instead of propagating as raw MCP exceptions
  - Mirrors the same pattern already applied to core, JSON, and text tool groups
- **Stats Tool Column Existence Validation** — All 13 stats tools now validate column existence before query execution
  - Prevents silent success on nonexistent columns (SQLite treats double-quoted nonexistent identifiers as string literals)
  - Returns `{success: false, code: "COLUMN_NOT_FOUND"}` with suggestion to use `sqlite_describe_table`
  - `sqlite_stats_summary` validates user-specified columns; auto-detected columns skip validation
  - `sqlite_stats_correlation` validates both `column1` and `column2`; `sqlite_stats_regression` validates both `xColumn` and `yColumn`
  - `sqlite_stats_hypothesis` validates `column`, `column2` (ttest_two), and `groupColumn` (chi_square)
  - 15 new error path tests added for nonexistent table and column scenarios
- **Security Test Pattern Update** — Updated security integration tests for stats tool structured error handling
  - `tool-integration.test.ts`: 57 stats injection tests now use `assertRejectsInjection()` helper accepting either throws or `{success: false}` responses
  - `identifier-integration.test.ts`: 4 stats identifier injection tests updated from `rejects.toThrow()` to structured error assertions
  - Fixed `stats_group_by` identifier test using wrong parameter names (`column`/`groupColumn` → `valueColumn`/`groupByColumn`/`stat`)

### Fixed

- **Missing Annotations**: Added `readOnly(...)` MCP annotations to all 6 window function tools (`sqlite_window_row_number`, `sqlite_window_rank`, `sqlite_window_lag_lead`, `sqlite_window_running_total`, `sqlite_window_moving_avg`, `sqlite_window_ntile`) — these were the only stats-group tools without `annotations`, causing the code mode readonly guard (fail-closed `isWriteTool()`) to incorrectly block them in `readonly: true` mode despite being pure SELECT queries.
- **Missing Annotations**: Added `write(...)` MCP annotations to all 7 transaction tools (`sqlite_transaction_begin`, `sqlite_transaction_commit`, `sqlite_transaction_rollback`, `sqlite_transaction_savepoint`, `sqlite_transaction_release`, `sqlite_transaction_rollback_to`, `sqlite_transaction_execute`) — discovered by the new `tool-annotations.test.ts` invariant test. While the fail-closed `isWriteTool()` guard correctly blocked these in readonly mode (they are write tools), the missing annotations violated the structural invariant and prevented proper tool discoverability.
- **Output Schema Strictness**: Made domain-specific fields optional in 24 output schemas across `core.ts` (5), `admin.ts` (9), `virtual.ts` (9), and `native.ts` (1) — fields like `rowCount`, `rows`, `tables`, `count`, `columns`, `indexes`, `integrity`, `databases`, `options`, `message`, `durationMs`, `insightCount`, `statementsExecuted` were required but absent from error responses (`{success: false, error: "..."}`), causing raw MCP `-32602` output validation errors on error paths. Discovered by the new `tool-output-schemas.test.ts` invariant test.
- **Output Schema Enforcement**: Wired existing `TransactionBeginOutputSchema`, `TransactionCommitOutputSchema`, `TransactionRollbackOutputSchema`, `TransactionSavepointOutputSchema`, `TransactionReleaseOutputSchema`, `TransactionRollbackToOutputSchema`, and `TransactionExecuteOutputSchema` to their corresponding 7 transaction tool definitions — schemas were defined in `native.ts` but never referenced, so the MCP SDK could not enforce output validation on these tools.
- **Input Coercion**: Added `z.preprocess()` coercion for numeric parameters (`limit`, `gridSize`, `srid`, `distance`, `simplifyTolerance`, `centerLat`, `centerLon`, `radius`, `minLat`, `maxLat`, `minLon`, `maxLon`, `lat1`–`lon2`) and enum parameters (`unit`, `geometryType`, `analysisType`, `action`, `format`, `operation`) in geo and SpatiaLite schemas — 22 params total. Non-numeric strings fall back to defaults, invalid enum values fall back to defaults instead of producing raw MCP `-32602` validation frames.
- **Input Coercion**: Added `z.preprocess(coerceBoolean, ...)` coercion for boolean parameters (`forceReload`, `excludeSelf`, `includeGeometry`) in SpatiaLite schemas — non-boolean strings now coerce to defaults instead of producing raw MCP `-32602` validation frames.
- **Validation Leaks**: Fixed Zod output schema errors in JSON tools (`sqlite_json_valid`, `sqlite_json_validate_path`) and core tools (`sqlite_drop_table`, `sqlite_create_index`, `sqlite_drop_index`) that caused the server to return raw MCP `-32602` validation frames instead of structured domain errors, by marking conditional message fields as optional.
- **Input Coercion**: Handled invalid numeric input types gracefully in JSON operations (`sqlite_json_each`, `sqlite_json_query`, `sqlite_json_analyze_schema`, `sqlite_json_storage_info`) and migration tools (`sqlite_migration_rollback`, `sqlite_migration_history`) by replacing `z.coerce.number()` with `z.preprocess()` for `limit`, `sampleSize`, `id`, and `offset` parameters — non-numeric values now silently fall back to defaults instead of producing raw MCP `-32602` validation frames.
- **Validation Leaks**: Fixed Zod output schema errors in text tools (`sqlite_regex_match`, `sqlite_regex_extract`, `sqlite_text_split`, `sqlite_text_replace`, `sqlite_text_normalize`, `sqlite_text_validate`) and FTS tools (`sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`) that caused raw MCP `-32602` output validation errors on error paths, by marking non-error fields as optional so `{success: false, error: "..."}` responses pass output validation.
- **Input Coercion**: Added `z.preprocess()` coercion for all numeric parameters in text tool schemas (`limit`, `maxDistance`, `groupIndex`, `start`, `length`, `fuzzyThreshold`, `maxInvalid`) and FTS search `limit` — non-numeric string values now silently fall back to defaults instead of producing raw MCP `-32602` input validation frames.
- **Input Coercion**: Added `z.preprocess()` coercion for all numeric parameters in stats schemas (`limit`, `buckets`, `n`, `threshold`, `maxOutliers`, `degree`, `expectedMean`) and window function schemas (`limit`, `offset`, `windowSize`, `buckets`) — 19 params total. Moved `maxOutliers` min/max refinements (`.min(1).max(500)`) to handler validation to avoid Zod refinement leaks.
- **Input Coercion**: Added `z.preprocess()` coercion for numeric parameters (`limit`, `sampleSize`, `dimensions`) and enum parameters (`metric`) in vector tool schemas — non-numeric strings fall back to defaults, invalid metric values fall back to `"cosine"` default instead of producing raw MCP `-32602` validation frames.
- **Input Coercion**: Added `z.preprocess()` coercion for required array parameters in vector tool schemas (`vector`, `queryVector`, `vector1`, `vector2`, `items`, `ids`) — non-array inputs are coerced to empty arrays to pass SDK `.partial()` validation, then handler-level guards reject them with structured errors instead of raw MCP `-32602` validation frames.
- **Dimension Validation**: Fixed `sqlite_vector_batch_store` only validating the first item's vector dimensions against the table schema — now validates all items individually with per-item error reporting (e.g., `"Dimension mismatch at item[1]"`).
- **Input Coercion**: Added `z.preprocess()` coercion for numeric parameters in admin schemas (`maxErrors`, `mask`) and virtual table schemas (`limit`, `start`, `stop`, `step`, `sampleRows`, `dimensions`) — 12 params total. Moved `dimensions` min/max refinements (`.min(2).max(5)`) to handler validation to prevent Zod refinement leaks.
- **Input Coercion**: Added `z.preprocess()` coercion for `timeout` parameter in `sqlite_execute_code` and moved `.int().min(1000).max(30000)` refinements to handler validation.
- **Refinement Leaks**: Removed `.regex()` from `SavepointSchema.name` in transaction tools — handler already validates with inline regex check. Prevents raw MCP `-32602` on invalid savepoint names.
- **Refinement Leaks**: Added `z.preprocess()` enum coercion for `BeginTransactionSchema.mode` — invalid enum values now coerce to `undefined` and fall to the `"deferred"` default instead of producing raw MCP `-32602` validation frames.
- **Error Handling**: Added missing `try/catch` wrappers to admin handlers (`integrityCheck`, `pragmaCompileOptions`, `pragmaDatabaseList`, `pragmaOptimize`, `dbstat`, `vacuum`) — uncaught errors now return structured `{success: false}` responses via `formatHandlerError`.
- **JSON Serialization**: Fixed an issue in `sqlite_json_query` where querying a column converted to JSONB would return the raw binary Buffer instead of the parsed JSON string by explicitly wrapping the column selection in `json()`.
- **PRAGMA/EXPLAIN LIMIT**: Fixed `sqlite_read_query` appending `LIMIT 1000` to PRAGMA and EXPLAIN statements, causing syntax errors. Safety limit injection now only applies to SELECT and WITH queries.
- **Instruction Generation**: Fixed `enabledTools` set in server constructor passing group names (e.g., `"core"`, `"json"`) instead of actual tool names, causing the Active Tools summary at `full` instruction level to never match any tools.
- **Restore Data Loss**: Fixed `sqlite_restore` silently dropping user-created indexes, views, and triggers during backup→restore cycles. The handler only restored tables (`type='table'` from `sqlite_master`), permanently losing all other schema objects. Now restores indexes, views, and triggers from the backup source after table restoration.
- **Error Formatting**: Standardized error handling across 11 admin/virtual tool handlers (`create_view`, `drop_view`, `generate_series`, `create_rtree_table`, `create_series_table`, `virtual_table_info`, `drop_virtual_table`, `pragma_table_info`, `append_insight`, `dbstat`, `vacuum`, `analyze_csv_schema`, `create_csv_table`, `list_virtual_tables`, `list_views`, `transaction_execute`) — replaced raw `error.message` (which produces unreadable Zod JSON arrays for validation errors) with `formatHandlerError()` for clean structured error responses.
- **Empty Path Validation**: Added pre-validation guards to `sqlite_backup`, `sqlite_restore`, and `sqlite_verify_backup` — empty/blank path strings now return clear `"targetPath/sourcePath/backupPath is required"` errors instead of confusing CWD resolution errors.
- **Test Prompt Corrections**: Fixed 15 parameter name mismatches in the admin group test checklist (`test-group-tools.md`): `viewName`/`selectQuery` for views, `tableName` for virtual tables, `targetPath`/`sourcePath`/`backupPath` for backup tools, `filePath` for CSV tools, `insight` for `append_insight`, `pragma` for `pragmaSettings`, plain string array for `transaction_execute`. Added required `start`/`stop` params for `create_series_table`, noted it creates a regular table (gotcha #15), and added absolute path warnings for backup and CSV tools.
- **Extension Path Resolution**: Fixed `EXTENSIONS_DIR` in `extensions.ts` resolving to the wrong directory after tsup code splitting — the relative path `../../../extensions` was correct for the source tree depth (3 levels) but wrong for compiled output in `dist/` (1 level). Replaced with `findProjectRoot()` that walks up from the compiled file's directory to locate `package.json`, making CSV and future extension loading resilient to any bundler output structure. SpatiaLite was unaffected because it loaded via `SPATIALITE_PATH` env var.
- **Validation Leak**: Fixed `sqlite_pragma_settings({})` producing a raw MCP error by moving `PragmaSettingsSchema.parse()` inside the `try/catch` block — Zod validation errors now return structured `{success: false}` responses.
- **Error Field Consistency**: Changed error field from `message` to `error` in `{success: false}` responses for `sqlite_verify_backup`, `sqlite_create_rtree_table`, `sqlite_create_series_table`, and `sqlite_transaction_execute` — all error responses now consistently use the `error` field per structured error convention.
- **Payload Optimization**: Changed `sqlite_dbstat` default for `excludeSystemTables` from `false` to `true` — SpatiaLite system tables (37 objects including `spatial_ref_sys` at 1434 pages) are now excluded by default, dramatically reducing response size.
- **Misleading Note**: Fixed `sqlite_pragma_database_list` showing a "WASM virtual filesystem paths" note in Native mode on Windows — the path comparison now normalizes slashes before comparing, so the note only appears when internal paths genuinely differ (i.e., in WASM mode).
- **Error Field Consistency**: Fixed `sqlite_append_insight` empty-insight error response using `message` instead of `error` field for `{success: false}` responses — now consistent with the structured error convention used by all other tools.
- **Test Prompt**: Fixed `test-tools.md` item 9 annotation verification instruction from uncallable `tools/list` protocol method to the existing `test-tool-annotations.mjs` terminal script. Fixed duplicate item numbering (two item 9s) and broke items out of the CAUTION blockquote where they were incorrectly nested.
- **Validation Leak**: Fixed `sqlite_execute_code({})` producing a raw MCP error by moving `ExecuteCodeSchema.parse()` inside the `try/catch` block — Zod validation errors now return structured `{success: false}` responses. Also made `metrics` optional in `ExecuteCodeOutputSchema` so error responses without metrics pass output schema validation.
- **Input Coercion**: Added `z.preprocess()` coercion for enum parameters in introspection tool schemas — `operation` (`sqlite_cascade_simulator`), `direction` (`sqlite_topological_sort`), `sections` array (`sqlite_schema_snapshot`), and `checks` array (`sqlite_constraint_analysis`). Invalid enum values now coerce to defaults or are filtered out instead of producing raw MCP `-32602` validation frames.
- **Payload Optimization**: Added `excludeSystemTables` parameter (default: `true`) to `sqlite_schema_snapshot`, `sqlite_storage_analysis`, `sqlite_index_audit`, and `sqlite_constraint_analysis`. SpatiaLite system tables, views, indexes, and triggers are now excluded by default, reducing response sizes by 47–91% in databases with SpatiaLite loaded. Pass `excludeSystemTables: false` to restore the previous behavior.
- **Error Message Leak**: Fixed `sqlite_spatialite_query` exposing internal better-sqlite3 implementation detail ("This statement does not return data. Use run() instead") when called with non-SELECT statements — now returns a clear `"This tool only supports SELECT queries"` message with `QUERY_NOT_SELECT` error code.
- **Silent Enum Coercion**: Fixed `sqlite_spatialite_index` silently coercing invalid `action` values (e.g., `"invalid_action"`) to the default `"create"` instead of returning a validation error. Replaced `z.preprocess(coerceIndexAction, z.enum(...))` with `z.string()` + handler-level validation, consistent with the pattern used by `analysisType`, `operation`, and `format` in other SpatiaLite tools.
- **Output Schema Leak**: Fixed `sqlite_cascade_simulator` with `compact: true` producing a raw MCP `-32602` output validation error — the `path` field in the output schema was required but `compact` mode strips it from affected entries. Made `path` optional in `CascadeSimulatorOutputSchema`.
- **Payload Optimization**: Added `excludeSystemTables` parameter (default: `true`) to `sqlite_dependency_graph` and `sqlite_topological_sort`. SpatiaLite system tables are now excluded by default, reducing `dependency_graph` from ~8KB→~1.5KB and `topological_sort` from ~3.5KB→~0.7KB in databases with SpatiaLite loaded. Pass `excludeSystemTables: false` to restore the previous behavior.
- **Output Schema Leak**: Fixed `sqlite_geo_distance` returning `from` and `to` coordinate objects not declared in `GeoDistanceOutputSchema` — the `additionalProperties: false` constraint caused the MCP framework to reject all successful responses with `-32602`. Removed redundant coordinate echo fields.
- **Field Naming**: Fixed `sqlite_geo_nearby` using `_distance` field name on result items instead of `distance` declared in `GeoWithinRadiusOutputSchema` — clients relying on the schema-declared field would find it absent.
- **Strict Schema Leak**: Removed `.strict()` from all tool input schemas across all groups — core (10), json (14), stats/window (6), admin/transactions (7+1), geo/SpatiaLite (7), migration (2). `additionalProperties: false` caused the MCP SDK to reject unrecognized keys with raw `-32602` errors before handlers could catch them.
- **Error Consistency**: Standardized ~20 error return paths across SpatiaLite tool handlers (`tools.ts`, `analysis.ts`) to include `code`, `category`, and `recoverable` fields — previously returned bare `{success: false, error: "..."}` without the structured metadata used by all other tool groups. Fixed `sqlite_spatialite_load` failure response using `message` field instead of `error` field.
- **Output Schema Leak**: Fixed `sqlite_json_valid` and `sqlite_json_validate_path` returning raw MCP `-32602` output validation errors on every call — output schemas were missing `success`, `message`, `path`, and `issues` fields that the handlers return.
- **Output Schema Leak**: Fixed `sqlite_optimize`, `sqlite_vacuum`, and `sqlite_analyze_csv_schema` returning raw MCP `-32602` output validation errors — output schemas were missing `durationMs`, `message`, and `wasmLimitation` fields that the handlers return.
- **Phantom Tool Names**: Fixed 11 non-existent tool names in help resource source files (`stats.md`, `text.md`, `geo.md`) that would mislead agents into calling tools that don't exist. Removed `sqlite_stats_covariance`, `sqlite_stats_z_score`, `sqlite_stats_moving_average`, `sqlite_text_pad`, `sqlite_text_template`, `sqlite_text_similarity`, `sqlite_text_word_count`, `sqlite_fts_count`, `sqlite_spatialite_status`. Renamed `sqlite_window_lead_lag` → `sqlite_window_lag_lead`. Added missing real tools to help content.
- **Code Mode Groups**: Fixed `gotchas.md` listing only 7 Code Mode API groups — added missing `sqlite.introspection` and `sqlite.migration` which are real groups exposed by the sandbox API.
- **Validation Leak**: Fixed `sqlite_json_normalize_column` producing a raw MCP `-32602` error when `outputFormat` receives an invalid enum value (e.g., `"invalid_format"`). Replaced `z.enum()` in the schema with `z.string()` and handler-side validation, consistent with the established pattern for enum coercion.
- **Output Schema Alignment**: Added missing `warning` field to `JsonSetOutputSchema` and `JsonRemoveOutputSchema` — handlers return a `warning` property when 0 rows are affected, but the output schema did not declare it. Added missing `firstErrorDetail` field to `JsonNormalizeColumnOutputSchema`. Changed `outputFormat` in `JsonNormalizeColumnOutputSchema` from `z.enum()` to `z.string()` to match the input schema change.
- **Missing Value Guards**: Added explicit `undefined` guards for payload parameters (`value` in `sqlite_json_set`, `sqlite_json_array_append`, `sqlite_json_update`; `mergeData` in `sqlite_json_merge`; `data` in `sqlite_json_insert`) — the SDK's `.partial()` makes all params optional, so omitting these previously caused a cryptic `"Cannot read properties of undefined"` error instead of a clear `"Missing required parameter: <name>"` structured response.
- **Input Coercion**: Fixed `sqlite_text_substring` `start` parameter producing a raw MCP `-32602` error when receiving wrong-type input (e.g., `"abc"`). Changed inner schema from required `z.number()` to `z.number().optional()` and added handler-side validation so the preprocess coercion-to-undefined path returns a structured error.
- **Output Schema Leak**: Fixed `sqlite_text_validate` returning undeclared `truncated` field when invalid results exceed `maxInvalid` — added `truncated: z.boolean().optional()` to the inline output schema.
- **Silent Enum Coercion**: Fixed `sqlite_vector_search` and `sqlite_vector_distance` silently coercing invalid `metric` values (e.g., `"invalid_metric"`) to the default `"cosine"` instead of returning a validation error. Replaced `z.preprocess(coerceMetric, z.enum(...))` with `z.string()` + handler-level validation, consistent with the pattern used for SpatiaLite `action` and JSON `outputFormat`.
- **E2E Test Flakiness**: Fixed intermittent 429 rate-limit and timeout failures in the Playwright test suite by bumping `MCP_RATE_LIMIT_MAX` from 1000 to 10000 (5× headroom), increasing global test timeout to 60s, and adding retry-with-backoff logic to the `createClient()` helper.
- **Raw MCP Error**: Fixed `sqlite_analyze_csv_schema` propagating a raw MCP error when the CSV file does not exist at an absolute path — the `try` block had no `catch`, only a `finally`. Added a `catch` block returning structured `{success: false, error: "..."}`. Also changed `message` → `error` in relative-path and WASM-unavailable error returns for field consistency.
- **Output Schema Wiring**: Wired `outputSchema` for 6 window function tools (`sqlite_window_row_number`, `sqlite_window_rank`, `sqlite_window_lag_lead`, `sqlite_window_running_total`, `sqlite_window_moving_avg`, `sqlite_window_ntile`) — schemas were defined in `native.ts` but never referenced. Updated 6 named schemas to match handler return shapes (added `rankType`, `direction`, `valueColumn`, `windowSize`, `buckets`; made `rowCount`/`rows` optional).
- **Output Schema Wiring**: Created 7 new SpatiaLite output schemas (`SpatialiteLoadOutputSchema`, `SpatialiteCreateTableOutputSchema`, `SpatialiteQueryOutputSchema`, `SpatialiteIndexOutputSchema`, `SpatialiteAnalyzeOutputSchema`, `SpatialiteTransformOutputSchema`, `SpatialiteImportOutputSchema`) and wired them into all 7 SpatiaLite tool definitions — these were the only tool group without output schema enforcement.
- **Inline Schema Consolidation**: Replaced 5 inline `z.object()` output schemas with named imports from `output-schemas/` — `sqlite_fuzzy_match`, `sqlite_phonetic_match`, `sqlite_text_normalize`, `sqlite_stats_regression`, `sqlite_stats_outliers`. Updated the corresponding named schemas (`FuzzySearchOutputSchema`, `SoundexOutputSchema`, `TextNormalizeOutputSchema`, `StatsRegressionOutputSchema`, `StatsOutliersOutputSchema`) to match actual handler return shapes.
- **Dead Schema Removal**: Deleted 25 orphaned output schemas that had no corresponding tools: 9 vector (`VectorCreate`, `VectorInsert`, `VectorUpsert`, `CosineSimilarity`, `EuclideanDistance`, `DotProduct`, `VectorMagnitude`, `HybridSearch` + result), 3 stats (`StatsDescribe`, `StatsMode`, `StatsMedian`), 3 virtual (`GenerateDates`, `CteRecursive`, `PivotTable`), 3 geo (`GeoNearest` + result, `GeoPolygonContains`, `GeoEncode`), 2 text (`Levenshtein`, `TrigramSimilarity`), 2 JSON (`JsonTree`, `JsonPatch`), 1 FTS (`FtsOptimize`), 3 server (`ServerInfo`, `ServerHealth`, `ListAdapters` — built-in tools use `content` pattern, not `structuredContent`).
- **API Consistency**: Renamed `valueColumn` → `column` in `RunningTotalSchema` and `MovingAverageSchema` input schemas (and all handler references) for consistency with the other 4 window function tools which all use `column`. Updated unit tests accordingly.
- **Input Coercion**: Added case-insensitive coercion to `TextNormalizeSchema.mode` — uppercase values like `"NFC"` now coerce to `"nfc"` instead of failing Zod enum validation.
- **Payload Optimization**: Changed `sqlite_list_tables` and `sqlite_get_indexes` defaults for `excludeSystemTables` / `excludeSystemIndexes` from `false` to `true` — SpatiaLite system tables (27 entries) and system indexes (4 entries) are now excluded by default, reducing `list_tables` from 38→11 entries and `get_indexes` from 8→4 entries. Pass `excludeSystemTables: false` / `excludeSystemIndexes: false` to restore the previous behavior.
- **Validation Leak**: Added missing `try/catch` around `ListTablesSchema.parse()` in `sqlite_list_tables` handler — the only core tool handler without the defensive wrapper. Zod parse errors now return structured `{success: false}` responses instead of propagating as uncaught exceptions.
- **Payload Optimization**: Filtered internal `_mcp_migrations` table from `sqlite_list_tables` default results — the db-mcp migration tracking table is now excluded alongside SpatiaLite system tables when `excludeSystemTables: true` (default). Tables prefixed with `_mcp_` are internal and not relevant to user workflows.
- **API Consistency**: Renamed `tableName` → `table` in core tool input schemas (`sqlite_create_table`, `sqlite_describe_table`, `sqlite_drop_table`, `sqlite_get_indexes`, `sqlite_create_index`) to match the field naming convention used by all other tool groups (json, text, stats, vector, admin).
- **Backward Compatibility**: Added `resolveAliases()` parameter alias support to all 8 core tool handlers and 2 window function handlers — legacy parameter names (`tableName`, `sql`, `name`, `valueColumn`) are transparently mapped to canonical names (`table`, `query`, `indexName`, `column`) before Zod parsing. Canonical names take precedence when both are supplied. Applied via handler-level preprocess (not schema-level `z.preprocess()` which would break the SDK's `.partial()` call). Also changed `registerToolImpl` to use `.partial().passthrough()` so unknown alias keys survive Zod's default strip mode.
- **Stale References**: Fixed `sqlite://help/stats` referencing `valueColumn` instead of `column` in `running_total` and `moving_avg` examples (both `stats.md` source and compiled `server-instructions.ts`). Fixed codemode `POSITIONAL_PARAM_MAP` and `GROUP_EXAMPLES` still using `tableName` for core tools after the rename to `table`.
- **Raw MCP Error**: Fixed `sqlite_create_table` propagating a raw MCP error when `ifNotExists: false` and the table already exists — `adapter.executeQuery()` was outside any `try/catch`, so the SQLite error escaped as an uncaught exception instead of returning a structured `{success: false}` response.
- **Error Quality**: Added `sqlite_master` table existence validation and `pragma_table_info` column existence validation to all 6 window function tools (`sqlite_window_row_number`, `sqlite_window_rank`, `sqlite_window_lag_lead`, `sqlite_window_running_total`, `sqlite_window_moving_avg`, `sqlite_window_ntile`) — previously relied on SQL execution errors which leaked raw SQL in the error `details` field. Now returns clean `TABLE_NOT_FOUND` / `COLUMN_NOT_FOUND` structured errors consistent with all other tool groups.
- **Chi-Square Validation**: Fixed `sqlite_stats_hypothesis` with `testType: "chi_square"` incorrectly rejecting non-numeric columns — the `validateNumericColumn()` check ran unconditionally for all test types before branching, but chi-square tests operate on categorical data. Numeric validation now only runs for `ttest_one` and `ttest_two`.
- **OrderBy Validation**: Added `validateOrderByColumns()` pre-validation to all 6 window function tools — parses column names from ORDER BY expressions (handling `price DESC`, multi-column `a, b DESC`, and expression skipping), then validates each against the table schema. Previously, nonexistent orderBy columns produced raw SQL errors with internal query leakage in `details.sql`.
- **Test Prompt**: Fixed `test-group-tools.md` checklist item 19 missing required `direction: "lag"` parameter for `sqlite_window_lag_lead`.
- **Output Schema Alignment**: Added missing `message` field to `VectorBatchStoreOutputSchema` — handler returns `message: "No items provided"` on empty-items path but the output schema did not declare it.
- **Dimension Validation**: Fixed `sqlite_vector_store` and `sqlite_vector_batch_store` silently accepting mismatched vector dimensions when the table lacks a `dimensions` column (e.g., tables not created via `sqlite_vector_create_table`). Added a third fallback to `validateDimensions()` that samples an existing vector from the actual vector column to infer expected dimensions.
- **Inline Schema Consolidation**: Relocated `AppendInsightOutputSchema` from handler helpers (`tools/admin/helpers.ts`) to the centralized `output-schemas/admin.ts` — consistent with the project convention that all output schemas live in the `output-schemas/` directory with named exports.
- **Output Schema Wiring**: Created `DbstatOutputSchema` (polymorphic — supports summarized, raw, and fallback return shapes) and wired it to the `sqlite_dbstat` tool definition — the only admin tool without output schema enforcement.
- **Output Schema Alignment**: Fixed `sqlite_list_views` error path returning bare `formatHandlerError(error)` without required output schema fields (`count`, `views`) — now merges `{count: 0, views: []}` to pass `ListViewsOutputSchema` validation on error paths.
- **Output Schema Alignment**: Added missing `skipped` and `warning` fields to `VectorSearchOutputSchema` — handler returns these fields when unparseable vectors are encountered during search, but the output schema did not declare them, causing raw MCP `-32602` errors on direct tool calls that trigger the skip path.
- **Missing Annotations**: Added MCP annotations to all 7 SpatiaLite tools (`spatialite_load`, `spatialite_create_table`, `spatialite_query`, `spatialite_index`, `spatialite_analyze`, `spatialite_transform`, `spatialite_import`) — these were the only tools without `annotations`, causing the code mode readonly guard to classify write tools as read-safe.
- **Readonly Guard**: Fixed code mode `isWriteTool()` using fail-open logic (`readOnlyHint !== false`) that treated unannotated tools as read-safe. Inverted to fail-closed (`readOnlyHint === true`) — tools are now assumed to be write tools unless explicitly marked as read-only. Removed redundant `READ_SAFE_PATTERNS` heuristic. Added defense-in-depth warning logging for any unannotated tool blocked in readonly mode.
- **Validation Leak**: Fixed `sqlite_text_case`, `sqlite_text_normalize`, and `sqlite_text_validate` producing raw MCP `-32602` errors when required enum params (`mode`, `pattern`) receive empty or invalid values. Replaced `z.enum()` in schemas with `z.string()` and handler-side validation against exported const arrays (`VALID_TEXT_CASE_MODES`, `VALID_NORMALIZE_MODES`, `VALID_VALIDATE_PATTERNS`). Fixed `sqlite_phonetic_match` `algorithm` param leaking on explicit empty string by adding a preprocess coercer.
- **Output Schema Wiring**: Created 4 new text output schemas (`TextConcatOutputSchema`, `TextTrimOutputSchema`, `TextCaseOutputSchema`, `TextSubstringOutputSchema`) and wired them to their tool definitions. Relocated inline `AdvancedSearchOutputSchema` from `search.ts` to centralized `output-schemas/text.ts`.
- **Validation Leak**: Fixed `sqlite_stats_group_by` and `sqlite_stats_hypothesis` producing raw MCP `-32602` errors when required enum params (`stat`, `testType`) receive empty or invalid values. Replaced `z.enum()` in schemas with `z.string()` and handler-side validation against exported const arrays (`VALID_STAT_TYPES`, `VALID_TEST_TYPES`).
- **Enum Coercion**: Added `z.preprocess(coerceEnum, ...)` to 6 optional `z.enum()` params that leaked raw MCP `-32602` on explicit empty strings: `orderBy` and `stat` in `GroupByStatsSchema`, `orderDirection` in `TopNSchema`, `method` in `OutlierSchema`, `mode` in `TextTrimSchema`, `tokenizer` in `FtsCreateSchema`, `format` in `FtsMatchInfoSchema`. Empty strings now coerce to `undefined` so `.default()` kicks in.
- **Validation Leak**: Fixed `sqlite_text_trim` and `sqlite_phonetic_match` producing raw MCP `-32602` errors when optional enum params (`mode`, `algorithm`) receive invalid non-empty values. Replaced `z.enum()` in schemas with `z.string()` and handler-side validation against exported const arrays (`VALID_TRIM_MODES`, `VALID_PHONETIC_ALGORITHMS`), consistent with the pattern used by `text_case`, `text_normalize`, and `text_validate`.
- **Enum Coercion**: Replaced `coerceEnum` (empty-string-only) with `coerceEnumValues` factory for 5 optional `z.enum()` params with defaults — `orderBy` in `GroupByStatsSchema`, `orderDirection` in `TopNSchema`, `method` in `OutlierSchema`, `tokenizer` in `FtsCreateSchema`, `format` in `FtsMatchInfoSchema`. Invalid non-empty strings (e.g., `"invalid"`, `"abc"`) now coerce to `undefined` so `.default()` kicks in, instead of leaking raw MCP `-32602` from the inner `z.enum()` rejection.
- **Validation Leak**: Fixed `sqlite_advanced_search` `techniques` array parameter producing a raw MCP `-32602` error when array elements contain invalid enum values (e.g., `["invalid_technique"]`). Replaced `z.enum(["exact", "fuzzy", "phonetic"])` inside the array with `z.string()` and handler-side validation against exported `VALID_SEARCH_TECHNIQUES` constant, consistent with the pattern used by all other enum params in text tools.
- **Payload Optimization**: `sqlite_stats_top_n` now auto-excludes long-content TEXT/BLOB columns (matching names like `description`, `body`, `notes`, `content`, `summary`, etc.) when `selectColumns` is not specified. Short identifier columns (`name`, `category`, `email`, etc.) are preserved. A `hint` field in the response lists excluded columns. Use `selectColumns` to override and include specific text columns.
- **Misleading Stats**: Fixed `sqlite_stats_summary` returning misleading `avg: 0` with null `min`/`max` when the user explicitly requests text columns via the `columns` parameter. Now returns `{column, error: "Not numeric"}` per-column (using the existing error field in the summary schema) instead of running SQL aggregates that produce meaningless results on text data.
- **Code Mode Alias**: Changed `sqlite.stats.describe()` alias mapping from `statsBasic` → `statsSummary` — calling `describe({table: 'foo'})` now returns a table-level summary of all numeric columns, matching the intuitive expectation of "describe a table" rather than requiring a `column` parameter.
- **Error Field Consistency**: Fixed `sqlite_create_csv_table` using `message` instead of `error` for failure text in two early-return paths (relative path rejection and WASM/CSV unavailability) — now consistent with the structured error convention used by all other tools.
- **Raw MCP Error**: Fixed `sqlite_vacuum` with `into` parameter propagating a raw MCP error instead of a structured response. Added early WASM guard for `VACUUM INTO` (file system access not supported in WASM mode) and wrapped `executeQuery()` in `try/catch` so SQL failures (e.g., invalid target paths) return structured `{success: false}` responses. Added `wasmLimitation` field to `VacuumOutputSchema`.
- **Input Coercion**: Fixed required numeric parameters in geo tools (`lat1`, `lon1`, `lat2`, `lon2`, `centerLat`, `centerLon`, `radius`, `minLat`, `maxLat`, `minLon`, `maxLon`) producing raw MCP `-32602` errors when receiving wrong-type string inputs (e.g., `"abc"`). Changed schema inner types from required `z.number()` to `z.number().optional()` so `coerceNumber`'s `undefined` fallback passes the SDK boundary, then added `requireCoordinate()` and `requireNumber()` handler-level validators that return structured `{success: false}` errors with `GEO_INVALID_COORDINATES` code.
- **Misleading Suggestion**: Fixed `sqlite_query_plan` classifying `SCAN CONSTANT ROW` as a full table scan on synthetic table "CONSTANT" and suggesting adding an index — constant-row, subquery, list, and materialized EXPLAIN plan entries are now excluded from fullScans/indexScans/coveringIndexes lists and optimization suggestions.
- **Validation Leak**: Fixed `sqlite_window_rank` and `sqlite_window_lag_lead` producing raw MCP `-32602` errors when enum params (`rankType`, `direction`) receive invalid values. `rankType` (optional with default) now uses `coerceEnumValues` coercer so invalid values fall to the `"rank"` default. `direction` (required, no default) changed from `z.enum()` to `z.string()` with handler-side validation against `VALID_DIRECTIONS` constant, returning a structured error.
- **Error Quality**: Added table existence pre-validation to `sqlite_fts_search`, `sqlite_fts_rebuild`, and `sqlite_fts_match_info` — previously, querying a nonexistent FTS table produced a generic `DB_QUERY_FAILED` error with leaked SQL. Now returns a clean `TABLE_NOT_FOUND` structured error consistent with all other text group tools. Extracted reusable `validateTableExists()` from `column-validation.ts`.
- **Case Sensitivity**: Fixed `sqlite_window_lag_lead` rejecting uppercase `"LAG"`/`"LEAD"` direction values despite the schema description suggesting them. The handler now normalizes direction to lowercase before validation, so `"LAG"`, `"lag"`, and `"Lag"` are all accepted.
- **Error Code Refinement**: Fixed `DbMcpError` subclasses (e.g., `QueryError`) always using their generic constructor code (e.g., `DB_QUERY_FAILED`) even when the error message matches a more specific suggestion pattern (e.g., `TABLE_NOT_FOUND`, `COLUMN_NOT_FOUND`). The constructor now auto-refines generic codes (`DB_QUERY_FAILED`, `DB_WRITE_FAILED`, `QUERY_ERROR`, `RESOURCE_ERROR`, `UNKNOWN_ERROR`) to the suggestion's specific code when available. This fixes all vector, stats, and other tools that delegate to `executeReadQuery`/`executeWriteQuery` — they now return `TABLE_NOT_FOUND` instead of `DB_QUERY_FAILED` for missing tables.
- **Error Code Consistency**: Added missing `code: "DIMENSION_MISMATCH"` to `sqlite_vector_distance` dimension mismatch error — `sqlite_vector_store` and `sqlite_vector_batch_store` already return this code, but `vector_distance` returned a bare `{success: false, error: "..."}` without it.
- **Error Code Consistency**: Added missing `code: "VECTOR_NOT_FOUND"` to `sqlite_vector_get` not-found error — both `{success: false}` return paths now include a specific error code for programmatic handling.
- **Error Code Refinement**: Added `VIEW_NOT_FOUND` and `FILE_NOT_FOUND` error suggestion patterns — `sqlite_drop_view` on a nonexistent view and `sqlite_create_csv_table` on a nonexistent file now return specific codes instead of generic `DB_WRITE_FAILED`. Both patterns also provide actionable suggestions.
- **Error Field Consistency**: Added missing `code: "VALIDATION_ERROR"` and `category: "validation"` to `sqlite_create_csv_table` and `sqlite_analyze_csv_schema` relative path rejection responses — previously returned bare `{success: false, error: "..."}` without structured error metadata.
- **Error Code Consistency**: Added missing error codes to 5 admin tool error responses: `sqlite_pragma_table_info` (`TABLE_NOT_FOUND`), `sqlite_pragma_settings` (`VALIDATION_ERROR` for invalid/unknown pragma names), `sqlite_verify_backup` (`FILE_NOT_FOUND` for missing files, `VALIDATION_ERROR` for empty paths, `ATTACH_FAILED` for attach errors), `sqlite_virtual_table_info` (`TABLE_NOT_FOUND`). Added `error` field and `VALIDATION_ERROR` code to `sqlite_drop_virtual_table` when attempting to drop a regular table (previously used `message` field only).
- **Error Code Consistency**: Fixed `sqlite_transaction_execute` failure response missing structured error metadata (`code`, `category`, `suggestion`, `recoverable`) — now uses `formatHandlerError()` and spreads the formatted error, so failures return specific codes like `TABLE_NOT_FOUND` instead of bare `{success: false, error: "..."}`.
- **Error Suggestion**: Added `TRANSACTION_CONFLICT` error suggestion pattern for "cannot start a transaction within a transaction" errors — advises committing/rolling back the active transaction or using `sqlite_transaction_execute` for atomic multi-statement operations.
- **Graph Semantics**: Fixed `sqlite_dependency_graph` `rootTables` and `leafTables` overlapping for tables with no FK relationships. Root now means "referenced by others but doesn't reference anything" and leaf means "references others but isn't referenced by anything." Isolated tables (no FK relationships at all) are excluded from both, making the sets properly disjoint.
- **Error Code Consistency**: Added missing `code: "TABLE_NOT_FOUND"` and structured error metadata to `sqlite_constraint_analysis` and `sqlite_cascade_simulator` nonexistent table responses — previously returned bare `{success: false, error: "..."}` without error codes.
- **Error Code Consistency**: Added missing `code: "VALIDATION_ERROR"` and structured error metadata to `sqlite_query_plan` non-SELECT rejection response — previously returned bare `{success: false, error: "..."}` without error codes.
- **FK Awareness**: Enhanced `sqlite_migration_risks` DROP TABLE analysis to check for FK dependents — when a table that other tables reference via foreign keys is dropped, the risk description now lists the dependent tables and the mitigation suggests handling them first.
- **Limit After Filter**: Fixed `sqlite_storage_analysis` `limit` parameter being applied at the SQL level before SpatiaLite system table filtering — `limit: 3` with `excludeSystemTables: true` could return fewer tables than requested because system tables consumed slots in the SQL result set before being filtered out. Limit is now applied via `.slice()` after filtering in both the `dbstat` and fallback code paths.
- **Error Code Consistency**: Added missing structured error codes to all migration tool error responses: `sqlite_migration_apply` (`DUPLICATE_MIGRATION`, `MIGRATION_NOT_INITIALIZED`, `MIGRATION_EXECUTION_FAILED`), `sqlite_migration_record` (`DUPLICATE_MIGRATION`, `MIGRATION_NOT_INITIALIZED`), `sqlite_migration_rollback` (`VALIDATION_ERROR`, `MIGRATION_NOT_FOUND`, `ROLLBACK_SQL_MISSING`, `MIGRATION_NOT_INITIALIZED`), `sqlite_migration_history` (`MIGRATION_NOT_INITIALIZED`) — previously returned bare `{success: false, error: "..."}` without error codes for programmatic handling.
- **Migration Status Semantics**: `sqlite_migration_record` now inserts with `status: 'recorded'` instead of `'applied'` — distinguishes externally-recorded migrations from those actually executed by `sqlite_migration_apply`. Added `recorded` count to `sqlite_migration_status` output. Status output schema updated to include the new count field.
- **Rollback Safety**: `sqlite_migration_rollback` now rejects re-rolling back an already `rolled_back` migration with `ALREADY_ROLLED_BACK` error code — previously would silently re-execute the rollback SQL, which could cause errors for non-idempotent rollback statements.
- **Duplicate Version Blocking**: `sqlite_migration_record` and `sqlite_migration_apply` now reject duplicate version identifiers with `DUPLICATE_VERSION` error code — previously `migrationRecord` only warned and `migrationApply` had no version check at all. Duplicate versions caused ambiguity with `migrationRollback` which looks up by version and would silently target only the latest record.
- **Rollback SQL Validation**: `sqlite_migration_rollback` now detects comment-only rollback SQL (e.g., `"-- Cannot drop column"`) and returns `ROLLBACK_SQL_INVALID` error — previously attempted to execute the comments, producing a confusing `DB_WRITE_FAILED` error with `"The supplied SQL string contains no statements"`. Strips single-line (`--`) and multi-line (`/* */`) comments before checking for executable content.
- **Migration Dedup Scope**: Fixed `sqlite_migration_apply` SHA-256 dedup check blocking the `record → apply` workflow — the dedup previously matched against ALL migration statuses, so recording a migration with `migrationRecord` then applying the same SQL with `migrationApply` was rejected as a duplicate. Dedup now only blocks against `applied` migrations, allowing: (1) `record` then `apply` with the same SQL, (2) re-apply after rollback. Also fixed post-insert SELECT in both `apply.ts` and `record.ts` fetching by `migration_hash` (returns wrong row when multiple rows share a hash) — now fetches by `version` (unique).
- **History Filter Completeness**: Added `"recorded"` to `MigrationHistorySchema.status` enum — previously only `["applied", "rolled_back", "failed"]` were available, making it impossible to filter history by `recorded` status.
- **Rollback on Recorded-Only Migrations**: `sqlite_migration_rollback` now handles `recorded`-only migrations (never applied) by marking them as `rolled_back` without executing rollback SQL — previously would blindly execute the rollback SQL even though the migration was never applied, which could cause errors or unintended side effects. Returns `warning` explaining the behavior.
- **Error Suggestion**: Added `MALFORMED_JSON` error suggestion pattern for `"malformed JSON"` errors — commonly triggered when `json_extract()` receives a nonexistent column name (SQLite treats the unresolved identifier as a string literal and attempts to parse it as JSON). The suggestion now guides the agent to verify the column exists with `sqlite_describe_table`, instead of returning a generic `DB_QUERY_FAILED` with no guidance.
- **Error Field Consistency**: Added missing `code: "VALIDATION_ERROR"` and `category: "validation"` to WASM limitation error responses in `sqlite_verify_backup`, `sqlite_create_rtree_table`, `sqlite_create_csv_table`, and `sqlite_analyze_csv_schema` — previously returned bare `{success: false, error: "...", wasmLimitation: true}` without structured error metadata, inconsistent with `sqlite_backup` and `sqlite_restore` which used `formatHandlerError(new ValidationError(...))`.
- **Code Quality Audit — Magic JSON-RPC Error Code** — Replaced 4 remaining inline `-32000` literals with `JSONRPC_SERVER_ERROR` constant in `session.ts`
- **Code Quality Audit** — Removed unused deprecated `SERVER_INSTRUCTIONS` export from `server-instructions.ts` (zero consumers)
- **Code Quality Audit** — `executeGeneral()` in `query-executor.ts` now throws `QueryError` with logging (was bare `Error`)
- **Code Quality Audit** — `validateQuery()` in `database-adapter.ts` now throws `ValidationError` instead of bare `Error`
- **Code Quality Audit** — `ensureConnected()` / `ensureDb()` in both adapters now throw `ConnectionError` instead of bare `Error`
- **Transport Feature Backport** — Changed `Referrer-Policy` from `strict-origin-when-cross-origin` to `no-referrer` (API server has no referrer to share)
- **Version SSoT Mismatch** — Synced hardcoded `0.1.0` to `1.0.2` (matching `package.json`) in `index.ts`, `McpServer.ts`, and `cli.ts`
- **Duplicate Error Class Hierarchy** — Removed 6 duplicate error classes from `types/index.ts` (simple constructor) and consolidated into `utils/errors.ts` (enhanced: category, suggestions, recoverable, `toResponse()`); `types/index.ts` now re-exports from `utils/errors.ts`; `auth/errors.ts` updated to extend enhanced `DbMcpError`; added `AUTHENTICATION`/`AUTHORIZATION` to `ErrorCategory` enum
- **Bare `z.object({})` Schemas** — Added `.strict()` to 5 schemas (`transaction_commit`, `transaction_rollback`, `MigrationInitSchema`, `MigrationStatusSchema`, `pragma_database_list`) to reject extraneous properties
- **`sqlite_migration_risks` DROP INDEX Detection** — Now returns `medium` risk for `DROP INDEX` statements
  - Previously no risk entry was generated for `DROP INDEX` (fell through all pattern checks)
  - Now detects `DROP INDEX` with `riskLevel: "medium"`, `category: "index_removal"`, and actionable mitigation advice
- **`ERROR_SUGGESTIONS` Insufficient Data Pattern** — Regression tool's "Insufficient data" error now returns `VALIDATION_ERROR` instead of `UNKNOWN_ERROR`
  - `sqlite_stats_regression` throws `Error("Insufficient data for degree N regression")` when data points < degree+1
  - Message didn't match any `ERROR_SUGGESTIONS` pattern and fell through to `ErrorCategory.INTERNAL` → `UNKNOWN_ERROR`
  - Added `/insufficient data/i` pattern mapping to `ErrorCategory.VALIDATION` with actionable suggestion
- **`sqlite_json_set` / `sqlite_json_remove` No-Match Warning** — Returns `warning` field when `rowsAffected: 0`
  - Previously returned `{success: true, rowsAffected: 0}` with no indication that nothing was changed
  - Now includes `warning: "No rows matched the WHERE clause — no changes were made"`
  - Mirrors the same pattern already applied to `sqlite_json_update` and `sqlite_json_merge`
- **`ERROR_SUGGESTIONS` Column Name Pattern Coverage** — Added `has no column named` pattern for INSERT/UPDATE column errors
  - SQLite uses "has no column named X" for INSERT/UPDATE column errors, distinct from "no such column" used by SELECT
  - Previously classified as `UNKNOWN_ERROR` (no pattern match); now returns `RESOURCE_ERROR` with actionable suggestion
- **`sqlite_text_validate` Missing `customPattern` Error Code** — Now returns `VALIDATION_ERROR` instead of `UNKNOWN_ERROR`
  - Handler threw generic `Error` for missing `customPattern` when `pattern='custom'`; `formatError()` classified it as `UNKNOWN_ERROR`
  - Changed to throw `ValidationError` with proper `VALIDATION_ERROR` code and `validation` category
- **`sqlite_vector_store` / `sqlite_vector_batch_store` DDL-Based Dimension Check** — Dimension validation now reads table schema DDL as primary source
  - Previously read `dimensions` from existing rows only — bypassed on empty tables or tables with mismatched row data
  - Now parses `DEFAULT N` from `CREATE TABLE` SQL via `sqlite_master` for authoritative validation
  - Falls back to existing row data when DDL lacks a DEFAULT clause
  - INSERT now explicitly sets `dimensions` column to actual vector length
- **`sqlite_vector_search` Skipped Vector Reporting** — Response now includes `skipped` count and `warning` when vectors fail similarity calculation
  - Previously, vectors with dimension mismatches or parse errors were silently dropped (try/catch returned null)
  - Now surfaces a `warning: "N vector(s) skipped due to dimension mismatch or parse errors"` field in the response
  - Helps callers diagnose why `count` may be less than expected
- **`sqlite_json_update` / `sqlite_json_merge` No-Match Warning** — Returns `warning` field when `rowsAffected: 0`
  - Previously returned `{success: true, rowsAffected: 0}` with no indication that nothing was changed
  - Now includes `warning: "No rows matched the WHERE clause — nothing was updated/merged"`
  - Helps callers distinguish between a successful no-op and an actual problem
- **`sqlite_stats_histogram` Empty Table Phantom Bucket** — Histogram on empty table no longer returns a phantom `{min: 0, max: 0, count: 1}` bucket
  - Root cause: `MIN()`/`MAX()` return NULL on empty tables, which defaulted to 0 via `?? 0`, making `bucketSize === 0` and returning a hardcoded `count: 1`
  - Now counts non-null rows via `COUNT(column)` and returns empty `buckets: []` when no data exists
  - Uniform data (all values identical) now returns actual row count instead of hardcoded 1
- **`sqlite_vector_store` / `sqlite_vector_batch_store` Dimension Mismatch Validation** — Storing vectors with wrong dimensions now returns a structured error
  - Previously accepted any vector length regardless of table's configured `dimensions` column (e.g., storing 2-dim vector in 4-dim table succeeded silently)
  - Now reads the table's `dimensions` column and returns `{success: false, code: "DIMENSION_MISMATCH"}` when vector length doesn't match
  - `sqlite_vector_search` already validated dimensions at comparison time (via helper functions), so this adds write-side enforcement
- **Introspection Tools WASM FTS5 Crash** — 5 introspection tools no longer crash when the database contains FTS5 virtual tables in WASM mode
  - `sqlite_dependency_graph`, `sqlite_topological_sort`, `sqlite_cascade_simulator`, `sqlite_schema_snapshot`, `sqlite_constraint_analysis` all failed with "no such module: fts5" because internal queries (`SELECT COUNT(*)`, `PRAGMA table_info`, `PRAGMA foreign_key_list`) hit FTS5 virtual tables that WASM SQLite can't resolve
  - Added try/catch around per-table queries in `buildForeignKeyGraph()` (graph.ts) and `schemaSnapshot`/`constraintAnalysis` handlers (analysis.ts)
  - FTS5 tables are still included in results (with rowCount 0 and columnCount 0) but no longer crash the entire operation
- **`sqlite_json_normalize_column` WASM Compatibility** — Fixed all rows silently failing in WASM mode
  - Root cause: `SELECT rowid, ...` doesn't expose `rowid` as a named column in sql-js when the table has an INTEGER PRIMARY KEY
  - Handler received `undefined` for `row["rowid"]`, causing all per-row UPDATE queries to fail in the inner try/catch
  - Fix: Changed to `SELECT _rowid_ AS _rid_` which SQLite guarantees to work across all backends
  - Added `firstErrorDetail` field to response when errors occur, making per-row failures diagnosable without reading source code
- **Security Test Assertion Migration** — Updated 11 tests from `.rejects.toThrow()` to structured error assertions
  - `pragma-security.test.ts`: 3 `sqlite_pragma_table_info` injection tests now assert `{success: false, error: /invalid/i}`
  - `identifier-integration.test.ts`: 6 FTS tool injection tests and 2 admin tool injection tests (`pragma_table_info`, `index_stats`) updated
  - These tests were stale after handlers were migrated to return structured `{success: false}` instead of throwing
- **`sqlite_index_stats` Structured Error Handling** — Handler now wrapped in try/catch with `formatError()`
  - `sanitizeIdentifier()` and `Schema.parse()` were outside any try/catch, causing raw `InvalidIdentifierError` throws
  - Now returns `{success: false, indexes: [], error: "Invalid identifier..."}` consistent with all other admin tools
- **FTS Security Test Assertion Migration** — Updated 7 FTS injection tests from `.rejects.toThrow()` to structured error assertions
  - `fts-injection.test.ts`: 4 `sqlite_fts_create`, 1 `sqlite_fts_search`, 1 `sqlite_fts_rebuild`, 1 `sqlite_fts_match_info` injection tests updated
- **Core Query Tool Validation Hardening** — `sqlite_read_query` and `sqlite_write_query` handlers now catch Zod validation errors as structured `{success: false}` responses
  - Wrapped `Schema.parse(params)` inside try/catch blocks in both `createReadQueryTool` and `createWriteQueryTool` handlers
  - `sqlite_read_query`: Added empty query guard — empty string `""` previously returned `{success: true, rowCount: 0}` instead of a validation error
  - Now returns `{success: false, error: "Query cannot be empty. Provide a valid SELECT, PRAGMA, EXPLAIN, or WITH statement."}`
- **Text/FTS Tool Zod Validation Error Handling** — All 17 text and FTS tool handlers now catch Zod validation errors as structured `{success: false}` responses
  - 13 text tools (`regex.ts`, `formatting.ts`, `search.ts`): Moved `Schema.parse(params)` inside try/catch blocks with `formatError()`
  - 4 FTS tools (`fts.ts`): Moved `Schema.parse(params)` plus FTS5 availability checks and identifier validation inside try/catch blocks
  - Previously, calling these tools with invalid parameters returned raw MCP error frames instead of structured handler errors
- **Introspection Tool Zod Validation Error Handling** — All 9 introspection tool handlers now catch Zod validation errors as structured `{success: false}` responses
  - `sqlite_dependency_graph`, `sqlite_topological_sort`, `sqlite_cascade_simulator`, `sqlite_schema_snapshot`, `sqlite_constraint_analysis`, `sqlite_migration_risks`, `sqlite_storage_analysis`, `sqlite_index_audit`, `sqlite_query_plan`: Moved `Schema.parse(params)` inside try/catch blocks with `formatError()`
  - Previously, calling tools with invalid parameters (wrong types, missing required fields, out-of-range values) returned raw MCP error frames instead of structured handler errors
- **`sqlite_query_plan` min(1) Refinement Leak** — Removed `.min(1)` from `QueryPlanSchema.sql` and added handler-level validation
  - `.partial()` in `DatabaseAdapter.registerTool()` makes keys optional for SDK validation, but doesn't strip refinements like `min(1)`
  - When `sql: ""` was passed, the `min(1)` check fired at the SDK level, producing raw MCP error -32602
  - Now validates empty `sql` inside the handler and returns structured `{success: false, error: "Parameter 'sql' is required..."}`
- **Geo Tool Zod Validation Error Handling** — All 4 Haversine geo tool handlers now catch Zod validation errors as structured `{success: false}` responses
  - `sqlite_geo_distance`, `sqlite_geo_nearby`, `sqlite_geo_bounding_box`, `sqlite_geo_cluster`: Moved `Schema.parse(params)` inside try/catch blocks with `formatError()`
  - Previously, calling these tools with empty or invalid parameters returned raw MCP error frames instead of structured handler errors
- **Geo Tool Coordinate Range Validation** — Moved `.min(-90).max(90)` / `.min(-180).max(180)` refinements from Zod schemas to handler-level validation
  - `sqlite_geo_distance`: lat1, lon1, lat2, lon2 range validation via `validateCoordinates()` helper
  - `sqlite_geo_nearby`: centerLat, centerLon range validation
  - `sqlite_geo_bounding_box`: minLat, maxLat, minLon, maxLon range validation
  - Previously, out-of-range coordinates (e.g., `lat1: 91`) triggered raw MCP `-32602` errors at the SDK boundary before the handler ran
  - Now returns structured `{success: false, error: "Invalid lat1: 91. Must be between -90 and 90."}`
- **Admin Tool Zod Validation Error Handling** — 11 admin tool handlers now catch Zod/sanitizeIdentifier errors as structured `{success: false}` responses
  - `sqlite_pragma_table_info`, `sqlite_virtual_table_info`, `sqlite_create_csv_table`, `sqlite_create_rtree_table`, `sqlite_create_series_table`, `sqlite_append_insight`: Added try/catch around `Schema.parse(params)` and `sanitizeIdentifier()` calls
  - `sqlite_backup`, `sqlite_restore`, `sqlite_generate_series`, `sqlite_analyze_csv_schema`, `sqlite_transaction_execute`: Added try/catch around `Schema.parse(params)` calls
  - Previously, calling these tools with empty or invalid parameters returned raw MCP error frames instead of structured handler errors
  - `AppendInsightSchema.insight` now requires `.min(1)` to reject empty strings (previously accepted `""` silently)
- **Migration Tool Zod Validation Error Handling** — `sqlite_migration_record` and `sqlite_migration_apply` handlers now catch Zod validation errors as structured `{success: false}` responses
  - Moved `Schema.parse(params)` inside existing try/catch blocks in `tracking.ts`
  - Previously, calling these tools with empty `{}` params returned raw MCP error frames instead of structured handler errors
- **Code Mode `log` Alias Mapping** — Fixed `sqlite.migration.log()` pointing to `migrationRecord` instead of `migrationHistory`
  - `log` semantically means "show the log of migrations", not "record a new migration"
  - Calling `sqlite.migration.log()` previously required `version` and `migrationSql` params (record) — now correctly returns migration history with no required params
- **JSON Tool Zod Validation Error Handling** — All 23 JSON tool handlers now catch Zod validation errors as structured `{success: false}` responses
  - Previously, calling any JSON tool with empty or invalid parameters returned raw MCP error `-32602` instead of a structured handler error
  - Root cause: MCP SDK validates `inputSchema` at the transport layer before the handler runs, rejecting required-field violations as `-32602`
  - Fix: `DatabaseAdapter.registerTool()` now wraps inputSchema with `.partial()` so the SDK accepts any param subset; handler-level `Schema.parse()` validates strictly and returns structured errors via `formatError()`
  - Added try/catch around `Schema.parse(params)` in all 23 JSON handlers across 4 files: `crud.ts` (7), `query.ts` (4), `transform.ts` (4), `json-helpers.ts` (8)
- **Core Table Tool Zod Validation Error Handling** — 3 table handlers (`sqlite_create_table`, `sqlite_describe_table`, `sqlite_drop_table`) now catch Zod validation errors as structured `{success: false}` responses
  - Previously, calling these tools with missing required parameters (e.g., empty `{}`) threw raw MCP errors instead of returning structured handler errors
  - Added try/catch around `Schema.parse(params)` in all 3 handlers in `tables.ts` with `formatError()` for consistent error responses
- **Index Tool Zod Validation Error Handling** — All 3 index handlers (`sqlite_get_indexes`, `sqlite_create_index`, `sqlite_drop_index`) now catch Zod validation errors as structured `{success: false}` responses
  - Root cause: `CreateIndexSchema.columns` had `.min(1)` which the MCP SDK validates before the handler runs, surfacing as raw MCP error `-32602`
  - Moved `min(1)` check to handler-level validation returning `{success: false, message: "At least one column is required..."}`
  - Wrapped all `Schema.parse()` calls in try/catch blocks with `formatError()` for defense-in-depth
- **Multi-Session Streamable HTTP Crash** — Fixed `Already connected to a transport` error when creating 2+ concurrent sessions
  - SDK's `McpServer.connect()` only supports one active transport; second `connect()` threw
  - Added close-before-reconnect pattern wrapping `server.connect()` in try-catch
- **`sqlite_spatialite_index` Check Returns `valid: false` for Valid Indexes** — Now treats `CheckSpatialIndex` null result as indeterminate
  - SpatiaLite 5.x's `CheckSpatialIndex()` commonly returns `null` instead of `1` for valid indexes
  - Previously interpreted `null` as `false`, producing misleading message "Spatial index exists but may be invalid"
  - Now returns `valid: null` with message "Spatial index exists (validation inconclusive — common in SpatiaLite 5.x)"
  - Explicit `valid: false` now only shown when `CheckSpatialIndex` returns `0` (actually invalid index)
- **`sqlite_spatialite_create_table` Misleading Success on Existing Table** — Now returns `alreadyExists: true` when table already exists
  - Previously used `CREATE TABLE IF NOT EXISTS` and always reported `"Spatial table 'X' created"` even when table already existed
  - Now pre-checks table existence and returns accurate message: `"Spatial table 'X' already exists"` with `alreadyExists: true` flag
  - Prevents confusion about whether data was reset or preserved
- **`sqlite_spatialite_index` Create/Drop/Check Idempotency** — All 3 index actions now report accurate state
  - `create`: Returns `alreadyExists: true` when index already exists instead of silently running `CreateSpatialIndex` again
  - `drop`: Returns `alreadyDropped: true` when no index exists instead of misleadingly reporting `"Spatial index dropped"`
  - `check`: Returns `{ indexed: false }` when no index exists, or `{ indexed: true, valid: true/false }` when index exists — previously returned raw `{ result: [{ "CheckSpatialIndex(...)": null }] }`
  - Index existence checked via `idx_{table}_{column}` in `sqlite_master`
- **`sqlite_spatialite_analyze` Distance Matrix `targetTable` Support** — Now uses `targetTable` parameter when provided
  - Previously, the `distance_matrix` analysis type always used `sourceTable` for both sides of the cross-join, ignoring `targetTable`
  - Now uses `targetTable` (defaulting to `sourceTable` when omitted) and only applies `a.id < b.id` dedup filter for same-table queries
- **SpatiaLite Tool Structured Error Responses** — All 7 SpatiaLite handlers now return structured errors instead of throwing raw MCP exceptions
  - Added `formatError` import and try/catch blocks to all 7 handlers: `sqlite_spatialite_load`, `sqlite_spatialite_create_table`, `sqlite_spatialite_query`, `sqlite_spatialite_analyze`, `sqlite_spatialite_index`, `sqlite_spatialite_transform`, `sqlite_spatialite_import`
  - `sqlite_spatialite_query`: Nonexistent table errors now return `{success: false, error, code, suggestion}` instead of propagating as raw MCP exceptions
  - `sqlite_spatialite_analyze`: Same fix — structured error response for nonexistent tables and invalid table names
  - `sqlite_spatialite_index`: Added table existence validation — previously returned `{success: true}` for nonexistent tables; now returns `{success: false, error: "Table 'x' does not exist"}`
  - `sqlite_spatialite_transform`: Added null-result validation — previously returned `{success: true, result: null}` for invalid WKT geometry; now returns `{success: false, error: "Invalid geometry..."}`
  - `sqlite_spatialite_import`: Added WKT pre-validation via `GeomFromText()` — previously silently accepted invalid WKT strings like `"INVALID_WKT"`; now returns `{success: false, error: "Invalid WKT geometry..."}`
  - `sqlite_spatialite_create_table`: Validation errors (invalid table/column names) now return structured responses instead of throwing
  - Tests updated to expect structured error responses instead of catching thrown errors; 11 tests covering all 7 tools
  - Previously threw raw MCP exception when called with a nonexistent table
  - Now returns `{success: false, error, code, suggestion}` consistent with all other tool groups
  - Security test updated to assert structured error response instead of `.rejects.toThrow()`
- **`sqlite_restore` Relative Path Resolution** — Now resolves relative paths to absolute before file existence check
  - Previously used raw `input.sourcePath` with `fs.existsSync`, which resolved against the MCP server's CWD (e.g., Antigravity IDE directory)
  - Stale 0-byte files left by SQLite `ATTACH DATABASE` at the server CWD could cause false-positive `{success: true}` responses
  - Now uses `nodePath.resolve()` consistent with the existing `sqlite_verify_backup` handler
- **`sqlite_backup` Relative Path Resolution** — Now resolves relative paths to absolute before `VACUUM INTO`
  - Previously used raw `input.targetPath` for `VACUUM INTO`, causing backups to be written to the MCP server's CWD instead of the expected location
  - Now uses `nodePath.resolve()` consistent with `sqlite_verify_backup` and `sqlite_restore`
- **`sqlite_drop_view` Misleading Success Message** — Now reports "did not exist (no action taken)" for nonexistent views
  - Previously always returned `View 'x' dropped` regardless of whether the view existed (when `ifExists: true`)
  - Now checks view existence before dropping, consistent with `sqlite_drop_virtual_table` pattern
- **`sqlite_verify_backup` Relative Path False Positive** — Now resolves relative paths to absolute before `fs.existsSync` check
  - Previously, relative paths like `"nonexistent_file.db"` bypassed the file existence check (resolved against MCP server CWD, not database directory) and `ATTACH DATABASE` silently created an empty DB, returning `{success: true, valid: true, pageCount: 0}`
  - Now uses `nodePath.resolve()` to convert to absolute path before checking, ensuring consistent behavior regardless of server CWD
- **`sqlite_pragma_settings` Nonexistent PRAGMA Error Message** — Returns user-friendly error for unknown PRAGMAs
  - Previously, querying a nonexistent PRAGMA like `nonexistent_pragma_xyz` returned the confusing better-sqlite3 internal error: `"This statement does not return data. Use run() instead"` with `UNKNOWN_ERROR` code
  - Now detects this specific error pattern and returns `{success: false, error: "Unknown or write-only PRAGMA: 'nonexistent_pragma_xyz'"}`
  - `input` parsing moved before try/catch block to ensure PRAGMA name is accessible in error handler
- **`sqlite_pragma_settings` Structured Error Response** — Handler now wrapped in try/catch with `formatError()`
  - Previously, invalid PRAGMA names threw raw MCP exceptions instead of structured error responses
  - Now returns `{success: false, error: "Invalid PRAGMA name"}` for validation failures
  - Catches all SQLite errors and returns structured `{success: false, error, code, suggestion}` responses
- **`sqlite_verify_backup` Nonexistent File Validation** — Now pre-validates file existence before ATTACH
  - Previously, ATTACH silently created an empty DB for nonexistent files, returning false-positive `{success: true, valid: true, pageCount: 0}`
  - Now returns `{success: false, message: "Backup file not found: ..."}` when file doesn't exist
  - Outer try/catch with `formatError()` added for unexpected errors
- **`sqlite_restore` Nonexistent File Validation** — Now pre-validates source file existence before ATTACH
  - Previously, ATTACH silently created an empty DB for nonexistent files, returning false-positive `{success: true}`
  - Now returns `{success: false, message: "Source file not found: ..."}` when file doesn't exist
- **Transaction Tool Structured Error Responses** — All 6 transaction handlers now return structured errors instead of throwing raw MCP exceptions
  - `sqlite_transaction_begin`, `sqlite_transaction_commit`, `sqlite_transaction_rollback`: Errors like double-begin and no-active-transaction now return `{success: false, error, code, suggestion}` instead of propagating as unhandled exceptions
  - `sqlite_transaction_savepoint`, `sqlite_transaction_release`, `sqlite_transaction_rollback_to`: Invalid savepoint names return `{success: false, error: "Invalid savepoint name"}` instead of throwing; nonexistent savepoint errors return structured responses
  - Added `formatError` import to `transactions.ts`
  - Security tests updated to assert structured error responses instead of `.rejects.toThrow()`
- **`sqlite_vector_distance` Missing Error Handling** — Handler now wrapped in try/catch with `formatError()`
  - Previously, Zod validation errors from malformed input threw raw MCP exceptions instead of structured error responses
  - Now consistent with `sqlite_vector_normalize` and all other vector tool handlers
- **`sqlite_vector_batch_store` Empty Items Table Validation** — Now validates table existence even when items array is empty
  - Previously, `batch_store({table: "nonexistent", items: []})` returned `{success: true, stored: 0}` without checking if the table exists
  - Now queries `sqlite_master` to verify table existence before returning the empty-items early response
  - Returns `{success: false, error: "Table 'x' does not exist"}` for nonexistent tables
- **`sqlite_vector_get` Column Not Found Error** — Provides clear error when vector column doesn't exist in row data
  - Previously returned misleading `"Invalid vector format"` with `UNKNOWN_ERROR` code when the specified vector column was not found in the row
  - Now returns descriptive error: `"Column 'x' not found or contains NULL. Available columns: ..."` listing actual column names
- **`sqlite_vector_count` Dimensions Filter** — `dimensions` parameter now filters results instead of being silently ignored
  - Previously `sqlite_vector_count({table: "t", dimensions: 8})` returned total row count regardless of dimensions value
  - Now adds `WHERE dimensions = N` clause when dimensions parameter is specified
- **`sqlite_vector_normalize` Error Handling** — Handler now wrapped in try/catch with `formatError()`
  - Previously threw raw Zod validation errors instead of returning structured error responses
  - Now consistent with all other vector tool handlers
- **`sqlite_vector_batch_store` Empty Items Validation** — Returns early with `{stored: 0, message: "No items provided"}` for empty items array
  - Previously, empty items array on a nonexistent table silently returned `{success: true, stored: 0}` without touching the database
  - Now short-circuits before any SQL execution, preventing misleading success responses
- **Vector Tool Structured Error Responses** — All 11 vector handlers now return structured errors instead of throwing raw MCP exceptions
  - `sqlite_vector_create_table`, `sqlite_vector_store`, `sqlite_vector_batch_store`, `sqlite_vector_search`, `sqlite_vector_get`, `sqlite_vector_delete`, `sqlite_vector_count`, `sqlite_vector_stats`, `sqlite_vector_dimensions`, `sqlite_vector_normalize`, `sqlite_vector_distance`: Errors like nonexistent tables, invalid identifiers, and invalid input now return `{success: false, error, code, suggestion}` instead of propagating as unhandled exceptions
  - Added `formatError` import from `utils/errors.js` and wrapped all 11 handlers in try/catch blocks
  - Security tests in `identifier-integration.test.ts` updated to assert structured error responses instead of `.rejects.toThrow()`
  - Consistent with the structured error pattern already used by all other tool groups
- **`sqlite_vector_search` Negative Cosine Similarity Filter** — Search no longer silently drops results with negative cosine similarity
  - Previously, the search filter `_similarity >= 0` excluded rows with negative cosine similarity (dissimilar vectors)
  - Negative cosine similarity is valid (ranges from -1 to 1) and should be returned when within the limit
  - Now filters only rows where vector parsing failed (returns `null`), preserving all valid similarity scores
- **`sqlite_vector_create_table` Dimensions Validation** — Now rejects dimensions < 1 with structured error
  - Previously accepted `dimensions: 0` creating a table with meaningless `DEFAULT 0` dimension column
- **`sqlite_vector_distance` Cosine Metric** — Now returns cosine distance (`1 - similarity`) instead of raw cosine similarity
  - Previously returned cosine similarity (0 for orthogonal, 1 for identical) despite the tool being named "distance"
  - Now returns cosine distance (1.0 for orthogonal, 0 for identical) consistent with euclidean distance semantics
  - Does not affect `sqlite_vector_search` which correctly uses `_similarity` as a ranking score
- **Window Function Structured Error Responses** — All 6 window function handlers now return structured errors instead of throwing raw MCP exceptions
  - `sqlite_window_row_number`, `sqlite_window_rank`, `sqlite_window_lag_lead`, `sqlite_window_running_total`, `sqlite_window_moving_avg`, `sqlite_window_ntile`: Errors like nonexistent tables, invalid identifiers, and bad SQL now return `{success: false, error, code, suggestion}` instead of propagating as unhandled exceptions
  - Added `formatError` import from `utils/errors.js` and wrapped all 6 handlers in try/catch blocks
  - Window function tests updated to assert structured error responses instead of `.rejects.toThrow()`
  - Consistent with the structured error pattern already used by all 13 stats tools
- **`server_health` FTS5 Detection False Negative** — Health check now correctly reports `fts5: true` when FTS5 is compiled in
  - `hasFts5()` previously created a `_fts5_test` virtual table as a probe, which silently failed when SpatiaLite extensions were loaded
  - Replaced with lightweight `PRAGMA compile_options` check for `ENABLE_FTS5` flag
  - More reliable and efficient than the virtual table creation/drop approach
- **FTS5 Tool Structured Error Responses** — All 4 FTS5 handlers now return structured errors instead of throwing raw MCP exceptions
  - `sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`: Errors like nonexistent tables, bad SQL, and invalid columns now return `{success: false, error, code, suggestion}` instead of propagating as unhandled exceptions
  - Previously, only `isFts5UnavailableError` (WASM mode) was caught; all other errors were re-thrown
  - Consistent with the structured error pattern already used by all 13 text tools, core tools, stats tools, and JSON tools
  - Security tests in `fts-injection.test.ts` updated to assert structured error responses instead of `.rejects.toThrow()`
- **`sqlite_execute_code` Per-Call Timeout Enforcement** — The `timeout` parameter is now respected per-call instead of being silently ignored
  - Previously, `timeout` was parsed from input but never passed to the sandbox pool; all executions used the fixed 30000ms default
  - Added `timeoutMs?: number` parameter to `ISandbox.execute()` and `ISandboxPool.execute()` interfaces
  - All 4 implementations updated: `CodeModeSandbox`, `SandboxPool`, `WorkerSandbox`, `WorkerSandboxPool`
  - `codemode.ts` now passes the user-specified timeout through to `pool.execute(code, bindings, timeoutMs)`
- **`sqlite_create_index` Table Existence Pre-Validation** — Now returns `TABLE_NOT_FOUND` error instead of raw SQL error for nonexistent tables
  - Previously returned `{success: false, message: "Write query failed: no such table: main.xyz"}` (leaking implementation detail)
  - Now pre-validates table existence and returns `{success: false, message: "Table 'xyz' does not exist", code: "TABLE_NOT_FOUND"}`
  - Consistent with `sqlite_describe_table` and `sqlite_get_indexes` which already pre-validate table existence
- **`sqlite_create_index` Empty Columns Validation** — `CreateIndexSchema.columns` now requires `.min(1)`
  - Previously, an empty columns array passed Zod validation and produced invalid SQL `CREATE INDEX ... ON table ()`
  - Now rejected at schema validation level with clear "Array must contain at least 1 element(s)" message
- **`formatError` Specific Resource Error Codes** — Native SQLite errors now return precise error codes instead of generic `RESOURCE_ERROR`
  - `no such table` errors now return `TABLE_NOT_FOUND` code (previously `RESOURCE_ERROR`)
  - `no such column` and `has no column named` errors now return `COLUMN_NOT_FOUND` code (previously `RESOURCE_ERROR`)
  - Added optional `code` field to `ERROR_SUGGESTIONS` entries; `formatError` prefers `match.code` over category default
  - Consistent across all tool groups: core `read_query`/`write_query`, text `fts_search`, vector `search`, JSON `extract`
  - `findSuggestion` return type extended with `code?: string` field
  - Category-level fallback codes still apply for patterns without specific `code` overrides
- **`ERROR_SUGGESTIONS` Query Error Pattern Coverage** — 3 new patterns added for query errors that previously fell through to `UNKNOWN_ERROR`
  - `incomplete input` → `QUERY_ERROR` with suggestion to check for missing clauses or closing parentheses
  - `more than one statement` → `QUERY_ERROR` with suggestion to split into separate calls or use `sqlite_execute_code`
  - `too few parameter` → `QUERY_ERROR` with suggestion to match params array to placeholder count
- **`sqlite_read_query` Statement Type Validation** — Now rejects non-SELECT statements with clear error messages
  - Previously, INSERT/UPDATE/DELETE/DDL passed to `read_query` leaked internal better-sqlite3 message: `"This statement does not return data. Use run() instead"`
  - Now validates upfront and returns: `"Statement type not allowed: INSERT is not a SELECT query. Use sqlite_write_query for INSERT/UPDATE/DELETE, or appropriate admin tools for DDL."`
  - Allows SELECT, PRAGMA, EXPLAIN, and WITH statements; mirrors `write_query` validation pattern
- **`reset-database.ps1` Verification Table List** — Removed orphaned `temp_text_test` entry from expected tables map
  - `temp_text_test` is not created by the seed SQL and was dead code (verification query only checks `test_%` tables)
- **Native Adapter Missing Codemode Tool** — `sqlite_execute_code` was not registered in Native mode
  - `NativeSqliteAdapter.getToolDefinitions()` was missing `getCodeModeTools()` from its tool list
  - WASM adapter (`SqliteAdapter`) already included it via `getAllToolDefinitions()`
  - Tool filter correctly auto-injected `codemode` into enabled groups, but the tool definition was never produced so it couldn't be registered
- **Core Tool Input Validation** — 5 core tool handlers now return structured errors for invalid identifiers instead of throwing raw MCP exceptions
  - `sqlite_create_table`: Added `sanitizeIdentifier` validation for table names and empty columns array check (previously accepted empty string names and empty columns, causing orphaned tables or SQL syntax errors)
  - `sqlite_drop_table`, `sqlite_drop_index`: Wrapped existing `sanitizeIdentifier` calls in try/catch to return `{success: false, message: "..."}` instead of propagating `InvalidIdentifierError`
  - `sqlite_get_indexes`, `sqlite_create_index`: Same try/catch wrapping for identifier validation
  - All 5 handlers now follow the structured error response pattern: `{success: false, message: "Invalid ... name"}`
- **`sqlite_geo_nearby` `returnColumns` Column Leakage** — Lat/lon columns no longer leak into results when `returnColumns` is specified
  - Previously, internally-added lat/lon columns (needed for Haversine distance calculation) were included in the response even when the user didn't request them
  - Now strips lat/lon columns from results unless the user explicitly includes them in `returnColumns`
  - Consistent with `sqlite_geo_bounding_box` which already respected `returnColumns` exactly
- **Geo Tool Structured Error Responses** — All 3 database-accessing geo handlers now return structured errors instead of throwing raw MCP errors
  - `sqlite_geo_nearby`, `sqlite_geo_bounding_box`, `sqlite_geo_cluster`: Wrap handler logic in try-catch with `formatError()` for consistent `{success: false, error: "..."}` responses
  - Added `validateColumnExists()` to validate lat/lon column existence before query execution; previously nonexistent columns silently returned 0 results
  - 6 new error path tests added for nonexistent table and column scenarios
- **Admin Tool Structured Error Responses** — 4 admin tool handlers now return structured errors instead of throwing raw MCP errors
  - `sqlite_virtual_table_info`: Returns `{success: false, error: "Virtual table 'x' not found"}` instead of throwing for nonexistent virtual tables
  - `sqlite_create_view`: Catches duplicate view errors, invalid SQL, and identifier validation failures; returns `{success: false, message: "..."}` with context
  - `sqlite_drop_view`: Catches nonexistent view errors (when `ifExists: false`) and identifier validation failures
  - `sqlite_drop_virtual_table`: Catches nonexistent table errors (when `ifExists: false`) and returns structured response
  - Security tests updated to assert `{success: false, message: /invalid/i}` instead of `.rejects.toThrow()`
- **`sqlite_verify_backup` WASM False Positive** — Now returns WASM limitation error upfront before attempting ATTACH
  - Previously, ATTACH succeeded silently in WASM (creating empty DB in virtual filesystem), causing verify to return `{success: true, valid: true}` for any path including nonexistent files
  - Now checks `isNativeBackend()` first and returns `{success: false, wasmLimitation: true}` immediately
- **`sqlite_restore` WASM False Positive** — Now returns WASM limitation error upfront before attempting ATTACH
  - Previously, ATTACH succeeded silently in WASM, causing restore to "succeed" by copying empty tables from a nonexistent backup
  - Now checks `isNativeBackend()` first and returns `{success: false, wasmLimitation: true}` immediately
- **`sqlite_pragma_table_info` Nonexistent Table Detection** — Returns `{success: false}` for nonexistent tables
  - Previously returned `{success: true, columns: []}` for tables that don't exist
  - Now checks if columns array is empty and returns `{success: false, error: "Table 'x' not found or has no columns"}`
- **Admin Code Mode Positional Parameters** — Added 12 missing entries in `api.ts` for admin group methods
  - `generateSeries`, `createView`, `dropView`, `createSeriesTable`, `virtualTableInfo`, `dropVirtualTable`, `verifyBackup`, `pragmaCompileOptions`, `createRtreeTable`, `createCsvTable`, `analyzeCsvSchema` now support positional arg syntax
  - Example: `sqlite.admin.createView("my_view", "SELECT 1")` now works instead of requiring object syntax
- **Code Mode `normalizeParams` Primitive Type Handling** — Fixed single number/boolean args being passed raw to tool handlers
  - Previously, `sqlite.admin.generateSeries(1, 5, 1)` passed `1` directly instead of `{start: 1, stop: 5, step: 1}`
  - `normalizeParams` now wraps number and boolean single args using the positional parameter mapping, same as strings
  - Affects any method with non-string first positional params (e.g., `generateSeries`, `dbstat`)
  - **`sqlite_stats_correlation` Non-Numeric Column Validation** — Now returns structured error for non-numeric columns
  - Previously returned `{success: true, correlation: null}` when correlating text columns (e.g., `name`, `description`)
  - Now validates column types via `PRAGMA table_info()` and returns `{success: false, code: "INVALID_INPUT"}` with suggestion to use numeric columns
  - Correlation description says "numeric columns" — behavior now enforces this
- **Stats Tool Zod Refinement Leak Fixes** — Moved `.min()/.max()` refinements from Zod schemas to handler-level validation for 3 tools
  - `sqlite_stats_histogram`: Removed `.min(1)` from `buckets` schema parameter; handler now returns `{success: false, error: "'buckets' must be at least 1"}` for invalid values
  - `sqlite_stats_percentile`: Removed `.min(0).max(100)` from `percentiles` array element schema; handler now validates each percentile value is between 0 and 100
  - `sqlite_stats_regression`: Removed `.min(1).max(3)` from `degree` schema parameter; handler now returns structured error for values outside 1-3 range
  - Previously, out-of-range values triggered raw MCP `-32602` errors at the SDK boundary before the handler ran
- **Stats Code Mode Positional Parameters** — Fixed `statsGroupBy` and added 5 missing entries in `api.ts`
  - `statsGroupBy`: Was mapped to `["table", "column"]` but actual params are `["table", "valueColumn", "groupByColumn", "stat"]`
  - Added missing positional mappings for `statsDistinct`, `statsSummary`, `statsFrequency`, `statsOutliers`, `statsHypothesis`
  - All 13 stats methods now support positional arg syntax in `sqlite_execute_code`
- **Code Mode `help()` Write Method Discoverability** — `help()` now lists all methods regardless of `readonly` flag
  - Previously, `readonly: true` filtered write tools before API construction, hiding them from `help()` output
  - Now builds full API surface first, then wraps write methods with readonly guards returning `CODEMODE_READONLY_VIOLATION` errors
  - Users can discover all available methods via `sqlite.core.help()` and get clear error messages when invoking write methods in readonly mode
- **Text Tool Code Mode Positional Parameters** — Fixed 8 broken positional parameter mappings for text tools in `api.ts`
  - `textSplit`, `textConcat`, `textReplace` renamed to `split`, `concat`, `replace` (matching actual method names after prefix stripping)
  - Added 5 missing entries: `trim`, `case`, `substring`, `validate`, `normalize`
  - All text tools now support positional arg syntax in `sqlite_execute_code` (e.g., `sqlite.text.split("table", "col", "@")`)
- **Text Tool Code Mode Alias** — Removed broken `normalize → textNormalize` alias from `METHOD_ALIASES`
  - The canonical method name is `normalize` (not `textNormalize`), so the alias was a no-op pointing to nothing
- **`sqlite_advanced_search` Error Code** — Changed from `executeQuery` to `executeReadQuery` for consistent error codes
  - Nonexistent table errors now return `DB_QUERY_FAILED` code instead of `UNKNOWN_ERROR`
- **Security Integration Tests** — Updated 4 text tool injection tests in `identifier-integration.test.ts`
  - Tests now check for `{success: false, error: /invalid/i}` pattern instead of `.rejects.toThrow()`
  - Consistent with structured error handling across all tool groups
  - Fixed `text_replace` test to use correct parameter names (`searchPattern`/`replaceWith` instead of `search`/`replace`)
- **`createIndex` Code Mode Positional Parameter** — Added missing `indexName` to positional parameter mapping
  - `createIndex` was mapped as `["tableName", "columns"]` but `indexName` is required
  - Code mode calls like `sqlite.core.createIndex("table", ["col"], "idx_name")` now work correctly
- **Text Tool `TABLE_NOT_FOUND` Error Priority** — `validateColumnExists` now checks table existence before column existence
  - Previously returned `COLUMN_NOT_FOUND` when table didn't exist (because `pragma_table_info` returns empty for nonexistent tables)
  - Now returns `TABLE_NOT_FOUND` with suggestion to run `sqlite_list_tables`
  - Gives users a more actionable error message for the root cause
- **`sqlite_phonetic_match` Word-Level Matching** — Now splits column values into words and matches any word
  - Previously computed soundex/metaphone on the entire column value, missing multi-word matches (e.g., "Mouse" didn't match "Mouse Pad XL")
  - Now consistent with `sqlite_advanced_search` phonetic behavior which already matched per-word
  - Both Soundex and Metaphone paths updated; native SQLite soundex query replaced with JS-based word splitting
  - Documentation updated from "compares FIRST word only" to "matches against any word in value"
- **Stats Tool Output Schema Error Responses** — All 13 stats output schemas now accommodate `{success: false}` error responses
  - 10 exported schemas in `output-schemas.ts` and 3 inline schemas in `stats.ts` (outliers, regression, hypothesis) updated
  - Success-specific fields made optional; `error`, `code`, `suggestion` fields added
  - Previously, `formatError()` responses failed Zod output validation because required fields like `column`, `stats`, `count` were missing
  - Mirrors the pattern already used by JSON tool schemas for structured error handling
- **Stats Tools Non-Numeric Column Validation** — `sqlite_stats_percentile`, `sqlite_stats_outliers`, and `sqlite_stats_hypothesis` now validate column types upfront
  - `sqlite_stats_percentile`: Previously produced raw MCP output validation error (string values in numeric schema); now returns `{success: false, code: "INVALID_INPUT"}`
  - `sqlite_stats_outliers`: Previously generated SQL with `NaN` values causing `DB_QUERY_FAILED`; now returns structured error before query execution
  - `sqlite_stats_hypothesis`: Previously returned `UNKNOWN_ERROR` with vague message; now returns `INVALID_INPUT` with clear suggestion
  - Shared `validateNumericColumn()` helper extracted from `createCorrelationTool` for reuse across all three handlers
- **Stats Code Mode Positional Parameters (Round 2)** — Fixed 2 remaining positional parameter mappings in `api.ts`
  - `statsTopN`: Was `["table", "column"]`, missing `n` and `orderDirection` — fixed to `["table", "column", "n", "orderDirection"]`
  - `statsHypothesis`: Had `column` and `testType` swapped — fixed to `["table", "column", "testType"]`
  - `statsHypothesis`: Added missing `expectedMean` as 4th positional param — enables `sqlite.stats.statsHypothesis("table", "col", "ttest_one", 25)` without object syntax
- **Stats Code Mode Positional Parameters (Round 3)** — Added `whereClause` and `selectColumns` to positional parameter mappings in `api.ts`
  - 12 stats methods (`statsBasic`, `statsCount`, `statsGroupBy`, `statsHistogram`, `statsPercentile`, `statsCorrelation`, `statsRegression`, `statsDistinct`, `statsSummary`, `statsFrequency`, `statsOutliers`, `statsHypothesis`) now accept trailing `whereClause` positional arg
  - `statsTopN`: Added `selectColumns` as 5th positional param — enables `sqlite.stats.statsTopN("table", "col", 3, "desc", ["id", "name"])` without object syntax
  - Previously, trailing positional args for `whereClause` and `selectColumns` were silently dropped
- **Stats Code Mode Help Examples** — Fixed incorrect method names in `GROUP_EXAMPLES` for stats group
  - `sqlite.stats.basic()` → `sqlite.stats.statsBasic()`, `.histogram()` → `.statsHistogram()`, `.percentile()` → `.statsPercentile()`
  - Stats group uses `KEEP_PREFIX_GROUPS` so methods retain the `stats` prefix; examples now match actual API
- **Stats Tools Numeric Column Validation (Round 2)** — Added `validateNumericColumn` to 4 additional stats tools
  - `sqlite_stats_basic`: Previously returned meaningless results (sum: 0, avg: 0, min/max: null) for text columns; now returns structured `INVALID_INPUT` error
  - `sqlite_stats_histogram`: Previously generated corrupt SQL with NaN bucket boundaries for text columns; now returns structured error before query execution
  - `sqlite_stats_regression`: Previously returned raw MCP output validation error (NaN coefficients) for text columns; now validates both xColumn and yColumn upfront
  - `sqlite_stats_group_by`: Previously returned `stat_value: 0` for AVG/SUM/MIN/MAX on text columns; now validates valueColumn is numeric for non-count aggregations (count stat remains unrestricted)
- **Stats Code Mode Positional Parameters (Round 4)** — Fixed `statsCount` missing `distinct` in positional parameter mapping
  - Was `["table", "column", "whereClause"]` — `distinct` boolean passed as 3rd arg was mapped to `whereClause`, causing Zod validation error
  - Fixed to `["table", "column", "distinct", "whereClause"]` — enables `sqlite.stats.statsCount("table", "col", true)` syntax
- **Codemode Positional Parameter Mapping** — Fixed incorrect parameter name mappings in `api.ts`
  - `readQuery` and `writeQuery` mapped to `"sql"` but actual schema uses `"query"` — corrected
  - `describeTable`, `dropTable`, `getIndexes` mapped to `"table"` but actual schema uses `"tableName"` — corrected
  - `createTable`, `createIndex` first positional param mapped to `"table"` instead of `"tableName"` — corrected
  - `ServerInstructions.ts` examples updated to match corrected mappings
- **Codemode JSON Positional Parameter Mapping** — Fixed 16 incorrect parameter mappings for JSON code mode methods
  - `validatePath`, `pretty`, `valid` were mismapped to `["table", "column", ...]` instead of `"path"`, `"json"`, `"json"` respectively
  - `extract`, `set`, `remove`, `type`, `arrayLength`, `arrayAppend`, `keys`, `each`, `update`, `merge` were missing `whereClause` positional param
  - `insert` missing `data`, `select` missing `paths`, `query` missing `filterPaths` params
  - Calling `sqlite.json.extract("table", "col", "$.path", "id = 1")` now correctly maps the 4th arg to `whereClause`
- **`sqlite_create_index` Misleading Message for Duplicate Index Name** — Fixed IF NOT EXISTS returning false "created" message
  - When an index name already exists, `CREATE INDEX IF NOT EXISTS` silently does nothing but the handler always reported "created on table(column)"
  - Now checks index existence before executing and returns `"already exists (no changes made)"` when the index is pre-existing
  - Mirrors the pattern already used by `sqlite_create_table` for duplicate table names
- **`sqlite_execute_code` Negative `memoryUsedMb` Values** — Clamped memory metric to `Math.max(0, ...)`
  - Both `worker-sandbox.ts` and `sandbox.ts` measured heap delta on the main thread, which could go negative due to GC during worker execution
  - Values like `-4.76 MB` are now reported as `0 MB` instead
- **`sqlite_write_query` Statement Type Validation** — Now rejects non-DML statements with structured errors
  - Only allows INSERT, UPDATE, DELETE, and REPLACE statements
  - SELECT, PRAGMA, EXPLAIN, and DDL (CREATE, ALTER, DROP, TRUNCATE) are rejected with clear error messages
  - Prevents accidental data loss from DDL via write_query (previously accepted and executed `DROP TABLE`)
- **WASM FTS5 Tool Exclusion** — FTS5 tools no longer registered in WASM mode
  - Removed `getFtsTools()` from shared WASM tool index (`tools/index.ts`)
  - FTS5 tools (`sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`) remain available in native mode only
  - Previously, 4 FTS5 tools were registered in WASM but always returned `{success: false, error: "FTS5 module unavailable"}`
  - WASM tool counts corrected: `starter` 48→44, `search` 36→32, `full` 102→98, `text` group 17→13
  - Updated README.md, DOCKER_README.md, ToolConstants.ts, ServerInstructions.ts
  - Updated fts.test.ts and index.test.ts to verify exclusion
- **`sqlite_create_json_collection` Non-Atomic Table Creation** — Index path validation now runs before table creation
  - Previously, the table was created first, then index paths were validated one-by-one
  - An invalid index path returned `{success: false}` but left the table behind (partial creation)
  - Now validates all index paths upfront before executing `CREATE TABLE`
  - **DOCKER_README Documentation Sync** — Synchronized Docker Hub README with main README content
  - Added Resources (8) table with efficiency tip and Prompts (10) table
  - Added SQLite Extensions section with Docker-specific SpatiaLite/CSV instructions
  - Added OAuth 2.1 supported scopes table and Docker quick start example
  - Added stateless mode section for serverless Docker deployments
  - Added performance tuning tip for schema cache TTL configuration
  - Expanded HTTP endpoints from bullet list to table format with session management details
  - Fixed formatting bug: unclosed 4-backtick code block in legacy syntax section
- **README Streamlining** — Removed redundant sections to reduce README from 712 to ~590 lines
  - Removed Table of Contents (GitHub renders one natively)
  - Merged Quick Test into Quick Start as a "Verify It Works" substep
  - Removed Security Features checklist (duplicated by "What Sets Us Apart" table)
  - Removed Tool Categories table (redundant with Tool Groups table in Tool Filtering)
  - Removed Backend Options table and Transaction/Window tool listings (reference-level detail for Wiki)
  - Merged standalone Configuration section into OAuth section as a one-liner
  - Promoted Extensions, Resources, and Prompts to top-level sections
- **ESLint v10 Compatibility** — Fixed 11 new lint errors introduced by the ESLint v10 major upgrade
  - Added `{ cause }` to re-thrown errors in `NativeSqliteAdapter.ts`, `spatialite.ts`, `SqliteAdapter.ts` (`preserve-caught-error`)
  - Removed useless initial assignments in `SchemaManager.ts`, `SqliteAdapter.ts`, `admin.ts`, `stats.ts` (`no-useless-assignment`)
  - Fixed unsafe `express.json()` call in `http.ts` (`no-unsafe-call`)
- Added `lint:json` npm script for agent-readable ESLint output (`eslint-results.json`)
- Added `.gitattributes` to normalize line endings to LF on all platforms
- Added test suite badges (941 tests, 80% coverage) to both READMEs
- **Query Normalization**: Strip trailing whitespace and semicolons before injecting safety `LIMIT`, preventing invalid SQL like `SELECT ...; LIMIT 1000`
- **CTE Write Support**: `sqlite_write_query` now correctly accepts CTE-prefixed DML (`WITH ... INSERT/UPDATE/DELETE/REPLACE`) by parsing past parenthesized CTE bodies to find the main DML keyword
- **Statement Validation**: Removed `UPSERT` from allowed write prefixes — it is not a valid SQLite leading keyword
- **SQL Injection Hardening**: Replaced string interpolation with parameterized queries for table name filters in `sqlite_get_indexes` and `sqlite_index_stats`
- **Column Validation**: Optimized `validateColumnsExist` to fetch all columns in a single `pragma_table_info` query and check membership in-memory, eliminating N+1 query roundtrips
- **Structured Errors**: All 3 native transaction savepoint handlers (`savepoint`, `release`, `rollback_to`) now return `formatHandlerError(ValidationError)` for invalid names instead of bare `{success: false}` objects
- **WASM Capability**: Corrected `fullTextSearch` capability flag to `false` for WASM/sql.js builds (FTS5 is not available)
- **Constraint Analysis**: Removed redundant no-op `.replace(/_/g, "_")` in foreign key column inference
- **Encoding**: Fixed mojibake em dash (`â€"` → `—`) in admin barrel index JSDoc
- **CodeQL**: Fixed missing regex anchor in icon URL test assertion
- **CodeQL**: Removed 10 unused imports across 8 test files

### Security

- **Strict Validation**: Removed `.strict()` from all Zod tool input schemas across all tool groups. `.strict()` maps to `additionalProperties: false` in JSON Schema, which causes the MCP SDK to reject unrecognized keys at the framework boundary before handlers can catch, producing raw `-32602` errors instead of structured responses. Handler-level validation (regex, enum checks) already guards against malformed input.
- **SQL Injection**: Added strong regex validation to `savepoint` names in the Native SQLite transaction methods to prevent potential arbitrary SQL injection.
- **CORS Advisory**: Updated `README.md` and `DOCKER_README.md` to explicitly warn about the permissive `["*"]` default CORS property in production HTTP deployments.
- **Unified Audit**: SHA-pinned all GitHub Actions in `lint-and-test.yml` and `e2e.yml` for supply chain safety. Updated stale v4 SHAs to current v6 in `e2e.yml`. Removed manually-maintained `LABEL version` from `Dockerfile` to prevent version drift. Fixed `flatted` dependency vulnerability (GHSA-25h7-pfq9-p65f).
- **DNS Rebinding**: Added `localhostHostValidation()` middleware from MCP SDK to the HTTP transport to prevent DNS rebinding attacks.
- **Supply Chain**: SHA-pinned remaining 2 un-pinned CI actions (`actions/checkout`, `actions/setup-node`) in the benchmarks job of `lint-and-test.yml`.
- **Supply Chain**: Bumped GitHub Actions to latest major versions (Node 24 runtime):
  - `docker/login-action` v3 → v4
  - `docker/build-push-action` v6 → v7
  - `docker/metadata-action` v5 → v6
  - `docker/setup-buildx-action` v3 → v4
  - `actions/upload-artifact` v6 → v7
  - `actions/download-artifact` v7 → v8
- **Transitive Updates**: Fixed multiple vulnerabilities in transitive dependencies by updating `package-lock.json` via `npm update`:
  - `minimatch`: ReDoS in `matchOne()` combinatorial backtracking via multiple non-adjacent GLOBSTAR segments.
  - `hono` and `@hono/node-server`: Arbitrary file access via `serveStatic`, authorization bypass for protected static paths, SSE Control Field Injection, Cookie Attribute Injection, and Prototype Pollution in `parseBody`.
  - `express-rate-limit`: IPv4-mapped IPv6 addresses bypassing per-client rate limiting on dual-stack networks.
- **Code Quality Audit — Table Name Validation** — Added regex guard (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`) to native adapter's `describeTable` fallback
  - WASM adapter already had this guard; native adapter's fallback path was missing it
- **Code Quality Audit — Missing WHERE Clause Validation** — Added `validateWhereClause()` to 15 SQL interpolation points across 5 JSON tool files
  - `json-operations/crud.ts` (7 handlers), `json-operations/query.ts` (5 handlers), `json-operations/transform.ts` (2 handlers)
  - `json-helpers/read.ts` (1 handler), `json-helpers/write.ts` (2 handlers)
  - These tools interpolated `input.whereClause` directly into SQL without validation, unlike text/stats/vector/window tools which all called `validateWhereClause()`
- **Security Audit Remediation** — Addressed 4 findings from comprehensive security audit
  - Fixed transitive `hono` vulnerability (GHSA-v8w9-8mx6-g223) via `npm audit fix`
  - Added HTTP server timeouts: `setTimeout(120s)`, `keepAliveTimeout(65s)`, `headersTimeout(66s)` to prevent slowloris-style DoS attacks
  - SHA-pinned all GitHub Actions across 4 CI workflows (`lint-and-test.yml`, `codeql.yml`, `publish-npm.yml`, `docker-publish.yml`) to prevent supply chain attacks via tag hijacking
  - Hardened Docker Scout security gate to fail-fast on non-timeout scan errors instead of silently continuing
- **NPM Audit Remediation** — Patched high severity vulnerabilities in transitive dependencies
  - `@hono/node-server`: updated to 1.19.11
  - `hono`: updated to 4.12.5
- **Docker CVE Remediation** — Patched npm-bundled transitive dependencies in Dockerfile (both stages)
  - `tar`: 7.5.7 → 7.5.8 (CVE-2026-26960: path traversal, HIGH 7.1)
  - `minimatch`: 10.1.2 → 10.2.4 (CVE-2026-26996: ReDoS, HIGH 8.7)
- **Security Audit Remediation** — Addressed findings from exhaustive codebase security audit
  - CI `npm audit` gate now hard-fails on moderate+ vulnerabilities (removed `continue-on-error`)
  - Added `Referrer-Policy` and `Strict-Transport-Security` HTTP security headers (5 → 7 total)
  - WHERE clause validation now blocks `; SELECT` stacked query injection
  - Removed dead `new InvalidTokenError()` construction in auth middleware
  - Updated `SECURITY.md` supported versions to `1.x.x`
  - Fixed Dockerfile labels (version `1.0.2`, tool count `124`)

### Performance

- **Compact JSON Serialization (R-1)** — Tool responses now use compact `JSON.stringify(result)` instead of pretty-printed `JSON.stringify(result, null, 2)`
  - Reduces serialization overhead by ~15-20% on large payloads; MCP clients parse JSON programmatically
  - Error responses retain pretty-print for debugging readability
- **Incremental TypeScript Builds (B-1)** — Added `incremental: true` and `tsBuildInfoFile` to `tsconfig.json`
  - Subsequent builds only recheck changed files, significantly reducing dev-loop build times
- **Vitest Thread Pool (T-1)** — Configured `pool: "threads"` in `vitest.config.ts`
  - Enables worker thread execution for test parallelism on multi-core machines
- **`isDDL()` Helper Extraction (S-2/R-4)** — Replaced 3× duplicated DDL detection blocks with module-scope `isDDL()` function
  - Eliminates redundant `sql.trim().toUpperCase()` allocations in `SqliteAdapter.ts` and `NativeSqliteAdapter.ts`
- **SchemaManager Array Pre-Allocation (R-7)** — `getAllIndexes()` now pre-allocates result array with `new Array(rows.length)`
  - Avoids incremental `push()` resizing; improved documentation of PRAGMA batching constraints
- **CI `node_modules` Caching (CI-1)** — Added `actions/cache@v4` for `node_modules` in `lint-and-test.yml`
  - Keyed on `package-lock.json` hash per Node.js version; skips `npm ci` on cache hit (~20-30s savings per run)
- **CI Benchmark Tracking (CI-2)** — New `benchmarks` job in `lint-and-test.yml` (main branch only)
  - Runs `npm run bench` and uploads results as artifacts with 30-day retention for regression detection
- **NativeSqliteAdapter SchemaManager Integration** — Schema metadata operations now use TTL-based caching
  - `listTables()`, `describeTable()`, `getSchema()`, `getAllIndexes()` delegate through `SchemaManager` (5s TTL)
  - Eliminates redundant `PRAGMA table_info()` queries on every metadata request
  - Auto-invalidates schema cache on DDL operations (`CREATE`, `ALTER`, `DROP`)
  - Matches the caching pattern already used by the WASM `SqliteAdapter`
- **Cached Tool Definitions** — `NativeSqliteAdapter.getToolDefinitions()` now lazily caches results
  - Tool definitions are immutable per adapter instance; avoids 13-way array spread on repeat calls
- **Logger Taint-Breaking Optimization** — `writeToStderr()` uses `"".concat()` instead of per-character copy
  - Previous O(n) character-by-character array+join replaced with single string concatenation
  - Still breaks CodeQL taint tracking without the allocation overhead
- **Logger Sensitive Key Matching** — Pre-computed `SENSITIVE_KEYS_ARRAY` at module scope
  - Avoids spreading `Set` into a new array on every context key during `sanitizeContext()`
- **Logger Regex Pre-Compilation** — `sanitizeMessage()` and `sanitizeStack()` regex patterns hoisted to module scope
  - Avoids re-constructing `RegExp` objects (via `String.fromCharCode()`) on every log call
- **SQL Validation Regex Pre-Compilation** — `DANGEROUS_SQL_PATTERNS` hoisted to module scope in `DatabaseAdapter.ts`
  - Avoids re-allocating 5 `RegExp` objects per `validateQuery()` call
- **CORS Preflight Caching** — Added `Access-Control-Max-Age: 86400` to OPTIONS responses
  - Browsers cache preflight results for 24 hours, reducing repeated OPTIONS roundtrips
- **Docker HTTP Healthcheck** — Healthcheck now validates `/health` endpoint for HTTP transport
  - Falls back to basic Node.js check for stdio mode

### Dependencies

- Bumped `@eslint/js` from 9.39.2 to 10.0.1 (major)
- Bumped `@modelcontextprotocol/sdk` from 1.25.3 to 1.27.1
- Bumped `@types/node` from 25.2.0 to 25.5.0
- Bumped `@vitest/coverage-v8` from 4.0.18 to 4.1.0
- Bumped `better-sqlite3` from 12.6.2 to 12.8.0
- Bumped `eslint` from 9.39.2 to 10.0.3 (major)
- Bumped `globals` from 17.3.0 to 17.4.0
- Bumped `jose` from 6.1.3 to 6.2.1
- Bumped `rimraf` from 6.1.2 to 6.1.3
- Bumped `sql.js` from 1.13.0 to 1.14.1
- Bumped `typescript-eslint` from 8.54.0 to 8.57.1
- Bumped `vitest` from 4.0.18 to 4.1.0
- Removed unused `dotenv` production dependency (never imported in source)
- Removed unused `pg` and `@types/pg` dependencies (never imported in source)
- Dockerfile `tar` dependency pinned to 7.5.11 for security compliance

---

## [1.0.2] - 2026-02-04

### Added

- GitHub Release badge to READMEs (dynamic version display)

---

## [1.0.1] - 2026-02-04

### Added

- **npm Publishing** — Automated npm publishing workflow on GitHub releases
  - `publish-npm.yml`: NPM publish workflow triggered on release events
  - `.npmignore`: Reduces npm package size from 2.5MB to ~200KB
- **README Badges** — npm version, Docker pulls, MCP Registry badges
- **MCP Registry Integration** — `server.json` with npm + Docker packages

### Fixed

- MIT license badge color (yellow → blue) for consistency

---

## [1.0.0] - 2026-02-04

### Added

- **Docker Release Infrastructure** — Complete CI/CD pipeline for Docker Hub publishing
  - `lint-and-test.yml`: CI workflow with Node.js 22/24/25 matrix testing, ESLint, TypeScript checks
  - `docker-publish.yml`: Docker deploy workflow with security scanning, multi-platform builds (amd64/arm64), manifest merge
  - `Dockerfile`: Multi-stage build with better-sqlite3 native compilation, non-root user, security patches
  - `.dockerignore`: Excludes dev files, tests, and databases from image
  - `DOCKER_README.md`: Docker Hub README with quick start, tool filtering, security documentation
  - `DOCKER_DEPLOYMENT_SETUP.md`: Setup guide for GitHub secrets and deployment workflow

### Added

- **Security Test Coverage Expansion** — 12 new/enhanced test files improving coverage for security-critical utilities
  - `tests/utils/quoteIdentifier.test.ts`: 32 tests for identifier sanitization edge cases (empty, whitespace, control chars, quotes)
  - `tests/security/validateQuery.test.ts`: 23 tests for `DatabaseAdapter.validateQuery` security patterns
  - `tests/adapters/sqlite/resources.test.ts`: 10 tests for all 8 MCP resource handlers
  - `tests/adapters/sqlite/prompts.test.ts`: 16 tests for all 10 MCP prompt handlers
  - `tests/utils/insightsManager.test.ts`: 16 tests for the insights memo singleton
  - `tests/utils/progress-utils.test.ts`: 17 tests for MCP progress notification utilities
  - `tests/utils/annotations.test.ts`: 21 tests for tool and resource annotation presets
  - `tests/adapters/sqlite/json-utils.test.ts`: 67 tests for JSON normalization, JSONB support, SQL generation, validation
  - `tests/adapters/sqlite-native/NativeSqliteAdapter.test.ts`: 39 tests for native adapter (connection, queries, schema, capabilities)
  - Enhanced `logger.test.ts` with 7 additional ModuleLogger convenience method tests (notice, warn, warning, critical, alert, emergency)
  - Enhanced `security-injection.test.ts` with `sanitizeWhereClause` tests
  - Enhanced `ToolFilter.test.ts` with edge case tests (comma-only strings, meta-group exclusion, summary generation)
  - Coverage improvements: `identifiers.ts` 65→97%, `where-clause.ts` 80→100%, `ToolFilter.ts` 91→96%, `resources.ts` 22→97%, `prompts.ts` 23→87%, `insightsManager.ts` 22→100%, `progress-utils.ts` 0→100%, `annotations.ts` 90→100%, `resourceAnnotations.ts` 66→100%, `json-utils.ts` 43→97%, `logger.ts` 85→97%, `NativeSqliteAdapter.ts` 49→65%+

### Changed

- **ServerInstructions.ts Admin Tool Documentation** — Improved admin tool documentation clarity
  - `sqlite_dbstat`: Clarified JS fallback provides counts only (not per-table stats); updated WASM vs Native table
  - `sqlite_pragma_compile_options`: Added note that WASM may show FTS3, not FTS5
  - R-Tree and CSV tools: Clarified these return graceful errors with `wasmLimitation: true` in WASM mode

- **ServerInstructions.ts Text Tool Documentation** — Improved fuzzy_match and phonetic_match examples
  - Clarified tokenize behavior: `tokenize:false` for full-string matching vs default token mode
  - Added `includeRowData:false` tip for phonetic matching to reduce payload size
  - Fixed example search term ("laptop" instead of "laptp" for clearer demonstration)

- **`sqlite_dbstat` Response Field Naming** — Renamed response fields for clarity when using `summarize: true`
  - Changed `tableCount` to `objectCount` and `tables` to `objects`
  - dbstat returns storage stats for all database objects (tables and indexes), not just tables
  - More accurately reflects the actual content of the response

### Added

- **`sqlite_spatialite_analyze` Geometry Output Control** — New `includeGeometry` parameter to reduce payload size
  - When `false` (default), omits full WKT geometry from `nearest_neighbor` and `point_in_polygon` results
  - When `true`, includes `source_geom` and `target_geom` WKT fields as before
  - Significantly reduces payload size for proximity analysis (geometry can be 100+ characters per row)

### Changed

- **`sqlite_spatialite_transform` Adaptive Buffer Simplification** — Buffer tolerance now scales with buffer distance
  - Default tolerance changed from fixed 0.0001 to adaptive `max(0.0001, distance * 0.01)`
  - Larger buffers (e.g., 0.1 degrees) now produce ~50 vertices instead of 96+ for more compact WKT
  - Smaller buffers retain precision with the 0.0001 floor

- **`sqlite_index_stats` System Index Filter** — New `excludeSystemIndexes` parameter to hide SpatiaLite system indexes
  - When `true` (default), filters out SpatiaLite system indexes (`idx_spatial_ref_sys`, `idx_srid_geocols`, `idx_viewsjoin`, `idx_virtssrid`)
  - Provides parity with `sqlite_dbstat` and `sqlite_list_tables` system table filtering
  - Set to `false` to include all indexes

### Changed

- **`sqlite_pragma_compile_options` Description** — Enhanced tool description to mention filter parameter
  - Description now notes "Use the filter parameter to reduce output (~50+ options by default)"
  - Helps agents know upfront how to avoid large payloads

- **`sqlite_dbstat` Parameter Clarification** — Updated `excludeSystemTables` description for accuracy
  - Description now clarifies it filters "SpatiaLite system tables and indexes" (not just tables)
  - Reflects actual filtering behavior which includes SpatiaLite indexes in dbstat output

- **`sqlite_dbstat` FTS5 Shadow Table Filtering** — Now filters FTS5 shadow tables when `excludeSystemTables: true`
  - Previously `excludeSystemTables` only filtered SpatiaLite system tables/indexes
  - Now also filters FTS5 shadow tables (`*_fts_data`, `*_fts_config`, `*_fts_docsize`, `*_fts_idx`, etc.)
  - Applies to both summarize mode and raw page-level mode

- **JSON Tool Naming Consistency** — Renamed `sqlite_analyze_json_schema` to `sqlite_json_analyze_schema`
  - Aligns with the `sqlite_json_*` prefix pattern used by all other tools in the JSON group
  - Updated ToolConstants.ts, ServerInstructions.ts, json-helpers.ts, and output-schemas.ts

- **ServerInstructions.ts Core Tools Documentation** — Removed confusing `sqlite_list_views` reference from `sqlite_list_tables` description
  - `sqlite_list_views` is in the admin group, not core; reference was misleading in core tools table
  - Simplified description to: "List tables with column counts (excludeSystemTables hides SpatiaLite tables)"

- **Modern MCP SDK API Migration** — Removed all `eslint-disable` comments
  - `McpServer.ts`: Migrated built-in tools (`server_info`, `server_health`, `list_adapters`) from deprecated `server.tool()` to `server.registerTool()` API
  - `SqliteAdapter.ts` and `NativeSqliteAdapter.ts`: Migrated from deprecated `server.resource()` and `server.prompt()` to modern `server.registerResource()` and `server.registerPrompt()` APIs
  - `middleware.ts`: Replaced global namespace extension with proper Express module augmentation pattern (`declare module "express-serve-static-core"`)
  - `progress-utils.ts`: Replaced deprecated `Server` type import with structural interface (`NotificationSender`)
  - `logger.ts`: Replaced control character regex literals with dynamically constructed `RegExp` using `String.fromCharCode()` to satisfy `no-control-regex` rule

- **`sqlite_generate_series` Pure JS Implementation** — Removed unnecessary native SQLite attempt
  - better-sqlite3's bundled SQLite lacks `SQLITE_ENABLE_SERIES` compile option
  - Native `generate_series()` virtual table was always failing, wasting a database call
  - Now generates directly in JavaScript, eliminating the failed native attempt overhead

### Fixed

- **`sqlite_vector_search` returnColumns Consistency** — Fixed `returnColumns` being ignored for euclidean/dot metrics
  - Previously, `returnColumns` only filtered output when using cosine similarity; euclidean and dot returned all columns
  - Now consistently applies column filtering after similarity calculation for all three metrics
  - Reduces payload size for non-cosine searches (previously ~3x larger due to full embedding vectors in output)

### Changed

- **ServerInstructions.ts `sqlite_stats_top_n` Documentation** — Strengthened payload optimization guidance
  - Changed comment from passive note to explicit ⚠️ warning: "Always use selectColumns to avoid returning all columns (large payloads with text fields)"
  - Emphasizes importance of column selection to reduce token usage

### Added

- **`sqlite_dbstat` System Table Filter** — New `excludeSystemTables` parameter to hide SpatiaLite metadata
  - When `true`, filters out SpatiaLite system tables from storage statistics (57 tables → ~12 user tables)
  - Applies to both summarize mode and default raw page-level mode
  - Provides parity with `sqlite_list_tables` and `sqlite_get_indexes` system table filtering
  - Default is `false` to preserve backward compatibility

- **`sqlite_list_tables` Tool Description** — Fixed misleading "row counts" description
  - Changed tool description in `core.ts` from "row counts" to "column counts" to match actual output
  - Tool returns `columnCount` per table, not row counts

- **`sqlite_json_normalize_column` Output Format Control** — New `outputFormat` parameter for normalization output
  - `preserve` (default): Keeps original format (text→text, JSONB→JSONB)
  - `text`: Always outputs normalized JSON as text
  - `jsonb`: Outputs normalized JSON in JSONB binary format
  - Enables normalizing JSONB columns without losing binary format efficiency
  - Response includes `outputFormat` field indicating which format was applied

### Changed

- **`sqlite_json_normalize_column` Default Behavior** — Changed default `outputFormat` from `text` to `preserve`
  - Prevents accidental JSONB-to-text conversion when normalizing columns that were previously converted to JSONB
  - Use explicit `outputFormat: "text"` when text output is specifically needed

### Changed

- **ServerInstructions.ts `sqlite_json_each` Payload Warning** — Added explicit warning about output row multiplication
  - Comment now reads: "Note: json_each multiplies output rows—use limit param for large arrays"
  - Example updated to include `limit: 50` parameter to demonstrate payload control

- **ServerInstructions.ts SpatiaLite Analyze Documentation** — Improved tool documentation clarity
  - Added explicit `analysisType` options: `spatial_extent | point_in_polygon | nearest_neighbor | distance_matrix`
  - Documented `excludeSelf` parameter for same-table nearest_neighbor/distance_matrix queries
  - Added note clarifying that distances are returned in **Cartesian (degrees)**, not geodetic (km/miles)

### Changed

- **`sqlite_drop_virtual_table` Regular Table Validation** — Now validates target is actually a virtual table
  - Returns helpful error message if attempting to drop a regular table, directing to use `sqlite_drop_table` instead
  - Prevents accidental misuse of virtual table drop tool on regular tables

- **`sqlite_dbstat` WASM Fallback Enhancement** — Added table count to basic stats in WASM mode
  - When dbstat virtual table is unavailable, now returns `tableCount` in addition to `pageCount`
  - Provides more useful context about database contents

- **CSV Tool Messages WASM Clarity** — Improved error messages for `sqlite_create_csv_table` and `sqlite_analyze_csv_schema`
  - When running in WASM mode, now explicitly states "CSV extension not available in WASM mode"
  - Previously showed generic message about loading extension, which was misleading in WASM context
  - `wasmLimitation` flag is now dynamic based on actual runtime environment

- **ServerInstructions.ts CSV Documentation** — Added WASM limitation note to CSV tool examples
  - Comment now reads "Native only - not available in WASM" for clarity

- **ServerInstructions.ts `sqlite_list_tables` Documentation** — Clarified that views are listed via `sqlite_list_views`
  - Updated description to note that views require `sqlite_list_views` from admin group

### Changed

- **`sqlite_vector_search` Payload Optimization** — Vector data now excluded from results when not explicitly requested
  - When `returnColumns` is specified without the vector column, results omit vector data for smaller payloads
  - Reduces response size significantly for high-dimensional vectors (e.g., 384+ dimensions)
  - Vector data still included when `returnColumns` is empty or explicitly includes the vector column

- **ServerInstructions.ts Vector Tool Documentation** — Expanded vector section with all 11 tool examples
  - Added missing tools: `sqlite_vector_batch_store`, `sqlite_vector_get`, `sqlite_vector_delete`, `sqlite_vector_count`, `sqlite_vector_dimensions`
  - Added documentation note about `returnColumns` payload optimization

- **ServerInstructions.ts Admin Tool Documentation** — Expanded Database Administration section with all admin tool examples
  - Added 20+ missing examples: views (`sqlite_create_view/drop_view/list_views`), virtual tables, backup/restore/verify
  - Added PRAGMA utilities (`sqlite_pragma_compile_options/database_list/optimize`), `sqlite_index_stats`, `sqlite_dbstat`
  - Added `sqlite_generate_series`, `sqlite_create_series_table`, `sqlite_create_rtree_table`, `sqlite_append_insight`

### Fixed

- **`sqlite_backup` WASM Consistent Error Response** — Backup now returns `success: false` upfront in WASM mode
  - Previously, backup attempted `VACUUM INTO` then caught errors, leading to inconsistent behavior: sometimes succeeding to ephemeral VFS, sometimes failing on path resolution
  - Now checks `isNativeBackend()` first and returns `{success: false, wasmLimitation: true}` immediately
  - Consistent with `sqlite_restore` and `sqlite_verify_backup` which already had upfront WASM checks
  - Native mode behavior unchanged: backup still uses `VACUUM INTO` and returns structured errors on failure

- **Stats Tool Group Bug Fixes** — Resolved 6 issues from comprehensive tool testing
  - `sqlite_stats_histogram`: Fixed off-by-one bucket boundary that excluded max values (now uses `<=` for final bucket)
  - `sqlite_stats_summary`: Auto-filters to numeric columns when no columns specified (prevents string min/max errors)
  - `sqlite_stats_correlation`: Returns `null` instead of `NaN` for invalid correlations (schema-safe)
  - `sqlite_stats_hypothesis`: Validates t-statistic is finite before returning (catches zero variance/non-numeric columns)
  - `sqlite_stats_basic`: Ensures numeric type coercion for all stat values (converts strings to numbers or null)
  - `sqlite_stats_group_by`: Validates both `valueColumn` and `groupByColumn` exist in table before execution

- **NativeSqliteAdapter Missing Method** — Added `getConfiguredPath()` to match SqliteAdapter interface
  - `sqlite_pragma_database_list` tool was failing in native mode due to missing method
  - Now returns configured database path consistently across WASM and Native adapters

- **`sqlite_dbstat` Table-Specific WASM Fallback** — Improved fallback when dbstat virtual table unavailable
  - Previously, the `table` parameter was ignored in WASM mode, returning only total database page count
  - Now provides table-specific estimates: `rowCount`, `estimatedPages` (~100 rows/page), and `totalDatabasePages`
  - Returns `success: false` with appropriate message if specified table doesn't exist

- **`sqlite_drop_virtual_table` Accurate Messaging** — Fixed misleading success message for non-existent tables
  - Previously, dropping a non-existent table with `ifExists: true` reported "Dropped virtual table 'x'"
  - Now returns accurate message: "Virtual table 'x' did not exist (no action taken)"
  - Helps distinguish between actual drops and no-op operations

- **FTS5 Tools WASM Upfront Check** — `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info` now check FTS5 availability upfront
  - Previously, these tools threw raw "no such table" SQL errors in WASM mode when FTS tables couldn't be created
  - Now return graceful error response with hint before attempting any SQL execution
  - Consistent with `sqlite_fts_create` which already had upfront FTS5 detection

- **WASM Adapter Templated Resource Support** — Fixed `sqlite://table/{name}/schema` resource returning "not found" in WASM mode
  - Ported `ResourceTemplate` handling from `NativeSqliteAdapter` to `SqliteAdapter`
  - Templated resources now properly register with MCP SDK's `ResourceTemplate` class
  - Both static and templated resources now work consistently across WASM and Native backends

- **Index Column Population in WASM Adapter** — Fixed `sqlite://indexes` resource returning empty `columns` array
  - Added `PRAGMA index_info()` queries to populate column names for each index
  - Updated both `SchemaManager.getAllIndexes()` and `SqliteAdapter.getIndexes()` fallback
  - Index metadata now matches Native adapter behavior

### Changed

- **`sqlite_pragma_database_list` Configured Path Visibility** — Added `configuredPath` field to output
  - WASM mode shows internal virtual filesystem paths (e.g., `/dbfile_3503536817`) which can confuse users
  - Now includes `configuredPath` showing the user's original database file path
  - Adds explanatory `note` when internal path differs from configured path

### Dependencies

- **Dependency Updates** — Updated npm dependencies to latest versions
  - `@types/node`: 25.1.0 → 25.2.0
  - `globals`: 17.2.0 → 17.3.0
  - `pg`: 8.17.2 → 8.18.0

### Changed

- **ServerInstructions.ts FTS5 Documentation** — Added note that FTS5 virtual tables and shadow tables are hidden from `sqlite_list_tables` for cleaner output

- **`sqlite_fuzzy_match` Token-Based Matching** — Now matches against word tokens by default instead of entire column value
  - New `tokenize` parameter (default: `true`) splits column values into words for per-token comparison
  - "laptop" now matches "Laptop Pro 15" (distance 0 on first token)
  - Output includes `matchedToken` and `tokenDistance` for transparency
  - Set `tokenize: false` to restore legacy behavior (match entire column value)
  - Removed full row data from output for token efficiency (just `value` and match info)
  - Updated `ServerInstructions.ts` documentation with new behavior

- **ServerInstructions.ts `generate_series` Documentation** — Clarified JS fallback behavior
  - Changed WASM vs Native table entry from "✅ native | ❌ | JS" to "JS fallback | JS fallback | —"
  - The generate_series extension is not compiled into SQLite, so both environments use the JavaScript fallback

- **`sqlite_phonetic_match` Documentation** — Updated matching behavior description
  - Changed from "compares FIRST word only" to "matches against any word in value"

- **`sqlite_json_keys` Documentation** — Clarified distinct key behavior
  - Updated description to note tool returns unique keys across all matching rows, not per-row keys

- **ServerInstructions.ts Stats Group Documentation** — Clarified window function grouping
  - Line 70: Changed "Window functions (6 tools)" to "Window functions (6 tools in stats group)"
  - Line 89: Changed "Stats(13-19)" to "Stats(19: 13 core + 6 window)" for clearer tool count breakdown

### Added

- **`sqlite_list_views` System View Filter** — New `excludeSystemViews` parameter to hide SpatiaLite views
  - When `true` (default), filters out SpatiaLite system views (`geom_cols_ref_sys`, `spatial_ref_sys_all`, `vector_layers`, etc.)
  - Reduces noise in view listings for spatial databases (7 views → 1 user view)
  - Set to `false` to include all views

- **`sqlite_get_indexes` System Index Filter** — New `excludeSystemIndexes` parameter to hide SpatiaLite indexes
  - When `true`, filters out SpatiaLite system indexes (`idx_spatial_ref_sys`, `idx_srid_geocols`, `idx_viewsjoin`, `idx_virtssrid`, etc.)
  - Provides parity with `sqlite_list_tables` parameter `excludeSystemTables`
  - Default is `false` to preserve backward compatibility

- **`sqlite_list_tables` System Table Filter** — New `excludeSystemTables` parameter to hide SpatiaLite metadata
  - When `true`, filters out SpatiaLite system tables (`geometry_columns`, `spatial_ref_sys`, `spatialite_history`, `vector_layers`, etc.)
  - Reduces noise in table listings for spatial databases (38 tables → 12 user tables)
  - Default is `false` to preserve backward compatibility

### Changed

- **CSV Tools Path Validation** — Improved error messages for `sqlite_create_csv_table` and `sqlite_analyze_csv_schema`
  - Now validates that file paths are absolute before attempting to create virtual table
  - Returns helpful error message with suggested absolute path when relative path is provided
  - Example: `"Relative path not supported. Please use an absolute path. Example: C:\\path\\to\\file.csv"`

- **ServerInstructions.ts FTS5 Documentation** — Fixed incomplete FTS5 example
  - Added required `sqlite_fts_rebuild` call after `sqlite_fts_create` (indexes are empty until rebuild)
  - Fixed parameter names: `table` → `tableName`/`sourceTable` to match actual tool schema
  - Added clarifying comment explaining that triggers sync future changes but don't populate existing data

### Fixed

- **`sqlite_list_tables` KNN2 Virtual Table** — KNN2 SpatiaLite virtual table now filtered by `excludeSystemTables`
  - Added "KNN2" to the SpatiaLite system table exclusion list
  - Previously KNN2 was shown despite `excludeSystemTables=true`

- **`sqlite_json_group_object` Aggregate Function Support** — New `aggregateFunction` parameter for aggregate values
  - Enables `COUNT(*)`, `SUM(amount)`, `AVG(price)`, and other aggregate functions as object values
  - Uses subquery pattern to pre-aggregate results before wrapping in `json_group_object()`
  - Example: `sqlite_json_group_object({ table: "events", keyColumn: "event_type", aggregateFunction: "COUNT(*)" })`
  - `allowExpressions` parameter clarified: supports column extraction only, NOT aggregate functions
  - **New**: Returns `hint` warning when using `allowExpressions` without `groupByColumn` (duplicate keys may result if key values aren't unique)

### Fixed

- **`server_health` SpatiaLite Status** — Health check now reports accurate SpatiaLite extension status
  - Previously hardcoded `spatialite: false` regardless of actual extension state
  - Now calls exported `isSpatialiteLoaded()` to reflect runtime extension status
  - Helps users confirm SpatiaLite is loaded before using spatial tools

### Changed

- **`sqlite_list_tables` Documentation** — Updated tool description in ServerInstructions.ts
  - Now mentions `excludeSystemTables` parameter for filtering SpatiaLite metadata

- **ServerInstructions.ts SpatiaLite Tool Count** — Improved documentation clarity
  - Changed "SpatiaLite GIS (7 of 11 geo tools)" to "SpatiaLite GIS (7 tools; 4 basic geo always work)"
  - Clarifies that 7 tools require SpatiaLite while 4 basic Haversine-based tools work in any mode

- **`sqlite_json_normalize_column` JSONB Conversion Consistency** — JSONB rows now always converted to normalized text format
  - Previously, JSONB rows with already-normalized content were left unchanged (still in JSONB binary format)
  - Handler now detects original storage format and forces text output for all JSONB rows
  - Ensures uniform text JSON format after normalization, avoiding mixed format scenarios

- **`sqlite_stats_hypothesis` Chi-Square Validation** — Added validation for insufficient categories
  - Chi-square test now throws descriptive error when df=0 (fewer than 2 categories in either column)
  - Previously returned mathematically meaningless results (p=1, df=0) without warning
  - Error message includes actual category counts for both columns to help users diagnose the issue

- **`sqlite_json_storage_info` Mixed Format Recommendation** — Fixed misleading recommendation when column has both text and JSONB rows
  - Now detects mixed format scenarios and recommends running `sqlite_jsonb_convert` to unify storage
  - Previously reported "Column already uses JSONB format" even when 50% of rows were still text JSON

### Changed

- **`sqlite_spatialite_transform` Buffer Auto-Simplification** — Buffer operation now auto-simplifies output by default
  - Reduces verbose WKT payload from ~2KB (64-point circle) to ~200 bytes
  - Default tolerance 0.0001 is suitable for lat/lon coordinates
  - Set `simplifyTolerance: 0` to disable auto-simplification for full precision output
  - Updated `ServerInstructions.ts` with clarified documentation on distance parameter usage

- **`sqlite_transaction_execute` SELECT Row Data** — SELECT statements now return actual row data
  - Results include `rowCount` and `rows` fields for SELECT statements instead of just `rowsAffected: 0`
  - Enables read-modify-read patterns within atomic transactions
  - Write statements continue to return `rowsAffected` as before

- **`sqlite_dbstat` Limit Parameter** — Added configurable `limit` parameter (default: 100)
  - Controls maximum number of tables/pages returned in both summarized and raw modes
  - Helps reduce payload size for large databases
  - Previously hardcoded to 100; now user-configurable

### Changed

- **`sqlite_fuzzy_match` Documentation** — Clarified that Levenshtein distance is computed against entire column values
  - Updated description to note comparison is against whole values, not word tokens
  - Added guidance to use maxDistance 1-3 for similar-length strings
  - This is expected behavior; documentation now makes it explicit

- **`sqlite_advanced_search` Parameter Guidance** — Added threshold tuning guidance for `fuzzyThreshold`
  - Parameter description now includes: "0.3-0.4 for loose matching, 0.6-0.8 for strict matching"
  - Added inline example: "e.g., 'laptob' matches 'laptop'"
  - Helps users understand how to tune the similarity threshold for their use case

- **ServerInstructions.ts Stats Tool Documentation** — Added `selectColumns` example for `sqlite_stats_top_n`
  - Documents payload optimization pattern for retrieving only required columns
  - Helps reduce response size when querying tables with large text fields

- **ServerInstructions.ts Text Processing Documentation** — Expanded TOOL_REFERENCE examples
  - Added `sqlite_regex_extract` example with capture groups
  - Added `sqlite_text_split`, `sqlite_text_concat`, `sqlite_text_normalize` examples
  - Added `sqlite_phonetic_match` example with soundex algorithm
  - Clarified fuzzy match behavior: "compares against ENTIRE column value, not word tokens"
  - Added `fuzzyThreshold` tuning guidance comment in `sqlite_advanced_search` example

- **`sqlite_spatialite_analyze` Self-Match Filtering** — Added `excludeSelf` parameter (default: true)
  - When sourceTable equals targetTable in nearest_neighbor analysis, self-matches (distance=0) are now filtered
  - Set `excludeSelf: false` to include self-matches in results
  - Reduces noise in proximity analysis results

- **`sqlite_spatialite_transform` Buffer Simplification** — Added `simplifyTolerance` parameter
  - Optional simplification applied to buffer operation output to reduce vertex count
  - Recommended values: 0.0001-0.001 for lat/lon coordinates
  - Reduces payload size for large buffer polygons (96+ vertices → fewer)

- **`sqlite_spatialite_analyze` Documentation** — Improved tool description
  - Clarified that point_in_polygon requires POINTs in sourceTable and POLYGONs in targetTable
  - Updated targetTable parameter description with geometry type guidance

- **ServerInstructions.ts Vector Tool Documentation** — Expanded vector section with utility tool examples
  - Added `sqlite_vector_normalize`, `sqlite_vector_distance`, and `sqlite_vector_stats` examples
  - Utility tools help with pre-processing embeddings before storage

- **`sqlite_text_split` Per-Row Output Structure** — Improved output for row traceability
  - Changed from flat `parts[]` array to structured per-row results
  - Each row now includes `rowid`, `original` value, and `parts` array
  - Enables correlation between split results and source rows

### Fixed

- **`sqlite_text_split` WASM Rowid Bug** — Fixed rows returning `rowid: 0` for all results
  - Changed SQL query from `SELECT rowid, column` to `SELECT rowid as id, column` for consistent behavior
  - SQL.js (WASM) does not handle unaliased `rowid` column correctly; aliasing ensures proper value retrieval
  - Native SQLite (better-sqlite3) was unaffected, but now uses consistent query pattern

- **`sqlite_list_tables` FTS5 Table Visibility** — FTS5 virtual tables and shadow tables now hidden
  - Virtual tables ending with `_fts` (e.g., `articles_fts`) are now filtered from output
  - Shadow tables containing `_fts_` (e.g., `articles_fts_config`, `articles_fts_data`) already filtered
  - Internal FTS5 implementation details no longer clutter table listings in native mode

- **`sqlite_text_validate` Null Value Display** — Improved accuracy for invalid null/empty values
  - Null/undefined values now display as `null` instead of artificial `"(empty)"` placeholder
  - Long values (>100 chars) are truncated with "..." for readability

### Changed

- **ServerInstructions.ts WASM Tool Count** — Corrected `starter` preset count for WASM mode
  - Changed from 48 to 44 (4 FTS5 tools unavailable in WASM)
  - Added footnote: "_17_ = 13 in WASM (4 FTS5 tools require native)"

### Fixed

- **`sqlite_json_group_array` and `sqlite_json_group_object` groupByColumn Expressions** — Extended `allowExpressions` to also apply to `groupByColumn` parameter
  - Previously `allowExpressions: true` only bypassed validation for `valueColumn`/`keyColumn`, not `groupByColumn`
  - Now enables grouping by JSON path expressions like `json_extract(data, '$.type')`
  - When using expressions for `groupByColumn`, output uses `group_key` alias for clarity

### Changed

- **ServerInstructions.ts JSONB Documentation** — Added note that `sqlite_json_normalize_column` converts JSONB back to text format
  - The `json()` function used for normalization returns text JSON, not JSONB binary
  - Users should run `sqlite_jsonb_convert` after normalization if JSONB format is desired

- **ServerInstructions.ts Text Processing Documentation** — Added inline comment for regex escaping clarity
  - Explains that regex patterns require double-escaping backslashes (`\\\\`) when passing through JSON/MCP transport

### Fixed

- **`sqlite_json_group_array` Expression Support** — Added `allowExpressions` option for consistency with `sqlite_json_group_object`
  - When `allowExpressions: true`, SQL expressions like `json_extract(data, '$.name')` are accepted for `valueColumn`
  - Default behavior unchanged (validates as simple column identifier for security)
  - Enables advanced aggregation patterns combining JSON extraction with grouping

- **`sqlite_json_update` String Value Escaping** — Fixed "malformed JSON" error when updating string values
  - String values now wrapped with `JSON.stringify()` before SQL escaping to produce valid JSON
  - Previously `'New Title'` (invalid JSON) was passed to `json()` instead of `'"New Title"'`

- **`sqlite_spatialite_analyze` Error Message Clarity** — Improved error messages for required parameter validation
  - Changed "Target table required" to "Missing required parameter 'targetTable'" for `nearest_neighbor` and `point_in_polygon` analysis types
  - Clearer messaging helps users identify which parameter they need to provide

- **`sqlite_json_group_array` and `sqlite_json_group_object` Column Naming** — Fixed quoted identifier names appearing in output
  - When using `groupByColumn`, the result column was showing `"type"` (with escaped quotes) instead of `type`
  - Added explicit column aliases (e.g., `"type" AS type`) to produce clean column names in output
  - Affects both tools when `groupByColumn` is specified

- **`sqlite_dbstat` Page Count Inconsistency** — Fixed JS fallback returning inconsistent page counts
  - Properly extracts page_count from PRAGMA result (handles both named and indexed column access)
  - Ensures consistent numeric return value via explicit type coercion

- **False WASM Limitation Detection in Native Mode** — Fixed backup/restore/verify tools incorrectly reporting WASM limitations when running in native mode
  - Added `isNativeBackend()` method to both `SqliteAdapter` (returns false) and `NativeSqliteAdapter` (returns true)
  - `sqlite_backup`, `sqlite_restore`, `sqlite_verify_backup` now only return `wasmLimitation: true` when actually running in WASM mode
  - `sqlite_restore` now attempts to recreate virtual tables (FTS5, R-Tree) in native mode instead of unconditionally skipping them
  - In native mode, actual file system errors are now properly thrown instead of being masked as WASM limitations

### Changed

- **ServerInstructions.ts CSV Path Documentation** — Added absolute path requirement note for CSV tools
  - Updated WASM vs Native table: CSV virtual tables now note "(requires absolute paths)"
  - Added CSV Virtual Tables examples to Database Administration section showing `sqlite_analyze_csv_schema` and `sqlite_create_csv_table` with absolute path usage

- **ServerInstructions.ts Statistical Analysis Examples** — Added missing stats tool examples to TOOL_REFERENCE
  - Added `sqlite_stats_outliers` example with IQR/Z-score method options
  - Added `sqlite_stats_hypothesis` example with one-sample t-test usage

- **JSON Aggregation Tool Documentation** — Clarified `groupByColumn` usage for JSON collection tables
  - Updated `sqlite_json_group_array` and `sqlite_json_group_object` parameter descriptions
  - For JSON collections, must use `allowExpressions: true` with `json_extract(data, '$.field')` for groupByColumn
  - Updated ServerInstructions.ts examples to show both regular table and JSON collection patterns

- **Tool Count Documentation Accuracy** — Fixed tool counts across all documentation files
  - `text` group: 16 → 17 (added fuzzy_match, phonetic_match, text_normalize, text_validate, advanced_search, fts_rebuild, fts_match_info)
  - `admin` group: 32 → 33
  - `starter` preset: 47 → 48
  - `search` preset: 35 → 36
  - `full` preset: 120 → 122 Native, 100 → 102 WASM
  - Updated ToolConstants.ts, ServerInstructions.ts, and README.md

- **ServerInstructions.ts Text Processing Examples** — Updated TOOL_REFERENCE section
  - Fixed `sqlite_fuzzy_search` example to correct tool name `sqlite_fuzzy_match` with proper parameters
  - Replaced generic `sqlite_text_similarity` example with practical `sqlite_text_validate` (email/phone/url/uuid/ipv4)
  - Added `sqlite_advanced_search` example demonstrating multi-technique search (exact/fuzzy/phonetic)

### Fixed

- **`sqlite_create_table` SQL Expression Default Values** — Fixed syntax error when using SQL expressions as default values
  - Expressions like `datetime('now')`, `CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_TIME` now wrapped in parentheses
  - Literal string values continue to be properly single-quoted with escape handling for embedded quotes
  - Added regex detection for function calls (pattern `function_name(...)`) and SQL keywords

- **JSONB Normalize Corruption Fix** — Fixed `sqlite_json_normalize_column` corrupting JSONB columns
  - Changed query to use `json(${column})` SQL function to convert JSONB binary to text before JavaScript processing
  - Previously, JSONB binary blobs were being serialized as numbered-key objects (`{"0":204,"1":95,...}`)
  - Now properly handles both text JSON and JSONB binary format without data loss

- **ServerInstructions.ts Core Tools Table** — Added missing tools to documentation
  - Added `sqlite_drop_table` and `sqlite_get_indexes` to Core Tools table (was only showing 6 of 8 tools)

### Fixed

- **WASM Mode Admin Tool Graceful Handling** — 4 admin tools now return structured errors instead of throwing in WASM mode
  - `sqlite_virtual_table_info`: Returns `moduleAvailable: false` with partial metadata when module unavailable (e.g., FTS5)
  - `sqlite_backup`: Returns `wasmLimitation: true` when file system access unavailable
  - `sqlite_restore`: Returns `wasmLimitation: true` when file system access unavailable
  - `sqlite_verify_backup`: Returns `wasmLimitation: true` when file system access unavailable
  - Added `wasmLimitation` field to `BackupOutputSchema`, `RestoreOutputSchema`, `VerifyBackupOutputSchema`
  - Updated `ServerInstructions.ts` WASM vs Native table with backup/restore, R-Tree, CSV limitations

- **Restore Tool Security Bypass** — `sqlite_restore` now bypasses SQL validation for internal operations
  - Added `skipValidation` optional parameter to `executeWriteQuery()` method signature
  - Internal restore operations (ATTACH, DROP, CREATE, INSERT, DETACH, PRAGMA) pass `skipValidation=true`
  - Prevents false-positive "dangerous patterns" errors from internal SQL comments or multi-statement patterns
  - Security remains intact: bypass only applies to trusted internal operations, not user-provided queries

- **WASM Mode R-Tree/CSV/Restore Graceful Handling** — 4 additional admin tools now return structured errors instead of throwing
  - `sqlite_create_rtree_table`: Returns `success: false` with `wasmLimitation: true` when R-Tree module unavailable
  - `sqlite_analyze_csv_schema`: Returns `success: false` with `wasmLimitation: true` when CSV extension not loaded
  - `sqlite_create_csv_table`: Returns `success: false` with `wasmLimitation: true` when CSV extension not loaded
  - `sqlite_restore`: Now skips virtual tables with unavailable modules (FTS5, R-Tree) instead of failing entire restore
  - Added `skippedTables` and `note` fields to `RestoreOutputSchema` for partial restore reporting

### Changed

- **ServerInstructions.ts Documentation Improvements** — Updated tool filtering reference for accuracy
  - Corrected tool counts to match README (was showing outdated single-column counts)
  - Added WASM/Native columns to shortcut table showing accurate counts per backend
  - Added `spatial` shortcut (23 WASM / 30 Native tools)
  - Added `geo` to groups list (was missing from documentation)
  - Added Fallback column to WASM vs Native table documenting JS fallback availability
  - Documented `generate_series`, `dbstat`, `soundex` JS fallbacks vs extension tools with no fallback
  - Added Database Administration examples section with 6 common admin tools

- **WASM Mode FTS5 Graceful Handling** — FTS5 tools now return helpful errors instead of crashes in WASM mode
  - All 4 FTS5 tools (`sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`) detect "no such module: fts5" errors
  - Returns structured error with `hint` directing to native SQLite backend (`--sqlite-native`)
  - Prevents tool failures when running in WASM mode (sql.js) which lacks FTS5 module

- **WASM Mode Soundex Fallback** — `sqlite_phonetic_match` now works with soundex algorithm in WASM mode
  - JavaScript-based soundex implementation used as fallback when SQLite's native `soundex()` function unavailable
  - Behavior matches metaphone algorithm path (fetch rows, filter in JS)
  - Same output format and accuracy as native soundex
  - Gracefully handles "no such function: soundex" error without user intervention

### Added

- **WASM vs Native Documentation** — Added feature comparison table to `ServerInstructions.ts`
  - Lists FTS5, transactions, window functions, SpatiaLite, and soundex availability
  - Token-efficient format optimized for AI agent consumption

- **Polynomial Regression Support** — `sqlite_stats_regression` now supports degree 1-3 polynomial fits
  - Linear (degree=1), quadratic (degree=2), and cubic (degree=3) regression via OLS normal equation
  - Matrix operations (transpose, multiply, Gauss-Jordan inverse) implemented in pure TypeScript
  - Output includes named coefficients (`intercept`, `linear`, `quadratic`, `cubic`) instead of generic `slope`
  - R² calculation uses sum of squared residuals for accurate goodness-of-fit measurement
  - Equation string displays polynomial terms (e.g., `y = 2.0000x² + 3.0000x + 5.0000`)

- **WASM Mode Core Tool Compatibility** — Fixed issues discovered during WASM mode testing
  - `server_health` now correctly reports `filePath` from `connectionString` when `filePath` is not set
  - `sqlite_list_tables` now gracefully handles FTS5 virtual tables in WASM mode (sql.js lacks FTS5 module)
  - FTS5 shadow tables (`_fts_*`) are automatically skipped in table listings
  - Tables that fail `PRAGMA table_info()` are skipped rather than failing the entire operation
  - `COUNT(*)` errors on virtual tables return `rowCount: 0` instead of throwing

- **MCP Resource Template Registration** — Fixed `sqlite_table_schema` templated resource not matching client requests
  - Updated `registerResource()` in `NativeSqliteAdapter` to detect URI templates (containing `{param}` placeholders)
  - Template resources now use MCP SDK's `ResourceTemplate` class for proper URI matching
  - Static resources continue using simple string URI registration
  - Allows clients to request resources like `sqlite://table/test_products/schema` and have them matched correctly

- **Missing `getAllIndexes()` Method** — Added `getAllIndexes()` to `NativeSqliteAdapter`
  - Required by `sqlite_indexes` resource but was missing in native adapter
  - Returns all user-created indexes with table name, column list, and uniqueness info
  - Queries `sqlite_master` and `PRAGMA index_info()` for complete index metadata

### Added

- **PRAGMA Compile Options Filter** — `sqlite_pragma_compile_options` now supports `filter` parameter
  - Case-insensitive substring match to limit returned options (e.g., `filter: "FTS"` returns only FTS-related options)
  - Reduces payload size for targeted queries (58 options → filtered subset)

- **Database Stats Summarize Mode** — `sqlite_dbstat` now supports `summarize` parameter
  - When `summarize: true`, returns aggregated per-table stats instead of raw page-level data
  - Summary includes: `pageCount`, `totalPayload`, `totalUnused`, `totalCells`, `maxPayload` per table
  - Reduces response size (27 rows → 1 row per table) while providing actionable storage metrics

- **Stats Tool Column Selection** — `sqlite_stats_top_n` now supports `selectColumns` parameter
  - Limits returned columns to only those specified (reduces payload size for large tables)
  - Default behavior unchanged: returns all columns when `selectColumns` is not provided
  - Columns are validated and sanitized for SQL injection protection

- **FTS5 Auto-Sync Triggers** — `sqlite_fts_create` now automatically creates sync triggers
  - INSERT/UPDATE/DELETE triggers keep FTS5 index synchronized with source table in real-time
  - New `createTriggers` option (default: `true`) to control trigger creation
  - FTS tables are automatically populated with existing data on creation via `rebuild`
  - Trigger naming convention: `{ftsTable}_ai` (insert), `{ftsTable}_ad` (delete), `{ftsTable}_au` (update)
  - Response includes `triggersCreated` array listing created trigger names

- **FTS5 Wildcard Query Support** — `sqlite_fts_search` now supports list-all queries
  - Query `*` or empty string returns all FTS table contents without MATCH filtering
  - Useful for browsing FTS index contents or debugging FTS configuration
  - Returns rows ordered by rowid with `rank: null`

- **Phonetic Match Verbosity Control** — `sqlite_phonetic_match` now supports `includeRowData` option
  - New `includeRowData` parameter (default: `true`) to control full row data inclusion
  - Set to `false` for compact responses with only `value` and `phoneticCode` per match
  - Backward compatible: existing calls behave identically

- **SQLite Extension Support** — Added CLI flags and configuration for loadable SQLite extensions
  - `--csv` flag to load CSV extension for CSV virtual tables
  - `--spatialite` flag to load SpatiaLite extension for GIS capabilities
  - `CSV_EXTENSION_PATH` and `SPATIALITE_PATH` environment variables for custom extension paths
  - Platform-aware extension binary detection (Windows/Linux/macOS)
  - README documentation for built-in vs loadable extensions with installation instructions
- **Test Infrastructure** — Migrated tests to native SQLite adapter for full feature coverage
  - Added `tests/utils/test-adapter.ts` factory for centralized adapter instantiation
  - All 9 SQLite test files now use `NativeSqliteAdapter` (better-sqlite3) instead of sql.js WASM
  - FTS5 tests now execute properly (previously skipped due to WASM limitations)

### Changed

- **SQLite-Focused Branding** — Updated project descriptions to reflect SQLite-only focus
  - `package.json`: Updated description and removed unused database keywords (postgresql, mysql, mongodb, redis)
  - `src/cli.ts`: Updated help text, removed dead CLI options and environment variable parsing for unsupported databases
  - Updated header comments in `src/index.ts`, `src/server/McpServer.ts`, `src/adapters/DatabaseAdapter.ts`

### Security

- **Identifier Validation Centralization** — Migrated 83 tool handlers to use centralized `sanitizeIdentifier()` utility
  - Replaced inline regex validations with type-safe `InvalidIdentifierError` handling
  - Consistent security pattern across 10 files: `geo.ts`, `admin.ts`, `text.ts`, `vector.ts`, `virtual.ts`, `stats.ts`, `fts.ts`, `json-operations.ts`, `json-helpers.ts`, `core.ts`
  - Updated security tests to expect new error message format

### Fixed

- **SpatiaLite Analyze WKT Output** — Fixed `sqlite_spatialite_analyze` binary geometry output
  - `nearest_neighbor` and `point_in_polygon` analysis types now return WKT via `AsText()` instead of raw binary blobs
  - Changed from `s.*` wildcard select to explicit `source_id`, `source_geom`, `target_id`, `target_geom` columns
  - Reduces payload size and improves readability (binary arrays → human-readable WKT strings)

- **Restore Virtual Table Handling** — Fixed `sqlite_restore` failing with virtual table shadow tables
  - Added pre-restore phase to drop existing virtual tables before attempting restore
  - Virtual table deletion automatically cleans up associated shadow tables (R-Tree: `_node`, `_rowid`, `_parent`)
  - Excludes R-Tree shadow tables from copy list in addition to FTS5 shadow tables
  - Prevents \"may not be dropped\" error when backup contains virtual table artifacts

- **Custom Regex Validation Double-Escaping Fix** — Fixed `sqlite_text_validate` custom pattern handling
  - Normalizes double-escaped backslashes (`\\\\` → `\\`) from JSON transport
  - Patterns like `.*@.*\.com$` now work correctly as expected
  - Added error message with both original and normalized pattern for debugging invalid regex

- **JSON Each Ambiguous Column Fix** — Fixed `sqlite_json_each` "ambiguous column name: id" error
  - Added table alias (`t`) and `CROSS JOIN` syntax to prevent column name conflicts with `json_each()` TVF output
  - `json_each()` returns columns: `key`, `value`, `type`, `atom`, `id`, `parent`, `fullkey`, `path`
  - Source table columns (especially `id`) now properly qualified with table alias
  - Added automatic `id =` → `t.id =` rewriting for user-provided WHERE clauses
  - Updated `JsonEachOutputSchema` to include optional `row_id` field for row identification

- **JSON Group Object Expression Support** — Added `allowExpressions` option to `sqlite_json_group_object`
  - When `allowExpressions: true`, SQL expressions like `json_extract(data, '$.name')` are accepted for `keyColumn` and `valueColumn`
  - Default behavior unchanged (validates as simple column identifiers for security)
  - Enables advanced aggregation patterns combining JSON extraction with grouping

- **JSONB Text Serialization Fix** — Fixed `sqlite_json_select` returning binary Buffer for JSONB data
  - Wrapped column selection with `json()` function to convert JSONB binary to readable text JSON
  - Works seamlessly with both text JSON (no-op) and JSONB (converts to text)
  - API consumers now receive readable JSON instead of raw binary buffers

- **JSONB Schema Analysis Fix** — Fixed `sqlite_analyze_json_schema` returning byte indexes for JSONB columns
  - Wrapped column with `json()` function to decode JSONB binary before schema inference
  - Was returning numeric keys (0, 1, 2, ..., 100) representing blob bytes instead of actual JSON structure
  - Now correctly infers object properties, types, and nullability for JSONB-formatted data

- **Core Tool Bug Fixes** — Resolved 3 issues discovered during comprehensive MCP tool testing
  - `sqlite_describe_table` now correctly returns an error for non-existent tables (was returning `success: true` with empty columns)
  - `sqlite_write_query` and other query methods now auto-convert boolean parameters (`true`/`false`) to integers (`1`/`0`) since SQLite doesn't have native boolean type
  - `sqlite_create_table` message now accurately indicates when table already exists (using IF NOT EXISTS): "Table 'x' already exists (no changes made)"
  - `sqlite_list_tables` now correctly returns `columnCount` for each table (was always returning 0 in native adapter because `PRAGMA table_info()` was not being called)

- **JSON Path Column Naming** — Fixed column naming in `json_select` and `json_query` tools
  - Columns now use meaningful names extracted from JSONPath expressions (e.g., `$.user.email` → `email`)
  - Was returning generic indexed names (`path_0`, `result_0`)
  - Added `extractColumnNameFromPath()` and `getUniqueColumnNames()` helpers in `json-helpers.ts`
  - Duplicate path segments get numeric suffixes (e.g., `name`, `name_2`)

- **Text Tool Output Schema Fixes** — Fixed 6 tools with output validation errors
  - `sqlite_regex_extract`: Added safe rowid coercion (Number/String/undefined → Number) to prevent NaN in output
  - `sqlite_regex_match`: Added safe rowid coercion (Number/String/undefined → Number) to prevent NaN in output
  - `sqlite_text_split`: Changed `rowCount`/`results` to `parts`/`count` to match schema
  - `sqlite_advanced_search`: Fixed NaN bug when coercing rowid to number
  - `sqlite_fts_create`: Changed `sql` to `tableName` in response to match schema
  - `sqlite_fts_rebuild`: Added missing `tableName` field to response

- **Text Tool Bug Fixes** — Resolved issues discovered during comprehensive MCP tool testing
  - `sqlite_text_concat`: Fixed SQL generation to use `||` operator for concatenation (was generating comma-separated SELECT which only returns last column)
  - `sqlite_regex_extract`, `sqlite_regex_match`, `sqlite_advanced_search`: Fixed rowid extraction by aliasing `rowid as id` in SQL queries (was returning 0 for all rows)
  - `sqlite_phonetic_match`: Fixed empty `searchCode` for soundex algorithm by computing locally upfront (was only extracting from matches, returning empty when no matches found)

- **Test Database FTS5 Table** — Added pre-built FTS5 table for testing
  - `test_articles_fts`: FTS5 virtual table indexing `test_articles` (title, body)
  - Updated `test-database.sql` to create and populate the FTS index
  - Updated `reset-database.md` documentation with new table

- **JSONB Support in Native Adapter** — Fixed JSONB detection missing in `NativeSqliteAdapter`
  - `NativeSqliteAdapter.connect()` now detects SQLite version and sets JSONB support flag
  - `sqlite_jsonb_convert` and other JSONB tools now work correctly with better-sqlite3 backend
  - better-sqlite3 includes SQLite 3.51.2 which fully supports JSONB (requires 3.45+)

- **JSONB-Compatible Collection Tables** — Updated `sqlite_create_json_collection` CHECK constraint
  - Changed from `CHECK(json_valid("data"))` to `CHECK(json_type("data") IS NOT NULL)`
  - `json_valid()` only works on text JSON; `json_type()` works on both text and JSONB formats
  - Collections can now store JSONB data after `sqlite_jsonb_convert`

- **JSON Tool Output Schema Fixes** — Fixed 6 tools with output validation errors
  - `sqlite_json_keys`: Added missing `rowCount` field and fixed `keys` array type
  - `sqlite_json_group_array`: Changed `results` to `rows` to match schema
  - `sqlite_json_group_object`: Changed `results` to `rows` to match schema
  - `sqlite_jsonb_convert`: Created dedicated `JsonbConvertOutputSchema`
  - `sqlite_json_storage_info`: Created dedicated `JsonStorageInfoOutputSchema`
  - `sqlite_json_normalize_column`: Created dedicated `JsonNormalizeColumnOutputSchema`
  - Added `JsonPrettyOutputSchema` for `sqlite_json_pretty`
  - Updated `ToolConstants.ts` with correct list of all 23 JSON tool names

- **Stats Tool Output Schema Fixes** — Fixed 8 tools with output validation errors
  - Created dedicated output schemas: `StatsBasicOutputSchema`, `StatsCountOutputSchema`, `StatsGroupByOutputSchema`, `StatsTopNOutputSchema`, `StatsDistinctOutputSchema`, `StatsSummaryOutputSchema`, `StatsFrequencyOutputSchema`
  - Updated `StatsPercentileOutputSchema` to support array of percentiles (was single value)
  - Updated `StatsHistogramOutputSchema` with optional `range`, `bucketSize`, and `bucket` fields
  - Updated `StatsCorrelationOutputSchema` with optional `n` and `message` fields
  - Tools fixed: `sqlite_stats_basic`, `sqlite_stats_count`, `sqlite_stats_group_by`, `sqlite_stats_percentile`, `sqlite_stats_top_n`, `sqlite_stats_distinct`, `sqlite_stats_summary`, `sqlite_stats_frequency`

- **Vector Tool Output Schema Fixes** — Fixed 10 tools with output validation errors
  - Created dedicated output schemas: `VectorStoreOutputSchema`, `VectorBatchStoreOutputSchema`, `VectorGetOutputSchema`, `VectorDeleteOutputSchema`, `VectorCountOutputSchema`, `VectorStatsOutputSchema`, `VectorDimensionsOutputSchema`, `VectorNormalizeOutputSchema`, `VectorDistanceOutputSchema`
  - Updated `VectorSearchOutputSchema` to match handler return structure (`metric`, `count`, `results` with `_similarity`)
  - Tools fixed: `sqlite_vector_store`, `sqlite_vector_batch_store`, `sqlite_vector_get`, `sqlite_vector_search`, `sqlite_vector_delete`, `sqlite_vector_count`, `sqlite_vector_stats`, `sqlite_vector_dimensions`, `sqlite_vector_normalize`, `sqlite_vector_distance`

- **Admin Tool Bug Fixes** — Fixed 4 tools with output schema and logic errors
  - `sqlite_create_view`: Fixed syntax error by using DROP+CREATE pattern (SQLite doesn't support `CREATE OR REPLACE VIEW`)
  - `sqlite_list_views`: Created dedicated `ListViewsOutputSchema` (was using `ListTablesOutputSchema` expecting `tables` instead of `views`)
  - `sqlite_optimize`: Added required `message` field to handler return object
  - `sqlite_restore`: Fixed PRAGMA query that caused "no such table: 1" error (simplified to `PRAGMA integrity_check(1)`)

- **Geo Tool Output Schema Fixes** — Fixed 3 tools with output validation errors
  - `sqlite_geo_nearby`: Changed `count` field to `rowCount`, removed extra metadata fields
  - `sqlite_geo_bounding_box`: Changed `count` field to `rowCount`, removed extra metadata fields
  - `sqlite_geo_cluster`: Restructured return to match schema with `clusterId`, `center: {latitude, longitude}`, `pointCount`

- **SpatiaLite Windows DLL Loading** — Fixed extension loading on Windows
  - Added runtime PATH modification to prepend SpatiaLite directory before `loadExtension()` call
  - Windows requires dependency DLLs (libgeos, libproj, etc.) to be discoverable via PATH
  - Applied to both `NativeSqliteAdapter.ts` (startup) and `spatialite.ts` (on-demand loading)
  - Following pattern from Python sqlite-mcp-server implementation

- **SpatiaLite Tool Bug Fixes** — Fixed 3 tools that silently failed due to incorrect method usage
  - `sqlite_spatialite_create_table`: Changed `executeWriteQuery` to `executeReadQuery` for `AddGeometryColumn()` call
  - `sqlite_spatialite_index` (create/drop): Changed to `executeReadQuery` for `CreateSpatialIndex()` and `DisableSpatialIndex()` calls
  - Root cause: better-sqlite3's `.run()` method only works for INSERT/UPDATE/DELETE, not SELECT statements
  - Added verification step after geometry column creation to ensure column exists before reporting success
  - Cascading fix enables `sqlite_spatialite_import` and `sqlite_spatialite_analyze` to work correctly

- **SpatiaLite Metadata Initialization** — Fixed missing `geometry_columns` table on pre-loaded databases
  - `isSpatialiteLoaded()` now calls `InitSpatialMetaData(1)` when detecting a pre-loaded SpatiaLite extension
  - Ensures SpatiaLite metadata tables (`geometry_columns`, `spatial_ref_sys`) exist even if extension was loaded in previous session
  - Fixes `sqlite_spatialite_analyze` "no such table: geometry_columns" error
  - Fixes `sqlite_spatialite_create_table` returning 0 from `AddGeometryColumn()` call

- **SpatiaLite GeoJSON Import Fix** — Fixed SRID constraint violation when importing GeoJSON data
  - Wrapped `GeomFromGeoJSON()` with `SetSRID(..., srid)` to ensure SRID is set correctly
  - GeoJSON import now supports `additionalData` columns (was only available for WKT import)
  - Fixes "geom violates Geometry constraint [geom-type or SRID not allowed]" error

### Changed

- **Simplified SpatiaLite Instructions** — Removed manual `sqlite_spatialite_load` step requirement
  - SpatiaLite extension and metadata tables are now auto-initialized on first use of any spatial tool
  - Removed "IMPORTANT" warning and step numbering from `ServerInstructions.ts`
  - Added GeoJSON import example to instructions

### Added

- **Comprehensive Test Infrastructure** — Test database setup for systematic tool group testing
  - `test-server/test-database.sql`: Seed data with 10 tables and 409 rows covering all 7 tool groups
  - `test-server/reset-database.ps1`: PowerShell script to reset database to clean state with verification
  - `test-server/test-groups/`: Individual test guides for each tool group (core, json, text, stats, vector, admin, geo)
  - Uses ESM-compatible Node.js scripts with better-sqlite3 for cross-platform reset
  - Test tables: products, orders, json_docs, articles, users, measurements, embeddings, locations, categories, events

- **HTTP/SSE Streaming Transport** — Enhanced HTTP transport with session management and SSE
  - **Stateful mode (default)**: Multi-session management with SSE streaming for notifications
  - **Stateless mode (`--stateless`)**: Lightweight serverless-compatible mode for Lambda/Workers
  - `POST /mcp`: JSON-RPC requests with session management
  - `GET /mcp`: SSE stream for server-to-client notifications
  - `DELETE /mcp`: Session termination endpoint
  - Enhanced CORS headers for `mcp-session-id` and `Last-Event-ID`
  - Health endpoint reports active session count and transport mode
- **Business Insights Memo** — New tool and resource for capturing analysis insights
  - `sqlite_append_insight` tool: Add business insights discovered during data analysis
  - `memo://insights` resource: Synthesized memo of all captured insights
  - Insights manager singleton for in-memory insight storage
- **Summarize Table Prompt** — Intelligent table analysis workflow
  - `sqlite_summarize_table` prompt with configurable analysis depth
  - Supports basic, detailed, and comprehensive analysis modes
- **Advanced Search Tool** — Multi-mode text search
  - `sqlite_advanced_search` tool combining exact, fuzzy (Levenshtein), and phonetic (Soundex) matching
  - Configurable threshold and technique selection
- **Hybrid Search Workflow Prompt** — Combined FTS5 + vector search
  - `sqlite_hybrid_search_workflow` prompt for hybrid search implementation
  - Guides through schema setup, query structure, and weight tuning
- **Interactive Demo Prompt** — Flagship MCP demonstration
  - `sqlite_demo` prompt for interactive capability walkthrough
  - Guides through data creation, querying, and insight capture
- **MCP Progress Notifications (2025-11-25)** — Real-time progress updates for long-running operations
  - New `src/utils/progress-utils.ts` module with `sendProgress()` and `buildProgressContext()` utilities
  - Extended `RequestContext` interface with optional `server` and `progressToken` fields
  - `sqlite_restore`: 3-phase progress (prepare → restore → verify)
  - `sqlite_optimize`: Dynamic multi-phase progress (start → reindex → analyze → complete)
  - `sqlite_vacuum`: 2-phase progress (start → complete)
  - Notifications are best-effort and require client support for `progressToken` in `_meta`
- **Modern Tool Registration** — Migrated from deprecated `server.tool()` to `server.registerTool()` API
  - Both `SqliteAdapter` and `NativeSqliteAdapter` now use modern pattern
  - Full `inputSchema`/`outputSchema` passed (not just `.shape`)
  - MCP 2025-11-25 `structuredContent` returned when `outputSchema` is present
  - Progress token extraction from `extra._meta` enables progress notifications
  - Removed all eslint-disable comments for deprecated API usage
- **Metadata Caching Pattern** — TTL-based schema caching ported from mysql-mcp
  - New `SchemaManager.ts` module with configurable cache TTL (default: 5s)
  - Schema, tables, and indexes cached to reduce repeated introspection queries
  - Auto-invalidation on DDL operations (CREATE/ALTER/DROP) in all query methods
  - Fixed N+1 query pattern in `sqlite://indexes` resource
  - ToolFilter caching for O(1) tool group lookups
  - `METADATA_CACHE_TTL_MS` environment variable for tuning (documented in README)

### Changed

- **Node.js 24 LTS Baseline** — Upgraded from Node 20 to Node 24 LTS as the project baseline
  - `package.json` now requires Node.js >=24.0.0 in `engines` field
  - README prerequisites updated to specify Node.js 24+ (LTS)
- **Dependency Updates** — Updated npm dependencies to latest versions
  - `@modelcontextprotocol/sdk`: 1.24.3 → 1.25.3
  - `@types/node`: 25.0.2 → 25.1.0
  - `better-sqlite3`: 12.5.0 → 12.6.2
  - `cors`: 2.8.5 → 2.8.6
  - `globals`: 16.5.0 → 17.2.0 (major version bump)
  - `pg`: 8.16.3 → 8.17.2
  - `typescript-eslint`: 8.49.0 → 8.54.0
  - `vitest`: 4.0.15 → 4.0.18
  - `zod`: 4.1.13 → 4.3.6

### Security

- **Transitive Dependency Fixes** — Resolved vulnerabilities via npm audit fix
  - `hono`: 4.11.5 → 4.11.7 (moderate severity fix via `@modelcontextprotocol/sdk`)
- **Log Injection Prevention** — Control character sanitization for log messages
  - Strips all ASCII control characters (0x00-0x1F) and DEL (0x7F) from messages
  - Prevents log forging and escape sequence attacks
  - Dedicated `sanitizeStack()` function replaces newlines with arrow delimiters for safe stack trace logging
- **Sensitive Data Redaction** — Automatic redaction of security-sensitive fields in log context
  - Sensitive keys redacted: password, secret, token, authorization, apikey, access_token, refresh_token, credential, client_secret
  - OAuth 2.1 fields redacted: issuer, audience, jwks_uri, oauth_config, scopes_supported, bearer_format
  - Supports recursive sanitization for nested configuration objects
  - Prevents exposure of OAuth configuration data in log output
- **CodeQL Taint Tracking Fix** — Resolved static analysis alerts in logger
  - Fixed `js/clear-text-logging` by breaking data-flow path in `writeToStderr()`
  - Fixed `js/log-injection` by reconstructing output from static character codes
  - Implemented the "Static Classification" pattern for taint-breaking sanitization
- **SQL Injection Protection** — WHERE clause validation and identifier sanitization (adapted from postgres-mcp)
  - New `src/utils/where-clause.ts` utility with SQLite-specific dangerous pattern detection
  - Blocks: ATTACH DATABASE, load_extension, PRAGMA, fileio functions, hex literals, comments, UNION attacks
  - New `src/utils/identifiers.ts` with centralized identifier validation and quoting
  - Integrated `validateWhereClause` into 36 tool handlers (text, window, vector, stats, geo)
  - New `tests/security/security-injection.test.ts` test suite (49 comprehensive test cases)
  - New `tests/security/tool-integration.test.ts` test suite (67 end-to-end handler tests)
- **Handler Security Hardening** — Added missing WHERE clause validation to tool handlers
  - `geo.ts`: Added `validateWhereClause()` to `sqlite_geo_cluster`
  - `stats.ts`: Added `validateWhereClause()` to `sqlite_stats_outliers`, `sqlite_stats_top_n`, `sqlite_stats_distinct`, `sqlite_stats_frequency`

### Fixed

- **MCP SDK 1.25.2 Compatibility** — Fixed stricter transport type requirements
  - Added onclose handler to StreamableHTTPServerTransport before connecting
  - Used type assertion to satisfy SDK's narrower Transport type constraints

### Verified

- **OAuth 2.1 Implementation** — Tested with Keycloak 26.4.7
  - Token validation with JWKS endpoint verified
  - Scope enforcement (`read`, `write`, `admin`) working correctly
  - RFC 9728 Protected Resource Metadata endpoint operational
  - Added OAuth Quick Start section to README with usage examples

### Added

- **SpatiaLite Geospatial Tools (Native-only)** — 7 new tools for GIS capabilities
  - `sqlite_spatialite_load` — Load SpatiaLite extension
  - `sqlite_spatialite_create_table` — Create tables with geometry columns
  - `sqlite_spatialite_query` — Execute spatial SQL (ST_Distance, ST_Within, etc.)
  - `sqlite_spatialite_analyze` — Spatial analysis (nearest neighbor, point-in-polygon)
  - `sqlite_spatialite_index` — Create/manage spatial R-Tree indexes
  - `sqlite_spatialite_transform` — Geometry operations (buffer, union, intersection)
  - `sqlite_spatialite_import` — Import WKT/GeoJSON data
  - Tools gracefully fail with helpful error if SpatiaLite extension not installed
- **Geo Tool Group** — New dedicated group for geospatial tools
  - Moved 4 Haversine-based geo tools from `admin` to `geo` group
  - SpatiaLite tools also in `geo` group (7 Native-only tools)
  - New `spatial` shortcut: Core + Geo + Vector (23 WASM / 30 Native tools)
  - 7 tool groups now available (was 6)

- **Admin/PRAGMA Tools** — Added 8 new database administration tools (100 total)
  - `sqlite_restore`: Restore database from backup file
  - `sqlite_verify_backup`: Verify backup file integrity without restoring
  - `sqlite_index_stats`: Get detailed index statistics with column info
  - `sqlite_pragma_compile_options`: List SQLite compile-time options
  - `sqlite_pragma_database_list`: List all attached databases
  - `sqlite_pragma_optimize`: Run PRAGMA optimize for performance tuning
  - `sqlite_pragma_settings`: Get or set PRAGMA values
  - `sqlite_pragma_table_info`: Get detailed table column metadata
- **MCP Tool Annotations (2025-11-25 spec)** — Added behavioral hints to all 73 tools
  - `readOnlyHint`: Indicates read-only tools (SELECT queries, schema inspection)
  - `destructiveHint`: Warns about irreversible operations (DROP, DELETE, TRUNCATE)
  - `idempotentHint`: Marks safe-to-retry operations (CREATE IF NOT EXISTS)
  - Annotation presets in `src/utils/annotations.ts`: READ_ONLY, WRITE, DESTRUCTIVE, IDEMPOTENT, ADMIN
  - Helper functions: `readOnly()`, `write()`, `destructive()`, `idempotent()`, `admin()`
- **MCP Resource Annotations (2025-11-25 spec)** — Added metadata hints to all 7 resources
  - `audience`: Intended consumer (`user`, `assistant`, or both)
  - `priority`: Display ordering hint (0-1 range)
  - `lastModified`: ISO 8601 timestamp for cache invalidation
  - Annotation presets in `src/utils/resourceAnnotations.ts`: HIGH_PRIORITY, MEDIUM_PRIORITY, LOW_PRIORITY
- **Whitelist-Style Tool Filtering** — Enhanced tool filtering to match postgres-mcp syntax
  - **Whitelist mode**: Specify only the groups you want (e.g., `core,json,text`)
  - **Shortcuts**: Predefined bundles (`starter`, `analytics`, `search`, `spatial`, `minimal`, `full`)
  - **Mixed mode**: Combine whitelist with exclusions (e.g., `starter,-fts5`)
  - **Backward compatible**: Legacy exclusion syntax (`-vector,-geo`) still works
  - See README "Tool Filtering" section for documentation
- **ServerInstructions for AI Agents** — Added automated instruction delivery to MCP clients
  - New `src/constants/ServerInstructions.ts` with tiered instruction levels (essential/standard/full)
  - Instructions automatically passed to MCP server during initialization
  - Includes usage examples for JSON, Vector, FTS5, Stats, Geo, Window Functions, and Transactions
  - Following patterns from memory-journal-mcp and postgres-mcp
- **MCP Enhanced Logging** — Full MCP protocol-compliant structured logging
  - RFC 5424 severity levels: debug, info, notice, warning, error, critical, alert, emergency
  - Module-prefixed error codes (e.g., `DB_CONNECT_FAILED`, `AUTH_TOKEN_INVALID`)
  - Structured log format: `[timestamp] [LEVEL] [MODULE] [CODE] message {context}`
  - Module-scoped loggers via `logger.forModule()` and `logger.child()`
  - Sensitive data redaction for OAuth 2.1 configuration fields
  - Stack trace inclusion for error-level logs with sanitization
  - Log injection prevention via control character sanitization
- Initial repository setup
- Project documentation (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
- GitHub workflows (CodeQL, Dependabot)
- Issue and PR templates
