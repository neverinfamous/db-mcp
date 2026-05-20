# db-mcp Code Mode Testing: [admin]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **admin** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js), apply these adjustments:

- **Phase 1**: Item 2 (`pragmaCompileOptions`) — WASM shows `FTS3` instead of `FTS5`. Item 3 (filter `"FTS"`) — matches FTS3. Item 9 (`dbstat`) — WASM returns counts-only (no per-table storage).
- **Phase 3**: Item 13 (`listVirtualTables`) — `test_articles_fts` may appear but is not queryable. Item 16 (`createRtreeTable`) — returns `{success: false}` (R-Tree unavailable in WASM). Treat as **negative validation**.
- **Phase 4** (Backup/Restore): All 3 items (19-21) return `{success: false, error: "...WASM mode"}`. Treat as **negative validation** — verify the structured error, do not skip.
- **Phase 6** (CSV): Both items (25-26) return `{success: false}` (CSV extension unavailable in WASM). Treat as **negative validation**.
- All other phases are WASM-compatible.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — monitor `metrics.tokenEstimate`.

## Test Database Schema

| Table             | Rows | Key Columns                                            |
| ----------------- | ---- | ------------------------------------------------------ |
| test_products     | 16   | id, name, price, category, created_at                  |
| test_orders       | 20   | id, product_id (FK→test_products), total_price, status |
| test_articles     | 8    | id, title, body, author, category                      |
| test_articles_fts | —    | FTS5 virtual table (title, body columns)               |

> **CSV testing**: Use `C:\Users\chris\Desktop\db-mcp\test-server\sample.csv` (columns: id, name, category, price, quantity, created_at). **Absolute paths only** — relative paths resolve from IDE CWD.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** Report as ❌.

1. **Batched scripting**: Bundle checks with `failures` array.
2. **Error path testing**: Every tool with `{}` (Zod) and domain error.
3. **Token tracking**: Monitor `metrics.tokenEstimate`.
4. **Coverage Matrix**: `| Tool | Happy Path | Domain Error | Zod Error |`
5. **Deterministic checklist first**.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

## Cleanup

- Temporary tables: `temp_*` prefix. Views: `temp_view_*` prefix. Drop at end of script.

---

## Phase 1: Pragma & Inspection — Happy Paths (batched)

1. `sqlite.admin.pragmaDatabaseList()` → verify database path matches `test.db`
2. `sqlite.admin.pragmaCompileOptions()` → list of compile options
3. `sqlite.admin.pragmaCompileOptions({filter: "FTS"})` → filtered to FTS options
4. `sqlite.admin.pragmaSettings({pragma: "journal_mode"})` → `{value: "wal"}`
5. `sqlite.admin.pragmaTableInfo({table: "test_products"})` → columns: id, name, description, price, category, created_at
6. `sqlite.admin.indexStats()` → index statistics
7. `sqlite.admin.integrityCheck()` → `ok`
8. `sqlite.admin.analyze()` → success
9. `sqlite.admin.dbstat({summarize: true})` → per-table storage

---

## Phase 2: View Management (batched)

10. `sqlite.admin.createView({viewName: "temp_view_orders", selectQuery: "SELECT product_id, COUNT(*) as order_count, SUM(total_price) as revenue FROM test_orders GROUP BY product_id"})` → success
11. `sqlite.admin.listViews()` → `temp_view_orders` present
12. `sqlite.admin.dropView({viewName: "temp_view_orders"})` → success

---

## Phase 3: Virtual Tables (batched)

13. `sqlite.admin.listVirtualTables()` → `test_articles_fts` present
14. `sqlite.admin.virtualTableInfo({tableName: "test_articles_fts"})` → module and column info
15. `sqlite.admin.generateSeries({start: 1, stop: 5, step: 1})` → 5 values
16. `sqlite.admin.createRtreeTable({tableName: "temp_cm_rtree", dimensions: 2})` → R-Tree created
17. `sqlite.admin.createSeriesTable({tableName: "temp_cm_series", start: 1, stop: 10})` → regular table with 10 rows
18. Cleanup: drop `temp_cm_rtree` (virtual) and `temp_cm_series` (regular)

---

## Phase 4: Backup/Restore (batched)

> Use absolute path for backup: `C:\Users\chris\Desktop\db-mcp\test-server\test-backup.db`

19. `sqlite.admin.backup({targetPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db"})` → success
20. `sqlite.admin.verifyBackup({backupPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db"})` → integrity verified
21. `sqlite.admin.restore({sourcePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db"})` → restore success

---

## Phase 5: Optimization (batched)

22. `sqlite.admin.vacuum()` → success
23. `sqlite.admin.optimize()` → optimization details
24. `sqlite.admin.pragmaOptimize()` → distinct from `optimize` — runs `PRAGMA optimize`

---

## Phase 6: CSV (batched)

> Use absolute path: `C:\Users\chris\Desktop\db-mcp\test-server\sample.csv`

25. `sqlite.admin.analyzeCsvSchema({filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"})` → inferred column types
26. `sqlite.admin.createCsvTable({tableName: "temp_cm_csv", filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"})` → virtual table
27. Cleanup: drop `temp_cm_csv` (virtual)

---

## Phase 7: Insights

28. `sqlite.admin.appendInsight({insight: "Test insight from codemode"})` → success

---

## Phase 8: Admin Domain Errors (batched)

🔴 29. `sqlite.admin.pragmaTableInfo({table: "nonexistent_xyz"})` → report behavior
🔴 30. `sqlite.admin.virtualTableInfo({tableName: "nonexistent_xyz"})` → `{success: false}`
🔴 31. `sqlite.admin.verifyBackup({backupPath: "nonexistent_file.db"})` → `{success: false}`
🔴 32. `sqlite.admin.dropView({viewName: "nonexistent_xyz", ifExists: false})` → `{success: false}`

---

## Phase 9: Admin Zod Validation (batched)

🔴 33. `sqlite.admin.backup({})` → `{success: false}`
🔴 34. `sqlite.admin.restore({})` → `{success: false}`
🔴 35. `sqlite.admin.verifyBackup({})` → `{success: false}`
🔴 36. `sqlite.admin.pragmaTableInfo({})` → `{success: false}`
🔴 37. `sqlite.admin.pragmaSettings({})` → `{success: false}`
🔴 38. `sqlite.admin.appendInsight({})` → `{success: false}`
🔴 39. `sqlite.admin.createView({})` → `{success: false}`
🔴 40. `sqlite.admin.dropView({})` → `{success: false}`
🔴 41. `sqlite.admin.virtualTableInfo({})` → `{success: false}`
🔴 42. `sqlite.admin.dropVirtualTable({})` → `{success: false}`
🔴 43. `sqlite.admin.createCsvTable({})` → `{success: false}`
🔴 44. `sqlite.admin.analyzeCsvSchema({})` → `{success: false}`
🔴 45. `sqlite.admin.createRtreeTable({})` → `{success: false}`
🔴 46. `sqlite.admin.createSeriesTable({})` → `{success: false}`
🔴 47. `sqlite.admin.generateSeries({})` → `{success: false}`
🔴 48. `sqlite.admin.dbstat({})` → `{success: false}` or success (no required params)

---

## Phase 9.5: Gotcha Edge Cases (batched)

49. `sqlite.admin.generateSeries({start: 1, stop: 10, step: 2})` → 5 values: 1, 3, 5, 7, 9 (non-default step value)
50. `sqlite.admin.pragmaSettings({pragma: "cache_size", value: "2000"})` → set cache_size, then `sqlite.admin.pragmaSettings({pragma: "cache_size"})` → verify read-back returns the set value
51. `sqlite.admin.createSeriesTable({tableName: "temp_cm_series_regular", start: 1, stop: 5})` → creates a REGULAR table (not virtual). Verify with `sqlite.core.describeTable({table: "temp_cm_series_regular"})` → success, then `sqlite.core.dropTable({table: "temp_cm_series_regular"})` → success (gotcha #15: use `dropTable`, not `dropVirtualTable`)
52. `sqlite.admin.dropVirtualTable({tableName: "test_products"})` → `{success: false}` — test_products is a regular table, not a virtual table (domain error)

---

## Phase 10: Multi-Step Workflow

### 10.1 — Database health check pipeline

```javascript
const failures = [];
const integrity = await sqlite.admin.integrityCheck();
if (integrity.integrity !== "ok") failures.push("integrity check failed");

const journal = await sqlite.admin.pragmaSettings({ pragma: "journal_mode" });
if (journal.value !== "wal")
  failures.push(`expected WAL, got ${journal.value}`);

const storage = await sqlite.admin.dbstat({ summarize: true });
const views = await sqlite.admin.listViews();
const vtables = await sqlite.admin.listVirtualTables();

return {
  failures,
  success: failures.length === 0,
  summary: {
    integrity: "ok",
    journalMode: journal.value,
    viewCount: views?.views?.length,
    virtualTableCount: vtables?.virtualTables?.length,
  },
};
```

### 10.2 — View lifecycle

```javascript
const failures = [];
await sqlite.admin.createView({
  viewName: "temp_view_cm_test",
  selectQuery: "SELECT COUNT(*) as n FROM test_products",
});
const views = await sqlite.admin.listViews();
const found = views.views?.some((v) => v.name === "temp_view_cm_test");
if (!found) failures.push("view not found after creation");
await sqlite.admin.dropView({ viewName: "temp_view_cm_test" });
return { failures, success: failures.length === 0 };
```

---

## Post-Test Procedures

1. **Cleanup**: Drop `temp_*` tables, views, and virtual tables
3. **Triage findings**: Create implementation plan if issues found
4. **Scope of fixes**: Handler code, server-instructions, this prompt
5. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
6. **Commit**: Stage and commit — do NOT push
7. **Token audit**: Report most expensive block
8. **Final summary**: After testing/re-testing
