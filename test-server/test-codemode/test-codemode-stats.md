# db-mcp Code Mode Testing: [stats]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're currently in Native mode.
> If there is nothing to fix, don't update UNRELEASED.md.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **stats** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js), apply these adjustments:

- **Skip Phase 3** entirely — all 6 window function tools (items 18-23) are `[NATIVE ONLY]`.
- **Phase 4**: Skip item 28 (`windowRowNumber`) — `[NATIVE ONLY]`.
- **Phase 5**: Skip items 45-50 (all `window*` tools) — `[NATIVE ONLY]`.
- **Phase 6**: Skip item 52 (`windowMovingAvg`) — `[NATIVE ONLY]`.
- All other phases (1, 2, 7) are fully WASM-compatible.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — monitor `metrics.tokenEstimate`.

## Test Database Schema

| Table             | Rows | Key Columns                                                   |
| ----------------- | ---- | ------------------------------------------------------------- |
| test_products     | 16   | id, name, price (REAL), category (3 values: electronics, accessories, office) |
| test_orders       | 20   | id, product_id, total_price, order_date, status               |
| test_measurements | 200  | id, sensor_id (INT 1-5), temperature, humidity, pressure, measured_at |
| test_events       | 100  | id, event_type (page_view, click, purchase, login, search), user_id, event_date |
| test_locations    | 15   | id, name, city (6 cities), latitude, longitude                |

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** Report as ❌.

1. **Batched scripting**: Bundle checks with `failures` array.
2. **Error path testing**: Every tool with `{}` (Zod) and domain error.
3. **Token tracking**: Monitor `metrics.tokenEstimate`.
4. **Coverage Matrix**: `| Tool | Happy Path | Domain Error | Zod Error |`
5. **Deterministic checklist first**.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

## Cleanup

- No write operations in stats — no cleanup needed.

---

## Phase 1: Core Stats — Happy Paths (batched)

> Bundle items 1-14 into 1-2 `sqlite_execute_code` calls.

1. `sqlite.stats.statsBasic({table: "test_measurements", column: "temperature"})` → `count: 200`, `min`, `max`, `avg` present inside `stats` object
2. `sqlite.stats.statsCount({table: "test_products"})` → `{count: 16}`
3. `sqlite.stats.statsCount({table: "test_products", column: "category", distinct: true})` → 3 (electronics, accessories, office)
4. `sqlite.stats.statsGroupBy({table: "test_measurements", groupByColumn: "sensor_id", valueColumn: "temperature", stat: "avg"})` → 5 results in `results` array
5. `sqlite.stats.statsHistogram({table: "test_measurements", column: "temperature", buckets: 5})` → 5 buckets
6. `sqlite.stats.statsPercentile({table: "test_measurements", column: "temperature", percentiles: [25, 50, 75, 90]})` → 4 values
7. `sqlite.stats.statsCorrelation({table: "test_measurements", column1: "temperature", column2: "humidity"})` → value between -1 and 1
8. `sqlite.stats.statsTopN({table: "test_products", column: "price", n: 3, orderDirection: "desc"})` → top 3 in `rows` array, `Laptop Pro 15` at 1299.99 first
9. `sqlite.stats.statsDistinct({table: "test_locations", column: "city"})` → 6 cities
10. `sqlite.stats.statsSummary({table: "test_measurements", columns: ["temperature", "humidity", "pressure"]})` → 3 summaries
11. `sqlite.stats.statsFrequency({table: "test_events", column: "event_type"})` → 5 event types in `distribution` array, ~20 each
12. `sqlite.stats.statsOutliers({table: "test_measurements", column: "temperature"})` → outlier detection result
13. `sqlite.stats.statsRegression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity", degree: 1})` → regression coefficients
14. `sqlite.stats.statsHypothesis({table: "test_measurements", column: "temperature", testType: "ttest_one", expectedMean: 25})` → `statistic` and `pValue` present

---

## Phase 2: Anomaly Detection Suite — Happy Paths (batched)

15. `sqlite.stats.detectAnomalies({table: "test_measurements", column: "temperature"})` → `anomalies` array present, `riskLevel` low
16. `sqlite.stats.detectBloat()` → bloat detection (may return empty if no bloat)
17. `sqlite.stats.detectSchemaRisks()` → `tables` array present, `highRiskCount` 0

---

## Phase 3: Window Functions `[NATIVE ONLY]` — Happy Paths (batched)

18. `sqlite.stats.windowRowNumber({table: "test_products", orderBy: "price DESC"})` → ranked by price
19. `sqlite.stats.windowRank({table: "test_products", orderBy: "price DESC"})` → rank with ties
20. `sqlite.stats.windowRunningTotal({table: "test_orders", valueColumn: "total_price", orderBy: "order_date"})` → cumulative totals
21. `sqlite.stats.windowMovingAvg({table: "test_measurements", valueColumn: "temperature", windowSize: 5, orderBy: "measured_at"})` → moving averages
22. `sqlite.stats.windowLagLead({table: "test_orders", column: "total_price", direction: "lag", orderBy: "order_date"})` → lag values
23. `sqlite.stats.windowNtile({table: "test_products", buckets: 4, orderBy: "price"})` → quartiles

---

## Phase 4: Stats Domain Errors (batched)

🔴 24. `sqlite.stats.statsBasic({table: "nonexistent_xyz", column: "x"})` → `{success: false}`
🔴 25. `sqlite.stats.statsBasic({table: "test_products", column: "nonexistent_col"})` → report behavior
🔴 26. `sqlite.stats.statsCorrelation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric
🔴 27. `sqlite.stats.detectAnomalies({table: "nonexistent_xyz", column: "x"})` → `{success: false}`
🔴 28. `sqlite.stats.windowRowNumber({table: "nonexistent_xyz", orderBy: "x"})` `[NATIVE ONLY]` → `{success: false}`

---

## Phase 5: Stats Zod Validation (batched)

🔴 29. `sqlite.stats.statsBasic({})` → `{success: false}`
🔴 30. `sqlite.stats.statsCount({})` → `{success: false}`
🔴 31. `sqlite.stats.statsGroupBy({})` → `{success: false}`
🔴 32. `sqlite.stats.statsHistogram({})` → `{success: false}`
🔴 33. `sqlite.stats.statsPercentile({})` → `{success: false}`
🔴 34. `sqlite.stats.statsCorrelation({})` → `{success: false}`
🔴 35. `sqlite.stats.statsTopN({})` → `{success: false}`
🔴 36. `sqlite.stats.statsDistinct({})` → `{success: false}`
🔴 37. `sqlite.stats.statsSummary({})` → `{success: false}`
🔴 38. `sqlite.stats.statsFrequency({})` → `{success: false}`
🔴 39. `sqlite.stats.statsOutliers({})` → `{success: false}`
🔴 40. `sqlite.stats.statsRegression({})` → `{success: false}`
🔴 41. `sqlite.stats.statsHypothesis({})` → `{success: false}`
🔴 42. `sqlite.stats.detectAnomalies({})` → `{success: false}`
🔴 43. `sqlite.stats.detectBloat({})` → `{success: false}` or success (no required params)
🔴 44. `sqlite.stats.detectSchemaRisks({})` → `{success: false}` or success (no required params)
🔴 45. `sqlite.stats.windowRowNumber({})` `[NATIVE ONLY]` → `{success: false}`
🔴 46. `sqlite.stats.windowRank({})` `[NATIVE ONLY]` → `{success: false}`
🔴 47. `sqlite.stats.windowLagLead({})` `[NATIVE ONLY]` → `{success: false}`
🔴 48. `sqlite.stats.windowRunningTotal({})` `[NATIVE ONLY]` → `{success: false}`
🔴 49. `sqlite.stats.windowMovingAvg({})` `[NATIVE ONLY]` → `{success: false}`
🔴 50. `sqlite.stats.windowNtile({})` `[NATIVE ONLY]` → `{success: false}`

---

## Phase 6: Wrong-Type Numeric Coercion (batched)

🔴 51. `sqlite.stats.statsHistogram({table: "test_measurements", column: "temperature", buckets: "abc"})` → coerced default (success) or handler error, NOT raw MCP
🔴 52. `sqlite.stats.windowMovingAvg({table: "test_measurements", valueColumn: "temperature", windowSize: "abc", orderBy: "measured_at"})` `[NATIVE ONLY]` → coerced default (success) or handler error

---

## Phase 6.5: Gotcha Edge Cases (batched)

53. `sqlite.stats.statsTopN({table: "test_articles", column: "title", n: 3})` → verify auto-exclusion of long-content columns (`body`, `description`, `notes`, etc.) from output when `selectColumns` is omitted (gotcha #13)
54. `sqlite.stats.statsTopN({table: "test_articles", column: "title", n: 3, selectColumns: ["title", "body"]})` → explicit `selectColumns` overrides auto-exclusion — `body` should appear in results (gotcha #13)
55. `sqlite.stats.detectBloat({includeZeroRisk: true})` → includes zero-risk tables in output (verify param is accepted and changes result set)
56. `sqlite.stats.detectSchemaRisks({includeZeroRisk: true})` → includes zero-risk tables in output (verify param is accepted and changes result set)

---

## Phase 7: Multi-Step Workflow

### 7.1 — Statistical analysis pipeline

```javascript
const failures = [];
const basic = await sqlite.stats.statsBasic({table: "test_measurements", column: "temperature"});
if (!basic || basic.stats.count !== 200) failures.push("basic stats: count mismatch");

const pct = await sqlite.stats.statsPercentile({table: "test_measurements", column: "temperature", percentiles: [50]});
const corr = await sqlite.stats.statsCorrelation({table: "test_measurements", column1: "temperature", column2: "humidity"});
const top = await sqlite.stats.statsTopN({table: "test_products", column: "price", n: 3});

return {
  failures,
  success: failures.length === 0,
  summary: {
    tempRange: `${basic.stats.min} - ${basic.stats.max}`,
    median: pct.percentiles,
    correlation: corr.correlation,
    topProducts: top.rows
  }
};
```

---

### 7.2 — Empty table boundary

```javascript
const failures = [];
await sqlite.core.createTable({
  table: "temp_cm_stats_empty",
  columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "value", type: "REAL"}]
});
const basic = await sqlite.stats.statsBasic({table: "temp_cm_stats_empty", column: "value"});
// Should return count: 0 or {success: false} — must not crash
if (basic.success === false) {
  // Structured error is acceptable for empty table
} else if (basic.stats?.count !== 0) {
  failures.push("expected count 0 for empty table, got: " + basic.stats?.count);
}
await sqlite.core.dropTable({table: "temp_cm_stats_empty"});
return { failures, success: failures.length === 0, basicResult: basic };
```

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Token audit**: Report most expensive block
6. **Final summary**: After testing/re-testing
