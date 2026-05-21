# db-mcp Tool Group Testing: [vector-write]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're in Native mode. If there is nothing to fix, don't update UNRELEASED.md.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All 4 vector-write tools are fully WASM-compatible. No items to skip or adjust.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **vector-write** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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

## Group Focus: vector-write

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### vector-write Group Tools (4)

1. sqlite_vector_create_table
2. sqlite_vector_store
3. sqlite_vector_batch_store
4. sqlite_vector_delete

**Checklist:**

**Write operations (use temp tables):**

1. `sqlite_vector_create_table({tableName: "temp_vector_test", dimensions: 8, additionalColumns: [{name: "content", type: "TEXT"}, {name: "category", type: "TEXT"}]})` → success
2. `sqlite_vector_store({table: "temp_vector_test", idColumn: "id", vectorColumn: "vector", id: 1, vector: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]})` → success
3. `sqlite_vector_batch_store({table: "temp_vector_test", idColumn: "id", vectorColumn: "vector", items: [{id: 2, vector: [0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88]}, {id: 3, vector: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]}]})` → `{stored: 2}`
4. Verify rows stored: `sqlite_vector_count({table: "temp_vector_test"})` → `{count: 3}` (use the direct tool or code mode)
5. `sqlite_vector_delete({table: "temp_vector_test", idColumn: "id", ids: [1]})` → success
6. Verify deletion: `sqlite_vector_count({table: "temp_vector_test"})` → `{count: 2}`
7. Cleanup: `sqlite_drop_table({table: "temp_vector_test"})` (using core tool)

**Error path testing:**

🔴 8. `sqlite_vector_store({table: "nonexistent_table_xyz", idColumn: "id", vectorColumn: "vec", id: 1, vector: [1,2,3]})` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 9. `sqlite_vector_create_table({})` → handler error
🔴 10. `sqlite_vector_store({})` → handler error
🔴 11. `sqlite_vector_batch_store({})` → handler error
🔴 12. `sqlite_vector_delete({})` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing
