# db-mcp Code Mode Testing: [admin]

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

> **CSV testing**: Use `C:\Users\chris\Desktop\db-mcp\test-server\sample.csv` (columns: id, name, category, price, quantity, created_at). **Absolute paths only** — relative paths resolve from IDE CWD.

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

## Group Focus: admin

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

8. `sqlite.admin.pragmaDatabaseList`
9. `sqlite.admin.pragmaCompileOptions`
10. `sqlite.admin.pragmaSettings`
11. `sqlite.admin.pragmaTableInfo`
12. `sqlite.admin.indexStats`
13. `sqlite.admin.integrityCheck`
14. `sqlite.admin.analyze`
15. `sqlite.admin.dbstat`
16. `sqlite.admin.createView`
17. `sqlite.admin.listViews`
18. `sqlite.admin.dropView`
19. `sqlite.admin.listVirtualTables`
20. `sqlite.admin.virtualTableInfo`
21. `sqlite.admin.generateSeries`
22. `sqlite.admin.createRtreeTable`
23. `sqlite.admin.createSeriesTable`
24. `sqlite.admin.backup`
25. `sqlite.admin.verifyBackup`
26. `sqlite.admin.restore`
27. `sqlite.admin.dump`
28. `sqlite.admin.vacuum`
29. `sqlite.admin.optimize`
30. `sqlite.admin.pragmaOptimize`
31. `sqlite.admin.analyzeCsvSchema`
32. `sqlite.admin.createCsvTable`
33. `sqlite.admin.appendInsight`
34. `sqlite.admin.reindex`
35. `sqlite.admin.wal`
36. `sqlite.admin.attachDatabase`
37. `sqlite.admin.detachDatabase`
38. `sqlite.admin.vacuumInto`
39. `sqlite.admin.dropVirtualTable`
40. `sqlite.core.describeTable`
41. `sqlite.core.dropTable`

## Phase 1: Pragma & Inspection — Happy Paths (batched)

8. `sqlite.admin.pragmaDatabaseList()` → verify database path matches `test.db`
9. `sqlite.admin.pragmaCompileOptions()` → list of compile options
10. `sqlite.admin.pragmaCompileOptions({filter: "FTS"})` → filtered to FTS options
11. `sqlite.admin.pragmaSettings({pragma: "journal_mode"})` → `{value: "wal"}`
12. `sqlite.admin.pragmaTableInfo({table: "test_products"})` → columns: id, name, description, price, category, created_at
13. `sqlite.admin.indexStats()` → index statistics
14. `sqlite.admin.integrityCheck()` → `ok`
15. `sqlite.admin.analyze()` → success
16. `sqlite.admin.dbstat({summarize: true})` → per-table storage


## Phase 2: View Management (batched)

17. `sqlite.admin.createView({viewName: "temp_view_orders", selectQuery: "SELECT product_id, COUNT(*) as order_count, SUM(total_price) as revenue FROM test_orders GROUP BY product_id"})` → success
18. `sqlite.admin.listViews()` → `temp_view_orders` present
19. `sqlite.admin.dropView({viewName: "temp_view_orders"})` → success


## Phase 3: Virtual Tables (batched)

20. `sqlite.admin.listVirtualTables()` → `test_articles_fts` present
21. `sqlite.admin.virtualTableInfo({tableName: "test_articles_fts"})` → module and column info
22. `sqlite.admin.generateSeries({start: 1, stop: 5, step: 1})` → 5 values
23. `sqlite.admin.createRtreeTable({tableName: "temp_cm_rtree", dimensions: 2})` → R-Tree created
24. `sqlite.admin.createSeriesTable({tableName: "temp_cm_series", start: 1, stop: 10})` → regular table with 10 rows
25. Cleanup: drop `temp_cm_rtree` (virtual) and `temp_cm_series` (regular)


## Phase 4: Backup/Restore (batched)

> Use absolute path for backup: `C:\Users\chris\Desktop\db-mcp\test-server\test-backup.db`

26. `sqlite.admin.backup({targetPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db"})` → success
27. `sqlite.admin.verifyBackup({backupPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db"})` → integrity verified
28. `sqlite.admin.restore({sourcePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db"})` → restore success
29. `sqlite.admin.dump({outputPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-dump.sql"})` → success with `path` and `durationMs`


## Phase 5: Optimization (batched)

30. `sqlite.admin.vacuum()` → success
31. `sqlite.admin.optimize()` → optimization details
32. `sqlite.admin.pragmaOptimize()` → distinct from `optimize` — runs `PRAGMA optimize`


## Phase 6: CSV (batched)

> Use absolute path: `C:\Users\chris\Desktop\db-mcp\test-server\sample.csv`

33. `sqlite.admin.analyzeCsvSchema({filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"})` → inferred column types
34. `sqlite.admin.createCsvTable({tableName: "temp_cm_csv", filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"})` → virtual table
35. Cleanup: drop `temp_cm_csv` (virtual)


## Phase 7: Insights

36. `sqlite.admin.appendInsight({insight: "Test insight from codemode"})` → success


## Phase 8: REINDEX & WAL Management (batched)

37. `sqlite.admin.reindex()` → reindex entire database, success with `durationMs`
38. `sqlite.admin.reindex({target: "test_products"})` → reindex all indexes on specific table, success
39. `sqlite.admin.reindex({target: "idx_orders_status"})` → reindex specific index, success
40. `sqlite.admin.wal({action: "status"})` → `{success: true, journalMode: "wal"}` (test.db uses WAL mode)
41. `sqlite.admin.wal({action: "enable"})` → `{success: true}` with "already enabled" message (already WAL)
42. `sqlite.admin.wal({action: "checkpoint"})` → success with `walPages` and `checkpointedPages`
43. `sqlite.admin.wal({action: "checkpoint", checkpointMode: "FULL"})` → success with checkpoint stats


## Phase 9: Database Management (batched)

> Use absolute paths where required

44. `sqlite.admin.attachDatabase({filepath: "C:\\\\Users\\\\chris\\\\Desktop\\\\db-mcp\\\\test-server\\\\test-backup.db", alias: "temp_attached"})` → Depends on backup file existing from Phase 4. If not present, note dependency. Expect structured success with `alias` and `filepath`.
45. `sqlite.admin.pragmaDatabaseList()` → verify `temp_attached` appears in attached databases list
46. `sqlite.admin.detachDatabase({alias: "temp_attached"})` → success with `message`
47. `sqlite.admin.vacuumInto({outputPath: "C:\\\\Users\\\\chris\\\\Desktop\\\\db-mcp\\\\test-server\\\\test-vacuum-copy.db"})` → success with `outputPath` and `sizeBytes`


## Phase 10: Admin Domain Errors (batched)

🔴 48. `sqlite.admin.pragmaTableInfo({table: "nonexistent_xyz"})` → report behavior
🔴 49. `sqlite.admin.virtualTableInfo({tableName: "nonexistent_xyz"})` → `{success: false}`
🔴 50. `sqlite.admin.verifyBackup({backupPath: "nonexistent_file.db"})` → `{success: false}`
🔴 51. `sqlite.admin.dropView({viewName: "nonexistent_xyz", ifExists: false})` → `{success: false}`
🔴 52. `sqlite.admin.attachDatabase({filepath: "nonexistent_file.db", alias: "bad_db"})` → `{success: false}`
🔴 53. `sqlite.admin.attachDatabase({filepath: "../../../etc/passwd", alias: "evil"})` → `{success: false}` (path traversal rejection)
🔴 54. `sqlite.admin.detachDatabase({alias: "main"})` → `{success: false}` (cannot detach main)
🔴 55. `sqlite.admin.detachDatabase({alias: "nonexistent_alias"})` → `{success: false}`
🔴 56. `sqlite.admin.vacuumInto({outputPath: "../../../tmp/evil.db"})` → `{success: false}` (path traversal rejection)
🔴 57. `sqlite.admin.dump({outputPath: "../../../tmp/evil.sql"})` → `{success: false}` (path traversal rejection)
🔴 58. `sqlite.admin.reindex({target: "nonexistent_xyz"})` → `{success: false}` (no such index or table)
🔴 59. `sqlite.admin.reindex({target: "../../etc/passwd"})` → `{success: false}` (identifier validation)


## Phase 11: Gotcha Edge Cases (batched)

82. `sqlite.admin.generateSeries({start: 1, stop: 10, step: 2})` → 5 values: 1, 3, 5, 7, 9 (non-default step value)
83. `sqlite.admin.pragmaSettings({pragma: "cache_size", value: "2000"})` → set cache_size, then `sqlite.admin.pragmaSettings({pragma: "cache_size"})` → verify read-back returns the set value
84. `sqlite.admin.createSeriesTable({tableName: "temp_cm_series_regular", start: 1, stop: 5})` → creates a REGULAR table (not virtual). Verify with `sqlite.core.describeTable({table: "temp_cm_series_regular"})` → success, then `sqlite.core.dropTable({table: "temp_cm_series_regular"})` → success (gotcha #15: use `dropTable`, not `dropVirtualTable`)
85. `sqlite.admin.dropVirtualTable({tableName: "test_products"})` → `{success: false}` — test_products is a regular table, not a virtual table (domain error)


## Phase 12: Multi-Step Workflow

### 11.1 — Database health check pipeline

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


## Phase 13: Zod Validation Sweep

🔴 60. `sqlite.admin.backup({})` → `{success: false}`
🔴 61. `sqlite.admin.restore({})` → `{success: false}`
🔴 62. `sqlite.admin.verifyBackup({})` → `{success: false}`
🔴 63. `sqlite.admin.pragmaTableInfo({})` → `{success: false}`
🔴 64. `sqlite.admin.pragmaSettings({})` → `{success: false}`
🔴 65. `sqlite.admin.appendInsight({})` → `{success: false}`
🔴 66. `sqlite.admin.createView({})` → `{success: false}`
🔴 67. `sqlite.admin.dropView({})` → `{success: false}`
🔴 68. `sqlite.admin.virtualTableInfo({})` → `{success: false}`
🔴 69. `sqlite.admin.dropVirtualTable({})` → `{success: false}`
🔴 70. `sqlite.admin.createCsvTable({})` → `{success: false}`
🔴 71. `sqlite.admin.analyzeCsvSchema({})` → `{success: false}`
🔴 72. `sqlite.admin.createRtreeTable({})` → `{success: false}`
🔴 73. `sqlite.admin.createSeriesTable({})` → `{success: false}`
🔴 74. `sqlite.admin.generateSeries({})` → `{success: false}`
🔴 75. `sqlite.admin.dbstat({})` → `{success: false}` or success (no required params)
🔴 76. `sqlite.admin.attachDatabase({})` → `{success: false}` handler error
🔴 77. `sqlite.admin.detachDatabase({})` → `{success: false}` handler error
🔴 78. `sqlite.admin.vacuumInto({})` → `{success: false}` handler error
🔴 79. `sqlite.admin.dump({})` → `{success: false}` handler error
🔴 80. `sqlite.admin.reindex({})` → success (target is optional — reindexes entire database)
🔴 81. `sqlite.admin.wal({})` → `{success: false}` handler error (action is required)


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
