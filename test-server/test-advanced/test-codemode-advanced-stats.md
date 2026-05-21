# Advanced Stress Test — db-mcp — [stats]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're in Native mode. If there is nothing to fix, don't update UNRELEASED.md.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode).

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js), apply these adjustments:

- **Skip Category 4** entirely (Window Functions — items 19-23) — `[NATIVE ONLY]`.
- **Category 6** (WASM Boundary Verification) — execute only in WASM mode.
- All other categories (1-3, 5) are fully WASM-compatible — 16 stats tools work identically.

## Code Mode Execution

- **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

All tests via `sqlite_execute_code`. Use `sqlite.stats.*` for all stats/window tools.
State persists across calls. Do NOT pass `readonly: true`. Group related tests into single calls.

## Test Database Schema

| Table             | Rows | Key Columns                                                   |
| ----------------- | ---- | ------------------------------------------------------------- |
| test_products     | 16   | id, name, price (REAL), category (3 values)                   |
| test_orders       | 20   | id, product_id, total_price, order_date, status               |
| test_measurements | 200  | id, sensor_id (1-5), temperature, humidity, pressure          |

## Naming & Cleanup

- **Temporary tables**: `stress_*` prefix. Drop at end.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`) | ✅ Confirmed (inline only)

### Error Message Quality Rating

| Level | Verdict |
| --- | --- |
| 5 - Excellent (name + code + context) | ✅ |
| 4 - Good (name) | ✅ |
| 3 - Adequate (raw SQLite, informative) | ⚠️ |
| 2 - Poor (no object name) | ⚠️ |
| 1 - Useless (generic) | ❌ |

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## stats Group Tools — Native (22)

1. sqlite_stats_basic
2. sqlite_stats_count
3. sqlite_stats_group_by
4. sqlite_stats_histogram
5. sqlite_stats_percentile
6. sqlite_stats_correlation
7. sqlite_stats_top_n
8. sqlite_stats_distinct
9. sqlite_stats_summary
10. sqlite_stats_frequency
11. sqlite_stats_outliers
12. sqlite_stats_regression
13. sqlite_stats_hypothesis
14. sqlite_detect_anomalies
15. sqlite_detect_bloat
16. sqlite_detect_schema_risks
17. sqlite_window_row_number `[NATIVE ONLY]`
18. sqlite_window_rank `[NATIVE ONLY]`
19. sqlite_window_lag_lead `[NATIVE ONLY]`
20. sqlite_window_running_total `[NATIVE ONLY]`
21. sqlite_window_moving_avg `[NATIVE ONLY]`
22. sqlite_window_ntile `[NATIVE ONLY]`

### WASM (16)

Same minus the 6 window function tools (items 17-22).

---

### Category 1: Boundary Values & Empty States

Create `stress_stats_table (id INTEGER PRIMARY KEY, value REAL, category TEXT)`:

**1.1 Empty Table Statistics**

1. `sqlite.stats.statsBasic({table: "stress_stats_table", column: "value"})` → graceful error or empty stats (not crash)
2. `sqlite.stats.statsCount({table: "stress_stats_table"})` → `{count: 0}`
3. `sqlite.stats.statsHistogram({table: "stress_stats_table", column: "value", buckets: 5})` → graceful handling

**1.2 Single-Row Statistics**

Insert one row: `(1, 42.0, 'test')`:

4. `sqlite.stats.statsBasic({table: "stress_stats_table", column: "value"})` → count=1, min=max=avg=42.0
5. `sqlite.stats.statsPercentile({table: "stress_stats_table", column: "value", percentiles: [25, 50, 75]})` → all equal 42
6. `sqlite.stats.statsRegression({table: "stress_stats_table", xColumn: "id", yColumn: "value", degree: 1})` → graceful handling (regression undefined for n=1)

**1.3 NULL-Heavy Data**

Insert 5 rows: 3 with `value IS NULL`, 2 with actual values:

7. `sqlite.stats.statsBasic({table: "stress_stats_table", column: "value"})` → only count non-null values (3 total)
8. `sqlite.stats.statsCount({table: "stress_stats_table", column: "value"})` → non-null count only

**1.4 Extreme Numeric Values**

Insert: `(99999999.99)`, `(-99999999.99)`, `(0.0)`, `(0.01)`:

9. `sqlite.stats.statsBasic({table: "stress_stats_table", column: "value"})` → verify min/max/avg handle extreme values

---

### Category 2: Statistical Edge Cases

10. `sqlite.stats.statsCorrelation({table: "test_products", column1: "id", column2: "id"})` → self-correlation = 1.0
11. `sqlite.stats.statsHypothesis({table: "test_measurements", column: "temperature", testType: "ttest_one", expectedMean: 999})` → should reject null hypothesis
12. `sqlite.stats.statsOutliers({table: "test_measurements", column: "temperature", method: "iqr"})` → IQR-based outliers
13. `sqlite.stats.statsOutliers({table: "test_measurements", column: "temperature", method: "zscore"})` → Z-score outliers (compare with IQR)
14. `sqlite.stats.statsRegression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity", degree: 2})` → quadratic regression

---

### Category 3: Anomaly Detection Stress

15. `sqlite.stats.detectAnomalies({table: "test_measurements", column: "temperature"})` → anomaly detection result
16. `sqlite.stats.detectAnomalies({table: "stress_stats_table", column: "value"})` → graceful handling on mixed NULL/extreme data
17. `sqlite.stats.detectBloat()` → bloat detection
18. `sqlite.stats.detectSchemaRisks()` → schema risk assessment

---

### Category 4: Window Functions `[NATIVE ONLY]`

19. `sqlite.stats.windowRowNumber({table: "test_products", orderBy: "price DESC"})` → 16 rows, Laptop Pro 15 at #1
    > **Note:** `window_row_number` and `window_rank` do NOT have a `direction` param — embed in `orderBy` string.
20. `sqlite.stats.windowRank({table: "test_orders", orderBy: "total_price DESC"})` → ranks with potential ties
21. `sqlite.stats.windowRunningTotal({table: "test_orders", valueColumn: "total_price", orderBy: "order_date"})` → monotonically increasing cumulative total
22. `sqlite.stats.windowMovingAvg({table: "test_measurements", valueColumn: "temperature", windowSize: 10, orderBy: "measured_at"})` → 10-row moving average
23. `sqlite.stats.windowNtile({table: "test_products", buckets: 4, orderBy: "price"})` → 4 groups of ~4 products

---

### Category 5: Error Message Quality

24. `sqlite.stats.statsBasic({table: "nonexistent_table_xyz", column: "x"})` → structured error mentioning table name
25. `sqlite.stats.statsBasic({table: "test_products", column: "nonexistent_col"})` → structured error mentioning column
26. `sqlite.stats.statsCorrelation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric columns
27. `sqlite.stats.statsHistogram({table: "test_products", column: "price", buckets: 0})` → error (must be > 0)
28. `sqlite.stats.statsHistogram({table: "test_products", column: "price", buckets: -1})` → error

---

### Category 6: WASM Boundary Verification

For WASM testing only:

29. Confirm window function tools are NOT present in the tool list
30. All 16 non-window stats tools should produce identical results in WASM and Native

---

### Final Cleanup

Drop `stress_stats_table`. Confirm `test_measurements` (200 rows) and `test_products` (16 rows) unchanged.

## Post-Test Procedures

1. **Cleanup**: Drop all `stress_*` objects
2. **Fix EVERY finding** — ❌, ⚠️, 📦
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Re-test**: After server rebuild
6. **Token audit**: Report most expensive block
