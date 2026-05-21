# db-mcp Tool Group Testing: [admin-core]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js), apply these adjustments:
> - **Items 13-15** (`sqlite_backup`, `sqlite_verify_backup`, `sqlite_restore`) — return `{success: false, error: "...WASM mode"}`. Treat as **negative validation** — verify the structured error, do not skip.
> - **Item 10** (`sqlite_pragma_compile_options` FTS filter) — WASM shows FTS3 instead of FTS5.
> - **Item 3** (`sqlite_dbstat` with `summarize: true`) — WASM returns counts-only (JS fallback) instead of per-table storage breakdown.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **admin-core** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**.

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
2. Create temporary views with `temp_view_*` prefix for write operations
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

## Group Focus: admin-core

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### admin-core Group Tools (19)

1. sqlite_create_view
2. sqlite_list_views
3. sqlite_drop_view
4. sqlite_dbstat
5. sqlite_vacuum
6. sqlite_backup
7. sqlite_analyze
8. sqlite_integrity_check
9. sqlite_optimize
10. sqlite_restore
11. sqlite_verify_backup
12. sqlite_index_stats
13. sqlite_pragma_compile_options
14. sqlite_pragma_database_list
15. sqlite_pragma_optimize
16. sqlite_pragma_settings
17. sqlite_pragma_table_info
18. sqlite_append_insight
19. sqlite_execute_code

**Checklist — Pragma & Inspection:**

1. `sqlite_pragma_database_list` → verify database path matches `test.db`
2. `sqlite_index_stats` → verify index statistics for test database
3. `sqlite_dbstat({summarize: true})` → per-table storage metrics
4. `sqlite_integrity_check` → `ok` result
5. `sqlite_analyze` → success
6. `sqlite_vacuum` → success
7. `sqlite_optimize` → success with optimization details
8. `sqlite_pragma_optimize` → success (note: distinct from `sqlite_optimize` — this runs `PRAGMA optimize`)
9. `sqlite_pragma_compile_options` → verify list of compile options returned
10. `sqlite_pragma_compile_options({filter: "FTS"})` → filtered subset containing FTS-related options (`ENABLE_FTS3`, `ENABLE_FTS4`, `ENABLE_FTS5`)
11. `sqlite_pragma_settings({pragma: "journal_mode"})` → `{value: "wal"}`
12. `sqlite_pragma_table_info({table: "test_products"})` → verify columns: id, name, description, price, category, created_at

**Checklist — Backup/Restore:**

13. `sqlite_backup({targetPath: "<absolute-path>/test-server/test-backup.db"})` → success with backup file info (⚠️ use absolute path — relative paths resolve from IDE CWD)
14. `sqlite_verify_backup({backupPath: "<absolute-path>/test-server/test-backup.db"})` → integrity verified
15. `sqlite_restore({sourcePath: "<absolute-path>/test-server/test-backup.db"})` → restore from backup, verify success
16. Cleanup: note backup file location for manual removal if desired

**Checklist — View Management:**

17. `sqlite_create_view({viewName: "temp_view_orders", selectQuery: "SELECT product_id, COUNT(*) as order_count, SUM(total_price) as revenue FROM test_orders GROUP BY product_id"})` → success
18. `sqlite_list_views` → verify `temp_view_orders` present
19. `sqlite_drop_view({viewName: "temp_view_orders"})` → success

**Checklist — Insights:**

20. `sqlite_append_insight({insight: "Test insight for verification"})` → success

**Code mode testing:**

21. `sqlite_execute_code({code: "const result = await sqlite.admin.integrityCheck(); return result;"})` → `ok` result
22. `sqlite_execute_code({code: "const result = await sqlite.admin.pragmaSettings({pragma: 'journal_mode'}); return result;"})` → `{pragma: "journal_mode", value: "wal"}`

**Error path testing:**

🔴 23. `sqlite_pragma_table_info({table: "nonexistent_table_xyz"})` → report behavior
🔴 24. `sqlite_verify_backup({backupPath: "nonexistent_file.db"})` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 25. `sqlite_backup({})` → handler error
🔴 26. `sqlite_restore({})` → handler error
🔴 27. `sqlite_verify_backup({})` → handler error
🔴 28. `sqlite_pragma_table_info({})` → handler error
🔴 29. `sqlite_pragma_settings({})` → handler error (has required `pragma` param)
🔴 30. `sqlite_append_insight({})` → handler error
🔴 31. `sqlite_create_view({})` → handler error
🔴 32. `sqlite_drop_view({})` → handler error
🔴 33. `sqlite_dbstat({})` → handler error (or success if no required params)

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing
