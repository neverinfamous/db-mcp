# Tool Reference

Complete reference of all db-mcp tools organized by 10 tool groups + codemode. Each group automatically includes Code Mode (`sqlite_execute_code`) for token-efficient operations.

## Tool Count Taxonomy

| Scope           | What it includes                                    |  Native |    WASM | Notes                                           |
| --------------- | --------------------------------------------------- | ------: | ------: | ----------------------------------------------- |
| **Group tools** | 10 adapter-registered groups                        |     168 |     141 | Accessible via Code Mode `sqlite.help()`        |
| **Audit tools** | 5 server-level snapshot tools                       |       5 |       5 | MCP-only — not exposed in Code Mode             |
| **Inventory**   | Group + Audit                                       | **173** | **146** | All filterable/functional tools                 |
| **Built-in**    | `server_info`, `health`, `adapters`, `execute_code` |       4 |       4 | Always on (Code Mode can be excluded via rules) |
| **MCP total**   | Inventory + Built-in (`tools/list`)                 | **177** | **150** | **What a client sees via `tools/list`**         |

> Use [Tool Filtering](#️-tool-filtering) to select the groups you need. See [Code Mode](#-recommended-code-mode-maximum-token-savings) for the `sqlite.*` API that exposes every group tool through sandboxed JavaScript.

---

## codemode (1 tool)

Sandboxed JavaScript execution that exposes all 9 tool groups through the `sqlite.*` API.

| MCP Tool Name         | Code Mode Name           | Description                                                                                                                                                                             |
| :-------------------- | :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_execute_code` | _N/A (Sandbox Executor)_ | Execute JavaScript in a sandboxed environment with access to all SQLite tools via the `sqlite.*` API. Enables complex multi-step operations in a single call with 70–90% token savings. |

---

## core (21 tools + Code Mode)

Read/write queries, table and index management, and schema discovery.

| MCP Tool Name             | Code Mode Name                | Description                                                                                                                          |
| :------------------------ | :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_read_query`       | `sqlite.core.readQuery`       | Execute a SELECT query on the SQLite database. Returns rows as JSON. Use parameter binding for safety. Supports cursor pagination.                               |
| `sqlite_write_query`      | `sqlite.core.writeQuery`      | Execute an INSERT, UPDATE, or DELETE query. Returns affected row count. Use parameter binding for safety.                            |
| `sqlite_upsert`           | `sqlite.core.upsert`          | Insert a row or update it if it already exists (INSERT ON CONFLICT DO UPDATE / INSERT OR REPLACE).                                   |
| `sqlite_batch_insert`     | `sqlite.core.batchInsert`     | Insert multiple rows in a single statement.                                                                                          |
| `sqlite_count`            | `sqlite.core.count`           | Count rows in a table, optionally filtered by a WHERE clause.                                                                        |
| `sqlite_exists`           | `sqlite.core.exists`          | Check whether rows exist in a table, optionally filtered by a WHERE clause.                                                          |
| `sqlite_truncate`         | `sqlite.core.truncate`        | Truncate a table (executes DELETE FROM table).                                                                                       |
| `sqlite_list_tables`      | `sqlite.core.listTables`      | List all tables and views in the database with their column counts.                                                                  |
| `sqlite_describe_table`   | `sqlite.core.describeTable`   | Get detailed schema information for a table including columns, types, and constraints.                                               |
| `sqlite_create_table`     | `sqlite.core.createTable`     | Create a new table in the database with specified columns and constraints.                                                           |
| `sqlite_drop_table`       | `sqlite.core.dropTable`       | Drop (delete) a table from the database. This is irreversible!                                                                       |
| `sqlite_get_indexes`      | `sqlite.core.getIndexes`      | List all indexes in the database, optionally filtered by table.                                                                      |
| `sqlite_create_index`     | `sqlite.core.createIndex`     | Create an index on one or more columns to improve query performance.                                                                 |
| `sqlite_drop_index`       | `sqlite.core.dropIndex`       | Drop (delete) an index from the database.                                                                                            |
| `sqlite_list_triggers`    | `sqlite.core.listTriggers`    | List database triggers with optional table filter. Shows name, table, event type, timing, and full SQL.                              |
| `sqlite_list_constraints` | `sqlite.core.listConstraints` | List all constraints for a table: primary key columns, foreign keys, unique indexes, and CHECK constraints.                          |
| `sqlite_date_add`         | `sqlite.core.dateAdd`         | Add or subtract time from a date/time column using native SQLite datetime modifiers.                                                 |
| `sqlite_date_diff`        | `sqlite.core.dateDiff`        | Calculate the difference between two date/time columns, returning the result in days, hours, minutes, or seconds.                    |
| `sqlite_alter_table`      | `sqlite.core.alterTable`      | Alter a table's structure: add, rename, or drop columns, or rename the table. Validates constraints and SQLite-specific limitations. |
| `sqlite_create_trigger`   | `sqlite.core.createTrigger`   | Create a database trigger with BEFORE/AFTER/INSTEAD OF timing, column-specific UPDATE triggers, and optional WHEN conditions.        |
| `sqlite_drop_trigger`     | `sqlite.core.dropTrigger`     | Drop a database trigger with existence checking.                                                                                     |

---

## json (25 tools + Code Mode)

Comprehensive JSON manipulation — read, write, transform, validate, and analyze JSON documents stored in SQLite.

| MCP Tool Name                   | Code Mode Name                     | Description                                                                                                          |
| :------------------------------ | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `sqlite_json_insert`            | `sqlite.json.insert`               | Insert a row with JSON data. Automatically normalizes JSON for consistent storage.                                   |
| `sqlite_json_update`            | `sqlite.json.update`               | Update a value at a specific JSON path using `json_set()`.                                                           |
| `sqlite_json_select`            | `sqlite.json.select`               | Select rows and optionally extract specific JSON paths.                                                              |
| `sqlite_json_query`             | `sqlite.json.query`                | Query JSON data with path-based filters and projections.                                                             |
| `sqlite_json_validate_path`     | `sqlite.json.validatePath`         | Validate a JSON path syntax without executing a query.                                                               |
| `sqlite_json_merge`             | `sqlite.json.merge`                | Merge JSON object into existing JSON column using `json_patch()`.                                                    |
| `sqlite_json_analyze_schema`    | `sqlite.json.analyzeSchema`        | Analyze JSON data in a column to infer its schema (types, nullability, counts).                                      |
| `sqlite_create_json_collection` | `sqlite.json.createJsonCollection` | Create an optimized JSON document collection table with ID, data column, optional timestamps, and JSON path indexes. |
| `sqlite_json_valid`             | `sqlite.json.valid`                | Check if a string is valid JSON.                                                                                     |
| `sqlite_json_extract`           | `sqlite.json.extract`              | Extract a value from a JSON column at the specified path using `json_extract()`.                                     |
| `sqlite_json_set`               | `sqlite.json.set`                  | Set a value at a JSON path using `json_set()`. Creates path if it does not exist.                                    |
| `sqlite_json_remove`            | `sqlite.json.remove`               | Remove a value at a JSON path using `json_remove()`.                                                                 |
| `sqlite_json_type`              | `sqlite.json.type`                 | Get the JSON type (null, true, false, integer, real, text, array, object) at a path.                                 |
| `sqlite_json_array_length`      | `sqlite.json.arrayLength`          | Get the length of a JSON array at the specified path.                                                                |
| `sqlite_json_array_append`      | `sqlite.json.arrayAppend`          | Append a value to a JSON array using `json_insert()`.                                                                |
| `sqlite_json_keys`              | `sqlite.json.keys`                 | Get the distinct keys of JSON objects at the specified path (returns unique keys across all matching rows).          |
| `sqlite_json_each`              | `sqlite.json.each`                 | Expand a JSON array or object into rows using `json_each()`.                                                         |
| `sqlite_json_group_array`       | `sqlite.json.groupArray`           | Aggregate column values into a JSON array using `json_group_array()`.                                                |
| `sqlite_json_group_object`      | `sqlite.json.groupObject`          | Aggregate key-value pairs into a JSON object using `json_group_object()`.                                            |
| `sqlite_json_pretty`            | `sqlite.json.pretty`               | Format JSON string with indentation for readability.                                                                 |
| `sqlite_jsonb_convert`          | `sqlite.json.jsonbConvert`         | Convert a text JSON column to JSONB binary format for faster processing. Requires SQLite 3.45+.                      |
| `sqlite_json_storage_info`      | `sqlite.json.storageInfo`          | Analyze storage format of a JSON column (text vs JSONB) and report statistics.                                       |
| `sqlite_json_normalize_column`  | `sqlite.json.normalizeColumn`      | Normalize JSON data in a column (sort keys, compact format) for consistent storage and comparison.                   |
| `sqlite_json_security_scan`     | `sqlite.json.securityScan`         | Scan JSON columns for sensitive keys (PII/credentials), SQL injection patterns, and XSS attack vectors.              |
| `sqlite_json_diff`              | `sqlite.json.diff`                 | Compare two JSON paths within the same row to find differences. Useful for before/after comparisons.                 |

---

## text (20 Native / 15 WASM tools + Code Mode)

Text processing, regex, fuzzy matching, phonetic search, sentiment analysis, hybrid search, and FTS5 full-text search.

| MCP Tool Name            | Code Mode Name               | Description                                                                                                                                                                      |
| :----------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_regex_extract`   | `sqlite.text.regexExtract`   | Extract text matching a regex pattern. Processed in JavaScript after fetching data.                                                                                              |
| `sqlite_regex_match`     | `sqlite.text.regexMatch`     | Find rows where column matches a regex pattern. Processed in JavaScript.                                                                                                         |
| `sqlite_text_split`      | `sqlite.text.split`          | Split a text column by delimiter into array results.                                                                                                                             |
| `sqlite_text_concat`     | `sqlite.text.concat`         | Concatenate multiple columns with optional separator.                                                                                                                            |
| `sqlite_text_replace`    | `sqlite.text.replace`        | Replace text in a column using SQLite `replace()` function.                                                                                                                      |
| `sqlite_text_trim`       | `sqlite.text.trim`           | Trim whitespace from text column values.                                                                                                                                         |
| `sqlite_text_case`       | `sqlite.text.case`           | Convert text to uppercase or lowercase.                                                                                                                                          |
| `sqlite_text_substring`  | `sqlite.text.substring`      | Extract a substring from text column using `substr()`.                                                                                                                           |
| `sqlite_fuzzy_match`     | `sqlite.text.fuzzyMatch`     | Find fuzzy matches using Levenshtein distance. Splits values into tokens by default (`tokenize: false` to match entire value). Use `maxDistance` 1–3 for similar-length strings. |
| `sqlite_phonetic_match`  | `sqlite.text.phoneticMatch`  | Find phonetically similar values using Soundex (SQLite native) or Metaphone algorithm.                                                                                           |
| `sqlite_text_normalize`  | `sqlite.text.normalize`      | Normalize text using Unicode normalization (NFC, NFD, NFKC, NFKD) or strip accents.                                                                                              |
| `sqlite_text_validate`   | `sqlite.text.validate`       | Validate text values against patterns: email, phone, URL, UUID, IPv4, or custom regex.                                                                                           |
| `sqlite_advanced_search` | `sqlite.text.advancedSearch` | Advanced search combining exact, fuzzy (Levenshtein), and phonetic (Soundex) matching.                                                                                           |
| `sqlite_hybrid_search`   | `sqlite.text.hybridSearch`   | Hybrid search combining FTS5 text search and vector embedding search using Reciprocal Rank Fusion (RRF). Returns a unified, scored result set.                                   |
| `sqlite_text_sentiment`  | `sqlite.text.sentiment`      | Perform basic keyword-based sentiment analysis on raw text. Returns sentiment classification, score, confidence, and optionally matched words. No database query needed.         |
| `sqlite_fts_create`      | `sqlite.text.ftsCreate`      | Create an FTS5 full-text search virtual table. `[NATIVE ONLY]`                                                                                                                   |
| `sqlite_fts_search`      | `sqlite.text.ftsSearch`      | Search an FTS5 table using full-text query syntax. Supports cursor pagination. `[NATIVE ONLY]`                                                                                                               |
| `sqlite_fts_rebuild`     | `sqlite.text.ftsRebuild`     | Rebuild an FTS5 index to optimize search performance. `[NATIVE ONLY]`                                                                                                            |
| `sqlite_fts_match_info`  | `sqlite.text.ftsMatchInfo`   | Get FTS5 match ranking information using bm25. `[NATIVE ONLY]`                                                                                                                   |
| `sqlite_fts_headline`    | `sqlite.text.ftsHeadline`    | Generate highlighted snippets from FTS5 search results using `highlight()` and `snippet()`. `[NATIVE ONLY]`                                                                      |

---

## stats (23 Native / 17 WASM tools + Code Mode)

Statistical analysis — descriptive stats, percentiles, correlation, regression, distributions, anomaly detection, and window functions.

| MCP Tool Name                      | Code Mode Name                        | Description                                                                                                             |
| :--------------------------------- | :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| `sqlite_stats_basic`               | `sqlite.stats.statsBasic`             | Get basic statistics (count, sum, avg, min, max) for a numeric column.                                                  |
| `sqlite_stats_count`               | `sqlite.stats.statsCount`             | Count rows, optionally distinct values in a column.                                                                     |
| `sqlite_stats_group_by`            | `sqlite.stats.statsGroupBy`           | Aggregate statistics grouped by a column.                                                                               |
| `sqlite_stats_histogram`           | `sqlite.stats.statsHistogram`         | Create a histogram with specified number of buckets.                                                                    |
| `sqlite_stats_percentile`          | `sqlite.stats.statsPercentile`        | Calculate percentiles (median, quartiles, etc.) for a column.                                                           |
| `sqlite_stats_correlation`         | `sqlite.stats.statsCorrelation`       | Calculate Pearson correlation coefficient between two numeric columns.                                                  |
| `sqlite_stats_top_n`               | `sqlite.stats.statsTopN`              | Get top N values from a column.                                                                                         |
| `sqlite_stats_distinct`            | `sqlite.stats.statsDistinct`          | Get distinct values from a column.                                                                                      |
| `sqlite_stats_summary`             | `sqlite.stats.statsSummary`           | Get summary statistics for multiple columns at once.                                                                    |
| `sqlite_stats_frequency`           | `sqlite.stats.statsFrequency`         | Get frequency distribution of values in a column.                                                                       |
| `sqlite_stats_outliers`            | `sqlite.stats.statsOutliers`          | Detect outliers using IQR (Interquartile Range) or Z-score method.                                                      |
| `sqlite_stats_regression`          | `sqlite.stats.statsRegression`        | Perform linear or polynomial regression analysis between two columns.                                                   |
| `sqlite_stats_hypothesis`          | `sqlite.stats.statsHypothesis`        | Perform statistical hypothesis tests: one-sample t-test, two-sample t-test, or chi-square test.                         |
| `sqlite_stats_detect_anomalies`    | `sqlite.stats.statsDetectAnomalies`   | Detect data distribution anomalies using z-score analysis across numeric columns. Returns per-column risk assessment.   |
| `sqlite_stats_detect_bloat`        | `sqlite.stats.statsDetectBloat`       | Score tables by fragmentation/bloat risk using PRAGMA + dbstat metrics. Returns weighted risk scores (0-100).           |
| `sqlite_stats_detect_schema_risks` | `sqlite.stats.statsDetectSchemaRisks` | Score tables by schema health risk: missing FK indexes, no PKs, wide tables, large unindexed tables. Risk scores 0-100. |
| `sqlite_stats_sample`              | `sqlite.stats.statsSample`            | Get a random sample of rows for exploratory analysis. Configurable sample size (max 1000).                              |
| `sqlite_window_row_number`         | `sqlite.stats.windowRowNumber`        | Assign sequential row numbers based on ordering. Useful for pagination and ranking. `[NATIVE ONLY]`                     |
| `sqlite_window_rank`               | `sqlite.stats.windowRank`             | Calculate rank of rows. RANK leaves gaps after ties, DENSE_RANK does not, PERCENT_RANK gives 0–1 range. `[NATIVE ONLY]` |
| `sqlite_window_lag_lead`           | `sqlite.stats.windowLagLead`          | Access previous (LAG) or next (LEAD) row values. Useful for comparing consecutive rows. `[NATIVE ONLY]`                 |
| `sqlite_window_running_total`      | `sqlite.stats.windowRunningTotal`     | Calculate running (cumulative) total. Useful for balance tracking, cumulative metrics. `[NATIVE ONLY]`                  |
| `sqlite_window_moving_avg`         | `sqlite.stats.windowMovingAvg`        | Calculate moving (rolling) average. Useful for smoothing time series data. `[NATIVE ONLY]`                              |
| `sqlite_window_ntile`              | `sqlite.stats.windowNtile`            | Divide rows into N buckets. E.g., 4 buckets = quartiles, 10 = deciles, 100 = percentiles. `[NATIVE ONLY]`               |

---

## vector (11 tools + Code Mode)

Vector storage, similarity search, and distance calculations for embeddings and AI/ML operations.

| MCP Tool Name                | Code Mode Name              | Description                                                              |
| :--------------------------- | :-------------------------- | :----------------------------------------------------------------------- |
| `sqlite_vector_create_table` | `sqlite.vector.createTable` | Create a table optimized for vector storage with JSON vector column.     |
| `sqlite_vector_store`        | `sqlite.vector.store`       | Store or update a vector in the database.                                |
| `sqlite_vector_batch_store`  | `sqlite.vector.batchStore`  | Store multiple vectors in a batch operation.                             |
| `sqlite_vector_search`       | `sqlite.vector.search`      | Find similar vectors using cosine, euclidean, or dot product similarity. |
| `sqlite_vector_get`          | `sqlite.vector.get`         | Retrieve a vector by its ID.                                             |
| `sqlite_vector_delete`       | `sqlite.vector.delete`      | Delete vectors by their IDs.                                             |
| `sqlite_vector_count`        | `sqlite.vector.count`       | Count vectors in a table.                                                |
| `sqlite_vector_stats`        | `sqlite.vector.stats`       | Get statistics about vectors in a table.                                 |
| `sqlite_vector_dimensions`   | `sqlite.vector.dimensions`  | Get the dimensions of vectors in a table.                                |
| `sqlite_vector_normalize`    | `sqlite.vector.normalize`   | Normalize a vector to unit length.                                       |
| `sqlite_vector_distance`     | `sqlite.vector.distance`    | Calculate distance or similarity between two vectors.                    |

---

## admin (32N/31W group + 5 audit + Code Mode)

Database maintenance — backup/restore, PRAGMA, views, and virtual tables.

| MCP Tool Name                   | Code Mode Name                      | Description                                                                                                               |
| :------------------------------ | :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `sqlite_backup`                 | `sqlite.admin.backup`               | Create a backup of the database to a file.                                                                                |
| `sqlite_analyze`                | `sqlite.admin.analyze`              | Analyze table statistics to improve query performance.                                                                    |
| `sqlite_integrity_check`        | `sqlite.admin.integrityCheck`       | Check database integrity for corruption or errors.                                                                        |
| `sqlite_optimize`               | `sqlite.admin.optimize`             | Optimize database by reindexing and/or analyzing.                                                                         |
| `sqlite_restore`                | `sqlite.admin.restore`              | Restore database from a backup file. WARNING: This replaces the current database.                                         |
| `sqlite_verify_backup`          | `sqlite.admin.verifyBackup`         | Verify a backup file's integrity without restoring it.                                                                    |
| `sqlite_index_stats`            | `sqlite.admin.indexStats`           | Get detailed statistics for database indexes.                                                                             |
| `sqlite_pragma_compile_options` | `sqlite.admin.pragmaCompileOptions` | Get the compile-time options used to build SQLite. Use the `filter` parameter to reduce output (~50+ options by default). |
| `sqlite_pragma_database_list`   | `sqlite.admin.pragmaDatabaseList`   | List all attached databases.                                                                                              |
| `sqlite_pragma_optimize`        | `sqlite.admin.pragmaOptimize`       | Run `PRAGMA optimize` to improve query performance based on usage patterns.                                               |
| `sqlite_pragma_settings`        | `sqlite.admin.pragmaSettings`       | Get or set a PRAGMA value.                                                                                                |
| `sqlite_pragma_table_info`      | `sqlite.admin.pragmaTableInfo`      | Get detailed column information for a table.                                                                              |
| `sqlite_append_insight`         | `sqlite.admin.appendInsight`        | Add a business insight to the `memo://insights` resource. Use this to capture key findings during data analysis.          |
| `sqlite_generate_series`        | `sqlite.admin.generateSeries`       | Generate a series of numbers using `generate_series()` virtual table.                                                     |
| `sqlite_create_view`            | `sqlite.admin.createView`           | Create a view based on a SELECT query.                                                                                    |
| `sqlite_list_views`             | `sqlite.admin.listViews`            | List all views in the database.                                                                                           |
| `sqlite_drop_view`              | `sqlite.admin.dropView`             | Drop (delete) a view from the database.                                                                                   |
| `sqlite_dbstat`                 | `sqlite.admin.dbstat`               | Get database storage statistics using dbstat virtual table.                                                               |
| `sqlite_vacuum`                 | `sqlite.admin.vacuum`               | Rebuild the database to reclaim space and optimize structure.                                                             |
| `sqlite_list_virtual_tables`    | `sqlite.admin.listVirtualTables`    | List all virtual tables in the database.                                                                                  |
| `sqlite_virtual_table_info`     | `sqlite.admin.virtualTableInfo`     | Get metadata about a specific virtual table.                                                                              |
| `sqlite_drop_virtual_table`     | `sqlite.admin.dropVirtualTable`     | Drop a virtual table.                                                                                                     |
| `sqlite_create_csv_table`       | `sqlite.admin.createCsvTable`       | Create a virtual table from a CSV file. Requires the csv extension.                                                       |
| `sqlite_analyze_csv_schema`     | `sqlite.admin.analyzeCsvSchema`     | Analyze a CSV file structure and infer column types. Uses a temporary virtual table.                                      |
| `sqlite_create_rtree_table`     | `sqlite.admin.createRtreeTable`     | Create an R-Tree virtual table for spatial indexing. Supports 2–5 dimensions.                                             |
| `sqlite_create_series_table`    | `sqlite.admin.createSeriesTable`    | Create a table populated with a series of numbers. Unlike `generate_series`, this creates a persistent table.             |
| `sqlite_attach_database`        | `sqlite.admin.attachDatabase`       | Attach an external SQLite database file under a schema alias. Restricted to same directory as primary database.           |
| `sqlite_detach_database`        | `sqlite.admin.detachDatabase`       | Detach a previously attached database by its schema alias. Cannot detach 'main' or 'temp'.                                |
| `sqlite_vacuum_into`            | `sqlite.admin.vacuumInto`           | Create a compacted, defragmented copy of the database using VACUUM INTO. Does not modify the original.                    |
| `sqlite_dump`                   | `sqlite.admin.dump`                 | Export the database schema and data as a SQL text dump to a specified file. `[NATIVE ONLY]`                               |
| `sqlite_reindex`                | `sqlite.admin.reindex`              | Rebuild indexes targeting a specific index, table, or the entire database.                                                |
| `sqlite_wal`                    | `sqlite.admin.wal`                  | WAL mode management: check status, enable/disable WAL mode, or run checkpoints with configurable modes.                   |

### Server Audit Tools

> These tools manage pre-mutation DDL snapshots. They are not exposed in Code Mode.

| MCP Tool Name                 | Code Mode Name | Description                                                     |
| :---------------------------- | :------------- | :-------------------------------------------------------------- |
| `sqlite_audit_list_backups`   | —              | List all available schema audit snapshots.                      |
| `sqlite_audit_get_backup`     | —              | Retrieve the contents of a specific audit snapshot by filename. |
| `sqlite_audit_diff_backup`    | —              | Compare an audit snapshot against the live database schema.     |
| `sqlite_audit_restore_backup` | —              | Restore schema from an audit snapshot with dry-run support.     |
| `sqlite_audit_cleanup`        | —              | Enforce retention policy and remove expired audit snapshots.    |

---

## transactions (8 Native tools + Code Mode)

Transaction control — begin, commit, rollback, savepoints, and atomic multi-statement execution.

| MCP Tool Name                    | Code Mode Name                   | Description                                                                                                                       |
| :------------------------------- | :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_transaction_begin`       | `sqlite.transactions.begin`      | Begin a new transaction. Use immediate or exclusive mode for write-heavy operations. `[NATIVE ONLY]`                              |
| `sqlite_transaction_status`      | `sqlite.transactions.status`     | Check whether a transaction is currently active. Returns status and a boolean flag. Read-only. `[NATIVE ONLY]`                    |
| `sqlite_transaction_commit`      | `sqlite.transactions.commit`     | Commit the current transaction, making all changes permanent. `[NATIVE ONLY]`                                                     |
| `sqlite_transaction_rollback`    | `sqlite.transactions.rollback`   | Rollback the current transaction, discarding all changes. `[NATIVE ONLY]`                                                         |
| `sqlite_transaction_savepoint`   | `sqlite.transactions.savepoint`  | Create a savepoint within the current transaction for partial rollback. `[NATIVE ONLY]`                                           |
| `sqlite_transaction_release`     | `sqlite.transactions.release`    | Release a savepoint, keeping the changes made since it was created. `[NATIVE ONLY]`                                               |
| `sqlite_transaction_rollback_to` | `sqlite.transactions.rollbackTo` | Rollback to a savepoint, discarding changes made after it was created. `[NATIVE ONLY]`                                            |
| `sqlite_transaction_execute`     | `sqlite.transactions.execute`    | Execute multiple SQL statements in a single transaction. Automatically commits on success or rolls back on error. `[NATIVE ONLY]` |

---

## geo (11 Native / 4 WASM tools + Code Mode)

Geospatial operations — Haversine distance/radius queries and SpatiaLite advanced GIS.

| MCP Tool Name                    | Code Mode Name                     | Description                                                                                                       |
| :------------------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `sqlite_geo_distance`            | `sqlite.geo.distance`              | Calculate the distance between two geographic points using Haversine formula.                                     |
| `sqlite_geo_nearby`              | `sqlite.geo.nearby`                | Find points within a radius of a center point.                                                                    |
| `sqlite_geo_bounding_box`        | `sqlite.geo.boundingBox`           | Find points within a rectangular bounding box.                                                                    |
| `sqlite_geo_cluster`             | `sqlite.geo.cluster`               | Cluster geographic points into grid cells.                                                                        |
| `sqlite_spatialite_load`         | `sqlite.geo.spatialiteLoad`        | Load SpatiaLite extension for geospatial capabilities. Required before using other spatial tools. `[NATIVE ONLY]` |
| `sqlite_spatialite_create_table` | `sqlite.geo.spatialiteCreateTable` | Create a spatial table with geometry column using SpatiaLite. `[NATIVE ONLY]`                                     |
| `sqlite_spatialite_query`        | `sqlite.geo.spatialiteQuery`       | Execute spatial SQL queries using SpatiaLite functions (`ST_Distance`, `ST_Within`, etc.). `[NATIVE ONLY]`        |
| `sqlite_spatialite_analyze`      | `sqlite.geo.spatialiteAnalyze`     | Perform spatial analysis: nearest neighbor, point in polygon, distance matrix. `[NATIVE ONLY]`                    |
| `sqlite_spatialite_index`        | `sqlite.geo.spatialiteIndex`       | Create, drop, or check spatial R-Tree index on geometry column. `[NATIVE ONLY]`                                   |
| `sqlite_spatialite_transform`    | `sqlite.geo.spatialiteTransform`   | Perform geometry operations: buffer, intersection, union, centroid, simplify. `[NATIVE ONLY]`                     |
| `sqlite_spatialite_import`       | `sqlite.geo.spatialiteImport`      | Import geometry data from WKT or GeoJSON into a spatial table. `[NATIVE ONLY]`                                    |

---

## introspection (10 tools + Code Mode)

Read-only schema analysis — dependency graphs, cascade simulation, diagnostics, and migration risk assessment.

| MCP Tool Name                | Code Mode Name                            | Description                                                                                                                                                                                      |
| :--------------------------- | :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_dependency_graph`    | `sqlite.introspection.dependencyGraph`    | Build a foreign key dependency graph showing relationships between all tables. Returns nodes (tables), edges (FK references), circular dependency detection, and root/leaf table identification. |
| `sqlite_topological_sort`    | `sqlite.introspection.topologicalSort`    | Generate a safe DDL execution order for tables based on foreign key dependencies. `create` direction lists parent tables first; `drop` direction lists child tables first.                       |
| `sqlite_cascade_simulator`   | `sqlite.introspection.cascadeSimulator`   | Simulate the impact of a DELETE, DROP, or TRUNCATE on a table. Shows which tables would be affected through cascading foreign key actions, with severity scoring.                                |
| `sqlite_schema_snapshot`     | `sqlite.introspection.schemaSnapshot`     | Generate a comprehensive snapshot of the database schema — tables, views, indexes, and triggers — in a single call.                                                                              |
| `sqlite_schema_diff`         | `sqlite.introspection.schemaDiff`         | Compare two schema snapshots and report structured drift — added, removed, and modified tables, views, indexes, and triggers. Accepts 'current' for live DB or inline snapshot objects.          |
| `sqlite_constraint_analysis` | `sqlite.introspection.constraintAnalysis` | Analyze database schema for constraint health issues: missing primary keys, columns that should be NOT NULL, foreign keys without indexes, and tables that could benefit from FK relationships.  |
| `sqlite_migration_risks`     | `sqlite.introspection.migrationRisks`     | Analyze DDL statements for SQLite-specific migration risks. Detects ALTER TABLE limitations, large table operations, column type changes, destructive operations, and FTS5 rebuild requirements. |
| `sqlite_storage_analysis`    | `sqlite.introspection.storageAnalysis`    | Analyze database storage health: fragmentation, size breakdown per table, and optimization recommendations.                                                                                      |
| `sqlite_index_audit`         | `sqlite.introspection.indexAudit`         | Audit index effectiveness: find redundant indexes (prefix duplicates), missing foreign key indexes, and large tables without secondary indexes. Can recommend composite indexes for specific queries. Returns actionable suggestions.                  |
| `sqlite_query_plan`          | `sqlite.introspection.queryPlan`          | Analyze a SQL query's execution plan. Returns structured EXPLAIN QUERY PLAN output with scan-type classification and optimization suggestions.                                                   |

---

## migration (6 tools + Code Mode)

Schema migration tracking — initialize, record, apply, rollback, and audit migrations with SHA-256 deduplication.

| MCP Tool Name               | Code Mode Name                       | Description                                                                                                                                                              |
| :-------------------------- | :----------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_migration_init`     | `sqlite.migration.migrationInit`     | Initialize the migration tracking system by creating the `_mcp_migrations` table. Safe to call multiple times — idempotent.                                              |
| `sqlite_migration_record`   | `sqlite.migration.migrationRecord`   | Record a migration that was applied externally (not executed by this tool). Uses SHA-256 hashing for dedup — duplicate SQL blocks are rejected.                          |
| `sqlite_migration_apply`    | `sqlite.migration.migrationApply`    | Execute migration SQL and record it atomically. If the SQL fails, no record is created. Uses SHA-256 hashing for dedup.                                                  |
| `sqlite_migration_rollback` | `sqlite.migration.migrationRollback` | Roll back a migration by ID or version. Requires that rollback SQL was recorded with the migration. Supports dry-run mode to preview the rollback SQL without executing. |
| `sqlite_migration_history`  | `sqlite.migration.migrationHistory`  | Query migration history with optional filters by status and source system. Supports pagination.                                                                          |
| `sqlite_migration_status`   | `sqlite.migration.migrationStatus`   | Get a summary of migration tracking state — latest version, counts by status, and unique source systems.                                                                 |

---

## outputSchema Registry

Every tool in db-mcp has a mandatory `outputSchema` defined via Zod. The Vitest invariant test (`tests/adapters/tool-output-schemas.test.ts`) enforces this — adding a tool without an outputSchema will fail CI.

All schemas are centralized in `src/adapters/sqlite/schemas/` with named exports. **No inline `z.object()` definitions** exist in handler files.

| Schema File        | Groups                       | Key Schemas                                                                                                                                                                                                                                                                                                                     |
| :----------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core.ts`          | core                         | `ReadQueryOutputSchema`, `WriteQueryOutputSchema`, `CreateTableOutputSchema`, `ListTablesOutputSchema`, `DescribeTableOutputSchema`, `DropTableOutputSchema`, `GetIndexesOutputSchema`, `CreateIndexOutputSchema`, `DropIndexOutputSchema`, `ListTriggersOutputSchema`, `ListConstraintsOutputSchema`, `DateMathOutputSchema`   |
| `json.ts`          | json                         | `JsonDiffOutputSchema` + schemas for all 25 JSON tools                                                                                                                                                                                                                                                                          |
| `text.ts`          | text                         | `TextConcatOutputSchema`, `TextTrimOutputSchema`, `TextCaseOutputSchema`, `TextSubstringOutputSchema`, `AdvancedSearchOutputSchema`, `HybridSearchOutputSchema` + schemas for all 15 text tools                                                                                                                                                             |
| `fts.ts`           | text (FTS5)                  | `FtsCreateOutputSchema`, `FtsSearchOutputSchema`, `FtsRebuildOutputSchema`                                                                                                                                                                                                                                                      |
| `stats.ts`         | stats                        | `StatsBasicOutputSchema`, `StatsCountOutputSchema`, `StatsGroupByOutputSchema`, `StatsHistogramOutputSchema`, `StatsPercentileOutputSchema`, `StatsCorrelationOutputSchema`, `StatsHypothesisOutputSchema`, `StatsDetectAnomaliesOutputSchema`, `StatsDetectBloatOutputSchema`, `StatsDetectSchemaRisksOutputSchema`            |
| `vector.ts`        | vector                       | `VectorSearchOutputSchema`, `VectorStoreOutputSchema`, `VectorBatchStoreOutputSchema`, `VectorGetOutputSchema`, `VectorDeleteOutputSchema`, `VectorCountOutputSchema`, `VectorStatsOutputSchema`, `VectorDimensionsOutputSchema`, `VectorNormalizeOutputSchema`, `VectorDistanceOutputSchema`                                   |
| `geo.ts`           | geo                          | Schemas for all 4 geo tools                                                                                                                                                                                                                                                                                                     |
| `admin.ts`         | admin                        | `BackupOutputSchema`, `RestoreOutputSchema`, `VerifyBackupOutputSchema`, `AnalyzeOutputSchema`, `OptimizeOutputSchema`, `IntegrityCheckOutputSchema`, `PragmaSettingsOutputSchema`, `AppendInsightOutputSchema`, `DbstatOutputSchema`, `AttachDatabaseOutputSchema`, `DetachDatabaseOutputSchema`, `VacuumIntoCopyOutputSchema` |
| `virtual.ts`       | admin (virtual)              | `ListVirtualTablesOutputSchema`, `VirtualTableInfoOutputSchema`, `DropVirtualTableOutputSchema`, `CreateCsvTableOutputSchema`, `AnalyzeCsvSchemaOutputSchema`, `CreateRtreeTableOutputSchema`, `CreateSeriesTableOutputSchema`                                                                                                  |
| `introspection.ts` | introspection                | `DependencyGraphOutputSchema`, `TopologicalSortOutputSchema`, `CascadeSimulatorOutputSchema`, `SchemaSnapshotOutputSchema`, `SchemaDiffOutputSchema`, `ConstraintAnalysisOutputSchema`, `MigrationRisksOutputSchema`, `StorageAnalysisOutputSchema`, `IndexAuditOutputSchema`, `QueryPlanOutputSchema`                          |
| `migration.ts`     | migration                    | `MigrationInitOutputSchema`, `MigrationRecordOutputSchema`, `MigrationApplyOutputSchema`, `MigrationRollbackOutputSchema`, `MigrationHistoryOutputSchema`, `MigrationStatusOutputSchema`                                                                                                                                        |
| `native.ts`        | transactions, stats (window) | `TransactionBeginOutputSchema` … `TransactionExecuteOutputSchema` (8 schemas), `WindowRowNumberOutputSchema` … `WindowNtileOutputSchema` (6 schemas)                                                                                                                                                                            |
| `spatialite.ts`    | geo (SpatiaLite)             | `SpatialiteLoadOutputSchema` … `SpatialiteImportOutputSchema` (7 schemas)                                                                                                                                                                                                                                                       |
| `codemode.ts`      | codemode                     | `ExecuteCodeOutputSchema`                                                                                                                                                                                                                                                                                                       |
| `common.ts`        | _(shared)_                   | `RowRecordSchema` — base row shape                                                                                                                                                                                                                                                                                              |
| `error-mixin.ts`   | _(shared)_                   | `ErrorFieldsMixin` — 6 optional error fields merged into all output schemas                                                                                                                                                                                                                                                     |
