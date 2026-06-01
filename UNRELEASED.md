## [Unreleased]

### Added
- `cursor` parameter support in `sqlite_read_query` and `sqlite_fts_search` for base64 opaque cursor-based pagination.
- `recommendComposite` and `queriesToAnalyze` options in `sqlite_index_audit` to automatically recommend composite and partial indexes using `EXPLAIN QUERY PLAN` heuristics.
