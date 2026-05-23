## [Unreleased]

### Added
- **Tools:** Added `sqlite_list_triggers`, `sqlite_list_constraints`, `sqlite_date_add`, `sqlite_date_diff`, `sqlite_alter_table`, `sqlite_create_trigger`, and `sqlite_drop_trigger` to the Core group.
- **Tools:** Added `sqlite_attach_database`, `sqlite_detach_database`, `sqlite_vacuum_into`, `sqlite_dump` (native only), `sqlite_reindex`, and `sqlite_wal` to the Admin group.
- **Tools:** Added `sqlite_stats_sample` to the Stats group.
- **Tools:** Added `sqlite_json_diff` to the JSON group.
- **Tools:** Added `sqlite_schema_diff` to the Introspection group.
- **Tools:** Added 5 new Server Audit tools (`sqlite_audit_list_backups`, `sqlite_audit_get_backup`, `sqlite_audit_diff_backup`, `sqlite_audit_restore_backup`, `sqlite_audit_cleanup`).
- **Code Mode:** Added `sqlite.reportProgress(current, total, message)` utility to allow sandboxed JavaScript to report execution progress.
- **Testing:** Added comprehensive DDL rejection tests for `sqlite_write_query` in unit and E2E suites.
- **Testing:** Added Vitest tests for timeout enforcement accuracy (±200ms) and `WorkerSandboxPool` concurrency limits.
- **Testing:** Added new `test-wasm-degradation.md` suite for WASM graceful degradation testing.
- **Testing:** Expanded test coverage with new domain error tests, Zod validation sweeps, wrong-type numeric coercion phases, and pagination tests across all test suites.
- **Testing:** Added `sqlite.reportProgress()` coverage to `test-codemode-sandbox.md` Phase 2 (API Discoverability).
- **Documentation:** Extracted testing prompt boilerplate into `test-server/prompt-template.md`.
- **Documentation:** Added `outputSchema` registry section to `tool-reference.md`.
- **CI:** Added `dockerfile-patch-drift.yml` workflow to detect when Dockerfile transitive dependency patches become stale after Node.js base image updates.

### Changed
- **Core:** Updated `sqlite_create_table` to natively support `STRICT` tables, `foreignKeys`, and `checkConstraints`.
- **Core:** Updated `sqlite_describe_table` to detect and report virtual or stored generated columns via `PRAGMA table_xinfo`.
- **Core:** Updated DDL tools and schema introspection to query `sqlite_temp_master` for temporary tables, indexes, and constraints.
- **Core:** Filtered internal SpatiaLite shadow tables and db-mcp system tables from resources.
- **Architecture:** Refactored `mcp-server.ts` into registration sub-modules and `session.ts` into stateful/stateless modules to adhere to the 500-line modularity limit.
- **Architecture:** Extracted `validateSameDirPath()` and `captureSchemaSnapshot()` to consolidate utility functions across tools.
- **Testing:** Standardized 41 testing prompts across all test suites into a cohesive format and automated their formatting via a Node script.
- **Testing:** Replaced hardcoded "We're currently testing Native mode" note with auto-detection instruction (`list_adapters`) in prompt template, eliminating manual mode switching.
- **Testing:** Updated WASM Mode text dynamically across codemode prompts using the `[NATIVE ONLY]` annotation.
- **Documentation:** Synchronized inventory tool counts (172 Native / 145 WASM — group + audit) and file counts across all documentation, test suites, and source files.
- **Documentation:** Consolidated testing documentation, added Tool Count Taxonomy to `tool-reference.md`, and standardized CHANGELOG format.
- **Documentation:** Replaced deprecated alias method names with canonical names in testing prompts and documentation for consistency.

### Fixed
- **Core:** Fixed `sqlite_date_diff` to correctly process string and numeric literals.
- **Core:** Fixed `sqlite_date_add` to return a clear error for out-of-bounds dates instead of silent `null` values.
- **Core:** Fixed table filtering in `sqlite_get_indexes` to correctly apply to `sqlite_temp_master` during `UNION ALL` queries.
- **Core:** Fixed `sqlite_drop_trigger` to require `ifExists: true` when dropping non-existent triggers, preventing silent failures.
- **Core:** Added missing limit parameters to `sqlite_date_add` and `sqlite_date_diff` to enforce row truncation safeguards.
- **Code Mode:** Allowed `CREATE TRIGGER` and `DROP TRIGGER` DDL statements in `sqlite_write_query` while maintaining strict DML validations.
- **Code Mode:** Threaded `RequestContext` down through `sqlite_execute_code` so nested tools correctly emit progress notifications to the client.
- **Testing:** Fixed quadruple-escaped backslashes in `attachDatabase` and `vacuumInto` paths across codemode test scripts.
- **Testing:** Fixed duplicate, colliding, and missing test phase and item numbers across multiple test suites (including `test-codemode-vector.md` Phase 5/6 renumbering).
- **Testing:** Fixed the `standardize-prompts.js` script corrupting regex patterns containing `$` and incorrectly replacing schema references.
- **Documentation:** Fixed outdated npm dependency patch versions in `SECURITY.md` to match `package.json` and `Dockerfile`.
- **Documentation:** Corrected inaccurate Code Mode API mappings, parameter names, and descriptions in server instruction source files.
- **Documentation:** Corrected multiple stale tool counts, prompt counts, directory references, and file paths across `code-map.md`, test READMEs, and script outputs.
- **Documentation:** Labeled all tool count columns and inline headers with N/W splits where `[NATIVE ONLY]` tools exist, renamed ambiguous `Tools` columns to `Group Tools` per tool-reference taxonomy, and fixed incorrect counts (json 26→25, stats 24N/18W→23N/17W, admin-core "Identical Native/WASM" → 24N/23W).
- **Documentation:** Adopted `170+` for hero/marketing tool counts across `README.md`, `DOCKER_README.md`, and `server.json` to avoid stale counts when tools are added. Exact per-tier counts (167N/140W group, 172N/145W inventory, 175N/148W MCP total) remain in `tool-reference.md` taxonomy table and `code-map.md`. Added combined `N/W + breakdown` format to stats and geo help resource headers for consistency with admin. Fixed Code Mode references from "11 tool groups" to "10" (codemode doesn't expose itself in the `sqlite.*` bridge).
- **Security:** Replaced naive string equality with `crypto.timingSafeEqual` for simple bearer token comparison to prevent timing side-channel attacks.
- **Security:** Added CLI warning when `--auth-token` is used, recommending `MCP_AUTH_TOKEN` environment variable for production deployments.
- **Documentation:** Synchronized Post-Test Procedures sections across all 3 test directory READMEs to match the canonical `prompt-template.md` version, fixing missing "Document" step, inconsistent step ordering, and stale language. Fixed misnumbered list items in `test-codemode/README.md` (Tool Groups 5–14 → 1–10) and `test-advanced/README.md` (Agent Execution Protocol 4–11 → 1–8, removed conflicting `### 9.` heading number).
