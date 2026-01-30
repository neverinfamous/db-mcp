# Admin Tool Group Tests

## Overview

The **Admin** group provides database administration tools including backup/restore, PRAGMA operations, virtual tables, and optimization functions.

| Environment | Tool Count                      |
| ----------- | ------------------------------- |
| WASM        | 26                              |
| Native      | 33 (includes transaction tools) |

## Tools in Group

### Backup & Restore (3 tools)

| Tool                   | Description             |
| ---------------------- | ----------------------- |
| `sqlite_backup`        | Create database backup  |
| `sqlite_restore`       | Restore from backup     |
| `sqlite_verify_backup` | Verify backup integrity |

### Optimization (4 tools)

| Tool                     | Description                     |
| ------------------------ | ------------------------------- |
| `sqlite_analyze`         | Analyze tables for optimization |
| `sqlite_optimize`        | Optimize database               |
| `sqlite_integrity_check` | Check database integrity        |
| `sqlite_vacuum`          | Vacuum database                 |

### PRAGMA Operations (5 tools)

| Tool                            | Description             |
| ------------------------------- | ----------------------- |
| `sqlite_pragma_compile_options` | Get compile options     |
| `sqlite_pragma_database_list`   | List attached databases |
| `sqlite_pragma_optimize`        | Run PRAGMA optimize     |
| `sqlite_pragma_settings`        | Get/set PRAGMA values   |
| `sqlite_pragma_table_info`      | Get table column info   |

### Virtual Tables (8 tools)

| Tool                         | Description              |
| ---------------------------- | ------------------------ |
| `sqlite_generate_series`     | Generate number sequence |
| `sqlite_create_view`         | Create a view            |
| `sqlite_list_views`          | List all views           |
| `sqlite_drop_view`           | Drop a view              |
| `sqlite_list_virtual_tables` | List virtual tables      |
| `sqlite_virtual_table_info`  | Get virtual table info   |
| `sqlite_drop_virtual_table`  | Drop virtual table       |
| `sqlite_dbstat`              | Database statistics      |

### CSV & R-Tree (4 tools)

| Tool                        | Description              |
| --------------------------- | ------------------------ |
| `sqlite_csv_table`          | Create CSV virtual table |
| `sqlite_analyze_csv_schema` | Analyze CSV schema       |
| `sqlite_rtree_table`        | Create R-Tree table      |
| `sqlite_series_table`       | Create series table      |

### Index & Insights (2 tools)

| Tool                    | Description             |
| ----------------------- | ----------------------- |
| `sqlite_index_stats`    | Get index statistics    |
| `sqlite_append_insight` | Append business insight |

### Transaction Tools (7 - Native Only)

| Tool                             | Description           |
| -------------------------------- | --------------------- |
| `sqlite_transaction_begin`       | Start transaction     |
| `sqlite_transaction_commit`      | Commit transaction    |
| `sqlite_transaction_rollback`    | Rollback transaction  |
| `sqlite_transaction_savepoint`   | Create savepoint      |
| `sqlite_transaction_release`     | Release savepoint     |
| `sqlite_transaction_rollback_to` | Rollback to savepoint |
| `sqlite_transaction_execute`     | Execute atomically    |

## Test Tables

- `test_events` (100 rows) - Event logs for admin operations
- All test tables for general admin operations

---

## Backup & Restore Tests

### 1. sqlite_backup

**Test 1.1: Create backup**

```json
{
  "path": "./test-database/backup-test.db"
}
```

Expected: Backup created successfully.

---

### 2. sqlite_verify_backup

**Test 2.1: Verify backup integrity**

```json
{
  "path": "./test-database/backup-test.db"
}
```

Expected: Backup verified, integrity check passed.

---

### 3. sqlite_restore

**Test 3.1: Check restore capability**

```json
{
  "path": "./test-database/backup-test.db"
}
```

Note: Be careful - this overwrites the current database!

---

## Optimization Tests

### 4. sqlite_analyze

**Test 4.1: Analyze all tables**

```json
{}
```

Expected: All tables analyzed.

**Test 4.2: Analyze specific table**

```json
{
  "table": "test_measurements"
}
```

Expected: test_measurements analyzed.

---

### 5. sqlite_integrity_check

**Test 5.1: Full integrity check**

```json
{
  "maxErrors": 100
}
```

Expected: "ok" if database is healthy.

---

### 6. sqlite_optimize

**Test 6.1: Optimize with analyze**

```json
{
  "reindex": false,
  "analyze": true
}
```

Expected: Database optimized.

**Test 6.2: Optimize with reindex**

```json
{
  "table": "test_orders",
  "reindex": true,
  "analyze": true
}
```

Expected: Table reindexed and analyzed.

---

### 7. sqlite_vacuum

**Test 7.1: Vacuum database**

```json
{}
```

Expected: Database vacuumed, space reclaimed.

---

## PRAGMA Tests

### 8. sqlite_pragma_compile_options

**Test 8.1: Get compile options**

```json
{}
```

Expected: Returns list of compile-time options (e.g., ENABLE_FTS5, ENABLE_JSON1).

---

### 9. sqlite_pragma_database_list

**Test 9.1: List databases**

```json
{}
```

Expected: Returns main database and any attached databases.

---

### 10. sqlite_pragma_optimize

**Test 10.1: Run optimize**

```json
{
  "mask": 65535
}
```

Expected: Optimization suggestions executed.

---

### 11. sqlite_pragma_settings

**Test 11.1: Get journal mode**

```json
{
  "pragma": "journal_mode"
}
```

Expected: Returns current journal mode (delete, wal, etc.).

**Test 11.2: Get page size**

```json
{
  "pragma": "page_size"
}
```

Expected: Returns page size (e.g., 4096).

**Test 11.3: Get cache size**

```json
{
  "pragma": "cache_size"
}
```

Expected: Returns current cache size.

---

### 12. sqlite_pragma_table_info

**Test 12.1: Get table info**

```json
{
  "table": "test_products"
}
```

Expected: Returns column definitions (name, type, notnull, default, pk).

---

## Virtual Table Tests

### 13. sqlite_generate_series

**Test 13.1: Generate number sequence**

```json
{
  "start": 1,
  "stop": 10,
  "step": 1
}
```

Expected: Returns values 1 through 10.

**Test 13.2: Step by 2**

```json
{
  "start": 0,
  "stop": 20,
  "step": 2
}
```

Expected: Returns 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20.

---

### 14. sqlite_create_view

**Test 14.1: Create summary view**

```json
{
  "viewName": "test_view_order_summary",
  "query": "SELECT p.name, SUM(o.quantity) as total_qty, SUM(o.total_price) as revenue FROM test_orders o JOIN test_products p ON o.product_id = p.id GROUP BY p.name",
  "replace": true
}
```

Expected: View created.

---

### 15. sqlite_list_views

**Test 15.1: List all views**

```json
{}
```

Expected: Returns list including test_view_order_summary.

---

### 16. sqlite_drop_view

**Test 16.1: Drop view**

```json
{
  "viewName": "test_view_order_summary",
  "ifExists": true
}
```

Expected: View dropped.

---

### 17. sqlite_list_virtual_tables

**Test 17.1: List virtual tables**

```json
{}
```

Expected: Returns any virtual tables (FTS, R-Tree, etc.).

---

### 18. sqlite_dbstat

**Test 18.1: Get database stats**

```json
{}
```

Expected: Returns page usage statistics.

**Test 18.2: Stats for specific table**

```json
{
  "table": "test_measurements"
}
```

Expected: Returns page stats for test_measurements.

---

### 19. sqlite_rtree_table

**Test 19.1: Create R-Tree table**

```json
{
  "tableName": "temp_rtree_locations",
  "dimensions": 2
}
```

Expected: R-Tree table created for 2D spatial indexing.

---

### 20. sqlite_series_table

**Test 20.1: Create persistent series**

```json
{
  "tableName": "temp_sequence",
  "start": 1,
  "stop": 100,
  "step": 1
}
```

Expected: Table created with sequence values.

---

## Transaction Tests (Native Only)

### 21. sqlite_transaction_begin

**Test 21.1: Begin deferred transaction**

```json
{
  "mode": "deferred"
}
```

Expected: Transaction started.

**Test 21.2: Begin immediate**

```json
{
  "mode": "immediate"
}
```

Expected: Immediate transaction started.

---

### 22. sqlite_transaction_commit

**Test 22.1: Commit transaction**

```json
{}
```

Expected: Transaction committed.

---

### 23. sqlite_transaction_rollback

**Test 23.1: Rollback transaction**

```json
{}
```

Expected: Transaction rolled back.

---

### 24. sqlite_transaction_savepoint

**Test 24.1: Create savepoint**

```json
{
  "name": "before_update"
}
```

Expected: Savepoint created.

---

### 25. sqlite_transaction_release

**Test 25.1: Release savepoint**

```json
{
  "name": "before_update"
}
```

Expected: Savepoint released.

---

### 26. sqlite_transaction_rollback_to

**Test 26.1: Rollback to savepoint**

```json
{
  "name": "before_update"
}
```

Expected: Rolled back to savepoint state.

---

### 27. sqlite_transaction_execute

**Test 27.1: Atomic multi-statement**

```json
{
  "statements": [
    "INSERT INTO test_products (name, price, category) VALUES ('TX Product', 10.99, 'test')",
    "UPDATE test_products SET price = 11.99 WHERE name = 'TX Product'"
  ]
}
```

Expected: Both statements executed atomically.

---

## Index & Insight Tests

### 28. sqlite_index_stats

**Test 28.1: Get index statistics**

```json
{}
```

Expected: Returns stats for all indexes.

**Test 28.2: Stats for specific table**

```json
{
  "table": "test_orders"
}
```

Expected: Returns index stats for test_orders.

---

### 29. sqlite_append_insight

**Test 29.1: Append business insight**

```json
{
  "insight": "Test insight: Database showing 200 sensor readings across 5 sensors."
}
```

Expected: Insight appended to memo resource.

---

## Cleanup

```sql
DROP VIEW IF EXISTS test_view_order_summary;
DROP TABLE IF EXISTS temp_rtree_locations;
DROP TABLE IF EXISTS temp_sequence;
DELETE FROM test_products WHERE category = 'test';
```

Also remove backup files:

```powershell
Remove-Item ./test-database/backup-test.db -Force -ErrorAction SilentlyContinue
```

## Known Issues / Notes

- Transaction tools only available on native backend
- VACUUM requires exclusive access (no other connections)
- Backup creates a complete copy - ensure disk space
- PRAGMA settings may be restricted in some environments
- R-Tree requires ENABLE_RTREE compile option
