# db-mcp Tool Group Testing: [stats-advanced]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're in Native mode. If there is nothing to fix, don't update UNRELEASED.md.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js), apply these adjustments:
> - **Skip window function tools** (items 1-6: `sqlite_window_row_number`, `sqlite_window_rank`, `sqlite_window_lag_lead`, `sqlite_window_running_total`, `sqlite_window_moving_avg`, `sqlite_window_ntile`) — `[NATIVE ONLY]`. These tools are not registered in WASM.
> - **Skip checklist items** 1-6.
> - **Skip Zod items** 7-12.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **stats-advanced** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

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
2. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads
3. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}` — NOT a raw MCP error frame.
4. **Output schema testing**: For **every** tool with an `outputSchema`, confirm valid happy-path calls return structured JSON — NOT a raw MCP `-32602` error.

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

## Group Focus: stats-advanced

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### stats-advanced Group Tools (6)

1. sqlite_window_row_number `[NATIVE ONLY]`
2. sqlite_window_rank `[NATIVE ONLY]`
3. sqlite_window_lag_lead `[NATIVE ONLY]`
4. sqlite_window_running_total `[NATIVE ONLY]`
5. sqlite_window_moving_avg `[NATIVE ONLY]`
6. sqlite_window_ntile `[NATIVE ONLY]`

**Checklist:**

**Window functions `[NATIVE ONLY]`:**

1. `sqlite_window_row_number({table: "test_products", orderBy: "price DESC"})` → products ranked by price
2. `sqlite_window_rank({table: "test_products", orderBy: "price DESC"})` → rank with ties
3. `sqlite_window_running_total({table: "test_orders", column: "total_price", orderBy: "order_date"})` → cumulative totals
4. `sqlite_window_moving_avg({table: "test_measurements", column: "temperature", windowSize: 5, orderBy: "measured_at"})` → moving averages
5. `sqlite_window_lag_lead({table: "test_orders", column: "total_price", direction: "lag", orderBy: "order_date"})` → lag/lead values
6. `sqlite_window_ntile({table: "test_products", buckets: 4, orderBy: "price"})` → quartile assignments

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 7. `sqlite_window_row_number({})` `[NATIVE ONLY]` → handler error
🔴 8. `sqlite_window_rank({})` `[NATIVE ONLY]` → handler error
🔴 9. `sqlite_window_lag_lead({})` `[NATIVE ONLY]` → handler error
🔴 10. `sqlite_window_running_total({})` `[NATIVE ONLY]` → handler error
🔴 11. `sqlite_window_moving_avg({})` `[NATIVE ONLY]` → handler error
🔴 12. `sqlite_window_ntile({})` `[NATIVE ONLY]` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing
