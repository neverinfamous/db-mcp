## [Unreleased]

### Added
- `cursor` parameter support in `sqlite_read_query` and `sqlite_fts_search` for base64 opaque cursor-based pagination.
- `recommendComposite` and `queriesToAnalyze` options in `sqlite_index_audit` to automatically recommend composite and partial indexes using `EXPLAIN QUERY PLAN` heuristics.

### Changed
**Dependency Updates**
- Bumped `isolated-vm` from 6.1.2 to 7.0.0
- Bumped `tsx` from 4.22.3 to 4.22.4
- Miscellaneous transitive dependencies updated via `npm update`
