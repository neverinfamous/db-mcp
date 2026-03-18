# Tool Reference

Complete reference of all **139 Native / 115 WASM tools** organized by 9 tool groups + codemode. Each group automatically includes Code Mode (`sqlite_execute_code`) for token-efficient operations.

> **3 built-in tools** (`server_info`, `server_health`, `list_adapters`) are always available regardless of filter settings.
>
> Use [Tool Filtering](#️-tool-filtering) to select the groups you need. See [Code Mode](#-recommended-code-mode-maximum-token-savings) for the `sqlite.*` API that exposes every tool below through sandboxed JavaScript.

---

## codemode (1 tool)

Sandboxed JavaScript execution that exposes all 9 tool groups through the `sqlite.*` API.

| Tool                  | Description                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_execute_code` | Execute JavaScript in a sandboxed environment with access to all SQLite tools via the `sqlite.*` API. Enables complex multi-step operations in a single call with 70–90% token savings. |

---

## core (9 tools + Code Mode)

Read/write queries, table and index management, and schema discovery.

| Tool                    | Description                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `sqlite_read_query`     | Execute a SELECT query on the SQLite database. Returns rows as JSON. Use parameter binding for safety.    |
| `sqlite_write_query`    | Execute an INSERT, UPDATE, or DELETE query. Returns affected row count. Use parameter binding for safety. |
| `sqlite_list_tables`    | List all tables and views in the database with their column counts.                                       |
| `sqlite_describe_table` | Get detailed schema information for a table including columns, types, and constraints.                    |
| `sqlite_create_table`   | Create a new table in the database with specified columns and constraints.                                |
| `sqlite_drop_table`     | Drop (delete) a table from the database. This is irreversible!                                            |
| `sqlite_get_indexes`    | List all indexes in the database, optionally filtered by table.                                           |
| `sqlite_create_index`   | Create an index on one or more columns to improve query performance.                                      |
| `sqlite_drop_index`     | Drop (delete) an index from the database.                                                                 |

---

## json (23 tools + Code Mode)

Comprehensive JSON manipulation — read, write, transform, validate, and analyze JSON documents stored in SQLite.

| Tool                            | Description                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `sqlite_json_insert`            | Insert a row with JSON data. Automatically normalizes JSON for consistent storage.                                   |
| `sqlite_json_update`            | Update a value at a specific JSON path using `json_set()`.                                                           |
| `sqlite_json_select`            | Select rows and optionally extract specific JSON paths.                                                              |
| `sqlite_json_query`             | Query JSON data with path-based filters and projections.                                                             |
| `sqlite_json_validate_path`     | Validate a JSON path syntax without executing a query.                                                               |
| `sqlite_json_merge`             | Merge JSON object into existing JSON column using `json_patch()`.                                                    |
| `sqlite_json_analyze_schema`    | Analyze JSON data in a column to infer its schema (types, nullability, counts).                                      |
| `sqlite_create_json_collection` | Create an optimized JSON document collection table with ID, data column, optional timestamps, and JSON path indexes. |
| `sqlite_json_valid`             | Check if a string is valid JSON.                                                                                     |
| `sqlite_json_extract`           | Extract a value from a JSON column at the specified path using `json_extract()`.                                     |
| `sqlite_json_set`               | Set a value at a JSON path using `json_set()`. Creates path if it does not exist.                                    |
| `sqlite_json_remove`            | Remove a value at a JSON path using `json_remove()`.                                                                 |
| `sqlite_json_type`              | Get the JSON type (null, true, false, integer, real, text, array, object) at a path.                                 |
| `sqlite_json_array_length`      | Get the length of a JSON array at the specified path.                                                                |
| `sqlite_json_array_append`      | Append a value to a JSON array using `json_insert()`.                                                                |
| `sqlite_json_keys`              | Get the distinct keys of JSON objects at the specified path (returns unique keys across all matching rows).          |
| `sqlite_json_each`              | Expand a JSON array or object into rows using `json_each()`.                                                         |
| `sqlite_json_group_array`       | Aggregate column values into a JSON array using `json_group_array()`.                                                |
| `sqlite_json_group_object`      | Aggregate key-value pairs into a JSON object using `json_group_object()`.                                            |
| `sqlite_json_pretty`            | Format JSON string with indentation for readability.                                                                 |
| `sqlite_jsonb_convert`          | Convert a text JSON column to JSONB binary format for faster processing. Requires SQLite 3.45+.                      |
| `sqlite_json_storage_info`      | Analyze storage format of a JSON column (text vs JSONB) and report statistics.                                       |
| `sqlite_json_normalize_column`  | Normalize JSON data in a column (sort keys, compact format) for consistent storage and comparison.                   |

---

## text (17 Native / 13 WASM tools + Code Mode)

Text processing, regex, fuzzy matching, phonetic search, and FTS5 full-text search.

| Tool                     | Description                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_regex_extract`   | Extract text matching a regex pattern. Processed in JavaScript after fetching data.                                                                                              |
| `sqlite_regex_match`     | Find rows where column matches a regex pattern. Processed in JavaScript.                                                                                                         |
| `sqlite_text_split`      | Split a text column by delimiter into array results.                                                                                                                             |
| `sqlite_text_concat`     | Concatenate multiple columns with optional separator.                                                                                                                            |
| `sqlite_text_replace`    | Replace text in a column using SQLite `replace()` function.                                                                                                                      |
| `sqlite_text_trim`       | Trim whitespace from text column values.                                                                                                                                         |
| `sqlite_text_case`       | Convert text to uppercase or lowercase.                                                                                                                                          |
| `sqlite_text_substring`  | Extract a substring from text column using `substr()`.                                                                                                                           |
| `sqlite_fuzzy_match`     | Find fuzzy matches using Levenshtein distance. Splits values into tokens by default (`tokenize: false` to match entire value). Use `maxDistance` 1–3 for similar-length strings. |
| `sqlite_phonetic_match`  | Find phonetically similar values using Soundex (SQLite native) or Metaphone algorithm.                                                                                           |
| `sqlite_text_normalize`  | Normalize text using Unicode normalization (NFC, NFD, NFKC, NFKD) or strip accents.                                                                                              |
| `sqlite_text_validate`   | Validate text values against patterns: email, phone, URL, UUID, IPv4, or custom regex.                                                                                           |
| `sqlite_advanced_search` | Advanced search combining exact, fuzzy (Levenshtein), and phonetic (Soundex) matching.                                                                                           |
| `sqlite_fts_create`      | Create an FTS5 full-text search virtual table. `[NATIVE ONLY]`                                                                                                                   |
| `sqlite_fts_search`      | Search an FTS5 table using full-text query syntax. `[NATIVE ONLY]`                                                                                                               |
| `sqlite_fts_rebuild`     | Rebuild an FTS5 index to optimize search performance. `[NATIVE ONLY]`                                                                                                            |
| `sqlite_fts_match_info`  | Get FTS5 match ranking information using bm25. `[NATIVE ONLY]`                                                                                                                   |

---

## stats (19 Native / 13 WASM tools + Code Mode)

Statistical analysis — descriptive stats, percentiles, correlation, regression, distributions, and window functions.

| Tool                          | Description                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `sqlite_stats_basic`          | Get basic statistics (count, sum, avg, min, max) for a numeric column.                                                  |
| `sqlite_stats_count`          | Count rows, optionally distinct values in a column.                                                                     |
| `sqlite_stats_group_by`       | Aggregate statistics grouped by a column.                                                                               |
| `sqlite_stats_histogram`      | Create a histogram with specified number of buckets.                                                                    |
| `sqlite_stats_percentile`     | Calculate percentiles (median, quartiles, etc.) for a column.                                                           |
| `sqlite_stats_correlation`    | Calculate Pearson correlation coefficient between two numeric columns.                                                  |
| `sqlite_stats_top_n`          | Get top N values from a column.                                                                                         |
| `sqlite_stats_distinct`       | Get distinct values from a column.                                                                                      |
| `sqlite_stats_summary`        | Get summary statistics for multiple columns at once.                                                                    |
| `sqlite_stats_frequency`      | Get frequency distribution of values in a column.                                                                       |
| `sqlite_stats_outliers`       | Detect outliers using IQR (Interquartile Range) or Z-score method.                                                      |
| `sqlite_stats_regression`     | Perform linear or polynomial regression analysis between two columns.                                                   |
| `sqlite_stats_hypothesis`     | Perform statistical hypothesis tests: one-sample t-test, two-sample t-test, or chi-square test.                         |
| `sqlite_window_row_number`    | Assign sequential row numbers based on ordering. Useful for pagination and ranking. `[NATIVE ONLY]`                     |
| `sqlite_window_rank`          | Calculate rank of rows. RANK leaves gaps after ties, DENSE_RANK does not, PERCENT_RANK gives 0–1 range. `[NATIVE ONLY]` |
| `sqlite_window_lag_lead`      | Access previous (LAG) or next (LEAD) row values. Useful for comparing consecutive rows. `[NATIVE ONLY]`                 |
| `sqlite_window_running_total` | Calculate running (cumulative) total. Useful for balance tracking, cumulative metrics. `[NATIVE ONLY]`                  |
| `sqlite_window_moving_avg`    | Calculate moving (rolling) average. Useful for smoothing time series data. `[NATIVE ONLY]`                              |
| `sqlite_window_ntile`         | Divide rows into N buckets. E.g., 4 buckets = quartiles, 10 = deciles, 100 = percentiles. `[NATIVE ONLY]`               |

---

## vector (11 tools + Code Mode)

Vector storage, similarity search, and distance calculations for embeddings and AI/ML operations.

| Tool                         | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| `sqlite_vector_create_table` | Create a table optimized for vector storage with JSON vector column.     |
| `sqlite_vector_store`        | Store or update a vector in the database.                                |
| `sqlite_vector_batch_store`  | Store multiple vectors in a batch operation.                             |
| `sqlite_vector_search`       | Find similar vectors using cosine, euclidean, or dot product similarity. |
| `sqlite_vector_get`          | Retrieve a vector by its ID.                                             |
| `sqlite_vector_delete`       | Delete vectors by their IDs.                                             |
| `sqlite_vector_count`        | Count vectors in a table.                                                |
| `sqlite_vector_stats`        | Get statistics about vectors in a table.                                 |
| `sqlite_vector_dimensions`   | Get the dimensions of vectors in a table.                                |
| `sqlite_vector_normalize`    | Normalize a vector to unit length.                                       |
| `sqlite_vector_distance`     | Calculate distance or similarity between two vectors.                    |

---

## admin (33 Native / 26 WASM tools + Code Mode)

Database maintenance — backup/restore, PRAGMA, views, virtual tables, and transaction control.

| Tool                             | Description                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_backup`                  | Create a backup of the database to a file.                                                                                        |
| `sqlite_analyze`                 | Analyze table statistics to improve query performance.                                                                            |
| `sqlite_integrity_check`         | Check database integrity for corruption or errors.                                                                                |
| `sqlite_optimize`                | Optimize database by reindexing and/or analyzing.                                                                                 |
| `sqlite_restore`                 | Restore database from a backup file. WARNING: This replaces the current database.                                                 |
| `sqlite_verify_backup`           | Verify a backup file's integrity without restoring it.                                                                            |
| `sqlite_index_stats`             | Get detailed statistics for database indexes.                                                                                     |
| `sqlite_pragma_compile_options`  | Get the compile-time options used to build SQLite. Use the `filter` parameter to reduce output (~50+ options by default).         |
| `sqlite_pragma_database_list`    | List all attached databases.                                                                                                      |
| `sqlite_pragma_optimize`         | Run `PRAGMA optimize` to improve query performance based on usage patterns.                                                       |
| `sqlite_pragma_settings`         | Get or set a PRAGMA value.                                                                                                        |
| `sqlite_pragma_table_info`       | Get detailed column information for a table.                                                                                      |
| `sqlite_append_insight`          | Add a business insight to the `memo://insights` resource. Use this to capture key findings during data analysis.                  |
| `sqlite_generate_series`         | Generate a series of numbers using `generate_series()` virtual table.                                                             |
| `sqlite_create_view`             | Create a view based on a SELECT query.                                                                                            |
| `sqlite_list_views`              | List all views in the database.                                                                                                   |
| `sqlite_drop_view`               | Drop (delete) a view from the database.                                                                                           |
| `sqlite_dbstat`                  | Get database storage statistics using dbstat virtual table.                                                                       |
| `sqlite_vacuum`                  | Rebuild the database to reclaim space and optimize structure.                                                                     |
| `sqlite_list_virtual_tables`     | List all virtual tables in the database.                                                                                          |
| `sqlite_virtual_table_info`      | Get metadata about a specific virtual table.                                                                                      |
| `sqlite_drop_virtual_table`      | Drop a virtual table.                                                                                                             |
| `sqlite_create_csv_table`        | Create a virtual table from a CSV file. Requires the csv extension.                                                               |
| `sqlite_analyze_csv_schema`      | Analyze a CSV file structure and infer column types. Uses a temporary virtual table.                                              |
| `sqlite_create_rtree_table`      | Create an R-Tree virtual table for spatial indexing. Supports 2–5 dimensions.                                                     |
| `sqlite_create_series_table`     | Create a table populated with a series of numbers. Unlike `generate_series`, this creates a persistent table.                     |
| `sqlite_transaction_begin`       | Begin a new transaction. Use immediate or exclusive mode for write-heavy operations. `[NATIVE ONLY]`                              |
| `sqlite_transaction_commit`      | Commit the current transaction, making all changes permanent. `[NATIVE ONLY]`                                                     |
| `sqlite_transaction_rollback`    | Rollback the current transaction, discarding all changes. `[NATIVE ONLY]`                                                         |
| `sqlite_transaction_savepoint`   | Create a savepoint within the current transaction for partial rollback. `[NATIVE ONLY]`                                           |
| `sqlite_transaction_release`     | Release a savepoint, keeping the changes made since it was created. `[NATIVE ONLY]`                                               |
| `sqlite_transaction_rollback_to` | Rollback to a savepoint, discarding changes made after it was created. `[NATIVE ONLY]`                                            |
| `sqlite_transaction_execute`     | Execute multiple SQL statements in a single transaction. Automatically commits on success or rolls back on error. `[NATIVE ONLY]` |

---

## geo (11 Native / 4 WASM tools + Code Mode)

Geospatial operations — Haversine distance/radius queries and SpatiaLite advanced GIS.

| Tool                             | Description                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `sqlite_geo_distance`            | Calculate the distance between two geographic points using Haversine formula.                                     |
| `sqlite_geo_nearby`              | Find points within a radius of a center point.                                                                    |
| `sqlite_geo_bounding_box`        | Find points within a rectangular bounding box.                                                                    |
| `sqlite_geo_cluster`             | Cluster geographic points into grid cells.                                                                        |
| `sqlite_spatialite_load`         | Load SpatiaLite extension for geospatial capabilities. Required before using other spatial tools. `[NATIVE ONLY]` |
| `sqlite_spatialite_create_table` | Create a spatial table with geometry column using SpatiaLite. `[NATIVE ONLY]`                                     |
| `sqlite_spatialite_query`        | Execute spatial SQL queries using SpatiaLite functions (`ST_Distance`, `ST_Within`, etc.). `[NATIVE ONLY]`        |
| `sqlite_spatialite_analyze`      | Perform spatial analysis: nearest neighbor, point in polygon, distance matrix. `[NATIVE ONLY]`                    |
| `sqlite_spatialite_index`        | Create, drop, or check spatial R-Tree index on geometry column. `[NATIVE ONLY]`                                   |
| `sqlite_spatialite_transform`    | Perform geometry operations: buffer, intersection, union, centroid, simplify. `[NATIVE ONLY]`                     |
| `sqlite_spatialite_import`       | Import geometry data from WKT or GeoJSON into a spatial table. `[NATIVE ONLY]`                                    |

---

## introspection (9 tools + Code Mode)

Read-only schema analysis — dependency graphs, cascade simulation, diagnostics, and migration risk assessment.

| Tool                         | Description                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sqlite_dependency_graph`    | Build a foreign key dependency graph showing relationships between all tables. Returns nodes (tables), edges (FK references), circular dependency detection, and root/leaf table identification. |
| `sqlite_topological_sort`    | Generate a safe DDL execution order for tables based on foreign key dependencies. `create` direction lists parent tables first; `drop` direction lists child tables first.                       |
| `sqlite_cascade_simulator`   | Simulate the impact of a DELETE, DROP, or TRUNCATE on a table. Shows which tables would be affected through cascading foreign key actions, with severity scoring.                                |
| `sqlite_schema_snapshot`     | Generate a comprehensive snapshot of the database schema — tables, views, indexes, and triggers — in a single call.                                                                              |
| `sqlite_constraint_analysis` | Analyze database schema for constraint health issues: missing primary keys, columns that should be NOT NULL, foreign keys without indexes, and tables that could benefit from FK relationships.  |
| `sqlite_migration_risks`     | Analyze DDL statements for SQLite-specific migration risks. Detects ALTER TABLE limitations, large table operations, column type changes, destructive operations, and FTS5 rebuild requirements. |
| `sqlite_storage_analysis`    | Analyze database storage health: fragmentation, size breakdown per table, and optimization recommendations.                                                                                      |
| `sqlite_index_audit`         | Audit index effectiveness: find redundant indexes (prefix duplicates), missing foreign key indexes, and large tables without secondary indexes. Returns actionable suggestions.                  |
| `sqlite_query_plan`          | Analyze a SQL query's execution plan. Returns structured EXPLAIN QUERY PLAN output with scan-type classification and optimization suggestions.                                                   |

---

## migration (6 tools + Code Mode)

Schema migration tracking — initialize, record, apply, rollback, and audit migrations with SHA-256 deduplication.

| Tool                        | Description                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sqlite_migration_init`     | Initialize the migration tracking system by creating the `_mcp_migrations` table. Safe to call multiple times — idempotent.                                              |
| `sqlite_migration_record`   | Record a migration that was applied externally (not executed by this tool). Uses SHA-256 hashing for dedup — duplicate SQL blocks are rejected.                          |
| `sqlite_migration_apply`    | Execute migration SQL and record it atomically. If the SQL fails, no record is created. Uses SHA-256 hashing for dedup.                                                  |
| `sqlite_migration_rollback` | Roll back a migration by ID or version. Requires that rollback SQL was recorded with the migration. Supports dry-run mode to preview the rollback SQL without executing. |
| `sqlite_migration_history`  | Query migration history with optional filters by status and source system. Supports pagination.                                                                          |
| `sqlite_migration_status`   | Get a summary of migration tracking state — latest version, counts by status, and unique source systems.                                                                 |
