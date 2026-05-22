# db-mcp Tool Group Testing: [stats-basic]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md` with any/all changes/fixes.

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
5. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
6. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
7. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

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

## Group Focus: stats-basic

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### stats-basic Group Tools (17)

8. sqlite_stats_basic
9. sqlite_stats_count
10. sqlite_stats_group_by
11. sqlite_stats_histogram
12. sqlite_stats_percentile
13. sqlite_stats_correlation
14. sqlite_stats_top_n
15. sqlite_stats_distinct
16. sqlite_stats_summary
17. sqlite_stats_frequency
18. sqlite_stats_outliers
19. sqlite_stats_regression
20. sqlite_stats_hypothesis
21. sqlite_stats_detect_anomalies
22. sqlite_stats_detect_bloat
23. sqlite_stats_detect_schema_risks
24. sqlite_stats_sample
25. sqlite_execute_code

## Phase 1: Core Check (batched)

26. `sqlite_stats_basic({table: "test_measurements", column: "temperature"})` → verify `count: 200`, `min`, `max`, `avg` present
27. `sqlite_stats_count({table: "test_products"})` → `{count: 16}`
28. `sqlite_stats_count({table: "test_products", column: "category", distinct: true})` → distinct category count (electronics, accessories, office = 3)
29. `sqlite_stats_group_by({table: "test_measurements", groupByColumn: "sensor_id", valueColumn: "temperature", stat: "avg"})` → 5 groups (sensor_id 1-5) with average temperatures
30. `sqlite_stats_histogram({table: "test_measurements", column: "temperature", buckets: 5})` → 5 buckets
31. `sqlite_stats_percentile({table: "test_measurements", column: "temperature", percentiles: [25, 50, 75, 90]})` → 4 percentile values
32. `sqlite_stats_correlation({table: "test_measurements", column1: "temperature", column2: "humidity"})` → correlation value between -1 and 1
33. `sqlite_stats_top_n({table: "test_products", column: "price", n: 3, orderDirection: "desc"})` → top 3 most expensive products
34. `sqlite_stats_distinct({table: "test_locations", column: "city"})` → distinct city count (6)
35. `sqlite_stats_summary({table: "test_measurements", columns: ["temperature", "humidity", "pressure"]})` → summaries array with 3 entries
36. `sqlite_stats_frequency({table: "test_events", column: "event_type"})` → distribution
37. `sqlite_stats_outliers({table: "test_measurements", column: "temperature"})` → outlier detection result
38. `sqlite_stats_regression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity", degree: 1})` → regression coefficients
39. `sqlite_stats_hypothesis({table: "test_measurements", column: "temperature", testType: "ttest_one", expectedMean: 25})` → verify `statistic` and `pValue` present
40. `sqlite_stats_sample({table: "test_measurements", sampleSize: 10})` → verify `sampleSize`, `totalRows: 200`, `rows` array with ≤ 10 items
41. `sqlite_stats_sample({table: "test_products", sampleSize: 5, selectColumns: ["name", "price"]})` → verify column filtering

**Code mode testing:**

42. `sqlite_execute_code({code: "const result = await sqlite.stats.statsBasic({table: 'test_measurements', column: 'temperature'}); return result;"})` → verify `count: 200`, `min`, `max`, `avg` present
43. `sqlite_execute_code({code: "const result = await sqlite.stats.statsPercentile({table: 'test_measurements', column: 'temperature', percentiles: [50]}); return result;"})` → median value

**Error path testing:**

🔴 44. `sqlite_stats_basic({table: "nonexistent_table_xyz", column: "x"})` → structured error
🔴 45. `sqlite_stats_correlation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric columns
🔴 46. `sqlite_stats_sample({table: "nonexistent_xyz", sampleSize: 5})` → structured error

## Phase 2: Zod Validation Sweep

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error (`{success: false, error: "Validation error: ..."}`), NOT raw MCP error:

🔴 47. `sqlite_stats_basic({})` → handler error
🔴 48. `sqlite_stats_count({})` → handler error
🔴 49. `sqlite_stats_group_by({})` → handler error
🔴 50. `sqlite_stats_histogram({})` → handler error
🔴 51. `sqlite_stats_percentile({})` → handler error
🔴 52. `sqlite_stats_correlation({})` → handler error
🔴 53. `sqlite_stats_top_n({})` → handler error
🔴 54. `sqlite_stats_distinct({})` → handler error
🔴 55. `sqlite_stats_summary({})` → handler error
🔴 56. `sqlite_stats_frequency({})` → handler error
🔴 57. `sqlite_stats_outliers({})` → handler error
🔴 58. `sqlite_stats_regression({})` → handler error
🔴 59. `sqlite_stats_hypothesis({})` → handler error
🔴 60. `sqlite_stats_detect_anomalies({})` → handler error
✅ 36. `sqlite_stats_detect_bloat({})` → success (no required params)
✅ 37. `sqlite_stats_detect_schema_risks({})` → success (no required params)
🔴 61. `sqlite_stats_sample({})` → handler error
🔴 62. `sqlite_execute_code({})` → handler error


---

## Post-Test Procedures

### Reporting Rules
- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in help resources and runtime hints

### After Testing
1. **Triage findings**: If issues were found, create an implementation plan, making sure they are consistent with working patterns in other tools/tool groups. If the plan requires no user decisions, proceed directly to implementation
2. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `src/constants/server-instructions/*.md` (per-group help files) — run `npm run generate:instructions` after editing to regenerate `server-instructions.ts`
   - Test database (`test-server/test.db`)
   - This prompt

### After Implementation
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit all changes — do NOT push
5. **Live re-test**: Test fixes with direct MCP tool calls. I will have already rebuilt and restarted the server.
6. **Final summary**: If no issues found, provide the final summary after testing. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working.
