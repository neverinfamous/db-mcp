# db-mcp Tool Group Testing: [stats-basic]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **stats-basic** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB and suggest a concrete optimization.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

1. Use existing `test_*` tables for read operations.
2. Test each tool with realistic inputs based on the schema above.
3. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads.
4. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) a domain error and (b) a **Zod validation error** (call the tool with `{}` empty params). Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
5. **Output schema testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

All tools should return errors as structured objects instead of throwing. The expected pattern:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error — How to Distinguish

| Type                 | Source                                                             | What you see                                                                                                          | Verdict            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields                                                               | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field | Bug — report as ❌ |

### Zod Validation Errors

Calling a tool with wrong parameter types or missing required fields triggers a Zod validation error. If the handler has no outer `try/catch`, this surfaces as a raw MCP error (often `-32602`). Test every tool with `{}` (empty params) if it has required parameters — the response must be a handler error, not an MCP error.

**Fix:** Remove ALL `.min(N)` / `.max(N)` refinements from the schema and validate inside the handler instead.

### Wrong-Type Numeric Parameter Coercion

For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.

### Output Schema Validation Errors

The MCP SDK enforces `additionalProperties: false` on **output** schemas. If a handler returns fields not declared in its output schema, the SDK rejects the response with a raw `-32602` error.

**How to detect:** If a tool call with **correct, valid inputs** returns a raw MCP `-32602` mentioning "does not match the tool's output schema" or "additional properties", report as ❌ with both the tool name and the missing field(s).

### Error Consistency Audit

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌.
2. **Error field name**: All `{success: false}` responses should use `error` as the field name.
3. **Zod validation leaks**: If calling a tool with missing required field produces a raw MCP `-32602` error instead of a structured response, report as ❌.
4. **Output schema leaks**: If calling a tool with valid inputs produces a raw MCP `-32602` mentioning "output schema", report as ❌.

----------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
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

| Type                 | Source                                                             | What you see                                                | Verdict            |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields     | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, `isError: true` — no `success` field | Bug — report as ❌ |

### Zod Validation Errors

**Zod refinement leak pattern:** `.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. **Fix:** Remove refinements from schema, validate inside handler.

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

---

## Group Focus: stats-basic

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### stats-basic Group Tools (17)

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
17. sqlite_stats_sample
18. sqlite_execute_code

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
15. `sqlite_stats_sample({table: "test_measurements", sampleSize: 10})` → verify `sampleSize`, `totalRows: 200`, `rows` array with ≤ 10 items
16. `sqlite_stats_sample({table: "test_products", sampleSize: 5, selectColumns: ["name", "price"]})` → verify column filtering

**Code mode testing:**

17. `sqlite_execute_code({code: "const result = await sqlite.stats.statsBasic({table: 'test_measurements', column: 'temperature'}); return result;"})` → verify `count: 200`, `min`, `max`, `avg` present
18. `sqlite_execute_code({code: "const result = await sqlite.stats.statsPercentile({table: 'test_measurements', column: 'temperature', percentiles: [50]}); return result;"})` → median value

**Error path testing:**

🔴 19. `sqlite_stats_basic({table: "nonexistent_table_xyz", column: "x"})` → structured error
🔴 20. `sqlite_stats_correlation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric columns
🔴 21. `sqlite_stats_sample({table: "nonexistent_xyz", sampleSize: 5})` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 22. `sqlite_stats_basic({})` → handler error
🔴 23. `sqlite_stats_count({})` → handler error
🔴 24. `sqlite_stats_group_by({})` → handler error
🔴 25. `sqlite_stats_histogram({})` → handler error
🔴 26. `sqlite_stats_percentile({})` → handler error
🔴 27. `sqlite_stats_correlation({})` → handler error
🔴 28. `sqlite_stats_top_n({})` → handler error
🔴 29. `sqlite_stats_distinct({})` → handler error
🔴 30. `sqlite_stats_summary({})` → handler error
🔴 31. `sqlite_stats_frequency({})` → handler error
🔴 32. `sqlite_stats_outliers({})` → handler error
🔴 33. `sqlite_stats_regression({})` → handler error
🔴 34. `sqlite_stats_hypothesis({})` → handler error
🔴 35. `sqlite_stats_detect_anomalies({})` → handler error
✅ 36. `sqlite_stats_detect_bloat({})` → success (no required params)
✅ 37. `sqlite_stats_detect_schema_risks({})` → success (no required params)
🔴 38. `sqlite_stats_sample({})` → handler error
🔴 39. `sqlite_execute_code({})` → handler error

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
