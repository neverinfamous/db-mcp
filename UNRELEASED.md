## [Unreleased]

### Added
- `sqlite_list_triggers` — list database triggers with optional table filter (core group)
- `sqlite_list_constraints` — unified view of table PK, FK, UNIQUE, and CHECK constraints (core group)
- `sqlite_stats_sample` — random sampling for exploratory analysis with configurable size (stats group)
- `sqlite_json_diff` — compare two JSON paths within the same row for before/after analysis (json group)
- `sqlite_attach_database` — attach external database files with path traversal security (admin group)
- `sqlite_detach_database` — detach previously attached databases (admin group)
- `sqlite_vacuum_into` — create compacted database copy via VACUUM INTO (admin group)
- `sqlite_audit_diff_backup` — compare audit snapshot against live schema (server audit tools)
- `sqlite_audit_restore_backup` — restore schema from audit snapshot with dry-run support (server audit tools)
- `sqlite_dump` — export full database SQL text dump with robust path security (admin group - native only)
- `sqlite_date_add` — add or subtract intervals from a date column (core group)
- `sqlite_date_diff` — calculate the difference between two date columns (core group)
- `sqlite_schema_diff` — compare two schema snapshots and report structured drift analysis with severity scoring (introspection group)

### Changed
- Refactored `mcp-server.ts` into smaller registration modules (`built-in-tools.ts`, `help-resources.ts`, `audit-tools.ts`) to adhere to the 500-line soft limit.
- Refactored `session.ts` into `stateless.ts` and `stateful.ts` to adhere to the 500-line soft limit.
- Filtered internal SpatiaLite and db-mcp system tables/views/indexes from SQLite MCP resources (`sqlite_schema`, `sqlite_tables`, `sqlite_views`, `sqlite_indexes`).
- Expanded SpatiaLite system filter to correctly exclude R-Tree virtual index shadow tables (`idx__...`).
- Updated E2E Playwright test assertions (`resources.spec.ts`) and test documentation (`test-resources.md`) to reflect the accurate count of 10 tables after the successful application of the SpatiaLite shadow table filter.
- Extracted shared `validateSameDirPath()` utility from duplicated path validation in `attach_database`, `vacuum_into`, and `dump` tools.
- Extracted `captureSchemaSnapshot()` helper from `sqlite_schema_snapshot` for reuse by `sqlite_schema_diff`.
- **Documentation Audit**: Synchronized all tool counts across `README.md`, `DOCKER_README.md`, `server.json`, `tool-reference.md`, `tool-constants.ts`, and `code-map.md` to reflect the current inventory (162 Native / 135 WASM). Fixed stale shortcut bundle counts in all tables. Removed PostgreSQL artifacts from `CONTRIBUTING.md` (prerequisite, `pg` library reference) and `SECURITY.md` (`pg` library reference, inapplicable SSL advice).
- **Test Prompt Sync**: Added `sqlite_schema_diff` tests to all 3 test suites (`test-tool-groups`, `test-codemode`, `test-advanced`). Synchronized stale tool counts across all test README files and individual WASM notes (core 14→18, JSON 24→26, stats 16→17, JSON-read 18→19, core-schema 8→10, introspection 9→10). Updated totals from 158/132 and 160/134 to 162/135.
