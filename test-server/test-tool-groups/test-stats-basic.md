# db-mcp Tool Group Testing: [stats-basic]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're in Native mode. If there is nothing to fix, don't update UNRELEASED.md.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All 16 tools in this basic stats suite are fully WASM-compatible. No items to skip or adjust.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **stats-basic** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

---

## Group Focus: stats-basic

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### stats-basic Group Tools (16)

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
14. sqlite_stats_detect_anomalies
15. sqlite_stats_detect_bloat
16. sqlite_stats_detect_schema_risks
17. sqlite_execute_code

**Checklist:**

1. `sqlite_stats_basic({table: "test_measurements", column: "temperature"})` → verify `count: 200`, `min`, `max`, `avg` present
2. `sqlite_stats_count({table: "test_products"})` → `{count: 16}`
3. `sqlite_stats_count({table: "test_products", column: "category", distinct: true})` → distinct category count (electronics, accessories, office = 3)
4. `sqlite_stats_group_by({table: "test_measurements", groupByColumn: "sensor_id", valueColumn: "temperature", stat: "avg"})` → 5 groups (sensor_id 1-5) with average temperatures
5. `sqlite_stats_histogram({table: "test_measurements", column: "temperature", buckets: 5})` → 5 buckets
6. `sqlite_stats_percentile({table: "test_measurements", column: "temperature", percentiles: [25, 50, 75, 90]})` → 4 percentile values
7. `sqlite_stats_correlation({table: "test_measurements", column1: "temperature", column2: "humidity"})` → correlation value between -1 and 1
8. `sqlite_stats_top_n({table: "test_products", column: "price", n: 3, orderDirection: "desc"})` → top 3 most expensive products
9. `sqlite_stats_distinct({table: "test_locations", column: "city"})` → distinct city count (6)
10. `sqlite_stats_summary({table: "test_measurements", columns: ["temperature", "humidity", "pressure"]})` → summaries array with 3 entries
11. `sqlite_stats_frequency({table: "test_events", column: "event_type"})` → distribution
12. `sqlite_stats_outliers({table: "test_measurements", column: "temperature"})` → outlier detection result
13. `sqlite_stats_regression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity", degree: 1})` → regression coefficients
14. `sqlite_stats_hypothesis({table: "test_measurements", column: "temperature", testType: "ttest_one", expectedMean: 25})` → verify `statistic` and `pValue` present

**Code mode testing:**

15. `sqlite_execute_code({code: "const result = await sqlite.stats.statsBasic({table: 'test_measurements', column: 'temperature'}); return result;"})` → verify `count: 200`, `min`, `max`, `avg` present
16. `sqlite_execute_code({code: "const result = await sqlite.stats.statsPercentile({table: 'test_measurements', column: 'temperature', percentiles: [50]}); return result;"})` → median value

**Error path testing:**

🔴 17. `sqlite_stats_basic({table: "nonexistent_table_xyz", column: "x"})` → structured error
🔴 18. `sqlite_stats_correlation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric columns

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 19. `sqlite_stats_basic({})` → handler error
🔴 20. `sqlite_stats_count({})` → handler error
🔴 21. `sqlite_stats_group_by({})` → handler error
🔴 22. `sqlite_stats_histogram({})` → handler error
🔴 23. `sqlite_stats_percentile({})` → handler error
🔴 24. `sqlite_stats_correlation({})` → handler error
🔴 25. `sqlite_stats_top_n({})` → handler error
🔴 26. `sqlite_stats_distinct({})` → handler error
🔴 27. `sqlite_stats_summary({})` → handler error
🔴 28. `sqlite_stats_frequency({})` → handler error
🔴 29. `sqlite_stats_outliers({})` → handler error
🔴 30. `sqlite_stats_regression({})` → handler error
🔴 31. `sqlite_stats_hypothesis({})` → handler error
🔴 32. `sqlite_stats_detect_anomalies({})` → handler error
🔴 33. `sqlite_stats_detect_bloat({})` → handler error
🔴 34. `sqlite_stats_detect_schema_risks({})` → handler error
🔴 35. `sqlite_execute_code({})` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing
