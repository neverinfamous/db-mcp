## [Unreleased]

### Added

- `sqlite_list_triggers` to list database triggers with an optional table filter (core group).
- `sqlite_list_constraints` to provide a unified view of table PK, FK, UNIQUE, and CHECK constraints (core group).
- `sqlite_stats_sample` to perform random sampling for exploratory analysis with configurable size (stats group).
- `sqlite_json_diff` to compare two JSON paths within the same row for before/after analysis (json group).
- `sqlite_attach_database` to attach external database files with path traversal security (admin group).
- `sqlite_detach_database` to detach previously attached databases (admin group).
- `sqlite_vacuum_into` to create a compacted database copy via `VACUUM INTO` (admin group).
- `sqlite_audit_diff_backup` to compare an audit snapshot against the live schema (server audit tools).
- `sqlite_audit_restore_backup` to restore schema from an audit snapshot with dry-run support (server audit tools).
- `sqlite_dump` to export a full database SQL text dump with path security (admin group - native only).
- `sqlite_date_add` to add or subtract intervals from a date column (core group).
- `sqlite_date_diff` to calculate the difference between two date columns (core group).
- `sqlite_schema_diff` to compare two schema snapshots and report structured drift analysis with severity scoring (introspection group).
- `sqlite_alter_table` to perform structured `ALTER TABLE` operations (`add_column`, `rename_column`, `drop_column`, `rename_table`) with validation and constraint checking (core group).
- `sqlite_create_trigger` to create database triggers with BEFORE/AFTER/INSTEAD OF timing, column-specific UPDATE triggers, WHEN conditions, and TEMP support (core group).
- `sqlite_drop_trigger` to drop database triggers with existence checking (core group).
- `sqlite_reindex` to rebuild indexes targeting a specific index, table, or the entire database (admin group).
- `sqlite_wal` to manage WAL mode (status, enable, disable, checkpoint) with mode selection (admin group).

### Changed

- Updated `C:\Users\chris\Desktop\db-mcp\test-server\tool-reference.md` to include both the MCP tool name and matching Code Mode method name for every single tool.
- Fixed inaccuracies and standardized prefix conventions in `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` to establish absolute prefix consistency and file accuracy across all tool groups.
- Standardized `CHANGELOG.md` to adhere to Keep a Changelog standards, consolidating headers, grouping entries, and eliminating duplicates.
- Updated `sqlite_create_table` to support the `strict` parameter (for `STRICT` tables), `foreignKeys`, and `checkConstraints` natively.
- Updated `sqlite_describe_table` to detect and report virtual or stored generated columns and their expressions via `PRAGMA table_xinfo`.
- Refactored `mcp-server.ts` into registration sub-modules (`built-in-tools.ts`, `help-resources.ts`, `audit-tools.ts`) to respect the 500-line size limit.
- Refactored `session.ts` into `stateless.ts` and `stateful.ts` to respect the 500-line size limit.
- Filtered internal SpatiaLite (including R-Tree virtual index shadow tables `idx__...`) and db-mcp system tables, views, and indexes from SQLite MCP resources (`sqlite_schema`, `sqlite_tables`, `sqlite_views`, `sqlite_indexes`).
- Updated E2E Playwright test assertions (`resources.spec.ts`) and test documentation (`test-resources.md`) to reflect the SpatiaLite shadow table filtering (10 tables).
- Extracted shared `validateSameDirPath()` utility to consolidate path validation in `attach_database`, `vacuum_into`, and `dump` tools.
- Extracted `captureSchemaSnapshot()` helper from `sqlite_schema_snapshot` to share with `sqlite_schema_diff`.
- Synchronized tool counts (167 Native / 140 WASM) across `README.md`, `DOCKER_README.md`, `server.json`, `tool-reference.md`, `tool-constants.ts`, `code-map.md`, and `server-instructions.ts`.
- Removed PostgreSQL-specific references and prerequisites from `CONTRIBUTING.md` and `SECURITY.md`.
- Updated shortcut bundle counts with dynamic headings.
- Synchronized tool and file counts across all test suites, including test READMEs and WASM notes (167 Native / 140 WASM).
- Expanded testing coverage across all three test suites (`test-tool-groups`, `test-codemode`, `test-advanced`) to cover new features, including `sqlite_schema_diff`, `sqlite_alter_table`, `sqlite_create_trigger`, `sqlite_drop_trigger`, `sqlite_reindex`, `sqlite_wal`, STRICT tables, and generated columns.
- Standardized 41 testing prompts across test suites into a single cohesive format covering boilerplate instructions, reporting rules, error expectations, and payload limits.
- Automated the formatting of all 41 test prompts using a Node script to decouple tool lists from test steps, convert tool lists to bullet points, and renumber all test steps sequentially from 1 to optimize for Agent consumption.

### Fixed

- Corrected outdated npm dependency patch versions in `SECURITY.md` to align with `Dockerfile` and `package.json` overrides.
- Allowed `CREATE TRIGGER` and `DROP TRIGGER` DDL statements in `sqlite_write_query` while maintaining strict DML validations.
- Updated `sqlite_list_triggers` to query `sqlite_temp_master` in addition to `sqlite_master` so triggers on temporary tables are listed.
- Fixed `sqlite_drop_trigger` to return an error when dropping a non-existent trigger without explicit `ifExists: true` (default is now `false`).
- Fixed `sqlite_date_diff` to correctly process string and numeric literals instead of quoting them as column identifiers.
- Updated core DDL and schema introspection tools to query `sqlite_temp_master` in addition to `sqlite_master` to properly handle temporary tables, indexes, and constraints.
- Fixed table filtering in `sqlite_get_indexes` to apply to both `sqlite_master` and `sqlite_temp_master` rather than only `sqlite_temp_master` due to a `UNION ALL` precedence issue.
- Added the missing limit parameter to `sqlite_date_add` and `sqlite_date_diff` to enforce standard row truncation safeguards.
- Corrected test prompt expectations in `test-codemode-advanced-core.md` regarding `sqlite_read_query` default row limits (50 rows) and `sqlite_drop_table` success handling.
- Updated the stress test in `test-codemode-advanced-core.md` to use `LIMIT 100` to intentionally bypass the 50-row default limit.
- Filtered internal SpatiaLite-generated system triggers (e.g., `geometry_columns`) from `sqlite_list_triggers` to prevent payload bloat.
- Fixed `sqlite_date_add` to return a clear error instead of silent `null` values when calculated dates fall outside SQLite's supported bounds (`0000-01-01` to `9999-12-31`).
