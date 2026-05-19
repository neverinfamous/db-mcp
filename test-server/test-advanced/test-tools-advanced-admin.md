# Advanced Stress Test — db-mcp — [admin]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode).

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js), apply these adjustments:

- **Category 2**: Item 6 (`createRtreeTable`) — returns `{success: false}` in WASM (R-Tree unavailable). Treat as **negative validation**. Item 7 (`listVirtualTables`) — `test_articles_fts` may appear but is not queryable.
- **Category 3**: All 3 items (11-13) return `{success: false, error: "...WASM mode"}`. Treat as **negative validation** — verify the structured error, do not skip.
- **Category 4**: Item 16 (`pragmaCompileOptions` FTS filter) — WASM shows FTS3 instead of FTS5.
- **Category 5**: Items 21-22 (`analyzeCsvSchema`, `createCsvTable`) — return `{success: false}` in WASM (CSV extension unavailable). Treat as **negative validation**.
- All other categories are WASM-compatible.

## Code Mode Execution

- **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

All tests via `sqlite_execute_code`. Use `sqlite.admin.*` for admin tools, `sqlite.core.*` for read/write.
State persists across calls. Do NOT pass `readonly: true`. Group related tests into single calls.

## Test Database Schema

| Table             | Rows | Key Columns                                                   |
| ----------------- | ---- | ------------------------------------------------------------- |
| test_products     | 16   | id, name, price, category, created_at                         |
| test_orders       | 20   | id, product_id (FK→test_products), total_price, status        |
| test_articles_fts | —    | FTS5 virtual table (title, body) `[NATIVE ONLY]`              |

> **CSV testing**: Use absolute path `C:\Users\chris\Desktop\db-mcp\test-server\sample.csv`.

## Naming & Cleanup

- **Temporary tables**: `stress_*` prefix
- **Temporary views**: `stress_view_*` prefix
- Drop at end. If DROP fails due to lock, note and move on.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`) | ✅ Confirmed (inline only)

### Error Message Quality Rating

| Level | Verdict |
| --- | --- |
| 5 - Excellent (name + code + context) | ✅ |
| 4 - Good (name) | ✅ |
| 3 - Adequate (raw SQLite, informative) | ⚠️ |
| 2 - Poor (no object name) | ⚠️ |
| 1 - Useless (generic) | ❌ |

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## admin Group Tools (26)

1. sqlite_pragma_database_list
2. sqlite_pragma_compile_options
3. sqlite_pragma_settings
4. sqlite_pragma_table_info
5. sqlite_pragma_optimize
6. sqlite_index_stats
7. sqlite_integrity_check
8. sqlite_analyze
9. sqlite_dbstat
10. sqlite_vacuum
11. sqlite_optimize
12. sqlite_create_view
13. sqlite_list_views
14. sqlite_drop_view
15. sqlite_list_virtual_tables
16. sqlite_virtual_table_info
17. sqlite_drop_virtual_table
18. sqlite_create_csv_table
19. sqlite_analyze_csv_schema
20. sqlite_create_rtree_table
21. sqlite_create_series_table
22. sqlite_generate_series
23. sqlite_backup
24. sqlite_restore
25. sqlite_verify_backup
26. sqlite_append_insight

---

### Category 1: View Lifecycle Stress

1. `sqlite.admin.createView({viewName: "stress_view_orders", selectQuery: "SELECT product_id, COUNT(*) as cnt FROM test_orders GROUP BY product_id"})` → success
2. `sqlite.admin.listViews()` → verify `stress_view_orders` present
3. `sqlite.admin.dropView({viewName: "stress_view_orders"})` → success
4. `sqlite.admin.dropView({viewName: "stress_view_orders"})` → structured error or "not found" (not raw crash)
5. `sqlite.admin.createView({viewName: "stress_view_orders", selectQuery: "SELECT product_id, COUNT(*) as cnt FROM test_orders GROUP BY product_id"})` → recreate success

---

### Category 2: Virtual Table Edge Cases

6. `sqlite.admin.createRtreeTable({tableName: "stress_rtree_test", dimensions: 2})` → success
7. `sqlite.admin.listVirtualTables()` → verify `stress_rtree_test` present alongside `test_articles_fts` (Native)
8. `sqlite.admin.virtualTableInfo({tableName: "stress_rtree_test"})` → correct module and column info
9. `sqlite.admin.dropVirtualTable({tableName: "stress_rtree_test"})` → success
10. `sqlite.admin.virtualTableInfo({tableName: "nonexistent_vtable_xyz"})` → structured error

---

### Category 3: Backup/Restore Integrity

> Use absolute path: `C:\Users\chris\Desktop\db-mcp\test-server\stress-backup.db`

11. `sqlite.admin.backup({targetPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-backup.db"})` → success
12. `sqlite.admin.verifyBackup({backupPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-backup.db"})` → integrity verified
13. `sqlite.admin.verifyBackup({backupPath: "nonexistent_file.db"})` → structured error
14. Note backup file for manual removal

---

### Category 4: Pragma Edge Cases

15. `sqlite.admin.pragmaCompileOptions({filter: "THREAD"})` → filtered result subset
16. `sqlite.admin.pragmaCompileOptions({filter: "FTS"})` → filtered to FTS options
17. `sqlite.admin.pragmaSettings({pragma: "journal_mode"})` → `{value: "wal"}`
18. `sqlite.admin.pragmaTableInfo({table: "nonexistent_table_xyz"})` → report behavior

---

### Category 5: Series & CSV Edge Cases

19. `sqlite.admin.generateSeries({start: 1, stop: 100, step: 1})` → 100 values — check payload size
20. `sqlite.admin.generateSeries({start: 1, stop: 1, step: 1})` → single value
21. `sqlite.admin.analyzeCsvSchema({filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"})` → inferred types
22. `sqlite.admin.createCsvTable({tableName: "stress_csv", filePath: "nonexistent_file.csv"})` → structured error

---

### Category 6: Error Message Quality

23. `sqlite.admin.dropView({viewName: "nonexistent_view_xyz"})` → structured error
24. `sqlite.admin.verifyBackup({backupPath: "nonexistent_backup.db"})` → structured error
25. `sqlite.admin.createCsvTable({tableName: "stress_csv", filePath: "nonexistent_file.csv"})` → structured error

---

### Category 7: WASM Boundary Verification

For WASM testing only:

26. Verify that backup/restore/verify, CSV, and R-Tree tools return `{success: false}` structured errors (not crashes). Confirm all other admin tools produce identical results in WASM and Native.

---

### Final Cleanup

Drop all `stress_*` tables and views. Confirm `test_products` (16 rows) and `test_orders` (20 rows) unchanged.

## Post-Test Procedures

1. **Cleanup**: Drop all `stress_*` objects
2. **Fix EVERY finding** — ❌, ⚠️, 📦
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Re-test**: After server rebuild
6. **Token audit**: Report most expensive block
