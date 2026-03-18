## [Unreleased]

### Fixed

- **Query Normalization**: Strip trailing whitespace and semicolons before injecting safety `LIMIT`, preventing invalid SQL like `SELECT ...; LIMIT 1000`
- **CTE Write Support**: `sqlite_write_query` now correctly accepts CTE-prefixed DML (`WITH ... INSERT/UPDATE/DELETE/REPLACE`) by parsing past parenthesized CTE bodies to find the main DML keyword
- **Statement Validation**: Removed `UPSERT` from allowed write prefixes — it is not a valid SQLite leading keyword
- **SQL Injection Hardening**: Replaced string interpolation with parameterized queries for table name filters in `sqlite_get_indexes` and `sqlite_index_stats`
- **Column Validation**: Optimized `validateColumnsExist` to fetch all columns in a single `pragma_table_info` query and check membership in-memory, eliminating N+1 query roundtrips
- **Structured Errors**: All 3 native transaction savepoint handlers (`savepoint`, `release`, `rollback_to`) now return `formatHandlerError(ValidationError)` for invalid names instead of bare `{success: false}` objects
- **WASM Capability**: Corrected `fullTextSearch` capability flag to `false` for WASM/sql.js builds (FTS5 is not available)
- **Constraint Analysis**: Removed redundant no-op `.replace(/_/g, "_")` in foreign key column inference
- **Encoding**: Fixed mojibake em dash (`â€"` → `—`) in admin barrel index JSDoc
- **CodeQL**: Fixed missing regex anchor in icon URL test assertion
- **CodeQL**: Removed 10 unused imports across 8 test files
