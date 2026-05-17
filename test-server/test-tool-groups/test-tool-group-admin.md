# db-mcp (SQLite) Tool Group Testing: [admin]

**Ignore WASM content. Test Native Mode Only**

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **admin** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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

> **Note:** String values in test data use **lowercase**. Use case-sensitive matching in queries.

> **Note:** When testing `sqlite_execute_code`, do **not** pass `readonly: true` unless specifically testing read-only filtering.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Report all failures, unexpected behaviors, or unnecessarily large payloads
4. Do not mention what already works well or issues documented in help resources
5. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
6. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.
7. **Deterministic checklist first**: Complete ALL items before freeform exploration.

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

- Raw MCP error (no `success` field) → report as ❌
- `{success: false, error: "..."}` → correct
- Successful response for invalid input → report as ⚠️

### Wrong-Type Numeric Parameter Coercion

For tools with optional numeric parameters, call with `param: "abc"`. Must NOT return raw MCP `-32602`.

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

### Error Consistency Audit

1. Raw error instead of `{success: false}` → ❌
2. Must use `error` field name
3. Orphaned/inline output schemas → ⚠️

### Split Schema Pattern Verification

Verify parameter visibility and alias acceptance.

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_`
- **Temporary views**: Prefix with `temp_view_`
- If DROP fails due to database lock, move on.

---

## Group Focus: admin

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

> **CSV Testing Note:** Use `test-server/sample.csv` (columns: id, name, category, price, quantity, created_at) with **absolute paths** for CSV tool testing — relative paths resolve from IDE CWD.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### admin Group Tools (26)

4. sqlite_generate_series
5. sqlite_create_view
6. sqlite_list_views
7. sqlite_drop_view
8. sqlite_dbstat
9. sqlite_vacuum
10. sqlite_list_virtual_tables
11. sqlite_virtual_table_info
12. sqlite_drop_virtual_table
13. sqlite_create_csv_table
14. sqlite_analyze_csv_schema
15. sqlite_create_rtree_table
16. sqlite_create_series_table
17. sqlite_backup
18. sqlite_analyze
19. sqlite_integrity_check
20. sqlite_optimize
21. sqlite_restore
22. sqlite_verify_backup
23. sqlite_index_stats
24. sqlite_pragma_compile_options
25. sqlite_pragma_database_list
26. sqlite_pragma_optimize
27. sqlite_pragma_settings
28. sqlite_pragma_table_info
29. sqlite_append_insight
30. sqlite_execute_code

**Checklist — Pragma & Inspection:**

1. `sqlite_pragma_database_list` → verify database path matches `test.db`
2. `sqlite_pragma_compile_options` → verify list of compile options returned
3. `sqlite_pragma_compile_options({filter: "FTS"})` → filtered subset containing FTS-related options (`ENABLE_FTS3`, `ENABLE_FTS4`, `ENABLE_FTS5`)
4. `sqlite_pragma_settings({pragma: "journal_mode"})` → `{value: "wal"}`
5. `sqlite_pragma_table_info({table: "test_products"})` → verify columns: id, name, description, price, category, created_at
6. `sqlite_index_stats` → verify index statistics for test database
7. `sqlite_integrity_check` → `ok` result
8. `sqlite_analyze` → success
9. `sqlite_dbstat({summarize: true})` → per-table storage metrics

**Checklist — View Management:**

10. `sqlite_create_view({viewName: "temp_view_orders", selectQuery: "SELECT product_id, COUNT(*) as order_count, SUM(total_price) as revenue FROM test_orders GROUP BY product_id"})` → success
11. `sqlite_list_views` → verify `temp_view_orders` present
12. `sqlite_drop_view({viewName: "temp_view_orders"})` → success

**Checklist — Virtual Tables:**

13. `sqlite_list_virtual_tables` → verify `test_articles_fts` present (Native)
14. `sqlite_virtual_table_info({tableName: "test_articles_fts"})` → verify module and column info (Native)
15. `sqlite_generate_series({start: 1, stop: 5, step: 1})` → 5 values
16. `sqlite_create_rtree_table({tableName: "temp_rtree_test", dimensions: 2})` → R-Tree virtual table created with 2D bounding box columns
17. `sqlite_create_series_table({tableName: "temp_series_test", start: 1, stop: 10})` → regular table created with 10 rows (not a virtual table — see gotcha #15)
18. Cleanup: `sqlite_drop_virtual_table({tableName: "temp_rtree_test"})` and `sqlite_drop_table({table: "temp_series_test"})` (series is a regular table — use `sqlite_drop_table`)

**Checklist — Backup/Restore:**

19. `sqlite_backup({targetPath: "<absolute-path>/test-server/test-backup.db"})` → success with backup file info (⚠️ use absolute path — relative paths resolve from IDE CWD)
20. `sqlite_verify_backup({backupPath: "<absolute-path>/test-server/test-backup.db"})` → integrity verified
21. `sqlite_restore({sourcePath: "<absolute-path>/test-server/test-backup.db"})` → restore from backup, verify success
22. Cleanup: note backup file location for manual removal if desired

**Checklist — Optimization:**

23. `sqlite_vacuum` → success
24. `sqlite_optimize` → success with optimization details
25. `sqlite_pragma_optimize` → success (note: distinct from `sqlite_optimize` — this runs `PRAGMA optimize`)

**Checklist — CSV:**

26. `sqlite_analyze_csv_schema({filePath: "<absolute-path>/test-server/sample.csv"})` → inferred column types (⚠️ CSV requires absolute paths — see gotcha #14)
27. `sqlite_create_csv_table({tableName: "temp_csv_test", filePath: "<absolute-path>/test-server/sample.csv"})` → virtual table created
28. Cleanup: `sqlite_drop_virtual_table({tableName: "temp_csv_test"})`

**Checklist — Insights:**

29. `sqlite_append_insight({insight: "Test insight for verification"})` → success

**Code mode testing:**

30. `sqlite_execute_code({code: "const result = await sqlite.admin.integrityCheck(); return result;"})` → `ok` result
31. `sqlite_execute_code({code: "const result = await sqlite.admin.pragmaSettings({pragma: 'journal_mode'}); return result;"})` → `{pragma: "journal_mode", value: "wal"}`

**Error path testing:**

🔴 32. `sqlite_pragma_table_info({table: "nonexistent_table_xyz"})` → report behavior
🔴 33. `sqlite_virtual_table_info({tableName: "nonexistent_table_xyz"})` → structured error
🔴 34. `sqlite_verify_backup({backupPath: "nonexistent_file.db"})` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 35. `sqlite_backup({})` → handler error
🔴 36. `sqlite_restore({})` → handler error
🔴 37. `sqlite_verify_backup({})` → handler error
🔴 38. `sqlite_pragma_table_info({})` → handler error
🔴 39. `sqlite_pragma_settings({})` → handler error (has required `pragma` param)
🔴 40. `sqlite_append_insight({})` → handler error
🔴 41. `sqlite_create_view({})` → handler error
🔴 42. `sqlite_drop_view({})` → handler error
🔴 43. `sqlite_virtual_table_info({})` → handler error
🔴 44. `sqlite_drop_virtual_table({})` → handler error
🔴 45. `sqlite_create_csv_table({})` → handler error
🔴 46. `sqlite_analyze_csv_schema({})` → handler error
🔴 47. `sqlite_create_rtree_table({})` → handler error
🔴 48. `sqlite_create_series_table({})` → handler error
🔴 49. `sqlite_generate_series({})` → handler error
🔴 50. `sqlite_dbstat({})` → handler error (or success if no required params)

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Test suite, lint + typecheck, changelog
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing

---

## Troubleshooting

### Database is locked / file in use

1. Check for Node.js processes: `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"`
2. WAL/journal files are normal

### Reset script fails

1. Run with `-Verbose`: `.\reset-database.ps1 -Verbose`
2. If `sqlite3` is not in PATH, the script falls back to Node.js with `better-sqlite3`
