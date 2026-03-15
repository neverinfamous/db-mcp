> **Note:** Leftover `temp_*` tables from previous test runs may exist in the database. Ignore them — they are inert (no foreign keys, no triggers) and are cleaned up when the test database is regenerated. If a cleanup step (e.g., `sqlite_drop_table`) fails due to a database lock, skip it and continue testing.

## core Group-Specific Testing (Native and WASM are identical)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

---

### core Group Tools (10)

4. sqlite_read_query
5. sqlite_write_query
6. sqlite_create_table
7. sqlite_list_tables
8. sqlite_describe_table
9. sqlite_drop_table
10. sqlite_get_indexes
11. sqlite_create_index
12. sqlite_drop_index
13. sqlite_execute_code

**Checklist:**

1. `server_info` → verify server name, version, adapter info present
2. `server_health` → verify healthy status
3. `list_adapters` → verify at least one adapter listed
4. `sqlite_read_query({query: "SELECT COUNT(*) AS n FROM test_products"})` → `{rows: [{n: 16}]}`
5. `sqlite_read_query({query: "SELECT name, price FROM test_products WHERE price > 500"})` → verify `Laptop Pro 15` (1299.99) and `Headphones Pro` (299.99) are returned — wait, 299.99 is < 500. Only `Laptop Pro 15` matches.
6. `sqlite_read_query({query: "SELECT COUNT(*) AS n FROM test_orders WHERE status = 'completed'"})` → `{rows: [{n: 8}]}`
7. `sqlite_list_tables` → verify `test_products`, `test_orders`, `test_jsonb_docs`, `test_articles`, `test_users`, `test_measurements`, `test_embeddings`, `test_locations`, `test_categories`, `test_events` all present
8. `sqlite_describe_table({table: "test_products"})` → verify columns include `id` (INTEGER), `name` (TEXT), `price` (REAL), `category` (TEXT)
9. `sqlite_get_indexes({table: "test_orders"})` → verify `idx_orders_status` and `idx_orders_date` present
10. `sqlite_create_table({table: "temp_core_test", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "name", type: "TEXT"}, {name: "value", type: "REAL"}]})` → success
11. `sqlite_write_query({query: "INSERT INTO temp_core_test (id, name, value) VALUES (1, 'alpha', 10.5), (2, 'beta', 20.0)"})` → `{rowsAffected: 2}`
12. `sqlite_read_query({query: "SELECT * FROM temp_core_test"})` → 2 rows
13. `sqlite_create_index({table: "temp_core_test", columns: ["name"], indexName: "idx_temp_core_name"})` → success
14. `sqlite_drop_table({table: "temp_core_test"})` → success

**Code mode testing:**

15. `sqlite_execute_code({code: "const tables = await sqlite.core.listTables(); return tables;"})` → returns list of tables including `test_products`, `test_orders`, etc.
16. `sqlite_execute_code({code: "const result = await sqlite.core.readQuery('SELECT COUNT(*) AS n FROM test_products'); return result;", readonly: true})` → `{rows: [{n: 16}]}` (verify readonly mode works)
17. `sqlite_execute_code({code: "const result = await sqlite.core.writeQuery('INSERT INTO test_products VALUES (999, \"x\", \"x\", 0, \"x\", \"x\")'); return result;", readonly: true})` → `result` contains `{success: false, code: "CODEMODE_READONLY_VIOLATION"}` (code mode returns errors as values, not thrown exceptions)

**Error path testing:**

🔴 18. `sqlite_describe_table({table: "nonexistent_table_xyz"})` → structured error response, NOT a raw MCP exception
🔴 19. `sqlite_read_query({query: "SELECT * FROM nonexistent_table_xyz"})` → structured error mentioning table name
🔴 20. `sqlite_get_indexes({table: "nonexistent_table_xyz"})` → report behavior (structured error or empty result)
🔴 21. `sqlite_drop_table({table: "nonexistent_table_xyz"})` → structured error or `{existed: false}` style response

**Zod validation sweep** — call each tool with `{}` (empty params). Every response must be a handler error (`{success: false, error: "Validation error: ..."}`) — NOT a raw MCP error frame:

🔴 22. `sqlite_read_query({})` → handler error
🔴 23. `sqlite_write_query({})` → handler error
🔴 24. `sqlite_create_table({})` → handler error
🔴 25. `sqlite_describe_table({})` → handler error
🔴 26. `sqlite_drop_table({})` → handler error
🔴 27. `sqlite_get_indexes({})` → handler error
🔴 28. `sqlite_create_index({})` → handler error
🔴 29. `sqlite_drop_index({})` → handler error
🔴 30. `sqlite_execute_code({})` → handler error (has required `code` param)

---

## json Group-Specific Testing (Native and WASM are identical)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### json Group Tools (24)

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
27. sqlite_execute_code

**Test data reference (test_jsonb_docs):**

| id  | doc.type | doc.author | doc.views | metadata.source | tags                                 |
| --- | -------- | ---------- | --------- | --------------- | ------------------------------------ |
| 1   | article  | Alice      | 1250      | blog            | ["database","tutorial","beginner"]   |
| 2   | article  | Bob        | 890       | docs            | ["json","advanced","sqlite"]         |
| 3   | video    | Carol      | 5400      | youtube         | ["mcp","protocol","ai"]              |
| 4   | article  | David      | 670       | wiki            | ["fts5","search","indexing"]         |
| 5   | podcast  | Eve        | —         | spotify         | ["performance","tips","podcast"]     |
| 6   | article  | Frank      | 2100      | medium          | ["vector","embeddings","similarity"] |

Row 4 has nested path: `doc → nested → level1 → level2 = "deep value"`

**Checklist:**

1. `sqlite_json_extract({table: "test_jsonb_docs", column: "doc", path: "$.author", whereClause: "id = 1"})` → result contains `"Alice"`
2. `sqlite_json_extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.level2", whereClause: "id = 4"})` → result contains `"deep value"`
3. `sqlite_json_keys({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → keys include `type`, `title`, `author`, `views`, `rating`
4. `sqlite_json_type({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → `"array"`
5. `sqlite_json_type({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → `"object"`
6. `sqlite_json_array_length({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → `3`
7. `sqlite_json_valid({json: "{\"type\":\"article\",\"title\":\"Getting Started with SQLite\",\"author\":\"Alice\",\"views\":1250,\"rating\":4.5}"})` → `{valid: true}`
8. `sqlite_json_validate_path({path: "$.author"})` → valid
9. `sqlite_json_pretty({json: "{\"type\":\"article\",\"author\":\"Alice\",\"views\":1250}"})` → formatted JSON with indentation
10. `sqlite_json_each({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → 3 expanded rows: `database`, `tutorial`, `beginner`
11. `sqlite_json_analyze_schema({table: "test_jsonb_docs", column: "doc"})` → inferred schema with `type`, `author`, etc.
12. `sqlite_json_merge({table: "test_jsonb_docs", column: "doc", mergeData: {"featured": true}, whereClause: "id = 999"})` → `{rowsAffected: 0}` (no matching rows, non-destructive test)
13. `sqlite_json_select({table: "test_jsonb_docs", column: "doc", paths: ["$.author", "$.views"]})` → rows with author and views columns
14. `sqlite_json_query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article"}})` → 4 rows (rows 1,2,4,6)
15. `sqlite_json_storage_info({table: "test_jsonb_docs", column: "doc"})` → storage analysis
16. `sqlite_json_group_array({table: "test_jsonb_docs", valueColumn: "json_extract(doc, '$.author')", allowExpressions: true})` → array of all authors `["Alice","Bob","Carol","David","Eve","Frank"]`
17. `sqlite_json_group_object({table: "test_jsonb_docs", keyColumn: "json_extract(doc, '$.author')", valueColumn: "json_extract(doc, '$.views')", allowExpressions: true})` → object mapping authors to view counts
18. `sqlite_jsonb_convert({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → JSONB binary conversion result
19. `sqlite_json_normalize_column({table: "test_jsonb_docs", column: "doc"})` → normalization report for the doc column

**Write operations (use temp tables):**

20. `sqlite_create_json_collection({tableName: "temp_json_test"})` → creates table with JSON columns
21. `sqlite_json_set` on `temp_json_test` → modify a JSON value
22. `sqlite_json_update` on `temp_json_test` → update an existing key's value (distinct from json_set: update requires key to exist)
23. `sqlite_json_insert` on `temp_json_test` → insert new key
24. `sqlite_json_remove` on `temp_json_test` → remove a key
25. `sqlite_json_array_append` on `temp_json_test` → add to array
26. Cleanup: drop `temp_json_test`

**Code mode testing:**

27. `sqlite_execute_code({code: "const result = await sqlite.json.extract({table: 'test_jsonb_docs', column: 'doc', path: '$.author', whereClause: 'id = 1'}); return result;"})` → result contains `"Alice"`
28. `sqlite_execute_code({code: "const keys = await sqlite.json.keys({table: 'test_jsonb_docs', column: 'doc', whereClause: 'id = 1'}); return keys;"})` → keys include `type`, `title`, `author`

**Error path testing:**

🔴 29. `sqlite_json_extract({table: "nonexistent_table_xyz", column: "doc", path: "$.x"})` → structured error
🔴 30. `sqlite_json_extract({table: "test_jsonb_docs", column: "nonexistent_col", path: "$.x"})` → report behavior
🔴 31. `sqlite_json_validate_path({path: "invalid path !@#"})` → report behavior

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 32. `sqlite_json_valid({})` → handler error
🔴 33. `sqlite_json_extract({})` → handler error
🔴 34. `sqlite_json_set({})` → handler error
🔴 35. `sqlite_json_remove({})` → handler error
🔴 36. `sqlite_json_type({})` → handler error
🔴 37. `sqlite_json_array_length({})` → handler error
🔴 38. `sqlite_json_array_append({})` → handler error
🔴 39. `sqlite_json_keys({})` → handler error
🔴 40. `sqlite_json_each({})` → handler error
🔴 41. `sqlite_json_group_array({})` → handler error
🔴 42. `sqlite_json_group_object({})` → handler error
🔴 43. `sqlite_json_pretty({})` → handler error
🔴 44. `sqlite_jsonb_convert({})` → handler error
🔴 45. `sqlite_json_storage_info({})` → handler error
🔴 46. `sqlite_json_normalize_column({})` → handler error
🔴 47. `sqlite_json_insert({})` → handler error
🔴 48. `sqlite_json_update({})` → handler error
🔴 49. `sqlite_json_select({})` → handler error
🔴 50. `sqlite_json_query({})` → handler error
🔴 51. `sqlite_json_validate_path({})` → handler error
🔴 52. `sqlite_json_merge({})` → handler error
🔴 53. `sqlite_json_analyze_schema({})` → handler error
🔴 54. `sqlite_create_json_collection({})` → handler error

---

## text Group-Specific Testing (Native- 18 Tools)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### text Group Tools

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
21. sqlite_execute_code

### text Group Tools (WASM- 14 Tools)

Same as Native minus the 4 FTS5 tools (items 17-20). WASM mode excludes FTS5 tools entirely.

**Test data reference:**

- `test_articles` (8 rows): FTS5 searchable terms: `SQLite`, `database`, `JSON`, `FTS`, `vector`, `API`, `search`, `MCP`
- `test_users` (9 rows): Emails include `@example.com`, `@company.org`, `@gmail.com`, etc. One user (`testuser`) has `test.user@gmail.com`. Phone formats: `+1-555-0101`, `+44-20-7123-4567`, `+82-2-1234-5678`
- `test_products` row 16: `name = 'Café Décor Light'` — has accented characters for `strip_accents` testing

**Checklist:**

1. `sqlite_regex_match({table: "test_users", column: "email", pattern: "@gmail\\.com$"})` → at least 1 result (`test.user@gmail.com`)
2. `sqlite_regex_extract({table: "test_users", column: "email", pattern: "@([^.]+)\\.", groupIndex: 1})` → extract domain parts (example, company, startup, etc.)
3. `sqlite_fuzzy_match({table: "test_products", column: "name", search: "Laptp", maxDistance: 3})` → results include `Laptop Pro 15`
4. `sqlite_phonetic_match({table: "test_products", column: "name", search: "Labtop"})` → should find `Laptop Pro 15` via Soundex (both produce L131)
5. `sqlite_text_validate({table: "test_users", column: "email", pattern: "email"})` → all 9 rows should be valid emails
6. `sqlite_text_validate({table: "test_users", column: "phone", pattern: "phone"})` → report valid/invalid counts (one user has NULL phone)
7. `sqlite_text_case({table: "test_users", column: "username", mode: "upper"})` → all usernames uppercased
8. `sqlite_text_normalize({table: "test_products", column: "name", mode: "strip_accents"})` → `Café Décor Light` becomes `Cafe Decor Light`
9. `sqlite_text_split({table: "test_users", column: "email", delimiter: "@"})` → each email split into local + domain parts
10. `sqlite_text_concat({table: "test_users", columns: ["username", "email"], separator: " - "})` → concatenated strings
11. `sqlite_text_replace({table: "test_users", column: "email", searchPattern: "@example.com", replaceWith: "@test.org", whereClause: "email LIKE '%@example.com'"})` → 1 row affected (write operation — revert with `searchPattern: "@test.org", replaceWith: "@example.com", whereClause: "email LIKE '%@test.org'"` afterward)
12. `sqlite_text_trim({table: "test_users", column: "bio"})` → trimmed bios
13. `sqlite_text_substring({table: "test_users", column: "username", start: 1, length: 4})` → first 4 chars of each username
14. `sqlite_advanced_search({table: "test_products", column: "name", searchTerm: "keyboard", techniques: ["exact", "fuzzy", "phonetic"]})` → should find `Mechanical Keyboard`

**FTS5 tools `[NATIVE ONLY]`:**

15. `sqlite_fts_create({sourceTable: "test_users", columns: ["username", "bio"], ftsTable: "temp_users_fts"})` → FTS5 virtual table created
16. `sqlite_fts_rebuild({table: "temp_users_fts"})` → rebuild index before searching
17. `sqlite_fts_search({table: "temp_users_fts", query: "test*"})` → verify results from test_users data (prefix query needed since no standalone "test" token exists)
18. Cleanup: `sqlite_drop_table({table: "temp_users_fts"})` (drop the temp FTS table)
19. `sqlite_fts_search({table: "test_articles_fts", query: "SQLite"})` → at least 1 result (article 1: "Introduction to SQLite")
20. `sqlite_fts_search({table: "test_articles_fts", query: "MCP protocol"})` → matches article 3: "The Model Context Protocol Explained"
21. `sqlite_fts_search({table: "test_articles_fts", query: "nonexistent_term_xyz"})` → 0 results
22. `sqlite_fts_match_info({table: "test_articles_fts", query: "database"})` → match info with scoring data
23. `sqlite_fts_rebuild({table: "test_articles_fts"})` → success

**Code mode testing:**

24. `sqlite_execute_code({code: "const result = await sqlite.text.fuzzyMatch({table: 'test_products', column: 'name', search: 'Laptp', maxDistance: 3}); return result;"})` → results include `Laptop Pro 15`
25. `sqlite_execute_code({code: "const result = await sqlite.text.regexMatch({table: 'test_users', column: 'email', pattern: '@gmail\\\\.com$'}); return result;"})` → at least 1 result

**Error path testing:**

🔴 26. `sqlite_regex_match({table: "nonexistent_table_xyz", column: "x", pattern: "."})` → structured error
🔴 27. `sqlite_fuzzy_match({table: "test_users", column: "nonexistent_col", search: "test"})` → structured error with code `COLUMN_NOT_FOUND`
🔴 28. `sqlite_fts_search({table: "nonexistent_fts_xyz", query: "test"})` `[NATIVE ONLY]` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 29. `sqlite_regex_extract({})` → handler error
🔴 30. `sqlite_regex_match({})` → handler error
🔴 31. `sqlite_text_split({})` → handler error
🔴 32. `sqlite_text_concat({})` → handler error
🔴 33. `sqlite_text_replace({})` → handler error
🔴 34. `sqlite_text_trim({})` → handler error
🔴 35. `sqlite_text_case({})` → handler error
🔴 36. `sqlite_text_substring({})` → handler error
🔴 37. `sqlite_fuzzy_match({})` → handler error
🔴 38. `sqlite_phonetic_match({})` → handler error
🔴 39. `sqlite_text_normalize({})` → handler error
🔴 40. `sqlite_text_validate({})` → handler error
🔴 41. `sqlite_advanced_search({})` → handler error
🔴 42. `sqlite_fts_create({})` `[NATIVE ONLY]` → handler error
🔴 43. `sqlite_fts_search({})` `[NATIVE ONLY]` → handler error
🔴 44. `sqlite_fts_rebuild({})` `[NATIVE ONLY]` → handler error
🔴 45. `sqlite_fts_match_info({})` `[NATIVE ONLY]` → handler error

---

## stats Group-Specific Testing

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### stats Group Tools — (Native- 20 Tools)

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
23. sqlite_execute_code

### stats Group Tools (WASM- 14 Tools)

Same as Native minus the 6 window function tools (items 17-22).

**Test data:** `test_measurements` (200 rows, sensor_id 1-5, columns: temperature, humidity, pressure, measured_at). `test_products` (16 rows, price column). `test_events` (100 rows, event_type column: page_view, click, purchase, login, search).

**Checklist:**

1. `sqlite_stats_basic({table: "test_measurements", column: "temperature"})` → verify `count: 200`, `min`, `max`, `avg` present
2. `sqlite_stats_count({table: "test_products"})` → `{count: 16}`
3. `sqlite_stats_count({table: "test_products", column: "category", distinct: true})` → distinct category count (electronics, accessories, office = 3)
4. `sqlite_stats_group_by({table: "test_measurements", groupByColumn: "sensor_id", valueColumn: "temperature", stat: "avg"})` → 5 groups (sensor_id 1-5) with average temperatures
5. `sqlite_stats_histogram({table: "test_measurements", column: "temperature", buckets: 5})` → 5 buckets
6. `sqlite_stats_percentile({table: "test_measurements", column: "temperature", percentiles: [25, 50, 75, 90]})` → 4 percentile values
7. `sqlite_stats_correlation({table: "test_measurements", column1: "temperature", column2: "humidity"})` → correlation value between -1 and 1
8. `sqlite_stats_top_n({table: "test_products", column: "price", n: 3, orderDirection: "desc"})` → top 3 most expensive products (Laptop Pro 15 at 1299.99 should be #1)
9. `sqlite_stats_distinct({table: "test_locations", column: "city"})` → distinct city count (New York, Paris, London, Tokyo, Sydney, San Francisco = 6)
10. `sqlite_stats_summary({table: "test_measurements", columns: ["temperature", "humidity", "pressure"]})` → summaries array with 3 entries
11. `sqlite_stats_frequency({table: "test_events", column: "event_type"})` → distribution of page_view, click, purchase, login, search (each ~20)
12. `sqlite_stats_outliers({table: "test_measurements", column: "temperature"})` → outlier detection result
13. `sqlite_stats_regression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity", degree: 1})` → regression coefficients
14. `sqlite_stats_hypothesis({table: "test_measurements", column: "temperature", testType: "ttest_one", expectedMean: 25})` → verify `statistic` and `pValue` present

**Window functions `[NATIVE ONLY]`:**

15. `sqlite_window_row_number({table: "test_products", orderBy: "price DESC"})` → products ranked by price
16. `sqlite_window_rank({table: "test_products", orderBy: "price DESC"})` → rank with ties
17. `sqlite_window_running_total({table: "test_orders", valueColumn: "total_price", orderBy: "order_date"})` → cumulative totals
18. `sqlite_window_moving_avg({table: "test_measurements", valueColumn: "temperature", windowSize: 5, orderBy: "measured_at"})` → moving averages
19. `sqlite_window_lag_lead({table: "test_orders", column: "total_price", orderBy: "order_date"})` → lag/lead values
20. `sqlite_window_ntile({table: "test_products", buckets: 4, orderBy: "price"})` → quartile assignments

**Code mode testing:**

21. `sqlite_execute_code({code: "const result = await sqlite.stats.statsBasic({table: 'test_measurements', column: 'temperature'}); return result;"})` → verify `count: 200`, `min`, `max`, `avg` present
22. `sqlite_execute_code({code: "const result = await sqlite.stats.statsPercentile({table: 'test_measurements', column: 'temperature', percentiles: [50]}); return result;"})` → median value

**Error path testing:**

🔴 23. `sqlite_stats_basic({table: "nonexistent_table_xyz", column: "x"})` → structured error
🔴 24. `sqlite_stats_basic({table: "test_products", column: "nonexistent_col"})` → report behavior
🔴 25. `sqlite_stats_correlation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric columns

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 26. `sqlite_stats_basic({})` → handler error
🔴 27. `sqlite_stats_count({})` → handler error
🔴 28. `sqlite_stats_group_by({})` → handler error
🔴 29. `sqlite_stats_histogram({})` → handler error
🔴 30. `sqlite_stats_percentile({})` → handler error
🔴 31. `sqlite_stats_correlation({})` → handler error
🔴 32. `sqlite_stats_top_n({})` → handler error
🔴 33. `sqlite_stats_distinct({})` → handler error
🔴 34. `sqlite_stats_summary({})` → handler error
🔴 35. `sqlite_stats_frequency({})` → handler error
🔴 36. `sqlite_stats_outliers({})` → handler error
🔴 37. `sqlite_stats_regression({})` → handler error
🔴 38. `sqlite_stats_hypothesis({})` → handler error
🔴 39. `sqlite_window_row_number({})` `[NATIVE ONLY]` → handler error
🔴 40. `sqlite_window_rank({})` `[NATIVE ONLY]` → handler error
🔴 41. `sqlite_window_lag_lead({})` `[NATIVE ONLY]` → handler error
🔴 42. `sqlite_window_running_total({})` `[NATIVE ONLY]` → handler error
🔴 43. `sqlite_window_moving_avg({})` `[NATIVE ONLY]` → handler error
🔴 44. `sqlite_window_ntile({})` `[NATIVE ONLY]` → handler error

---

## vector Group-Specific Testing (Native and WASM are identical)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

> **Note:** Vector tools use pure JS computations (cosine, euclidean, dot product) with JSON-stored vectors — no native SQLite extension required. All 12 tools work identically in both WASM and Native modes.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### vector Group Tools (12 Tools)

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
15. sqlite_execute_code

**Test data:** `test_embeddings` (20 rows, 8-dim vectors, categories: tech, database, food, fitness, travel). Row 1: content="Machine learning fundamentals", embedding=[0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01].

**Checklist:**

1. `sqlite_vector_count({table: "test_embeddings"})` → `{count: 20}`
2. `sqlite_vector_dimensions({table: "test_embeddings"})` → `{dimensions: 8}`
3. `sqlite_vector_get({table: "test_embeddings", idColumn: "id", vectorColumn: "embedding", id: 1})` → verify content="Machine learning fundamentals", category="tech", embedding has 8 dimensions
4. `sqlite_vector_search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 3})` → top result should be row 1 (exact match, \_similarity ≈ 1)
5. `sqlite_vector_search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 3, whereClause: "category = 'database'"})` → only database category results
6. `sqlite_vector_distance({vector1: [1, 0, 0], vector2: [0, 1, 0], metric: "cosine"})` → distance ≈ 1.0 (orthogonal vectors)
7. `sqlite_vector_distance({vector1: [3, 4], vector2: [0, 0], metric: "euclidean"})` → distance = 5.0
8. `sqlite_vector_normalize({vector: [3, 4]})` → `{normalized: [0.6, 0.8], originalMagnitude: 5}`
9. `sqlite_vector_stats({table: "test_embeddings", vectorColumn: "embedding"})` → verify min/max/avg magnitude

**Write operations (use temp tables):**

10. `sqlite_vector_create_table({tableName: "temp_vector_test", dimensions: 8, additionalColumns: [{name: "content", type: "TEXT"}, {name: "category", type: "TEXT"}]})` → success
11. `sqlite_vector_store({table: "temp_vector_test", idColumn: "id", vectorColumn: "vector", id: 1, vector: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]})` → success (note: additional columns like content/category cannot be set via this tool)
12. `sqlite_vector_batch_store({table: "temp_vector_test", idColumn: "id", vectorColumn: "vector", items: [{id: 2, vector: [0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88]}, {id: 3, vector: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]}]})` → `{stored: 2}`
13. `sqlite_vector_count({table: "temp_vector_test"})` → `{count: 3}`
14. `sqlite_vector_delete({table: "temp_vector_test", idColumn: "id", ids: [1]})` → success
15. `sqlite_vector_count({table: "temp_vector_test"})` → `{count: 2}`
16. Cleanup: `sqlite_drop_table({table: "temp_vector_test"})` (via core tools if needed)

**Code mode testing:**

17. `sqlite_execute_code({code: "const result = await sqlite.vector.count({table: 'test_embeddings'}); return result;"})` → `{count: 20}`
18. `sqlite_execute_code({code: "const result = await sqlite.vector.distance({vector1: [3, 4], vector2: [0, 0], metric: 'euclidean'}); return result;"})` → distance = 5.0

**Error path testing:**

🔴 17. `sqlite_vector_search({table: "nonexistent_table_xyz", vectorColumn: "embedding", queryVector: [1,2,3], metric: "cosine"})` → structured error
🔴 18. `sqlite_vector_distance({vector1: [1, 2, 3], vector2: [1, 2], metric: "cosine"})` → error about dimension mismatch

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 19. `sqlite_vector_create_table({})` → handler error
🔴 20. `sqlite_vector_store({})` → handler error
🔴 21. `sqlite_vector_batch_store({})` → handler error
🔴 22. `sqlite_vector_search({})` → handler error
🔴 23. `sqlite_vector_get({})` → handler error
🔴 24. `sqlite_vector_delete({})` → handler error
🔴 25. `sqlite_vector_count({})` → handler error
🔴 26. `sqlite_vector_stats({})` → handler error
🔴 27. `sqlite_vector_dimensions({})` → handler error
🔴 28. `sqlite_vector_normalize({})` → handler error
🔴 29. `sqlite_vector_distance({})` → handler error

---

## admin Group-Specific Testing

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### admin Group Tools (Native- 34 Tools)

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
37. sqlite_execute_code

---

### admin Group Tools (WASM- 27 Tools)

Same as Native minus the 7 transaction management tools (items 30-36).

**Checklist — Pragma & Inspection:**

1. `sqlite_pragma_database_list` → verify database path matches `test.db`
2. `sqlite_pragma_compile_options` → verify list of compile options returned
3. `sqlite_pragma_compile_options({filter: "FTS"})` → filtered subset containing FTS-related options (`ENABLE_FTS3`, `ENABLE_FTS4`, `ENABLE_FTS5`)
4. `sqlite_pragma_settings` → verify key settings returned
5. `sqlite_pragma_table_info({table: "test_products"})` → verify columns: id, name, description, price, category, created_at
6. `sqlite_index_stats` → verify index statistics for test database
7. `sqlite_integrity_check` → `ok` result
8. `sqlite_analyze` → success
9. `sqlite_dbstat({summarize: true})` → per-table storage metrics

**Checklist — View Management:**

10. `sqlite_create_view({name: "temp_view_orders", sql: "SELECT product_id, COUNT(*) as order_count, SUM(total_price) as revenue FROM test_orders GROUP BY product_id"})` → success
11. `sqlite_list_views` → verify `temp_view_orders` present
12. `sqlite_drop_view({name: "temp_view_orders"})` → success

**Checklist — Virtual Tables:**

13. `sqlite_list_virtual_tables` → verify `test_articles_fts` present (Native) or report behavior (WASM)
14. `sqlite_virtual_table_info({table: "test_articles_fts"})` → verify module and column info (Native)
15. `sqlite_generate_series({start: 1, stop: 5, step: 1})` → 5 values
16. `sqlite_create_rtree_table({table: "temp_rtree_test", dimensions: 2})` → R-Tree virtual table created with 2D bounding box columns
17. `sqlite_create_series_table({table: "temp_series_test"})` → series virtual table created
18. Cleanup: `sqlite_drop_virtual_table({table: "temp_rtree_test"})` and `sqlite_drop_virtual_table({table: "temp_series_test"})`

**Checklist — Backup/Restore:**

19. `sqlite_backup({path: "test-server/test-backup.db"})` → success with backup file info
20. `sqlite_verify_backup({path: "test-server/test-backup.db"})` → integrity verified
21. `sqlite_restore({path: "test-server/test-backup.db"})` → restore from backup, verify success
22. Cleanup: note backup file location for manual removal if desired

**Checklist — Optimization:**

23. `sqlite_vacuum` → success
24. `sqlite_optimize` → success with optimization details
25. `sqlite_pragma_optimize` → success (note: distinct from `sqlite_optimize` — this runs `PRAGMA optimize`)

**Checklist — Transaction Management `[NATIVE ONLY]`:**

26. `sqlite_transaction_begin` → capture transaction ID
27. `sqlite_transaction_rollback` → rollback entire transaction, verify success
28. `sqlite_transaction_begin` → start a new transaction for savepoint tests
29. `sqlite_transaction_savepoint({name: "sp1"})` → success
30. `sqlite_transaction_rollback_to({name: "sp1"})` → success
31. `sqlite_transaction_release({name: "sp1"})` → success (released savepoints cannot be rolled back to)
32. `sqlite_transaction_commit` → success
33. `sqlite_transaction_execute({statements: [{sql: "SELECT 1 AS test"}, {sql: "SELECT 2 AS test2"}]})` → success with 2 statements executed

**Checklist — CSV:**

34. `sqlite_analyze_csv_schema({path: "test-server/sample.csv"})` → inferred column types
35. `sqlite_create_csv_table({table: "temp_csv_test", path: "test-server/sample.csv"})` → virtual table created
36. Cleanup: `sqlite_drop_virtual_table({table: "temp_csv_test"})`

**Checklist — Insights:**

37. `sqlite_append_insight({text: "Test insight for verification"})` → success

**Code mode testing:**

38. `sqlite_execute_code({code: "const result = await sqlite.admin.integrityCheck(); return result;"})` → `ok` result
39. `sqlite_execute_code({code: "const result = await sqlite.admin.pragmaSettings(); return result;"})` → settings object

**Error path testing:**

🔴 40. `sqlite_pragma_table_info({table: "nonexistent_table_xyz"})` → report behavior
🔴 41. `sqlite_virtual_table_info({table: "nonexistent_table_xyz"})` → structured error
🔴 42. `sqlite_verify_backup({path: "nonexistent_file.db"})` → structured error
🔴 43. `sqlite_transaction_execute({statements: [{sql: "INSERT INTO nonexistent_table VALUES (1)"}]})` `[NATIVE ONLY]` → structured error with rollback info

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 44. `sqlite_backup({})` → handler error
🔴 45. `sqlite_restore({})` → handler error
🔴 46. `sqlite_verify_backup({})` → handler error
🔴 47. `sqlite_pragma_table_info({})` → handler error
🔴 48. `sqlite_pragma_settings({})` → handler error (has required `pragma` param)
🔴 49. `sqlite_append_insight({})` → handler error
🔴 50. `sqlite_create_view({})` → handler error
🔴 51. `sqlite_drop_view({})` → handler error
🔴 52. `sqlite_virtual_table_info({})` → handler error
🔴 53. `sqlite_drop_virtual_table({})` → handler error
🔴 54. `sqlite_create_csv_table({})` → handler error
🔴 55. `sqlite_analyze_csv_schema({})` → handler error
🔴 56. `sqlite_create_rtree_table({})` → handler error
🔴 57. `sqlite_create_series_table({})` → handler error
🔴 58. `sqlite_generate_series({})` → handler error
🔴 59. `sqlite_dbstat({})` → handler error (or success if no required params)
🔴 60. `sqlite_transaction_begin({})` `[NATIVE ONLY]` → handler error (or success if no required params)
🔴 61. `sqlite_transaction_execute({})` `[NATIVE ONLY]` → handler error
🔴 62. `sqlite_transaction_savepoint({})` `[NATIVE ONLY]` → handler error
🔴 63. `sqlite_transaction_release({})` `[NATIVE ONLY]` → handler error
🔴 64. `sqlite_transaction_rollback_to({})` `[NATIVE ONLY]` → handler error

---

## geo Group-Specific Testing

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### geo Group Tools (Native- 12 Tools)

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
15. sqlite_execute_code

### geo Group Tools — WASM (5)

Only the Haversine-based tools: items 4-7 and code mode. SpatiaLite tools (items 8-14) are Native only.

**Test data:** `test_locations` (15 rows). Key coordinates:

| Name               | City          | Lat      | Lng       |
| ------------------ | ------------- | -------- | --------- |
| Central Park       | New York      | 40.7829  | -73.9654  |
| Eiffel Tower       | Paris         | 48.8584  | 2.2945    |
| Big Ben            | London        | 51.5007  | -0.1246   |
| Tokyo Tower        | Tokyo         | 35.6586  | 139.7454  |
| Sydney Opera House | Sydney        | -33.8568 | 151.2153  |
| Golden Gate Bridge | San Francisco | 37.8199  | -122.4783 |

**Checklist (Haversine tools — Native & WASM):**

1. `sqlite_geo_distance({lat1: 40.7829, lon1: -73.9654, lat2: 48.8584, lon2: 2.2945})` → NYC to Paris ≈ 5,837 km (verify within ±50 km)
2. `sqlite_geo_distance({lat1: 40.7829, lon1: -73.9654, lat2: 37.8199, lon2: -122.4783})` → NYC to SF ≈ 4,130 km
3. `sqlite_geo_nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.7580, centerLon: -73.9855, radius: 10})` → should find NYC locations (Central Park, Empire State Building, Times Square) — 3 results
4. `sqlite_geo_nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 48.8584, centerLon: 2.2945, radius: 10})` → should find Paris locations (Eiffel Tower, Louvre, Notre-Dame) — 3 results
5. `sqlite_geo_bounding_box({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 35, maxLat: 55, minLon: -130, maxLon: -70})` → US locations (NYC 3 + SF 1 = 4)
6. `sqlite_geo_cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 5})` → ~5 clusters grouping by city proximity

**SpatiaLite tools `[NATIVE ONLY]`:**

7. `sqlite_spatialite_load` → load SpatiaLite extension, verify version
8. `sqlite_spatialite_create_table({tableName: "temp_spatial_test", geometryColumn: "geom", geometryType: "POINT", srid: 4326, additionalColumns: [{name: "name", type: "TEXT"}]})` → success
9. `sqlite_spatialite_import({tableName: "temp_spatial_test", format: "wkt", data: "POINT(-73.9654 40.7829)", additionalData: {name: "Test Point"}})` → success
10. `sqlite_spatialite_query({query: "SELECT name, AsText(geom) as geom_text FROM temp_spatial_test"})` → WKT geometry returned
11. `sqlite_spatialite_transform({operation: "buffer", geometry1: "POINT(-73.9654 40.7829)", distance: 0.01, srid: 4326})` → buffered polygon
12. `sqlite_spatialite_index({tableName: "temp_spatial_test", geometryColumn: "geom", action: "create"})` → R-Tree index created
13. `sqlite_spatialite_analyze({analysisType: "spatial_extent", sourceTable: "temp_spatial_test", geometryColumn: "geom"})` → spatial extent
14. Cleanup: drop `temp_spatial_test`

**Code mode testing:**

15. `sqlite_execute_code({code: "const result = await sqlite.geo.distance({lat1: 40.7829, lon1: -73.9654, lat2: 48.8584, lon2: 2.2945}); return result;"})` → NYC to Paris ≈ 5,837 km
16. `sqlite_execute_code({code: "const result = await sqlite.geo.nearby({table: 'test_locations', latColumn: 'latitude', lonColumn: 'longitude', centerLat: 40.758, centerLon: -73.9855, radius: 10}); return result;"})` → NYC locations

**Error path testing:**

🔴 17. `sqlite_geo_nearby({table: "nonexistent_table_xyz", latColumn: "lat", lonColumn: "lng", centerLat: 0, centerLon: 0, radius: 100})` → structured error
🔴 18. `sqlite_geo_distance({lat1: 91, lon1: 0, lat2: 0, lon2: 0})` → must return `{success: false, error: "Invalid lat1: 91. Must be between -90 and 90."}` — structured handler error, NOT a raw MCP error. If this returns a raw MCP `-32602`, it is a Zod `.min()/.max()` refinement leak bug (see `test-tools.md` refinement leak pattern).

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 19. `sqlite_geo_distance({})` → handler error
🔴 20. `sqlite_geo_nearby({})` → handler error
🔴 21. `sqlite_geo_bounding_box({})` → handler error
🔴 22. `sqlite_geo_cluster({})` → handler error
🔴 23. `sqlite_spatialite_create_table({})` `[NATIVE ONLY]` → handler error
🔴 24. `sqlite_spatialite_query({})` `[NATIVE ONLY]` → handler error
🔴 25. `sqlite_spatialite_analyze({})` `[NATIVE ONLY]` → handler error
🔴 26. `sqlite_spatialite_index({})` `[NATIVE ONLY]` → handler error
🔴 27. `sqlite_spatialite_transform({})` `[NATIVE ONLY]` → handler error
🔴 28. `sqlite_spatialite_import({})` `[NATIVE ONLY]` → handler error

---

## introspection Group-Specific Testing (Native and WASM are identical)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

> **Note:** All introspection tools are **read-only**. The test database has one FK relationship (`test_orders.product_id → test_products.id`) and a deliberately redundant index (`idx_orders_status` is a prefix of `idx_orders_status_date`) for audit testing.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### introspection Group Tools (10)

4. sqlite_dependency_graph
5. sqlite_topological_sort
6. sqlite_cascade_simulator
7. sqlite_schema_snapshot
8. sqlite_constraint_analysis
9. sqlite_migration_risks
10. sqlite_storage_analysis
11. sqlite_index_audit
12. sqlite_query_plan
13. sqlite_execute_code

**Checklist — Graph Analysis:**

1. `sqlite_dependency_graph({})` → nodes ≥ 2, edges includes `test_orders → test_products` (FK); stats.totalRelationships ≥ 1
2. `sqlite_topological_sort({})` → order array with `test_products` before `test_orders` (FK dependency); hasCycles = false
3. `sqlite_cascade_simulator({table: "test_products"})` → affectedTables includes `test_orders` (FK dependent)
4. `sqlite_cascade_simulator({table: "test_measurements"})` → affectedTables is empty (no tables reference it via FK)
5. `sqlite_cascade_simulator({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}`

**Checklist — Schema Analysis:**

6. `sqlite_schema_snapshot({})` → snapshot.tables ≥ 11 (10 test\_ tables + FTS virtual); stats.indexes ≥ 4; generatedAt present
7. `sqlite_constraint_analysis({})` → findings array; summary.totalFindings ≥ 0; summary.byType and bySeverity objects present
8. `sqlite_migration_risks({statements: ["DROP TABLE test_products"]})` → risks array non-empty; risk category includes data_loss or destructive
9. `sqlite_migration_risks({statements: ["ALTER TABLE test_users ADD COLUMN age INTEGER"]})` → low risk
10. `sqlite_migration_risks({statements: ["CREATE TABLE new_table (id INTEGER PRIMARY KEY)", "DROP TABLE test_products"]})` → summary.totalStatements = 2; summary.highestRisk ≥ "high"

**Checklist — Diagnostics:**

11. `sqlite_storage_analysis({})` → database.pageSize > 0, database.totalPages > 0, database.totalSizeBytes = pageSize × totalPages; recommendations array present
12. `sqlite_storage_analysis({})` → tables array contains "test_measurements" (largest by row count); verify each entry has name, sizeBytes, rowCount
13. `sqlite_index_audit({})` → findings array present; summary has redundant, missingFk, total fields
14. `sqlite_index_audit({})` → findings includes type="redundant" for `idx_orders_status` (prefix of `idx_orders_status_date`)
15. `sqlite_query_plan({sql: "SELECT * FROM test_products WHERE category = 'electronics'"})` → plan array non-empty; analysis.fullScans may or may not include test_products (idx_products_category exists)
16. `sqlite_query_plan({sql: "SELECT * FROM test_orders WHERE status = 'completed'"})` → analysis.indexScans present (idx_orders_status exists)
17. `sqlite_query_plan({sql: "SELECT * FROM test_products WHERE name = 'Laptop Pro 15'"})` → analysis.fullScans includes test_products (no index on name); suggestions non-empty
18. `sqlite_query_plan({sql: "WITH recent AS (SELECT * FROM test_orders ORDER BY order_date DESC LIMIT 5) SELECT * FROM recent"})` → plan contains CTE-related entries

**Code mode testing (params only accessible via code mode):**

19. `sqlite_execute_code({code: "const result = await sqlite.introspection.schemaSnapshot({}); return { tableCount: result.snapshot.tables.length, hasStats: !!result.stats };"})` → tableCount ≥ 11, hasStats = true
20. `sqlite_execute_code({code: "const result = await sqlite.introspection.queryPlan({sql: 'SELECT * FROM test_products WHERE category = \u0027electronics\u0027'}); return result;"})` → plan array present
21. `sqlite_execute_code({code: "const result = await sqlite.introspection.schemaSnapshot({sections: ['tables']}); return { hasTables: !!result.snapshot.tables, hasViews: !!result.snapshot.views, hasIndexes: !!result.snapshot.indexes };"})` → hasTables=true, hasViews=false, hasIndexes=false
22. `sqlite_execute_code({code: "const result = await sqlite.introspection.schemaSnapshot({compact: true}); const t = result.snapshot.tables[0]; return { name: t.name, hasColumns: !!t.columns };"})` → hasColumns=false (compact omits columns)
23. `sqlite_execute_code({code: "const result = await sqlite.introspection.constraintAnalysis({table: 'test_orders'}); return { count: result.findings.length, allTestOrders: result.findings.every(f => f.table === 'test_orders') };"})` → allTestOrders=true
24. `sqlite_execute_code({code: "const result = await sqlite.introspection.constraintAnalysis({checks: ['unindexed_fk']}); return { count: result.findings.length, allUnindexedFk: result.findings.every(f => f.type === 'unindexed_fk') };"})` → allUnindexedFk=true
25. `sqlite_execute_code({code: "const result = await sqlite.introspection.storageAnalysis({includeTableDetails: false}); return { hasTables: !!result.tables, hasDatabase: !!result.database };"})` → hasTables=false, hasDatabase=true
26. `sqlite_execute_code({code: "const result = await sqlite.introspection.indexAudit({table: 'test_orders'}); return { count: result.findings.length, allTestOrders: result.findings.every(f => f.table === 'test_orders') };"})` → allTestOrders=true
27. `sqlite_execute_code({code: "const result = await sqlite.introspection.topologicalSort({direction: 'drop'}); return { direction: result.direction, first: result.order[0], last: result.order[result.order.length - 1] };"})` → direction="drop", test_orders before test_products in order

**Error path testing:**

🔴 28. `sqlite_query_plan({sql: "DELETE FROM test_products WHERE id = 1"})` → `{success: false, error: "...only SELECT..."}` (non-SELECT rejected)
🔴 29. `sqlite_query_plan({})` → Zod validation error (missing required `sql`). Must be handler error, NOT raw MCP error.
🔴 30. `sqlite_cascade_simulator({})` → Zod validation error (missing required `table`)
🔴 31. `sqlite_migration_risks({statements: []})` → report behavior for empty array
🔴 32. `sqlite_execute_code({code: "return await sqlite.introspection.storageAnalysis({limit: 0});", readonly: true})` → Zod validation error (min: 1) — `limit` param only accessible via code mode

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 33. `sqlite_dependency_graph({})` → handler error (or success if no required params)
🔴 34. `sqlite_topological_sort({})` → handler error (or success if no required params)
🔴 35. `sqlite_cascade_simulator({})` → handler error
🔴 36. `sqlite_schema_snapshot({})` → handler error (or success if no required params)
🔴 37. `sqlite_constraint_analysis({})` → handler error (or success if no required params)
🔴 38. `sqlite_migration_risks({})` → handler error
🔴 39. `sqlite_storage_analysis({})` → handler error (or success if no required params)
🔴 40. `sqlite_index_audit({})` → handler error (or success if no required params)
🔴 41. `sqlite_query_plan({})` → handler error

---

## migration Group-Specific Testing (Native and WASM are identical)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

> **Note:** Migration tools write a `_mcp_migrations` tracking table. Use `temp_*` naming for test migrations. **Clean up** the tracking table and any schema changes after testing. Consider resetting the database after this group.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### migration Group Tools (7)

4. sqlite_migration_init
5. sqlite_migration_record
6. sqlite_migration_apply
7. sqlite_migration_rollback
8. sqlite_migration_history
9. sqlite_migration_status
10. sqlite_execute_code

**Checklist — Full Lifecycle:**

> **Note**: `sqlite_migration_record` is for **externally-applied** migrations — it records them as `applied` immediately without executing the SQL. `sqlite_migration_apply` **executes SQL AND records** the migration atomically. They are NOT a two-step record→apply workflow.

1. `sqlite_migration_init({})` → success; creates `_mcp_migrations` table
2. `sqlite_migration_status({})` → initialized state, zero counts
3. `sqlite_migration_apply({version: "001_create_temp_table", migrationSql: "CREATE TABLE temp_migration_test (id INTEGER PRIMARY KEY, value TEXT)", rollbackSql: "DROP TABLE IF EXISTS temp_migration_test", description: "Create temp table for migration testing", sourceSystem: "agent", appliedBy: "antigravity"})` → migration executed and recorded as applied; verify `temp_migration_test` exists via `sqlite_list_tables`
4. `sqlite_migration_status({})` → shows 1 applied migration, latestVersion = "001_create_temp_table"
5. `sqlite_migration_record({version: "002_external_change", migrationSql: "ALTER TABLE temp_migration_test ADD COLUMN extra TEXT", description: "Record external schema change", sourceSystem: "agent", appliedBy: "antigravity"})` → migration recorded as applied (SQL NOT executed — record-only)
6. `sqlite_migration_history({})` → shows both migrations with `applied` status, ordered by id DESC
7. `sqlite_migration_rollback({version: "001_create_temp_table"})` → rollback executed; `temp_migration_test` dropped; status = "rolled_back"
8. `sqlite_migration_history({})` → shows 001=rolled_back, 002=applied
9. `sqlite_migration_status({})` → verify overall state: 1 applied, 1 rolled_back
10. `sqlite_migration_apply({version: "003_duplicate_test", migrationSql: "CREATE TABLE temp_migration_test (id INTEGER PRIMARY KEY, value TEXT)"})` → duplicate SQL detection (same hash as 001) → `{success: false, error: "Duplicate migration: ..."}`

**Code mode testing:**

11. `sqlite_execute_code({code: "const result = await sqlite.migration.migrationStatus(); return result;"})` → current migration state
12. `sqlite_execute_code({code: "const result = await sqlite.migration.migrationHistory(); return result;"})` → migration history list

**Error path testing:**

🔴 13. `sqlite_migration_apply({version: "fail_test", migrationSql: "CREATE TABLE nonexistent_xyz.bad (id INT)"})` → structured error (SQL execution fails; recorded as status=failed)
🔴 14. `sqlite_migration_record({})` → Zod validation error (missing required params) — must be handler error, NOT raw MCP error
🔴 15. `sqlite_migration_rollback({version: "nonexistent_migration_xyz"})` → structured error `{success: false, error: "Migration not found: ..."}`
🔴 16. `sqlite_migration_rollback({version: "002_external_change"})` → structured error (no rollback SQL was recorded with this migration)

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 17. `sqlite_migration_init({})` → handler error (or success if no required params)
🔴 18. `sqlite_migration_record({})` → handler error
🔴 19. `sqlite_migration_apply({})` → handler error
🔴 20. `sqlite_migration_rollback({})` → handler error
🔴 21. `sqlite_migration_history({})` → handler error (or success if no required params)
🔴 22. `sqlite_migration_status({})` → handler error (or success if no required params)

**Cleanup:**

23. Drop `_mcp_migrations` table: `sqlite_drop_table({table: "_mcp_migrations"})` (writeQuery rejects DROP TABLE)
24. Drop `temp_migration_test` if still exists: `sqlite_drop_table({table: "temp_migration_test"})`
25. Verify cleanup via `sqlite_list_tables`
