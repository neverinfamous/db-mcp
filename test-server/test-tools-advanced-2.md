# Advanced Stress Test — db-mcp (SQLite) — Part 2

**Step 1:** Read `server-instructions.ts` and `src/constants/server-instructions/gotchas.md` using `view_file` (not grep or search) to understand documented behaviors, edge cases, and response structures.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode), not with a browser, scripts, or terminal.

## Code Mode Execution

All tests should be executed via `sqlite_execute_code` code mode. Tests are written in direct tool call syntax for readability — translate to code mode:

| Direct Tool Call | Code Mode Equivalent |
|---|---|
| `sqlite_read_query({query: "..."})` | `sqlite.core.readQuery({query: "..."})` |
| `sqlite_write_query({query: "..."})` | `sqlite.core.writeQuery({query: "..."})` |
| `sqlite_create_table({tableName: "...", columns: [...]})` | `sqlite.core.createTable({tableName: "...", columns: [...]})` |
| `sqlite_describe_table({tableName: "..."})` | `sqlite.core.describeTable({tableName: "..."})` |
| `sqlite_drop_table({tableName: "..."})` | `sqlite.core.dropTable({tableName: "..."})` |
| `sqlite_create_index({...})` | `sqlite.core.createIndex({...})` |
| `sqlite_get_indexes({tableName: "..."})` | `sqlite.core.getIndexes({tableName: "..."})` |
| `sqlite_json_*({...})` | `sqlite.json.*({...})` |
| `sqlite_text_*` / `sqlite_regex_*` / etc. | `sqlite.text.*` |
| `sqlite_stats_*` / `sqlite_window_*` | `sqlite.stats.*` |
| `sqlite_vector_*` | `sqlite.vector.*` |
| `sqlite_fts_*` | `sqlite.text.*` (FTS tools are in the text group) |
| `sqlite_create_view` / `sqlite_drop_view` / etc. | `sqlite.admin.*` |
| `sqlite_geo_*` / `sqlite_spatialite_*` | `sqlite.geo.*` |
| `sqlite_dependency_graph` / `sqlite_index_audit` / etc. | `sqlite.introspection.*` |
| `sqlite_migration_*` | `sqlite.migration.*` |

**Key rules:**
- Use `sqlite.<group>.help()` to discover method names and parameters for each group
- State **persists** across `sqlite_execute_code` calls — create a table in one call, query it in the next
- Do **NOT** pass `readonly: true` when tests need to create/write/drop objects
- Group multiple related tests into a single code mode call when practical

## Test Database Schema

Same as `test-tools.md` — refer to that file for the full schema reference. Key tables: `test_products` (16 rows), `test_orders` (20), `test_jsonb_docs` (6), `test_articles` (8), `test_users` (9), `test_measurements` (200), `test_embeddings` (20), `test_locations` (15), `test_categories` (17), `test_events` (100).

## Naming & Cleanup

- **Temporary tables**: Prefix with `stress_` (e.g., `stress_empty_table`)
- **Temporary indexes**: Prefix with `stress_idx_`
- **Temporary views**: Prefix with `stress_view_`
- Clean up ALL `stress_*` objects after testing

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response for the given input
- ✅ Confirmed: Edge case handled correctly (use only inline during testing; omit from Final Summary)

### Error Code Consistency

When rating errors, flag any generic code (`RESOURCE_ERROR`, `UNKNOWN_ERROR`) that should be a specific code (e.g., `TABLE_NOT_FOUND`, `COLUMN_NOT_FOUND`, `VALIDATION_ERROR`). These are fixable in `src/utils/errors/` (see `suggestions.ts` and `classes.ts`) by adding a `code` override to the matching error class. Treat as ⚠️ Issue and include in fix plan.

## Post-Test Procedures

At the end, confirm cleanup of all `stress_*` objects, then **fix every finding** — not just ❌ Fails, but also ⚠️ Issues (behavioral improvements, missing warnings, error code consistency) and 📦 Payload problems (responses that should be truncated or offer a `limit` param). Create a plan covering all findings; if the plan does not require important decision choices, proceed with implementation. When complete, run the full test suite and fix any broken tests, run lint and typecheck and fix any issues, run prettier, update the changelog (being careful not to create duplicate headers), and commit without pushing. Then re-test your fixes with code mode calls.

### Note:

C:\Users\chris\Desktop\db-mcp\test-server is in .gitignore as intended.

---

## admin Group Advanced Tests

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### admin Group Tools — Native (33)

4. sqlite_generate_series
5. sqlite_create_view
6. sqlite_list_views
7. sqlite_drop_view
8. sqlite_dbstat
9. sqlite_vacuum
10. sqlite_list_virtual_tables
11. sqlite_virtual_table_info
12. sqlite_drop_virtual_table
13. sqlite_create_csv_table
14. sqlite_analyze_csv_schema
15. sqlite_create_rtree_table
16. sqlite_create_series_table
17. sqlite_backup
18. sqlite_analyze
19. sqlite_integrity_check
20. sqlite_optimize
21. sqlite_restore
22. sqlite_verify_backup
23. sqlite_index_stats
24. sqlite_pragma_compile_options
25. sqlite_pragma_database_list
26. sqlite_pragma_optimize
27. sqlite_pragma_settings
28. sqlite_pragma_table_info
29. sqlite_append_insight
30. sqlite_transaction_begin
31. sqlite_transaction_commit
32. sqlite_transaction_rollback
33. sqlite_transaction_savepoint
34. sqlite_transaction_release
35. sqlite_transaction_rollback_to
36. sqlite_transaction_execute

### admin Group Tools — WASM (26)

Same as Native minus the 7 transaction management tools (items 30-36).

### Category 1: View Lifecycle Stress

1. `sqlite_create_view({viewName: "stress_view_orders", selectQuery: "SELECT product_id, COUNT(*) as cnt FROM test_orders GROUP BY product_id"})` → success
2. `sqlite_list_views` → verify `stress_view_orders` present
3. `sqlite_drop_view({viewName: "stress_view_orders"})` → success
4. `sqlite_drop_view({viewName: "stress_view_orders"})` → expect structured error or "not found" (not raw crash)
5. `sqlite_create_view({viewName: "stress_view_orders", selectQuery: "SELECT product_id, COUNT(*) as cnt FROM test_orders GROUP BY product_id"})` → recreate success

### Category 2: Virtual Table Edge Cases

6. `sqlite_create_rtree_table({tableName: "stress_rtree_test", dimensions: 2})` → success
7. `sqlite_list_virtual_tables` → verify `stress_rtree_test` present alongside `test_articles_fts` (Native)
8. `sqlite_virtual_table_info({tableName: "stress_rtree_test"})` → correct module and column info
9. `sqlite_drop_virtual_table({tableName: "stress_rtree_test"})` → success
10. `sqlite_virtual_table_info({tableName: "nonexistent_vtable_xyz"})` → structured error

### Category 3: Backup/Restore Integrity

11. `sqlite_backup({targetPath: "test-server/stress-backup.db"})` → success
12. `sqlite_verify_backup({backupPath: "test-server/stress-backup.db"})` → integrity verified
13. `sqlite_verify_backup({backupPath: "nonexistent_file.db"})` → structured error
14. Cleanup: note backup file for manual removal

### Category 4: Transaction Edge Cases `[NATIVE ONLY]`

**4.1 Aborted Transaction Recovery**

15. `sqlite_transaction_begin` → get transaction ID
16. `sqlite_transaction_execute({statements: ["INSERT INTO nonexistent_table VALUES (1)"]})` → should fail
17. Start new transaction → verify it works normally (no lingering aborted state)

**4.2 Savepoint Stress Test**

18. `sqlite_transaction_begin` → get transaction ID
19. Create savepoint `sp1`
20. `sqlite_write_query` → INSERT a row into a temp table (within transaction)
21. Create savepoint `sp2`
22. `sqlite_write_query` → INSERT another row
23. `sqlite_transaction_rollback_to({name: "sp2"})` → should undo sp2's insert
24. `sqlite_transaction_rollback_to({name: "sp1"})` → should undo all inserts
25. `sqlite_transaction_commit` → only pre-sp1 state persists

**4.3 Transaction Execute Mixed Statements**

26. `sqlite_transaction_execute({statements: ["CREATE TABLE stress_tx_test (id INTEGER PRIMARY KEY, name TEXT)", "INSERT INTO stress_tx_test VALUES (1, 'alpha')", "INSERT INTO stress_tx_test VALUES (2, 'beta')"]})` → success, 3 statements executed
27. Verify `stress_tx_test` exists with 2 rows

**4.4 Transaction Execute Failure Rollback**

28. `sqlite_transaction_execute({statements: ["CREATE TABLE stress_tx_fail (id INT)", "INSERT INTO nonexistent_xyz VALUES (1)", "CREATE TABLE stress_tx_fail2 (id INT)"]})` → failure
29. Verify: `stress_tx_fail` does NOT exist (atomic rollback worked)

### Category 5: Pragma Edge Cases

30. `sqlite_pragma_compile_options({filter: "THREAD"})` → filtered result subset
31. `sqlite_pragma_settings` → verify key settings structure
32. `sqlite_pragma_table_info({tableName: "nonexistent_table_xyz"})` → report behavior

### Category 6: Error Message Quality

33. `sqlite_drop_view({viewName: "nonexistent_view_xyz"})` → structured error
34. `sqlite_create_csv_table({tableName: "stress_csv", filePath: "nonexistent_file.csv"})` → structured error
35. `sqlite_verify_backup({backupPath: "nonexistent_backup.db"})` → structured error

### Category 7: WASM Boundary Verification

For WASM testing only:

36. Confirm transaction tools are NOT present in the tool list
37. All 26 non-transaction admin tools should work identically in WASM and Native

### Final Cleanup

Drop all `stress_*` tables and views. Confirm `test_products` (16 rows) and `test_orders` (20 rows) are unchanged.

---

## geo Group Advanced Tests

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### geo Group Tools — Native (11)

4. sqlite_geo_distance
5. sqlite_geo_nearby
6. sqlite_geo_bounding_box
7. sqlite_geo_cluster
8. sqlite_spatialite_load `[NATIVE ONLY]`
9. sqlite_spatialite_create_table `[NATIVE ONLY]`
10. sqlite_spatialite_query `[NATIVE ONLY]`
11. sqlite_spatialite_analyze `[NATIVE ONLY]`
12. sqlite_spatialite_index `[NATIVE ONLY]`
13. sqlite_spatialite_transform `[NATIVE ONLY]`
14. sqlite_spatialite_import `[NATIVE ONLY]`

### geo Group Tools — WASM (4)

Only the Haversine-based tools: items 4-7.

### Category 1: Haversine Boundary Conditions

1. `sqlite_geo_distance({lat1: 0, lon1: 0, lat2: 0, lon2: 0})` → distance = 0 (same point)
2. `sqlite_geo_distance({lat1: 90, lon1: 0, lat2: -90, lon2: 0})` → antipodal distance ≈ 20,015 km (half Earth circumference)
3. `sqlite_geo_distance({lat1: 0, lon1: -180, lat2: 0, lon2: 180})` → distance ≈ 0 (same point, opposite notation)
4. `sqlite_geo_distance({lat1: 91, lon1: 0, lat2: 0, lon2: 0})` → report behavior for out-of-bounds latitude (>90°)
5. `sqlite_geo_distance({lat1: 0, lon1: 181, lat2: 0, lon2: 0})` → report behavior for out-of-bounds longitude (>180°)

### Category 2: Nearby Search Edge Cases

6. `sqlite_geo_nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.7829, centerLon: -73.9654, radius: 0.1, unit: "km"})` → very small radius — should find only Central Park (within 100m)
7. `sqlite_geo_nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.7829, centerLon: -73.9654, radius: 50000, unit: "km"})` → very large radius — should find ALL 15 locations
8. `sqlite_geo_nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 0, centerLon: 0, radius: 100, unit: "km"})` → no locations near (0,0) — 0 results (not error)

### Category 3: Bounding Box Edge Cases

9. `sqlite_geo_bounding_box({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: -90, maxLat: 90, minLon: -180, maxLon: 180})` → all 15 locations (global bounding box)
10. `sqlite_geo_bounding_box({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 0, maxLat: 0, minLon: 0, maxLon: 0})` → 0 results (point bounding box)
11. `sqlite_geo_bounding_box({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 50, maxLat: 52, minLon: -1, maxLon: 1})` → London locations (Big Ben, Tower Bridge, Buckingham Palace)

### Category 4: Clustering Edge Cases

12. `sqlite_geo_cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 180})` → single cluster with all 15 points (huge grid)
13. `sqlite_geo_cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 0.001})` → ~15 clusters (tiny grid, one per location)
14. `sqlite_geo_cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 0.1})` → approximately one cluster per city

### Category 5: SpatiaLite Integration `[NATIVE ONLY]`

15. `sqlite_spatialite_load` → verify version string returned
16. `sqlite_spatialite_create_table({tableName: "stress_geo_spatial", geometryColumn: "geom", geometryType: "POINT", srid: 4326, additionalColumns: [{name: "name", type: "TEXT"}, {name: "type", type: "TEXT"}]})` → success
17. Import 3 points (NYC, Paris, Tokyo) via `sqlite_spatialite_import`
18. `sqlite_spatialite_query({query: "SELECT name, AsText(geom) FROM stress_geo_spatial"})` → 3 rows with WKT
19. `sqlite_spatialite_transform({operation: "buffer", geometry1: "POINT(-73.9654 40.7829)", distance: 0.01})` → buffered polygon
20. `sqlite_spatialite_transform({operation: "centroid", geometry1: "POLYGON((-74 40, -74 41, -73 41, -73 40, -74 40))"})` → centroid point
21. `sqlite_spatialite_index({tableName: "stress_geo_spatial", geometryColumn: "geom", action: "create"})` → R-Tree index
22. `sqlite_spatialite_index({tableName: "stress_geo_spatial", geometryColumn: "geom", action: "check"})` → index integrity
23. `sqlite_spatialite_analyze({analysisType: "spatial_extent", sourceTable: "stress_geo_spatial", geometryColumn: "geom"})` → spatial extent

### Category 6: Error Message Quality

24. `sqlite_geo_nearby({table: "nonexistent_table_xyz", latColumn: "lat", lonColumn: "lon", centerLat: 0, centerLon: 0, radius: 100, unit: "km"})` → structured error
25. `sqlite_geo_nearby({table: "test_locations", latColumn: "nonexistent_col", lonColumn: "longitude", centerLat: 0, centerLon: 0, radius: 100, unit: "km"})` → structured error about column
26. `sqlite_spatialite_query({query: "SELECT * FROM nonexistent_table_xyz"})` `[NATIVE ONLY]` → structured error

### Category 7: WASM Boundary Verification

For WASM testing only:

27. Confirm SpatiaLite tools (items 8-14) are NOT present in the tool list
28. All 4 Haversine tools should produce identical results in WASM and Native

### Final Cleanup

Drop `stress_geo_spatial` (if created). Confirm `test_locations` count is still 15.

---

## introspection Group Advanced Tests

> **Note:** All introspection tools are **read-only**. The test database has **one FK** (`test_orders.product_id → test_products.id`) and a **deliberately redundant index** (`idx_orders_status` is a prefix of `idx_orders_status_date`).

> **Code Mode Required:** Several optional params (`table`, `direction`, `sections`, `compact`, `checks`, `includeTableDetails`, `limit`) are defined in tool schemas but NOT exposed in MCP tool definitions. Use `sqlite_execute_code` to test these params via `sqlite.introspection.*` API.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### introspection Group Tools (9)

4. sqlite_dependency_graph
5. sqlite_topological_sort
6. sqlite_cascade_simulator
7. sqlite_schema_snapshot
8. sqlite_constraint_analysis
9. sqlite_migration_risks
10. sqlite_storage_analysis
11. sqlite_index_audit
12. sqlite_query_plan

### Category 1: Graph Analysis Edge Cases

**1.1 Full Dependency Graph**

1. `sqlite_dependency_graph({})` → full graph. Verify edge `test_orders → test_products` present in edges array.
2. `sqlite_dependency_graph({includeRowCounts: false})` → verify rowCount is omitted from node entries.
3. `sqlite_dependency_graph({})` → verify `stats.rootTables` and `stats.leafTables` are populated and disjoint.

**1.2 Topological Sort Direction Stress**

4. `sqlite_topological_sort({direction: "create"})` → `test_products` appears BEFORE `test_orders` (dependency order)
5. `sqlite_topological_sort({direction: "drop"})` → `test_orders` appears BEFORE `test_products` (reverse)
6. Verify both directions list the same set of tables (just reordered)

**1.3 Cascade Chains**

7. `sqlite_cascade_simulator({table: "test_products"})` → affectedTables includes `test_orders` with action from FK definition (CASCADE)
8. `sqlite_cascade_simulator({table: "test_measurements"})` → affectedTables is empty (leaf table, nothing references it)
9. `sqlite_cascade_simulator({table: "test_orders"})` → verify behavior: nothing references `test_orders` via FK, so affectedTables should be empty even though it has outgoing FKs

### Category 2: Schema Snapshot Completeness

10. `sqlite_schema_snapshot({})` → full snapshot. Verify:
    - tables ≥ 11 (10 regular + FTS virtual)
    - indexes ≥ 4 (`idx_orders_status`, `idx_orders_date`, `idx_products_category`, `idx_orders_status_date`)
    - generatedAt is a valid ISO timestamp
11. `sqlite_schema_snapshot({sections: ["indexes"]})` → only indexes section populated. Verify table section is absent/empty.
12. `sqlite_schema_snapshot({sections: ["tables", "indexes"]})` → both sections present
13. `sqlite_schema_snapshot({compact: true})` → verify tables exist but columns arrays are absent from each table entry
14. `sqlite_schema_snapshot({compact: false})` → verify column details (name, type, nullable, pk) are present for each table

### Category 3: Constraint Analysis Stress

15. `sqlite_constraint_analysis({})` → all tables analyzed. Verify summary.byType keys and summary.bySeverity keys.
16. `sqlite_constraint_analysis({checks: ["unindexed_fk"]})` → only unindexed FK findings. The `test_orders.product_id` FK may or may not be flagged depending on whether `idx_orders_status` counts as a covering index.
17. `sqlite_constraint_analysis({table: "test_users"})` → only findings for `test_users`. Verify no findings reference other tables.
18. `sqlite_constraint_analysis({table: "nonexistent_table_xyz"})` → report behavior: empty findings, or structured error?

### Category 4: Storage Analysis & Index Audit Depth

**4.1 Storage Analysis Verification**

19. `sqlite_storage_analysis({})` → verify database.totalSizeBytes = database.pageSize × database.totalPages (arithmetic check)
20. `sqlite_storage_analysis({})` → verify tables array is sorted by size descending (or largest tables first)
21. `sqlite_storage_analysis({includeTableDetails: false})` → tables property is absent. Database-level metrics still present.
22. `sqlite_storage_analysis({limit: 3})` → only top 3 tables returned (if limit parameter is supported)
23. `sqlite_storage_analysis({})` → verify database.fragmentationPct is a number between 0 and 100. Check database.journalMode and database.autoVacuum are non-empty strings.

**4.2 Index Audit Cross-Validation**

24. `sqlite_index_audit({})` → should flag `idx_orders_status` as `type: "redundant"` (prefix of `idx_orders_status_date`). Note: the field name is `index` (not `indexName`).
25. `sqlite_index_audit({})` → verify `redundantOf` field points to `idx_orders_status_date` (the superset index)
26. `sqlite_index_audit({})` → check for `missing_fk_index` on `test_orders.product_id` (FK column without dedicated index)
27. `sqlite_index_audit({table: "test_products"})` → filtered findings. Only `test_products` findings returned. Verify `idx_products_category` is NOT flagged as redundant (it's the only index on that table).
28. `sqlite_index_audit({table: "test_measurements"})` → table with 200 rows and no secondary indexes. Note: `unindexed_large_table` threshold is 1000 rows, so no finding expected here.

### Category 5: Query Plan Deep Analysis

29. `sqlite_query_plan({sql: "SELECT * FROM test_orders WHERE status = 'completed'"})` → should use `idx_orders_status`. Verify `analysis.indexScans` includes a reference.
30. `sqlite_query_plan({sql: "SELECT * FROM test_products WHERE name = 'Laptop Pro 15'"})` → full scan (no index on `name`). Verify:
    - `analysis.fullScans` includes `test_products`
    - `suggestions` array is non-empty with index creation recommendation
31. `sqlite_query_plan({sql: "SELECT p.name, o.quantity FROM test_products p JOIN test_orders o ON o.product_id = p.id WHERE o.status = 'completed'"})` → join plan. Verify plan has multiple entries and analysis reflects join strategy.
32. `sqlite_query_plan({sql: "SELECT * FROM test_orders WHERE status = 'completed' AND order_date > '2026-01-20'"})` → compound WHERE. Verify which index is chosen (`idx_orders_status` or `idx_orders_status_date`).
33. `sqlite_query_plan({sql: "SELECT COUNT(*) FROM test_measurements GROUP BY sensor_id"})` → GROUP BY plan without dedicated index on `sensor_id`. Expect full scan.
34. `sqlite_query_plan({sql: "WITH top_orders AS (SELECT * FROM test_orders ORDER BY total_price DESC LIMIT 5) SELECT t.*, p.name FROM top_orders t JOIN test_products p ON p.id = t.product_id"})` → CTE + JOIN plan. Verify multi-step plan.

### Category 6: Migration Risk Assessment Depth

35. `sqlite_migration_risks({statements: ["DROP TABLE test_products"]})` → critical/high risk. Verify risk mentions FK dependents (`test_orders`).
36. `sqlite_migration_risks({statements: ["ALTER TABLE test_products ADD COLUMN temp_col TEXT"]})` → low risk (additive, non-destructive)
37. `sqlite_migration_risks({statements: ["CREATE INDEX idx_temp ON test_products(name)"]})` → low risk
38. `sqlite_migration_risks({statements: ["DROP INDEX idx_orders_status"]})` → medium risk (removing a supporting index). Verify `riskLevel: "medium"` and `category: "index_removal"`.
39. `sqlite_migration_risks({statements: ["ALTER TABLE test_products ADD COLUMN temp1 TEXT", "DROP TABLE test_orders", "CREATE TABLE new_orders (id INTEGER PRIMARY KEY)"]})` → 3 statements, mixed risk levels. Verify `summary.totalStatements = 3` and `summary.highestRisk ≥ "high"`.

### Category 7: Error Message Quality

40. `sqlite_query_plan({sql: "DELETE FROM test_products WHERE id = 1"})` → structured error rejecting non-SELECT
41. `sqlite_query_plan({sql: "SELECT * FROM nonexistent_table_xyz"})` → structured error mentioning table
42. `sqlite_query_plan({})` → Zod error for missing `sql` param — must be handler error, NOT raw MCP error
43. `sqlite_cascade_simulator({})` → Zod error for missing `table` param
44. `sqlite_migration_risks({})` → Zod error for missing `statements` param
45. `sqlite_storage_analysis({limit: 0})` → Zod error (min: 1)
46. `sqlite_storage_analysis({limit: -5})` → Zod error

### Final Cleanup

All tools in this group are read-only — no cleanup needed. Confirm `test_products` (16 rows), `test_orders` (20 rows), and `test_measurements` (200 rows) are unchanged.

---

## migration Group Advanced Tests

> **Note:** Migration tools create a `_mcp_migrations` tracking table and may ALTER/CREATE/DROP tables. **Always reset the database after this group.**

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### migration Group Tools (6)

4. sqlite_migration_init
5. sqlite_migration_record
6. sqlite_migration_apply
7. sqlite_migration_rollback
8. sqlite_migration_history
9. sqlite_migration_status

### Category 1: Initialization & Idempotency

1. `sqlite_migration_init({})` → success, `_mcp_migrations` table created
2. `sqlite_migration_init({})` → idempotent call: should succeed without error (table already exists)
3. `sqlite_migration_status({})` → empty/clean state, no pending migrations
4. `sqlite_migration_history({})` → empty list

### Category 2: Full Lifecycle (Record → Apply → Rollback)

**2.1 Simple ALTER TABLE Migration**

5. `sqlite_migration_record({version: "stress_001_add_col", migrationSql: "ALTER TABLE test_products ADD COLUMN stress_flag INTEGER DEFAULT 0"})` → recorded (note: `migrationRecord` only stores metadata in `_mcp_migrations`; use `migrationApply` to execute the SQL)
6. `sqlite_migration_status({})` → shows 1 recorded migration
7. Verify column is NOT yet added until `migrationApply` is called. Use `sqlite_migration_apply` with the same `version` and `migrationSql` to execute.
8. `sqlite_migration_status({})` → shows 1 applied after `migrationApply`

**2.2 CREATE TABLE Migration**

9. `sqlite_migration_record({version: "stress_002_create_table", migrationSql: "CREATE TABLE stress_migration_data (id INTEGER PRIMARY KEY, name TEXT NOT NULL, value REAL)"})` → recorded (does NOT create the table). Use `migrationApply` to execute.
10. `sqlite_migration_history({})` → shows both migrations with timestamps

**2.3 Rollback Chain**

11. `sqlite_migration_rollback({version: "stress_002_create_table"})` → report behavior: rollback may require stored rollbackSql from apply step
12. `sqlite_list_tables` → verify `stress_migration_data` status
13. `sqlite_migration_history({})` → check `stress_002_create_table` status

### Category 3: State Pollution & Ordering

**3.1 Re-Record After Rollback**

14. `sqlite_migration_record({version: "stress_003_recreate", migrationSql: "CREATE TABLE stress_migration_data (id INTEGER PRIMARY KEY, value TEXT)"})` → recorded and applied (different schema from rolled-back migration)
15. `sqlite_migration_status({})` → verify correct counts

**3.2 Duplicate Name Detection**

16. `sqlite_migration_record({version: "stress_001_add_col", migrationSql: "SELECT 1"})` → report behavior: should error (duplicate version) or allow re-record?

**3.3 Multi-Statement Apply Verification**

17. Record a migration with a complex SQL statement:
    `sqlite_migration_record({version: "stress_004_complex", migrationSql: "CREATE INDEX stress_idx_flag ON test_products(stress_flag)"})`
18. Verify index created with `sqlite_get_indexes({tableName: "test_products"})`.

### Category 4: Error Paths & Recovery

**4.1 Apply Failures**

19. `sqlite_migration_record({version: "stress_005_bad_sql", migrationSql: "ALTER TABLE nonexistent_xyz ADD COLUMN foo TEXT"})` → records successfully (record only stores metadata, does not validate SQL executability)
20. `sqlite_migration_status({})` → verify the failed migration state is tracked (not lost)

**4.2 Nonexistent Migration Operations**

21. `sqlite_migration_apply({version: "nonexistent_migration_xyz"})` → structured error (not raw MCP error)
22. `sqlite_migration_rollback({version: "nonexistent_migration_xyz"})` → structured error

**4.3 Zod Validation Errors**

23. `sqlite_migration_record({})` → Zod error for missing required params (`version`, `migrationSql`) — must be handler error
24. `sqlite_migration_apply({})` → Zod error for missing `version`
25. `sqlite_migration_rollback({})` → Zod error for missing params

### Category 5: Error Message Quality

Rate each error response 1-5 for contextual usefulness:

26. `sqlite_migration_apply({version: "nonexistent_migration_xyz"})` → rate error: does it mention the migration version?
27. `sqlite_migration_record({})` → rate error: does it list the missing required fields?
28. `sqlite_migration_rollback({version: "stress_001_add_col"})` (already applied, not rolled back yet — or already rolled back) → rate error clarity

### Final Cleanup

1. Drop `_mcp_migrations`: `sqlite_write_query({query: "DROP TABLE IF EXISTS _mcp_migrations"})`
2. Drop `stress_migration_data`: `sqlite_write_query({query: "DROP TABLE IF EXISTS stress_migration_data"})`
3. Drop `stress_idx_flag`: `sqlite_write_query({query: "DROP INDEX IF EXISTS stress_idx_flag"})`
4. **Reset the database** to undo the `stress_flag` column addition on `test_products` (SQLite cannot DROP COLUMN in older versions)
5. After reset, verify: `test_products` has 16 rows and original 6 columns (no `stress_flag`)

---

## Cross-Group Integration Tests

> These tests exercise realistic multi-group workflows that span tool boundaries. All create temporary objects that must be cleaned up.

### Workflow 1: Core → JSON → Stats (Data Pipeline)

1. `sqlite_create_table({tableName: "stress_pipeline", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "data", type: "TEXT"}, {name: "score", type: "REAL"}]})` → success
2. `sqlite_write_query({query: "INSERT INTO stress_pipeline VALUES (1, '{\"category\": \"A\", \"value\": 42}', 85.5), (2, '{\"category\": \"B\", \"value\": 17}', 92.3), (3, '{\"category\": \"A\", \"value\": 88}', 71.0), (4, '{\"category\": \"B\", \"value\": 55}', 63.8), (5, '{\"category\": \"A\", \"value\": 31}', 99.1)"})` → 5 rows
3. `sqlite_json_extract({table: "stress_pipeline", column: "data", path: "$.category"})` → 5 results with A/B categories
4. `sqlite_stats_basic({table: "stress_pipeline", column: "score"})` → count=5, verify min/max/avg
5. `sqlite_stats_group_by({table: "stress_pipeline", groupByColumn: "json_extract(data, '$.category')", valueColumn: "score", stat: "avg"})` → report behavior (may or may not accept SQL expression as groupByColumn)
6. Cleanup: `sqlite_drop_table({tableName: "stress_pipeline"})`

### Workflow 2: Core → Vector → Text (AI Search Pipeline)

7. `sqlite_vector_create_table({tableName: "stress_ai_search", dimensions: 4, additionalColumns: [{name: "content", type: "TEXT"}, {name: "label", type: "TEXT"}]})` → success
8. `sqlite_vector_batch_store({table: "stress_ai_search", idColumn: "id", vectorColumn: "vector", items: [{id: 1, vector: [0.1, 0.2, 0.3, 0.4]}, {id: 2, vector: [0.5, 0.6, 0.7, 0.8]}, {id: 3, vector: [0.9, 0.1, 0.2, 0.3]}]})` → `{stored: 3}`
9. `sqlite_vector_search({table: "stress_ai_search", vectorColumn: "vector", queryVector: [0.1, 0.2, 0.3, 0.4], metric: "cosine", limit: 2})` → top result is id=1 (exact match)
10. `sqlite_fuzzy_match({table: "stress_ai_search", column: "label", search: "test"})` → report behavior (NULL column values)
11. Cleanup: `sqlite_drop_table({tableName: "stress_ai_search"})`

### Workflow 3: Migration → Introspection (Schema Lifecycle)

12. `sqlite_migration_init({})` → create tracking table
13. `sqlite_migration_record({version: "stress_cross_001", migrationSql: "CREATE TABLE stress_cross_ref (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES stress_cross_ref(id))"})` → recorded (note: `migrationRecord` only stores metadata; manually create the table or use `migrationApply` to execute the SQL)
14. `sqlite_dependency_graph({})` → verify self-referencing FK detected in edges
15. `sqlite_cascade_simulator({table: "stress_cross_ref"})` → verify self-reference analysis
16. `sqlite_schema_snapshot({})` → verify `stress_cross_ref` appears in snapshot
17. `sqlite_migration_rollback({version: "stress_cross_001"})` → report rollback behavior
19. Cleanup: `sqlite_write_query({query: "DROP TABLE IF EXISTS _mcp_migrations"})`

### Workflow 4: Admin → Introspection (Health Check Pipeline)

20. `sqlite_integrity_check` → verify `ok`
21. `sqlite_index_audit({})` → capture current findings count
22. `sqlite_storage_analysis({})` → verify database.totalSizeBytes > 0
23. `sqlite_query_plan({sql: "SELECT p.name, COUNT(o.id) FROM test_products p LEFT JOIN test_orders o ON o.product_id = p.id GROUP BY p.name"})` → complex JOIN query plan
24. `sqlite_analyze` → run ANALYZE
25. `sqlite_query_plan({sql: "SELECT p.name, COUNT(o.id) FROM test_products p LEFT JOIN test_orders o ON o.product_id = p.id GROUP BY p.name"})` → same query — report whether plan improved after ANALYZE

### Cross-Group Cleanup

1. `sqlite_drop_table({tableName: "stress_pipeline"})` → clean up
2. `sqlite_drop_table({tableName: "stress_ai_search"})` → clean up
3. `sqlite_drop_table({tableName: "stress_cross_ref"})` → clean up
4. `sqlite_write_query({query: "DROP TABLE IF EXISTS _mcp_migrations"})` → clean up

---

## Final Summary

At the end, compile a summary of all findings from **both Part 1 and Part 2**:

1. **Fails (❌)**: Tool errors or incorrect results that need code fixes
2. **Issues (⚠️)**: Unexpected behaviors or improvement opportunities
3. **Payload (📦)**: Unnecessarily large responses
4. **Error quality ratings**: For error message quality tests, rate each error 1-5 for contextual usefulness (5=excellent: includes object name, type, suggestion; 1=useless: generic "error occurred")

Create a plan to implement any fixes, including:

- Correcting any deficiencies in `src/constants/server-instructions/*.md` (run `npm run generate:instructions` after editing)
- Updating test-database.sql if needed
- Updating the prompts (`test-tools-advanced-1.md`, `test-tools-advanced-2.md`) if any test case was invalid

Confirm cleanup of ALL `stress_*` objects is complete.
