# db-mcp Tool Group Testing: [admin-extensions]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're currently in Native mode.
> If there is nothing to fix, don't update UNRELEASED.md.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js), apply these adjustments:
> - **Items 3-4** (`sqlite_create_csv_table`, `sqlite_analyze_csv_schema`) — return `{success: false}` in WASM (CSV extension unavailable). Treat as **negative validation**.
> - **Item 5** (`sqlite_create_rtree_table`) — returns `{success: false}` in WASM (R-Tree unavailable). Treat as **negative validation**.
> - **Item 1** (`sqlite_list_virtual_tables`) — `test_articles_fts` may appear but is not queryable.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **admin-extensions** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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
2. Create temporary tables with `temp_*` prefix for write operations
3. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
4. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.

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

## Group Focus: admin-extensions

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

> **CSV Testing Note:** Use `test-server/sample.csv` (columns: id, name, category, price, quantity, created_at) with **absolute paths** for CSV tool testing — relative paths resolve from IDE CWD.

### admin-extensions Group Tools (8)

1. sqlite_generate_series
2. sqlite_list_virtual_tables
3. sqlite_virtual_table_info
4. sqlite_drop_virtual_table
5. sqlite_create_csv_table
6. sqlite_analyze_csv_schema
7. sqlite_create_rtree_table
8. sqlite_create_series_table

**Checklist:**

**Virtual Tables:**

1. `sqlite_list_virtual_tables` → verify `test_articles_fts` present (Native)
2. `sqlite_virtual_table_info({tableName: "test_articles_fts"})` → verify module and column info (Native)
3. `sqlite_generate_series({start: 1, stop: 5, step: 1})` → 5 values
4. `sqlite_create_rtree_table({tableName: "temp_rtree_test", dimensions: 2})` → R-Tree virtual table created with 2D bounding box columns
5. `sqlite_create_series_table({tableName: "temp_series_test", start: 1, stop: 10})` → regular table created with 10 rows (not a virtual table — see gotcha #14)
6. Cleanup: `sqlite_drop_virtual_table({tableName: "temp_rtree_test"})` and `sqlite_drop_table({table: "temp_series_test"})` (series is a regular table — use core `sqlite_drop_table`)

**CSV:**

7. `sqlite_analyze_csv_schema({filePath: "<absolute-path>/test-server/sample.csv"})` → inferred column types (⚠️ CSV requires absolute paths — see gotcha #13)
8. `sqlite_create_csv_table({tableName: "temp_csv_test", filePath: "<absolute-path>/test-server/sample.csv"})` → virtual table created
9. Cleanup: `sqlite_drop_virtual_table({tableName: "temp_csv_test"})`

**Error path testing:**

🔴 10. `sqlite_virtual_table_info({tableName: "nonexistent_table_xyz"})` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 11. `sqlite_virtual_table_info({})` → handler error
🔴 12. `sqlite_drop_virtual_table({})` → handler error
🔴 13. `sqlite_create_csv_table({})` → handler error
🔴 14. `sqlite_analyze_csv_schema({})` → handler error
🔴 15. `sqlite_create_rtree_table({})` → handler error
🔴 16. `sqlite_create_series_table({})` → handler error
🔴 17. `sqlite_generate_series({})` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing
