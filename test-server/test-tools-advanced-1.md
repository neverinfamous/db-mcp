# Advanced Stress Test — db-mcp (SQLite)

**Test WASM Mode Only. Ignore Native content**

**Step 1:** Read `server-instructions.ts` and `src/constants/server-instructions/gotchas.md` using `view_file` (not grep or search) to understand documented behaviors, edge cases, and response structures.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode), not scripts/terminal.

**Note**: If your attempt to cleanup after testing fails, it's because the database is locked. Move on. I will drop them.

## Code Mode Execution

All tests should be executed via `sqlite_execute_code` code mode. Tests are written in direct tool call syntax for readability — translate to code mode:

| Direct Tool Call                                          | Code Mode Equivalent                                          |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| `sqlite_read_query({query: "..."})`                       | `sqlite.core.readQuery({query: "..."})`                       |
| `sqlite_write_query({query: "..."})`                      | `sqlite.core.writeQuery({query: "..."})`                      |
| `sqlite_create_table({tableName: "...", columns: [...]})` | `sqlite.core.createTable({tableName: "...", columns: [...]})` |
| `sqlite_describe_table({tableName: "..."})`               | `sqlite.core.describeTable({tableName: "..."})`               |
| `sqlite_drop_table({tableName: "..."})`                   | `sqlite.core.dropTable({tableName: "..."})`                   |
| `sqlite_create_index({...})`                              | `sqlite.core.createIndex({...})`                              |
| `sqlite_get_indexes({tableName: "..."})`                  | `sqlite.core.getIndexes({tableName: "..."})`                  |
| `sqlite_json_*({...})`                                    | `sqlite.json.*({...})`                                        |
| `sqlite_text_*` / `sqlite_regex_*` / etc.                 | `sqlite.text.*`                                               |
| `sqlite_stats_*` / `sqlite_window_*`                      | `sqlite.stats.*`                                              |
| `sqlite_vector_*`                                         | `sqlite.vector.*`                                             |
| `sqlite_fts_*`                                            | `sqlite.text.*` (FTS tools are in the text group)             |

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
- **Cleanup**: Attempt to remove all `temp_*` tables. If DROP fails due to a database lock, note the leftover tables and move on — they are inert and will be cleaned up on next database regeneration

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB and suggest a concrete optimization (e.g., filter system tables, add `compact` option, omit empty arrays).
- ✅ Confirmed: Edge case handled correctly (use only inline during testing; omit from Final Summary)

### Error Code Consistency

When rating errors, flag any generic code (`RESOURCE_ERROR`, `UNKNOWN_ERROR`) that should be a specific code (e.g., `TABLE_NOT_FOUND`, `COLUMN_NOT_FOUND`, `VALIDATION_ERROR`). These are fixable in `src/utils/errors/` (see `suggestions.ts` and `classes.ts`) by adding a `code` override to the matching error class. Treat as ⚠️ Issue and include in fix plan.

## Post-Test Procedures

At the end, confirm cleanup of all `stress_*` objects, then **fix every finding** — not just ❌ Fails, but also ⚠️ Issues (behavioral improvements, missing warnings, error code consistency) and 📦 Payload problems (responses that should be truncated or offer a `limit` param). Create a plan covering all finding architecturally consistent with other tools/tool groups. If the plan does not require important decision choices, proceed with implementation. When complete, update the changelog (being careful not to create duplicate headers), and commit without pushing. Then re-test your fixes with direct MCP calls.

---

## core Group Advanced Tests

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### core Group Tools (9)

4. sqlite_read_query
5. sqlite_write_query
6. sqlite_create_table
7. sqlite_list_tables
8. sqlite_describe_table
9. sqlite_drop_table
10. sqlite_get_indexes
11. sqlite_create_index
12. sqlite_drop_index

### Category 1: Boundary Values & Empty States

**1.1 Empty Table Operations**

Create `stress_empty_table (id INTEGER PRIMARY KEY, name TEXT, value REAL)`, then test:

1. `sqlite_read_query({query: "SELECT COUNT(*) AS n FROM stress_empty_table"})` → `{rows: [{n: 0}]}`
2. `sqlite_describe_table({tableName: "stress_empty_table"})` → valid schema with 3 columns
3. `sqlite_get_indexes({tableName: "stress_empty_table"})` → empty or primary key only

**1.2 Single-Row Table**

Insert one row into `stress_empty_table`: `(1, 'solo', 42.0)`, then test:

4. `sqlite_read_query({query: "SELECT * FROM stress_empty_table"})` → exactly 1 row

**1.3 NULL-Heavy Data**

Insert 4 more rows: 3 with `name IS NULL AND value IS NULL`, 1 with actual values:

5. `sqlite_read_query({query: "SELECT COUNT(*) AS n FROM stress_empty_table WHERE value IS NULL"})` → `{rows: [{n: 3}]}`
6. `sqlite_read_query({query: "SELECT COUNT(value) AS n FROM stress_empty_table"})` → `{rows: [{n: 2}]}` (COUNT of non-null values)

### Category 2: State Pollution & Idempotency

**2.1 Create-Drop-Recreate Cycles**

7. `sqlite_create_table` → create `stress_cycle_table (id INTEGER PRIMARY KEY, data TEXT)`
8. `sqlite_create_index` → create `stress_idx_cycle` on `stress_cycle_table(data)`
9. `sqlite_drop_table({tableName: "stress_cycle_table"})` → success
10. `sqlite_drop_table({tableName: "stress_cycle_table"})` → expect structured error or `{existed: false}` (not a raw crash)
11. `sqlite_create_table` → recreate `stress_cycle_table` → success (no orphaned metadata)
12. Cleanup: drop `stress_cycle_table`

**2.2 Duplicate Object Detection**

13. `sqlite_create_table` with the table name `test_products` → expect error or "already exists" indication (not silent overwrite)
14. `sqlite_create_index` on `idx_orders_status` (already exists on `test_orders`) → expect error or "already exists" indication

### Category 3: Error Message Quality

For each test, verify the error returns a **structured response** (`{success: false, error: "..."}`) — NOT a raw MCP exception. Rate each error message: does it include enough context to diagnose the problem?

**3.1 Nonexistent Objects**

15. `sqlite_describe_table({tableName: "nonexistent_table_xyz"})` → error should mention table name
16. `sqlite_read_query({query: "SELECT * FROM nonexistent_table_xyz"})` → error should mention table name
17. `sqlite_get_indexes({tableName: "nonexistent_table_xyz"})` → report behavior
18. `sqlite_write_query({query: "INSERT INTO nonexistent_table_xyz VALUES (1)"})` → structured error

**3.2 Invalid SQL**

19. `sqlite_read_query({query: "SELEKT * FROM test_products"})` → structured error with SQL syntax context
20. `sqlite_write_query({query: "INSERT INTO test_products (nonexistent_col) VALUES (1)"})` → structured error mentioning column

**3.3 Type/Constraint Violations**

21. `sqlite_write_query({query: "INSERT INTO test_products (id) VALUES (1)"})` → duplicate primary key error (id=1 exists)

### Category 4: Large Payload & Truncation Verification

22. `sqlite_read_query({query: "SELECT * FROM test_measurements"})` → 200 rows — verify response size, check if truncation/limit is applied
23. `sqlite_read_query({query: "SELECT * FROM test_measurements LIMIT 5"})` → exactly 5 rows
24. `sqlite_read_query({query: "SELECT * FROM test_events"})` → 100 rows — check payload size

### Final Cleanup

Drop all `stress_*` tables created during testing and confirm `test_products` row count is still 16 (no pollution).

---

## json Group Advanced Tests

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### json Group Tools (23)

4. sqlite_json_valid
5. sqlite_json_extract
6. sqlite_json_set
7. sqlite_json_remove
8. sqlite_json_type
9. sqlite_json_array_length
10. sqlite_json_array_append
11. sqlite_json_keys
12. sqlite_json_each
13. sqlite_json_group_array
14. sqlite_json_group_object
15. sqlite_json_pretty
16. sqlite_jsonb_convert
17. sqlite_json_storage_info
18. sqlite_json_normalize_column
19. sqlite_json_insert
20. sqlite_json_update
21. sqlite_json_select
22. sqlite_json_query
23. sqlite_json_validate_path
24. sqlite_json_merge
25. sqlite_json_analyze_schema
26. sqlite_create_json_collection

### Category 1: Deep JSON Operations

**1.1 Deeply Nested Access**

1. `sqlite_json_extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.level2", whereClause: "id = 4"})` → `"deep value"`
2. `sqlite_json_extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.nonexistent", whereClause: "id = 4"})` → null or empty (not error)
3. `sqlite_json_extract({table: "test_jsonb_docs", column: "doc", path: "$.nonexistent_key", whereClause: "id = 1"})` → null or empty

**1.2 Array Manipulation Edge Cases**

4. `sqlite_json_array_length({table: "test_jsonb_docs", column: "tags", whereClause: "id = 3"})` → 3 (["mcp","protocol","ai"])
5. Create `stress_json_test` with a row containing `tags = '[]'` (empty array) → `sqlite_json_array_length` → 0
6. `sqlite_json_each` on an empty array → 0 expanded rows (not error)

**1.3 Merge Conflict Behavior**

> **Note:** `sqlite_json_merge` is table-bound (requires `table`, `column`, `mergeData`, `whereClause`) — it uses `json_patch()` which follows RFC 7396 merge-patch semantics.

Insert test rows into `stress_json_test`: row 2 = `{"a": 1, "b": {"c": 2}}`, row 3 = `{"a": [1, 2]}`:

7. `sqlite_json_merge({table: "stress_json_test", column: "tags", mergeData: {"b": {"d": 3}}, whereClause: "id = 2"})` → verify deep merge: `b.c` should survive (`json_patch` recursively merges objects, so `b.c` is preserved alongside new `b.d`)
8. `sqlite_json_merge({table: "stress_json_test", column: "tags", mergeData: {"a": [3, 4]}, whereClause: "id = 3"})` → arrays are replaced (not concatenated) per RFC 7396

**1.4 Type Coercion Edge Cases**

9. `sqlite_json_type({table: "test_jsonb_docs", column: "doc", path: "$.views", whereClause: "id = 1"})` → `"integer"` (views=1250)
10. `sqlite_json_type({table: "test_jsonb_docs", column: "doc", path: "$.rating", whereClause: "id = 1"})` → `"real"` (rating=4.5)
11. `sqlite_json_type({table: "test_jsonb_docs", column: "doc", path: "$.nested", whereClause: "id = 4"})` → `"object"`

### Category 2: JSON Query & Filter Stress

> **Note:** `sqlite_json_query` uses `filterPaths` (equality-only, `Record<path, value>`) and `selectPaths` — not `conditions` with operators.

12. `sqlite_json_query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article"}})` → 4 rows (all articles)
13. `sqlite_json_query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article", "$.author": "Alice"}, selectPaths: ["$.title", "$.views"]})` → 1 row (Alice's article)
14. `sqlite_json_query({table: "test_events", column: "payload", filterPaths: {"$.page": "home"}})` → 25 rows (every 4th event)

### Category 3: Error Message Quality

15. `sqlite_json_extract({table: "nonexistent_table_xyz", column: "doc", path: "$.x"})` → structured error mentioning table name
16. `sqlite_json_extract({table: "test_jsonb_docs", column: "nonexistent_col", path: "$.x"})` → structured error mentioning column name
17. `sqlite_json_set({table: "test_jsonb_docs", column: "doc", path: "$.author", value: "\"Modified\"", whereClause: "id = 99999"})` → report behavior for nonexistent row
18. `sqlite_json_validate_path({path: ""})` → report behavior for empty path

### Category 4: Write Operation Safety

19. Create `stress_json_write` table → insert 3 JSON documents → perform `sqlite_json_set`, `sqlite_json_remove`, `sqlite_json_insert` → verify mutations → cleanup
    > **Note:** `sqlite_json_insert` is a **row-level INSERT** (creates a new row with JSON data), not a path-level JSON insert like SQLite's `json_insert()` function.
20. `sqlite_json_normalize_column` on `stress_json_write` → verify keys are sorted/compacted without data loss

### Final Cleanup

Drop all `stress_*` tables. Confirm `test_jsonb_docs` row count is still 6 and contents are unchanged.

---

## text Group Advanced Tests

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### text Group Tools — Native (17)

4. sqlite_regex_extract
5. sqlite_regex_match
6. sqlite_text_split
7. sqlite_text_concat
8. sqlite_text_replace
9. sqlite_text_trim
10. sqlite_text_case
11. sqlite_text_substring
12. sqlite_fuzzy_match
13. sqlite_phonetic_match
14. sqlite_text_normalize
15. sqlite_text_validate
16. sqlite_advanced_search
17. sqlite_fts_create `[NATIVE ONLY]`
18. sqlite_fts_search `[NATIVE ONLY]`
19. sqlite_fts_rebuild `[NATIVE ONLY]`
20. sqlite_fts_match_info `[NATIVE ONLY]`

### text Group Tools — WASM (13)

Same as Native minus the 4 FTS5 tools (items 17-20).

### Category 1: Regex Edge Cases

1. `sqlite_regex_match({table: "test_users", column: "email", pattern: "^[a-z]+\\.[a-z]+@"})` → verify matching against dotted local parts (john.doe, jane.smith, etc.)
2. `sqlite_regex_match({table: "test_users", column: "phone", pattern: "^\\+1"})` → US phone numbers only (6 users, 1 NULL excluded)
3. `sqlite_regex_extract({table: "test_users", column: "email", pattern: "@(.+)$", groupIndex: 1})` → full domain extraction
4. `sqlite_regex_match({table: "test_users", column: "bio", pattern: ".*"})` → should match all non-NULL bios (all 9 users have bios)

### Category 2: Fuzzy/Phonetic Matching Stress

5. `sqlite_fuzzy_match({table: "test_products", column: "name", search: "Keyborad", maxDistance: 3})` → should find "Mechanical Keyboard" (Levenshtein)
6. `sqlite_fuzzy_match({table: "test_products", column: "name", search: "LAPTOP", maxDistance: 2, tokenize: true})` → should match "Laptop" token in "Laptop Pro 15"
7. `sqlite_fuzzy_match({table: "test_products", column: "name", search: "xyznonexistent", maxDistance: 1})` → 0 results
8. `sqlite_phonetic_match({table: "test_users", column: "username", search: "jon", algorithm: "soundex"})` → 0 results expected (Soundex: "jon"=J500 ≠ "johndoe"=J530; single-word usernames aren't tokenized)
9. `sqlite_phonetic_match({table: "test_users", column: "username", search: "smith", algorithm: "soundex"})` → report behavior (janesmith contains "smith" as suffix)
10. `sqlite_advanced_search({table: "test_users", column: "username", searchTerm: "jhn", techniques: ["exact", "fuzzy", "phonetic"], fuzzyThreshold: 0.3})` → should find John via fuzzy/phonetic even with low threshold

### Category 3: Text Transformation Edge Cases

11. `sqlite_text_normalize({table: "test_products", column: "name", mode: "strip_accents"})` → `"Café Décor Light"` becomes `"Cafe Decor Light"` — verify ALL rows returned, not just the accented one
12. `sqlite_text_normalize({table: "test_products", column: "name", mode: "nfkc"})` → NFKC normalization (compatibility decomposition + canonical composition)
13. `sqlite_text_case({table: "test_users", column: "username", mode: "upper"})` → verify 9 uppercased usernames
14. `sqlite_text_case({table: "test_users", column: "username", mode: "lower"})` → verify idempotent (already lowercase)
15. `sqlite_text_substring({table: "test_users", column: "email", start: 1, length: 3})` → first 3 chars of each email

### Category 4: Validation Patterns

16. `sqlite_text_validate({table: "test_users", column: "email", pattern: "email"})` → expect all 9 valid
17. `sqlite_text_validate({table: "test_users", column: "phone", pattern: "phone"})` → report valid/invalid/null counts
18. `sqlite_text_validate({table: "test_users", column: "email", pattern: "custom", customPattern: "^.+@.+\\..{2,}$"})` → custom regex validation

### Category 5: FTS5 State Integrity `[NATIVE ONLY]`

19. `sqlite_fts_search({table: "test_articles_fts", query: "database"})` → verify results include articles about databases
20. After base tests confirm FTS works, test rebuild: `sqlite_fts_rebuild({table: "test_articles_fts"})` → success
21. `sqlite_fts_search({table: "test_articles_fts", query: "database"})` → verify same results after rebuild (idempotent)
22. `sqlite_fts_search({table: "test_articles_fts", query: "SQLite AND database"})` → boolean operator test
23. `sqlite_fts_search({table: "test_articles_fts", query: "\"full-text search\""})` → phrase query test

### Category 6: WASM Boundary Verification

For WASM testing only — verify graceful degradation:

24. Confirm FTS5 tools are NOT present in the tool list (WASM mode should exclude them)
25. All 13 non-FTS text tools should work identically in WASM and Native

### Category 7: Error Message Quality

26. `sqlite_regex_match({table: "nonexistent_table_xyz", column: "x", pattern: "."})` → structured error
27. `sqlite_fuzzy_match({table: "test_users", column: "nonexistent_col", search: "test"})` → structured error
28. `sqlite_text_validate({table: "test_users", column: "email", pattern: "custom"})` → error about missing `customPattern` when pattern=custom
29. `sqlite_fts_search({table: "nonexistent_fts_xyz", query: "test"})` `[NATIVE ONLY]` → structured error

### Final Cleanup

Confirm `test_articles` row count is still 8. Verify FTS index integrity with `sqlite_fts_match_info` `[NATIVE ONLY]`.

---

## stats Group Advanced Tests

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### stats Group Tools — Native (19)

4. sqlite_stats_basic
5. sqlite_stats_count
6. sqlite_stats_group_by
7. sqlite_stats_histogram
8. sqlite_stats_percentile
9. sqlite_stats_correlation
10. sqlite_stats_top_n
11. sqlite_stats_distinct
12. sqlite_stats_summary
13. sqlite_stats_frequency
14. sqlite_stats_outliers
15. sqlite_stats_regression
16. sqlite_stats_hypothesis
17. sqlite_window_row_number `[NATIVE ONLY]`
18. sqlite_window_rank `[NATIVE ONLY]`
19. sqlite_window_lag_lead `[NATIVE ONLY]`
20. sqlite_window_running_total `[NATIVE ONLY]`
21. sqlite_window_moving_avg `[NATIVE ONLY]`
22. sqlite_window_ntile `[NATIVE ONLY]`

### stats Group Tools — WASM (13)

Same as Native minus the 6 window function tools (items 17-22).

### Category 1: Boundary Values & Empty States

Create `stress_stats_table (id INTEGER PRIMARY KEY, value REAL, category TEXT)`:

**1.1 Empty Table Statistics**

1. `sqlite_stats_basic({table: "stress_stats_table", column: "value"})` → expect graceful error or empty stats (not a crash)
2. `sqlite_stats_count({table: "stress_stats_table"})` → `{count: 0}`
3. `sqlite_stats_histogram({table: "stress_stats_table", column: "value", buckets: 5})` → expect graceful handling

**1.2 Single-Row Statistics**

Insert one row: `(1, 42.0, 'test')`:

4. `sqlite_stats_basic({table: "stress_stats_table", column: "value"})` → count=1, min=max=avg=42.0
5. `sqlite_stats_percentile({table: "stress_stats_table", column: "value", percentiles: [25, 50, 75]})` → all should equal 42
6. `sqlite_stats_regression({table: "stress_stats_table", xColumn: "id", yColumn: "value", degree: 1})` → expect graceful handling (regression undefined for n=1)

**1.3 NULL-Heavy Data**

Insert 5 rows: 3 with `value IS NULL`, 2 with actual values:

7. `sqlite_stats_basic({table: "stress_stats_table", column: "value"})` → should only count non-null values (3 total: 42.0 + 2 new)
8. `sqlite_stats_count({table: "stress_stats_table", column: "value"})` → non-null count only

**1.4 Extreme Numeric Values**

Insert: `(value: 99999999.99)`, `(value: -99999999.99)`, `(value: 0.0)`, `(value: 0.01)`:

9. `sqlite_stats_basic({table: "stress_stats_table", column: "value"})` → verify min/max/avg handle extreme values correctly

### Category 2: Statistical Edge Cases

10. `sqlite_stats_correlation({table: "test_products", column1: "id", column2: "id"})` → self-correlation = 1.0 (or very close)
11. `sqlite_stats_hypothesis({table: "test_measurements", column: "temperature", testType: "ttest_one", expectedMean: 999})` → should reject null hypothesis (very different from actual mean)
12. `sqlite_stats_outliers({table: "test_measurements", column: "temperature", method: "iqr"})` → IQR-based outliers
13. `sqlite_stats_outliers({table: "test_measurements", column: "temperature", method: "zscore"})` → Z-score-based outliers (compare with IQR)
14. `sqlite_stats_regression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity", degree: 2})` → quadratic regression coefficients

### Category 3: Window Functions `[NATIVE ONLY]`

15. `sqlite_window_row_number({table: "test_products", orderBy: "price DESC"})` → 16 rows with sequential row numbers, Laptop Pro 15 at #1
    > **Note:** `window_row_number` and `window_rank` do NOT have a `direction` param — embed direction in the `orderBy` string (e.g., `"price DESC"`).
16. `sqlite_window_rank({table: "test_orders", orderBy: "total_price DESC"})` → ranks with potential ties
17. `sqlite_window_running_total({table: "test_orders", valueColumn: "total_price", orderBy: "order_date"})` → monotonically increasing cumulative total
18. `sqlite_window_moving_avg({table: "test_measurements", valueColumn: "temperature", windowSize: 10, orderBy: "measured_at"})` → moving average with 10-row window
19. `sqlite_window_ntile({table: "test_products", buckets: 4, orderBy: "price"})` → 4 groups of ~4 products each

### Category 4: Error Message Quality

20. `sqlite_stats_basic({table: "nonexistent_table_xyz", column: "x"})` → structured error mentioning table name
21. `sqlite_stats_basic({table: "test_products", column: "nonexistent_col"})` → structured error mentioning column name
22. `sqlite_stats_correlation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric columns (both TEXT)
23. `sqlite_stats_histogram({table: "test_products", column: "price", buckets: 0})` → error (must be > 0)
24. `sqlite_stats_histogram({table: "test_products", column: "price", buckets: -1})` → error

### Category 5: WASM Boundary Verification

For WASM testing only:

25. Confirm window function tools are NOT present in the tool list
26. All 13 non-window stats tools should produce identical results in WASM and Native

### Final Cleanup

Drop `stress_stats_table`. Confirm `test_measurements` (200 rows) and `test_products` (16 rows) are unchanged.

---

## vector Group Advanced Tests

> **Note:** Vector tools use pure JS computations with JSON-stored vectors — all 12 tools work identically in both WASM and Native modes.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### vector Group Tools (11)

4. sqlite_vector_create_table
5. sqlite_vector_store
6. sqlite_vector_batch_store
7. sqlite_vector_search
8. sqlite_vector_get
9. sqlite_vector_delete
10. sqlite_vector_count
11. sqlite_vector_stats
12. sqlite_vector_dimensions
13. sqlite_vector_normalize
14. sqlite_vector_distance

### Category 1: Boundary Values

> **Note:** Vector tools use `tableName` for create, but `table` for other operations. Store/batch-store require `idColumn` and `vectorColumn`. Search requires `vectorColumn` and `queryVector`.

**1.1 Empty Vector Table**

1. `sqlite_vector_create_table({tableName: "stress_vec_empty", dimensions: 4})` → success (creates columns: id, vector, dimensions)
2. `sqlite_vector_count({table: "stress_vec_empty"})` → `{count: 0}`
3. `sqlite_vector_search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 2, 3, 4], metric: "cosine", limit: 5})` → empty results (not error)
4. `sqlite_vector_stats({table: "stress_vec_empty", vectorColumn: "vector"})` → graceful handling: `{count: 0, message: "No valid vectors found"}`
5. `sqlite_vector_dimensions({table: "stress_vec_empty", vectorColumn: "vector"})` → `{dimensions: null, message: "No vectors found"}` (inferred from data, not schema)

**1.2 Single-Vector Table**

6. `sqlite_vector_store({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", id: 1, vector: [1, 0, 0, 0]})` → success
7. `sqlite_vector_search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 0, 0, 0], metric: "cosine", limit: 5})` → exactly 1 result, similarity = 1

### Category 2: Distance Metric Verification

8. `sqlite_vector_distance({vector1: [1, 0, 0], vector2: [0, 1, 0], metric: "cosine"})` → ≈ 1.0 (orthogonal)
9. `sqlite_vector_distance({vector1: [1, 0, 0], vector2: [1, 0, 0], metric: "cosine"})` → ≈ 0.0 (identical)
10. `sqlite_vector_distance({vector1: [1, 0, 0], vector2: [-1, 0, 0], metric: "cosine"})` → ≈ 2.0 (opposite)
11. `sqlite_vector_distance({vector1: [3, 4], vector2: [0, 0], metric: "euclidean"})` → exactly 5.0
12. `sqlite_vector_distance({vector1: [1, 2, 3], vector2: [1, 2, 3], metric: "euclidean"})` → exactly 0.0
13. `sqlite_vector_normalize({vector: [3, 4]})` → `{normalized: [0.6, 0.8], originalMagnitude: 5.0}`
14. `sqlite_vector_normalize({vector: [0, 0, 0]})` → `{normalized: [0, 0, 0], originalMagnitude: 0}` (zero vector returns zero — no crash)

### Category 3: Dimension Mismatch

> **Note:** Dimension validation on store is best-effort — checks `dimensions` column of existing rows. `sqlite_vector_distance` enforces strictly.

15. `sqlite_vector_store({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", id: 2, vector: [1, 2]})` → dimension mismatch error (table has 4-dim rows)
16. `sqlite_vector_search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 2], metric: "cosine"})` → search still runs (dimension mismatch is silently handled via try/catch in similarity calculation)
17. `sqlite_vector_distance({vector1: [1, 2, 3], vector2: [1, 2], metric: "cosine"})` → structured error: "Vector dimensions must match"

### Category 4: Batch Operations

18. `sqlite_vector_batch_store({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", items: []})` → `{stored: 0, message: "No items provided"}`
19. `sqlite_vector_batch_store` with 50 vectors into `stress_vec_empty` → verify `{stored: 50}`
20. `sqlite_vector_count({table: "stress_vec_empty"})` → `{count: 51}` (1 from earlier + 50 batch)

### Category 5: Category Filtering

21. `sqlite_vector_search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 20, whereClause: "category = 'tech'"})` → only tech category results (4 rows)
22. `sqlite_vector_search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 20, whereClause: "category = 'nonexistent'"})` → 0 results (not error)

### Category 6: Error Message Quality

23. `sqlite_vector_search({table: "nonexistent_table_xyz", vectorColumn: "v", queryVector: [1, 2, 3], metric: "cosine"})` → structured error mentioning table name
24. `sqlite_vector_get({table: "test_embeddings", idColumn: "id", vectorColumn: "embedding", id: 99999})` → `{success: false, error: "Vector not found"}`
25. `sqlite_vector_delete({table: "test_embeddings", idColumn: "id", ids: [99999]})` → `{success: true, deleted: 0}` (idempotent)

### Final Cleanup

Drop `stress_vec_empty`. Confirm `test_embeddings` count is still 20.
