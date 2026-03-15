# db-mcp Help — Database Administration

## Transactions (7 tools, Native only)

- `sqlite_transaction_execute({ statements: ["UPDATE a SET x=1", "UPDATE b SET y=2"] })` — atomic execution
- `sqlite_transaction_begin({ mode: "immediate" })`
- `sqlite_transaction_savepoint({ name })` / `sqlite_transaction_rollback_to({ name })` / `sqlite_transaction_release({ name })`
- `sqlite_transaction_commit()` / `sqlite_transaction_rollback()`

## Maintenance

- `sqlite_integrity_check({ maxErrors })` — check for corruption
- `sqlite_optimize({ analyze?, reindex? })` — optimize performance
- `sqlite_vacuum()` — reclaim space
- `sqlite_analyze({ table? })` — update statistics for query planner
- `sqlite_dbstat({ summarize? })` — storage stats (⚠️ `summarize` native-only; WASM returns counts only)

## Backup/Restore (Native only)

- `sqlite_backup({ targetPath })` — backup database
- `sqlite_verify_backup({ backupPath })` — check integrity without restoring
- `sqlite_restore({ sourcePath })` — ⚠️ WARNING: Replaces current database

## PRAGMA

- `sqlite_pragma_settings({ pragma, value? })` — get/set PRAGMA values
- `sqlite_pragma_table_info({ table })` — column details
- `sqlite_pragma_compile_options({ filter? })` — filter compile options (⚠️ WASM may show FTS3, not FTS5)
- `sqlite_pragma_database_list()` — list attached databases
- `sqlite_pragma_optimize()` — run PRAGMA optimize

## Index & Stats

- `sqlite_index_stats({ table })` — stats for explicit indexes

## Views

- `sqlite_create_view({ viewName, selectQuery, replace? })` — `replace: true` for CREATE OR REPLACE
- `sqlite_list_views()` — list all views
- `sqlite_drop_view({ viewName })`

## Virtual Tables

- `sqlite_list_virtual_tables()` — list FTS5, R-Tree, CSV tables
- `sqlite_virtual_table_info({ tableName })` — module and column info
- `sqlite_drop_virtual_table({ tableName, ifExists? })`

## Generate Series (pure JS)

- `sqlite_generate_series({ start, stop, step? })` — returns array of values
- `sqlite_create_series_table({ tableName, start, stop })` — creates REGULAR table (use `sqlite_drop_table` to remove)

## R-Tree (Native only)

- `sqlite_create_rtree_table({ tableName, dimensions: 2 })` — 2D: minX, maxX, minY, maxY. Returns graceful error in WASM

## CSV Virtual Tables (Native only, requires ABSOLUTE paths)

- `sqlite_analyze_csv_schema({ filePath })` — analyze CSV structure
- `sqlite_create_csv_table({ tableName, filePath })` — create virtual table from CSV

## Business Insights

- `sqlite_append_insight({ insight })` — add to `memo://insights`
