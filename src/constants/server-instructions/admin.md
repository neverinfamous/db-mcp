# db-mcp Help — Database Administration (32N/31W tools) + Server Audit (5 tools)

## Maintenance

```javascript
sqlite_integrity_check({ maxErrors: 10 }); // check for corruption
sqlite_optimize({ analyze: true, reindex: true }); // optimize performance
sqlite_vacuum(); // reclaim space
sqlite_analyze({ table: "orders" }); // update statistics for query planner
sqlite_dbstat({ summarize: true }); // storage stats (⚠️ summarize native-only; WASM returns counts only)
sqlite_reindex(); // rebuild all indexes
sqlite_reindex({ target: "idx_users_email" }); // rebuild specific index
sqlite_reindex({ target: "orders" }); // rebuild all indexes for a table
```

## Backup/Restore (Native only)

```javascript
sqlite_backup({ targetPath: "/path/to/backup.db" });
sqlite_vacuum_into({ outputPath: "/path/to/compact.db" }); // create defragmented copy
sqlite_dump({ outputPath: "/path/to/dump.sql" }); // export SQL text dump
sqlite_verify_backup({ backupPath: "/path/to/backup.db" }); // check integrity without restoring
sqlite_restore({ sourcePath: "/path/to/backup.db" }); // ⚠️ WARNING: Replaces current database
```

## Audit Backups

```javascript
sqlite_audit_list_backups(); // list pre-mutation DDL snapshots
sqlite_audit_get_backup({ filename: "snapshot_123.json" }); // retrieve specific snapshot
sqlite_audit_diff_backup({ filename: "snapshot_123.json" }); // compare snapshot against live schema
sqlite_audit_restore_backup({ filename: "snapshot_123.json", dryRun: true }); // restore schema from snapshot
sqlite_audit_cleanup(); // apply retention policy and delete old snapshots
```

## PRAGMA

```javascript
sqlite_pragma_settings({ pragma: "journal_mode" }); // get value
sqlite_pragma_settings({ pragma: "cache_size", value: 10000 }); // set value
sqlite_pragma_table_info({ table: "users" }); // column details
sqlite_pragma_compile_options({ filter: "FTS" }); // ⚠️ WASM may show FTS3, not FTS5
sqlite_pragma_database_list(); // list attached databases
sqlite_attach_database({ filepath: "/path/to/other.db", alias: "archive" }); // attach external DB
sqlite_detach_database({ alias: "archive" }); // detach DB
sqlite_pragma_optimize(); // run PRAGMA optimize
```

## WAL Management

```javascript
sqlite_wal({ action: "status" }); // check current journal mode
sqlite_wal({ action: "enable" }); // switch to WAL mode
sqlite_wal({ action: "disable" }); // switch back to DELETE journal mode
sqlite_wal({ action: "checkpoint" }); // run default checkpoint
sqlite_wal({ action: "checkpoint", checkpointMode: "TRUNCATE" }); // checkpoint and truncate WAL file
```

## Index & Stats

- `sqlite_index_stats({ table: "orders" })` — stats for explicit indexes

## Views

```javascript
sqlite_create_view({
  viewName: "active_orders",
  selectQuery: "SELECT * FROM orders WHERE status = 'active'",
});
sqlite_create_view({ viewName: "v", selectQuery: "...", replace: true }); // CREATE OR REPLACE
sqlite_list_views(); // list all views
sqlite_drop_view({ viewName: "active_orders" });
```

## Virtual Tables

```javascript
sqlite_list_virtual_tables(); // list FTS5, R-Tree, CSV tables
sqlite_virtual_table_info({ tableName: "articles_fts" }); // module and column info
sqlite_drop_virtual_table({ tableName: "old_fts", ifExists: true });
```

## Generate Series (pure JS)

```javascript
sqlite_generate_series({ start: 1, stop: 100, step: 5 }); // returns array of values
// ⚠️ Creates a REGULAR table (not virtual) — use sqlite_drop_table to remove
sqlite_create_series_table({ tableName: "numbers", start: 1, stop: 1000 });
```

## R-Tree (Native only)

```javascript
sqlite_create_rtree_table({ tableName: "locations_idx", dimensions: 2 }); // 2D: minX, maxX, minY, maxY
// Returns graceful error with wasmLimitation: true in WASM
```

## CSV Virtual Tables (Native only)

⚠️ Requires ABSOLUTE file paths

```javascript
sqlite_analyze_csv_schema({ filePath: "/absolute/path/to/data.csv" }); // analyze CSV structure
sqlite_create_csv_table({
  tableName: "csv_data",
  filePath: "/absolute/path/to/data.csv",
});
```

## Business Insights

```javascript
sqlite_append_insight({ insight: "Q4 revenue increased 23% YoY" }); // add to memo://insights
```

