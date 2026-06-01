## [Unreleased]

### Added
- `sqlite_hybrid_search` tool combining FTS5 text search and vector embedding search via Reciprocal Rank Fusion (RRF).
- `includeFacets` faceted search support added to `sqlite_fts_search`, `sqlite_advanced_search`, and `sqlite_hybrid_search`.
- FTS5 query sanitization to prevent syntax errors on malformed user input (`sanitizeFtsQuery`).
- `cursor` parameter support in `sqlite_read_query` and `sqlite_fts_search` for base64 opaque cursor-based pagination.
- `recommendComposite` and `queriesToAnalyze` options in `sqlite_index_audit` to automatically recommend composite and partial indexes using `EXPLAIN QUERY PLAN` heuristics.

### Fixed
- Fixed V8 Garbage Collection `STATUS_ACCESS_VIOLATION` (0xC0000005) crashes during teardown of `CodeModeSandbox` by rigorously wrapping isolate executions in `try...finally` blocks with explicit object `.dispose()` and `.release()` calls.

### Changed
**Dependency Updates**
- Pinned `isolated-vm` to exactly `6.1.2` (reverting from 7.0.0) to prevent uncontrolled minor/patch updates from introducing native V8 thread leaks on Windows.
- Bumped `tsx` from 4.22.3 to 4.22.4
- Miscellaneous transitive dependencies updated via `npm update`
