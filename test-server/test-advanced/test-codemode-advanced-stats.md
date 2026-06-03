# db-mcp Advanced Stress Testing: [stats]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> **Adapter mode**: Call `list_adapters` at the start of testing to determine whether you are running against `native` or `wasm`. Apply the WASM Mode rules below if the adapter is `wasm`.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): Tools marked `[NATIVE ONLY]` in the checklist are unavailable and should be skipped. All unmarked tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> [!WARNING]
> **Stale Build Issues:** The MCP server runs from the compiled `dist/` directory, NOT `src/`. If you encounter inexplicable behavior (e.g., tools executing old logic or throwing validation errors for things already fixed in the source code), the server might be running a stale build. Check if the compiled code in `dist/` matches the source code in `src/`. If out of sync, stop and instruct the user to run `npm run build` and restart the server before continuing testing.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference

> See `code-map.md` in the `test-server/` directory for the complete test database schema (`test_*` tables).

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

> [!NOTE]
> **Tool Availability & Code Mode**: The `sqlite_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a _different_ group (e.g., `sqlite_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `sqlite_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, or a raw text string wrapped in `isError: true` with no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.
>
> ⚠️ **ARCHITECTURAL NOTE — `isError: true` rules for tools with `outputSchema`**: The MCP SDK uses `isError` to decide whether to validate `structuredContent` against the `outputSchema`. Getting this wrong causes either raw `-32602` crashes or valid responses wrapped in error frames. **This is now handled automatically by the server framework in `tools.ts`**, but as a tester, you must verify the SDK output matches this rule:
>
> | Response         | `isError: true` | SDK behavior                                              | Verdict                                |
> | ---------------- | --------------- | --------------------------------------------------------- | -------------------------------------- |
> | `success: true`  | **Absent**      | Validates `structuredContent` → passes                    | ✅ Correct                             |
> | `success: true`  | **Present**     | Skips validation, wraps in error frame                    | ❌ Bug — valid response shown as error |
> | `success: false` | **Present**     | Skips validation (error shape won't match success schema) | ✅ Correct                             |
> | `success: false` | **Absent**      | Validates error against success schema → fails            | ❌ Bug — raw `-32602`                  |
>
> **TL;DR**: `isError: true` on errors, absent on successes. The framework handles this automatically when your handler returns `success: false`.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) An **empty parameters test** (call the tool with `{}`).
     Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
     > **Note on Aliases & Zod**: Tools that support legacy parameter aliases (e.g. `tableName` instead of `table`) often use `.default("")` in their Zod schema so the SDK validation lets the payload reach the handler's alias-resolution logic. For these tools, calling with `{}` will pass Zod validation and correctly trigger a handler-level domain error (e.g. `TABLE_NOT_FOUND`) instead of a strict Zod `invalid_type` error. **This is expected behavior.** Do NOT remove `.default("")` from schemas to force a Zod error, as this will break alias compatibility.
3. **Output Schema Testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
4. **Wrong-Type Coercion**: For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.
   > **Note on Zod Coercion & Validation Errors**: When passing `"abc"` to a numeric field, receiving a structured handler error like `{ success: false, error: "limit: Expected number, received string", code: "VALIDATION_ERROR" }` is **correct**. This proves the global SDK monkey-patch successfully intercepted Zod's `invalid_type` error and transformed it into a structured domain error. Do NOT attempt to "fix" `coerceNumber` or schema definitions to bypass this Zod validation or force a silent fallback to `undefined`.
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
- `sqlite.stats.statsHistogram`
- `sqlite.stats.statsPercentile`
- `sqlite.stats.statsRegression`
- `sqlite.stats.statsCorrelation`
- `sqlite.stats.statsHypothesis`
- `sqlite.stats.statsOutliers`
- `sqlite.stats.statsDetectAnomalies`
- `sqlite.stats.statsDetectBloat`
- `sqlite.stats.statsDetectSchemaRisks`
- `sqlite.stats.windowRowNumber`
- `sqlite.stats.windowRank`
- `sqlite.stats.windowRunningTotal`
- `sqlite.stats.windowMovingAvg`
- `sqlite.stats.windowLagLead`
- `sqlite.stats.windowNtile`
- `sqlite.stats.statsSample`

> **Note**: Tools not listed here (`statsGroupBy`, `statsTopN`, `statsDistinct`, `statsSummary`, `statsFrequency`) are covered in the standard `test-codemode-stats.md` prompt and do not require additional stress testing.

## Phase 1: Boundary Values & Empty States (batched)

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

## Phase 2: Statistical Edge Cases (batched)

10. `sqlite.stats.statsCorrelation({table: "test_products", column1: "id", column2: "id"})` → self-correlation = 1.0
11. `sqlite.stats.statsHypothesis({table: "test_measurements", column: "temperature", testType: "ttest_one", expectedMean: 999})` → should reject null hypothesis
12. `sqlite.stats.statsOutliers({table: "test_measurements", column: "temperature", method: "iqr"})` → IQR-based outliers
13. `sqlite.stats.statsOutliers({table: "test_measurements", column: "temperature", method: "zscore"})` → Z-score outliers (compare with IQR)
14. `sqlite.stats.statsRegression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity", degree: 2})` → quadratic regression

## Phase 3: Anomaly Detection Stress (batched)

15. `sqlite.stats.statsDetectAnomalies({table: "test_measurements", column: "temperature"})` → anomaly detection result
16. `sqlite.stats.statsDetectAnomalies({table: "stress_stats_table", column: "value"})` → graceful handling on mixed NULL/extreme data
17. `sqlite.stats.statsDetectBloat()` → bloat detection
18. `sqlite.stats.statsDetectSchemaRisks()` → schema risk assessment

## Phase 4: Window Functions `[NATIVE ONLY]` (batched)

19. `sqlite.stats.windowRowNumber({table: "test_products", orderBy: "price DESC"})` → 16 rows, Laptop Pro 15 at #1
    > **Note:** `window_row_number` and `window_rank` do NOT have a `direction` param — embed in `orderBy` string.
20. `sqlite.stats.windowRank({table: "test_orders", orderBy: "total_price DESC"})` → ranks with potential ties
21. `sqlite.stats.windowRunningTotal({table: "test_orders", valueColumn: "total_price", orderBy: "order_date"})` → monotonically increasing cumulative total
22. `sqlite.stats.windowMovingAvg({table: "test_measurements", valueColumn: "temperature", windowSize: 10, orderBy: "measured_at"})` → 10-row moving average
23. `sqlite.stats.windowLagLead({table: "test_measurements", valueColumn: "temperature", direction: "lag", offset: 2, orderBy: "measured_at"})` → LAG with offset=2 (skip 1 row)
24. `sqlite.stats.windowLagLead({table: "test_measurements", valueColumn: "temperature", direction: "lead", offset: 1, orderBy: "measured_at", partitionBy: "sensor_id"})` → LEAD partitioned by sensor
25. `sqlite.stats.windowNtile({table: "test_products", buckets: 4, orderBy: "price"})` → 4 groups of ~4 products

## Phase 5: Error Message Quality (batched)

26. `sqlite.stats.statsBasic({table: "nonexistent_table_xyz", column: "x"})` → structured error mentioning table name
27. `sqlite.stats.statsBasic({table: "test_products", column: "nonexistent_col"})` → structured error mentioning column
28. `sqlite.stats.statsCorrelation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric columns
29. `sqlite.stats.statsHistogram({table: "test_products", column: "price", buckets: 0})` → error (must be > 0)
30. `sqlite.stats.statsHistogram({table: "test_products", column: "price", buckets: -1})` → error

## Phase 6: Stats Sample Edge Cases (batched)

31. Create `stress_stats_empty (id INTEGER PRIMARY KEY)` (no rows). `sqlite.stats.statsSample({table: "stress_stats_empty", sampleSize: 10})` → verify behavior on empty table (0 rows or structured error)
32. `sqlite.stats.statsSample({table: "test_measurements", sampleSize: 1})` → exactly 1 row
33. `sqlite.stats.statsSample({table: "test_measurements", sampleSize: 1000})` → capped at 200 (total rows), verify `sampleSize` vs actual returned
34. Run `statsSample({table: "test_measurements", sampleSize: 10})` twice → verify rows differ (randomized sampling)
35. `sqlite.stats.statsSample({table: "test_measurements", sampleSize: 5, whereClause: "sensor_id = 1"})` → filtered sample, verify all returned rows have `sensor_id: 1`
36. `sqlite.stats.statsSample({table: "test_measurements", sampleSize: 0})` → structured error or empty result (boundary: zero sample)
37. `sqlite.stats.statsSample({table: "test_measurements", sampleSize: 5, selectColumns: ["temperature", "humidity"], whereClause: "sensor_id = 1"})` → verify only selected columns returned and all rows match filter

## Phase 7: WASM Boundary Verification (batched)

For WASM testing only:

38. Confirm window function tools are NOT present in the tool list
39. All 17 non-window stats tools should produce identical results in WASM and Native

### Final Cleanup

Drop `stress_stats_table` and `stress_stats_empty`. Confirm `test_measurements` (200 rows) and `test_products` (16 rows) unchanged.

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
