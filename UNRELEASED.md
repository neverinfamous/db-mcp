## [Unreleased]

### Fixed

- Fixed `sqlite_list_triggers` not showing triggers created on temporary tables by querying `sqlite_temp_master` alongside `sqlite_master`.
- Fixed `sqlite_drop_trigger` incorrectly returning success when dropping a non-existent trigger (changed `DropTriggerSchema` `ifExists` default to `false`).
- Fixed `sqlite_date_diff` to correctly handle string and numeric literal values without aggressively quoting them as column identifiers.
- Fixed `sqlite_list_indexes`, `sqlite_create_index`, `sqlite_drop_index`, `sqlite_create_table`, `sqlite_describe_table`, `sqlite_drop_table`, `sqlite_alter_table`, and `sqlite_list_constraints` to correctly handle temporary objects by querying `sqlite_temp_master` in addition to `sqlite_master`.

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
- `sqlite_alter_table` — structured ALTER TABLE operations: add_column, rename_column, drop_column, rename_table with validation and SQLite-specific constraint checking (core group)
- `sqlite_create_trigger` — create database triggers with BEFORE/AFTER/INSTEAD OF timing, column-specific UPDATE triggers, WHEN conditions, and TEMP support (core group)
- `sqlite_drop_trigger` — drop database triggers with existence checking (core group)
- `sqlite_reindex` — rebuild indexes targeting specific index, table, or entire database (admin group)
- `sqlite_wal` — WAL mode management: status, enable, disable, checkpoint with mode selection (admin group)

### Changed

- `sqlite_create_table` now accepts `strict: true` parameter to create STRICT tables (SQLite 3.37+) that enforce column type checking.
- `sqlite_describe_table` now detects and reports generated columns (VIRTUAL/STORED) including their expression, via PRAGMA table_xinfo enrichment.
- Refactored `mcp-server.ts` into smaller registration modules (`built-in-tools.ts`, `help-resources.ts`, `audit-tools.ts`) to adhere to the 500-line soft limit.
- Refactored `session.ts` into `stateless.ts` and `stateful.ts` to adhere to the 500-line soft limit.
- Filtered internal SpatiaLite and db-mcp system tables/views/indexes from SQLite MCP resources (`sqlite_schema`, `sqlite_tables`, `sqlite_views`, `sqlite_indexes`).
- Expanded SpatiaLite system filter to correctly exclude R-Tree virtual index shadow tables (`idx__...`).
- Updated E2E Playwright test assertions (`resources.spec.ts`) and test documentation (`test-resources.md`) to reflect the accurate count of 10 tables after the successful application of the SpatiaLite shadow table filter.
- Extracted shared `validateSameDirPath()` utility from duplicated path validation in `attach_database`, `vacuum_into`, and `dump` tools.
- Extracted `captureSchemaSnapshot()` helper from `sqlite_schema_snapshot` for reuse by `sqlite_schema_diff`.
- **Documentation Audit**: Synchronized all tool counts across `README.md`, `DOCKER_README.md`, `server.json`, `tool-reference.md`, `tool-constants.ts`, `code-map.md`, and `server-instructions.ts` to reflect the current inventory (167 Native / 140 WASM). Updated shortcut bundle counts with dynamic headings. Removed PostgreSQL artifacts from `CONTRIBUTING.md` (prerequisite, `pg` library reference) and `SECURITY.md` (`pg` library reference, inapplicable SSL advice).
- **Test Prompt Sync**: Added `sqlite_schema_diff` tests to all 3 test suites (`test-tool-groups`, `test-codemode`, `test-advanced`). Synchronized stale tool counts across all test README files and individual WASM notes to 167/140. Added `sqlite_alter_table`, `sqlite_create_trigger`, `sqlite_drop_trigger` tests to core test suites and `sqlite_reindex`, `sqlite_wal` tests to admin test suites across all 3 test suites. Added `create_table` STRICT mode and `describe_table` generated column enhancement tests. Updated file inventory counts in `test-codemode/README.md` (core 18→21, admin 30N→32N) and `test-tool-groups/README.md` (core-schema 12→15, admin-core 26→28).
