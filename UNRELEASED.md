## [Unreleased]

### Changed
- Filtered internal SpatiaLite and db-mcp system tables/views/indexes from SQLite MCP resources (`sqlite_schema`, `sqlite_tables`, `sqlite_views`, `sqlite_indexes`).
- Expanded SpatiaLite system filter to correctly exclude R-Tree virtual index shadow tables (`idx__...`).
- Updated E2E Playwright test assertions (`resources.spec.ts`) and test documentation (`test-resources.md`) to reflect the accurate count of 10 tables after the successful application of the SpatiaLite shadow table filter.
