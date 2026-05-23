## [Unreleased]

### Added
- `sqlite_list_triggers`, `sqlite_list_constraints`, `sqlite_date_add`, `sqlite_date_diff`, `sqlite_alter_table`, `sqlite_create_trigger`, and `sqlite_drop_trigger` to the Core tool group.
- `sqlite_attach_database`, `sqlite_detach_database`, `sqlite_vacuum_into`, `sqlite_dump` (native only), `sqlite_reindex`, and `sqlite_wal` to the Admin tool group.
- `sqlite_stats_sample` to the Stats tool group.
- `sqlite_json_diff` to the JSON tool group.
- `sqlite_schema_diff` to the Introspection tool group.
- Server Audit tools group with 5 new tools: `sqlite_audit_list_backups`, `sqlite_audit_get_backup`, `sqlite_audit_diff_backup`, `sqlite_audit_restore_backup`, and `sqlite_audit_cleanup`.
- `sqlite.reportProgress(current, total, message)` Code Mode utility for sandboxed JavaScript execution progress reporting.
- Comprehensive DDL rejection tests for `sqlite_write_query` in unit and E2E test suites.
- Vitest tests for timeout enforcement accuracy (±200ms) and `WorkerSandboxPool` concurrency limits.
- `test-wasm-degradation.md` suite for WASM graceful degradation testing.
- Expanded test coverage for domain errors, Zod validation sweeps, wrong-type numeric coercion, and pagination.
- `sqlite.reportProgress()` coverage to `test-codemode-sandbox.md` Phase 2.
- Extracted testing prompt boilerplate in `test-server/prompt-template.md`.
- `outputSchema` registry section in `tool-reference.md`.
- `dockerfile-patch-drift.yml` CI workflow to detect stale Dockerfile transitive dependency patches.

### Changed
- Updated `sqlite_create_table` to natively support `STRICT` tables, `foreignKeys`, and `checkConstraints`.
- Updated `sqlite_describe_table` to detect and report virtual or stored generated columns via `PRAGMA table_xinfo`.
- Updated DDL tools and schema introspection to query `sqlite_temp_master` for temporary tables, indexes, and constraints.
- Filtered internal SpatiaLite shadow tables and db-mcp system tables from resources.
- Refactored `mcp-server.ts` into registration sub-modules and `session.ts` into stateful/stateless modules to adhere to the 500-line modularity limit.
- Extracted `validateSameDirPath()` and `captureSchemaSnapshot()` to consolidate utility functions across tools.
- Standardized 41 testing prompts across all test suites into a cohesive format and automated formatting via a Node script.
- Replaced hardcoded "We're currently testing Native mode" note with auto-detection instruction (`list_adapters`) in prompt template.
- Updated WASM Mode text dynamically across codemode prompts using the `[NATIVE ONLY]` annotation.
- Synchronized inventory tool counts and file counts across all documentation, test suites, and source files.
- Consolidated testing documentation, added Tool Count Taxonomy to `tool-reference.md`, and standardized CHANGELOG format.
- Replaced deprecated alias method names with canonical names in testing prompts and documentation.

### Fixed
- `sqlite_date_diff` processing of string and numeric literals.
- `sqlite_date_add` returning silent `null` values for out-of-bounds dates instead of clear errors.
- Table filtering in `sqlite_get_indexes` failing to apply to `sqlite_temp_master` during `UNION ALL` queries.
- `sqlite_drop_trigger` silent failures by requiring `ifExists: true` when dropping non-existent triggers.
- Missing limit parameters in `sqlite_date_add` and `sqlite_date_diff` bypassing row truncation safeguards.
- `sqlite_write_query` rejecting `CREATE TRIGGER` and `DROP TRIGGER` DDL statements.
- Nested tools failing to emit progress notifications to the client due to missing `RequestContext` in `sqlite_execute_code`.
- Quadruple-escaped backslashes in `attachDatabase` and `vacuumInto` paths across codemode test scripts.
- Duplicate, colliding, and missing test phase and item numbers across multiple test suites.
- `standardize-prompts.js` script corrupting regex patterns containing `$` and incorrectly replacing schema references.
- Outdated npm dependency patch versions in `SECURITY.md`.
- Inaccurate Code Mode API mappings, parameter names, and descriptions in server instruction source files.
- Stale tool counts, prompt counts, directory references, and file paths across `code-map.md`, test READMEs, and script outputs.
- Incorrect tool count columns, inline headers, and ambiguous `Tools` column names in documentation.
- Stale hero/marketing tool counts across `README.md`, `DOCKER_README.md`, and `server.json` by adopting a generic `170+` format.
- Timing side-channel attacks in bearer token comparison by using `crypto.timingSafeEqual`.
- Missing CLI warning when `--auth-token` is used instead of the recommended `MCP_AUTH_TOKEN` environment variable.
- Inconsistent Post-Test Procedures sections across test directory READMEs compared to the canonical `prompt-template.md`.

### Security
- **[H-1]** Code Mode sandbox: freeze built-in prototypes (`Object`, `Function`, `Error`, etc.) inside the `vm` context to prevent dynamic constructor chain escapes via string concatenation (e.g., `'con'+'structor'`).
- **[H-2]** WHERE clause validation: add subquery detection pattern (`(SELECT ...`) to `DANGEROUS_PATTERNS` blocklist, preventing cross-table data exfiltration via boolean-based blind injection.
- **[M-1]** CORS: change default `corsOrigins` from wildcard `["*"]` to deny-all `[]`, requiring explicit origin configuration for HTTP transport deployments.
- **[M-2]** Scope enforcement: change `getRequiredScope()` default from `read` to `admin` (fail-closed) so unknown/unmapped tools require admin scope by default.
- **[M-3]** Code Mode sandbox: add blocked patterns for general `Reflect.*` access, `Symbol.*` access, and `new Proxy` construction to close escape aid gaps.
- **[M-4]** OAuth token validator: filter prototype-polluting keys (`__proto__`, `constructor`, `prototype`) from JWT payload before spreading into `TokenClaims` object.
- **[L-4]** Docker: remove `npm install -g npm@latest` from production stage to reduce attack surface (npm not needed at runtime).
- **[L-5]** CI/CD: add `push: branches: [main]` trigger to `secrets-scanning.yml` for defense-in-depth on direct pushes.
