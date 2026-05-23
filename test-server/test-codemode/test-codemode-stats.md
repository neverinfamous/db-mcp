# db-mcp Code Mode Testing: [stats]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> We're currently testing Native mode.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
> *No specific table schema required for this test group.*

## Reporting Format
- ❌ **Fail**: Tool errors or produces incorrect results (include error message)
- ⚠️ **Issue**: Unexpected behavior or improvement opportunity
- 📦 **Payload**: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB and suggest a concrete optimization.
- ✅ **Confirmed**: (Use inline only during testing; omit from Final Summary)

### Error Message Quality Rating
| Level                                  | Verdict |
| -------------------------------------- | ------- |
| 5 - Excellent (name + code + context)  | ✅      |
| 4 - Good (name)                        | ✅      |
| 3 - Adequate (raw SQLite, informative) | ⚠️      |
| 2 - Poor (no object name)              | ⚠️      |
| 1 - Useless (generic)                  | ❌      |

## Testing Requirements & Error Standards

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) A **Zod validation error** (call the tool with `{}` empty params).
   Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
3. **Output Schema Testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
4. **Wrong-Type Coercion**: For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.
5. **Proactive Improvements**: You are highly encouraged to proactively improve functionality, performance, security, agent experience, and token/payload efficiency whenever you see an opportunity during your testing and handler code review.
   > **CRITICAL**: Architectural consistency is paramount. Do not introduce undocumented architectural deviations. If you implement a structural or architectural improvement in one tool, you must apply it symmetrically to other applicable tools in the group or project.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
7. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
8. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

### Structured Error Response Pattern
All tools should return errors as structured objects instead of throwing. The expected pattern:
```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                                                                          | Verdict            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields                                                               | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field | Bug — report as ❌ |

## Naming & Cleanup
- **Temporary tables**: `temp_*` (or `stress_*`) prefix
- **Temporary views**: `temp_view_*` (or `stress_view_*`) prefix
- Drop at the end of the script. If DROP fails due to lock, note and move on.

---

## Group Focus: stats

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.stats.statsBasic`
- `sqlite.stats.statsCount`
- `sqlite.stats.statsGroupBy`
- `sqlite.stats.statsHistogram`
- `sqlite.stats.statsPercentile`
- `sqlite.stats.statsCorrelation`
- `sqlite.stats.statsTopN`
- `sqlite.stats.statsDistinct`
- `sqlite.stats.statsSummary`
- `sqlite.stats.statsFrequency`
- `sqlite.stats.statsOutliers`
- `sqlite.stats.statsRegression`
- `sqlite.stats.statsHypothesis`
- `sqlite.stats.statsSample`
- `sqlite.stats.detectAnomalies`
- `sqlite.stats.detectBloat`
- `sqlite.stats.detectSchemaRisks`
- `sqlite.stats.windowRowNumber`
- `sqlite.stats.windowRank`
- `sqlite.stats.windowRunningTotal`
- `sqlite.stats.windowMovingAvg`
- `sqlite.stats.windowLagLead`
- `sqlite.stats.windowNtile`
- `sqlite.core.createTable`
- `sqlite.core.dropTable`

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
15. `sqlite.stats.statsSample({table: "test_measurements", sampleSize: 10})` → `sampleSize: 10`, `totalRows: 200`, `rows` array with ≤ 10 rows
16. `sqlite.stats.statsSample({table: "test_products", sampleSize: 5, selectColumns: ["name", "price"]})` → rows contain only `name` and `price` columns


## Phase 2: Anomaly Detection Suite — Happy Paths (batched)

17. `sqlite.stats.detectAnomalies({table: "test_measurements", column: "temperature"})` → `anomalies` array present, `riskLevel` low
18. `sqlite.stats.detectBloat()` → bloat detection (may return empty if no bloat)
19. `sqlite.stats.detectSchemaRisks()` → `tables` array present, `highRiskCount` 0


## Phase 3: Window Functions `[NATIVE ONLY]` — Happy Paths (batched)

20. `sqlite.stats.windowRowNumber({table: "test_products", orderBy: "price DESC"})` → ranked by price
21. `sqlite.stats.windowRank({table: "test_products", orderBy: "price DESC"})` → rank with ties
22. `sqlite.stats.windowRunningTotal({table: "test_orders", valueColumn: "total_price", orderBy: "order_date"})` → cumulative totals
23. `sqlite.stats.windowMovingAvg({table: "test_measurements", valueColumn: "temperature", windowSize: 5, orderBy: "measured_at"})` → moving averages
24. `sqlite.stats.windowLagLead({table: "test_orders", column: "total_price", direction: "lag", orderBy: "order_date"})` → lag values
25. `sqlite.stats.windowNtile({table: "test_products", buckets: 4, orderBy: "price"})` → quartiles


## Phase 4: Stats Domain Errors (batched)

🔴 26. `sqlite.stats.statsBasic({table: "nonexistent_xyz", column: "x"})` → `{success: false}`
🔴 27. `sqlite.stats.statsBasic({table: "test_products", column: "nonexistent_col"})` → report behavior
🔴 28. `sqlite.stats.statsCorrelation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric
🔴 29. `sqlite.stats.detectAnomalies({table: "nonexistent_xyz", column: "x"})` → `{success: false}`
🔴 30. `sqlite.stats.statsSample({table: "nonexistent_xyz", sampleSize: 5})` → `{success: false}`
🔴 31. `sqlite.stats.windowRowNumber({table: "nonexistent_xyz", orderBy: "x"})` `[NATIVE ONLY]` → `{success: false}`


## Phase 5: Wrong-Type Numeric Coercion (batched)

🔴 32. `sqlite.stats.statsHistogram({table: "test_measurements", column: "temperature", buckets: "abc"})` → coerced default (success) or handler error, NOT raw MCP
🔴 33. `sqlite.stats.windowMovingAvg({table: "test_measurements", valueColumn: "temperature", windowSize: "abc", orderBy: "measured_at"})` `[NATIVE ONLY]` → coerced default (success) or handler error


## Phase 6: Gotcha Edge Cases (batched)

34. `sqlite.stats.statsTopN({table: "test_articles", column: "title", n: 3})` → verify auto-exclusion of long-content columns (`body`, `description`, `notes`, etc.) from output when `selectColumns` is omitted (gotcha #13)
35. `sqlite.stats.statsTopN({table: "test_articles", column: "title", n: 3, selectColumns: ["title", "body"]})` → explicit `selectColumns` overrides auto-exclusion — `body` should appear in results (gotcha #13)
36. `sqlite.stats.detectBloat({includeZeroRisk: true})` → includes zero-risk tables in output (verify param is accepted and changes result set)
37. `sqlite.stats.detectSchemaRisks({includeZeroRisk: true})` → includes zero-risk tables in output (verify param is accepted and changes result set)


## Phase 7: Multi-Step Workflow

### 7.1 — Statistical analysis pipeline

```javascript
const failures = [];
const basic = await sqlite.stats.statsBasic({
  table: "test_measurements",
  column: "temperature",
});
if (!basic || basic.stats.count !== 200)
  failures.push("basic stats: count mismatch");

const pct = await sqlite.stats.statsPercentile({
  table: "test_measurements",
  column: "temperature",
  percentiles: [50],
});
const corr = await sqlite.stats.statsCorrelation({
  table: "test_measurements",
  column1: "temperature",
  column2: "humidity",
});
const top = await sqlite.stats.statsTopN({
  table: "test_products",
  column: "price",
  n: 3,
});

return {
  failures,
  success: failures.length === 0,
  summary: {
    tempRange: `${basic.stats.min} - ${basic.stats.max}`,
    median: pct.percentiles,
    correlation: corr.correlation,
    topProducts: top.rows,
  },
};
```


### 7.2 — Empty table boundary

```javascript
const failures = [];
await sqlite.core.createTable({
  table: "temp_cm_stats_empty",
  columns: [
    { name: "id", type: "INTEGER", primaryKey: true },
    { name: "value", type: "REAL" },
  ],
});
const basic = await sqlite.stats.statsBasic({
  table: "temp_cm_stats_empty",
  column: "value",
});
// Should return count: 0 or {success: false} — must not crash
if (basic.success === false) {
  // Structured error is acceptable for empty table
} else if (basic.stats?.count !== 0) {
  failures.push("expected count 0 for empty table, got: " + basic.stats?.count);
}
await sqlite.core.dropTable({ table: "temp_cm_stats_empty" });
return { failures, success: failures.length === 0, basicResult: basic };
```


## Phase 8: Zod Validation Sweep

🔴 38. `sqlite.stats.statsBasic({})` → `{success: false}`
🔴 39. `sqlite.stats.statsCount({})` → `{success: false}`
🔴 40. `sqlite.stats.statsGroupBy({})` → `{success: false}`
🔴 41. `sqlite.stats.statsHistogram({})` → `{success: false}`
🔴 42. `sqlite.stats.statsPercentile({})` → `{success: false}`
🔴 43. `sqlite.stats.statsCorrelation({})` → `{success: false}`
🔴 44. `sqlite.stats.statsTopN({})` → `{success: false}`
🔴 45. `sqlite.stats.statsDistinct({})` → `{success: false}`
🔴 46. `sqlite.stats.statsSummary({})` → `{success: false}`
🔴 47. `sqlite.stats.statsFrequency({})` → `{success: false}`
🔴 48. `sqlite.stats.statsOutliers({})` → `{success: false}`
🔴 49. `sqlite.stats.statsRegression({})` → `{success: false}`
🔴 50. `sqlite.stats.statsHypothesis({})` → `{success: false}`
🔴 51. `sqlite.stats.detectAnomalies({})` → `{success: false}`
🔴 52. `sqlite.stats.detectBloat({})` → `{success: false}` or success (no required params)
🔴 53. `sqlite.stats.detectSchemaRisks({})` → `{success: false}` or success (no required params)
🔴 54. `sqlite.stats.statsSample({})` → `{success: false}` handler error
🔴 55. `sqlite.stats.windowRowNumber({})` `[NATIVE ONLY]` → `{success: false}`
🔴 56. `sqlite.stats.windowRank({})` `[NATIVE ONLY]` → `{success: false}`
🔴 57. `sqlite.stats.windowLagLead({})` `[NATIVE ONLY]` → `{success: false}`
🔴 58. `sqlite.stats.windowRunningTotal({})` `[NATIVE ONLY]` → `{success: false}`
🔴 59. `sqlite.stats.windowMovingAvg({})` `[NATIVE ONLY]` → `{success: false}`
🔴 60. `sqlite.stats.windowNtile({})` `[NATIVE ONLY]` → `{success: false}`

---

## Post-Test Procedures

### Reporting Rules
- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in help resources and runtime hints

### After Testing
1. **Triage findings**: If issues were found, create an implementation plan, making sure they are consistent with working patterns in other tools/tool groups. If the plan requires no user decisions, proceed directly to implementation.
2. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `src/constants/server-instructions/*.md` (per-group help files) — run `npm run generate:instructions` after editing to regenerate `server-instructions.ts`
   - Test database (`test-server/test.db`)
   - This prompt

### After Implementation
3. **Document**: Update `UNRELEASED.md`, `code-map.md` (if appropriate), and create a `memory-journal-mcp` entry detailing the changes and improvements made.
4. **Commit**: Stage and commit all changes — do NOT push.
5. **Validate**: Halt your work and instruct the user to validate the changes by running the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself. Also instruct the user to rebuild and restart the server.
6. **Live re-test**: Once the user confirms the server is restarted, test the fixes with direct MCP tool calls to confirm they are working.
7. **Final summary**: If no issues found, provide the final summary. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working.
