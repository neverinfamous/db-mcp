# db-mcp (SQLite) Tool Group Testing: [stats]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js), apply these adjustments:

- **Skip window function tools** (items 20-25: `sqlite_window_row_number`, `sqlite_window_rank`, `sqlite_window_lag_lead`, `sqlite_window_running_total`, `sqlite_window_moving_avg`, `sqlite_window_ntile`) — `[NATIVE ONLY]`. These tools are not registered in WASM.
- **Skip window checklist items** 15-20 — all require window function tools.
- **Skip Zod items** 42-47 (window function tools) — `[NATIVE ONLY]`.
- All other items (1-14, 21-41) are fully WASM-compatible — 16 stats tools work identically.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **stats** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Report the response size in KB and suggest a concrete optimization.

## Test Database Schema

| Table             | Rows | Columns                                                                       | JSON Columns                                                                              |
| ----------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| test_products     | 16   | id, name, description, price, category, created_at                            | —                                                                                         |
| test_orders       | 20   | id, product_id (FK), customer_name, quantity, total_price, order_date, status | —                                                                                         |
| test_jsonb_docs   | 6    | id, doc, metadata, tags, created_at                                           | **doc**, **metadata** (nested), **tags** (array)                                          |
| test_articles     | 8    | id, title, body, author, category, published_at                               | —                                                                                         |
| test_users        | 9    | id, username, email, phone, bio, created_at                                   | —                                                                                         |
| test_measurements | 200  | id, sensor_id, temperature, humidity, pressure, measured_at                   | —                                                                                         |
| test_embeddings   | 20   | id, content, category, embedding                                              | **embedding** (8-dim float array); category values: database, fitness, food, tech, travel |
| test_locations    | 15   | id, name, city, latitude, longitude, type                                     | —                                                                                         |
| test_categories   | 17   | id, name, path, level                                                         | —                                                                                         |
| test_events       | 100  | id, event_type, user_id (INT, 8 values), payload, event_date                  | **payload** (JSON)                                                                        |

> **Note:** String values in test data use **lowercase**. Use case-sensitive matching in queries.

> **Note:** `test_measurements.sensor_id` is an **INTEGER** column (values 1-5), not a string. Use `sensor_id = 1`, not `sensor_id = 'S001'`.

> **Note:** When testing `sqlite_execute_code`, do **not** pass `readonly: true` unless specifically testing read-only filtering.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads
4. Do not mention what already works well or issues well documented in help resources
5. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}` — NOT a raw MCP error frame.
6. **Output schema testing**: For **every** tool with an `outputSchema`, confirm valid happy-path calls return structured JSON — NOT a raw MCP `-32602` error.
7. **Deterministic checklist first**: Complete ALL items before freeform exploration.
8. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                      | Verdict            |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields           | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, `isError: true` — no `success` field      | Bug — report as ❌ |

### Zod Validation Errors

**Zod refinement leak pattern:** `.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. **Fix:** Remove refinements from schema, validate inside handler.

**Required enum coercion pattern:** For **required** enums, use `z.string()` and validate inside handler.

- Raw MCP error (no `success` field) → report as ❌
- `{success: false, error: "..."}` → correct
- Successful response for invalid input → report as ⚠️

### Wrong-Type Numeric Parameter Coercion

For tools with optional numeric parameters (`limit`, `buckets`, `windowSize`, `sampleSize`), call with `param: "abc"`. Must NOT return raw MCP `-32602`.

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

### Error Consistency Audit

1. Raw error instead of `{success: false}` → ❌
2. Must use `error` field name
3. Orphaned/inline output schemas → ⚠️

### Split Schema Pattern Verification

Verify parameter visibility and alias acceptance.

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_`
- If DROP fails due to database lock, move on.

---

## Group Focus: stats

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### stats Group Tools (Native — 22 Tools)

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
17. sqlite_stats_detect_anomalies
18. sqlite_stats_detect_bloat
19. sqlite_stats_detect_schema_risks
20. sqlite_window_row_number `[NATIVE ONLY]`
21. sqlite_window_rank `[NATIVE ONLY]`
22. sqlite_window_lag_lead `[NATIVE ONLY]`
23. sqlite_window_running_total `[NATIVE ONLY]`
24. sqlite_window_moving_avg `[NATIVE ONLY]`
25. sqlite_window_ntile `[NATIVE ONLY]`
26. sqlite_execute_code

### stats Group Tools (WASM — 16 Tools)

Same as Native minus the 6 window function tools (items 20-25).

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
17. `sqlite_window_running_total({table: "test_orders", column: "total_price", orderBy: "order_date"})` → cumulative totals
18. `sqlite_window_moving_avg({table: "test_measurements", column: "temperature", windowSize: 5, orderBy: "measured_at"})` → moving averages
19. `sqlite_window_lag_lead({table: "test_orders", column: "total_price", direction: "lag", orderBy: "order_date"})` → lag/lead values
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
🔴 39. `sqlite_stats_detect_anomalies({})` → handler error
🔴 40. `sqlite_stats_detect_bloat({})` → handler error (or success if no required params)
🔴 41. `sqlite_stats_detect_schema_risks({})` → handler error (or success if no required params)
🔴 42. `sqlite_window_row_number({})` `[NATIVE ONLY]` → handler error
🔴 43. `sqlite_window_rank({})` `[NATIVE ONLY]` → handler error
🔴 44. `sqlite_window_lag_lead({})` `[NATIVE ONLY]` → handler error
🔴 45. `sqlite_window_running_total({})` `[NATIVE ONLY]` → handler error
🔴 46. `sqlite_window_moving_avg({})` `[NATIVE ONLY]` → handler error
🔴 47. `sqlite_window_ntile({})` `[NATIVE ONLY]` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing

---

## Troubleshooting

### Database is locked / file in use

1. Check for Node.js processes: `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"`
2. WAL/journal files are normal

### Reset script fails

1. Run with `-Verbose`: `.\reset-database.ps1 -Verbose`
2. If `sqlite3` is not in PATH, the script falls back to Node.js with `better-sqlite3`
