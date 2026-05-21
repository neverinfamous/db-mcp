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

### Changed
- Filtered internal SpatiaLite and db-mcp system tables/views/indexes from SQLite MCP resources (`sqlite_schema`, `sqlite_tables`, `sqlite_views`, `sqlite_indexes`).
- Expanded SpatiaLite system filter to correctly exclude R-Tree virtual index shadow tables (`idx__...`).
- Updated E2E Playwright test assertions (`resources.spec.ts`) and test documentation (`test-resources.md`) to reflect the accurate count of 10 tables after the successful application of the SpatiaLite shadow table filter.
