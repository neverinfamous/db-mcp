# db-mcp Code Mode Testing: [admin]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> **Adapter mode**: Call `list_adapters` at the start of testing to determine whether you are running against `native` or `wasm`. Apply the WASM Mode rules below if the adapter is `wasm`.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): Tools marked `[NATIVE ONLY]` in the checklist are unavailable and should be skipped. All unmarked tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> [!WARNING]
> **Stale Build Issues:** The MCP server runs from the compiled `dist/` directory, NOT `src/`. If you encounter inexplicable behavior (e.g., tools executing old logic or throwing validation errors for things already fixed in the source code), the server might be running a stale build. Check if the compiled code in `dist/` matches the source code in `src/`. If out of sync, stop and instruct the user to run `npm run build` and restart the server before continuing testing.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference

> See [`code-map.md`](file:///C:/Users/chris/Desktop/db-mcp/test-server/code-map.md) for the complete test database schema (`test_*` tables).

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

> [!NOTE]
> **Tool Availability & Code Mode**: The `sqlite_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a _different_ group (e.g., `sqlite_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `sqlite_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

> [!IMPORTANT]
> **Testing Code Mode**: Do NOT write test scripts to the filesystem. Pass your JavaScript snippets directly to the `sqlite_execute_code` tool's `code` parameter. Do NOT wrap your tests in monolithic `try/catch` blocks that suppress or transform the server's natural error output. You must allow the server to return its native structured error responses so you can evaluate them against the standards below.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, or a raw text string wrapped in `isError: true` with no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.
>
> ⚠️ **ARCHITECTURAL NOTE — `isError: true` rules for tools with `outputSchema`**: The MCP SDK uses `isError` to decide whether to validate `structuredContent` against the `outputSchema`. Getting this wrong causes either raw `-32602` crashes or valid responses wrapped in error frames. **This is now handled automatically by the server framework in `tools.ts`**, but as a tester, you must verify the SDK output matches this rule:
>
> | Response         | `isError: true` | SDK behavior                                              | Verdict                                |
> | ---------------- | --------------- | --------------------------------------------------------- | -------------------------------------- |
> | `success: true`  | **Absent**      | Validates `structuredContent` → passes                    | ✅ Correct                             |
> | `success: true`  | **Present**     | Skips validation, wraps in error frame                    | ❌ Bug — valid response shown as error |
> | `success: false` | **Present**     | Skips validation (error shape won't match success schema) | ✅ Correct                             |
> | `success: false` | **Absent**      | Validates error against success schema → fails            | ❌ Bug — raw `-32602`                  |
>
> **TL;DR**: `isError: true` on errors, absent on successes. The framework handles this automatically when your handler returns `success: false`.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) An **empty parameters test** (call the tool with `{}`).
     Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
     > **Note on Aliases & Zod**: Tools that support legacy parameter aliases (e.g. `tableName` instead of `table`) often use `.default("")` in their Zod schema so the SDK validation lets the payload reach the handler's alias-resolution logic. For these tools, calling with `{}` will pass Zod validation and correctly trigger a handler-level domain error (e.g. `TABLE_NOT_FOUND`) instead of a strict Zod `invalid_type` error. **This is expected behavior.** Do NOT remove `.default("")` from schemas to force a Zod error, as this will break alias compatibility.
3. **Output Schema Testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
4. **Wrong-Type Coercion**: For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.
   > **Note on Zod Coercion & Validation Errors**: When passing `"abc"` to a numeric field, receiving a structured handler error like `{ success: false, error: "limit: Expected number, received string", code: "VALIDATION_ERROR" }` is **correct**. This proves the global SDK monkey-patch successfully intercepted Zod's `invalid_type` error and transformed it into a structured domain error. Do NOT attempt to "fix" `coerceNumber` or schema definitions to bypass this Zod validation or force a silent fallback to `undefined`.
5. **Proactive Improvements**: You are highly encouraged to proactively improve functionality, performance, security, agent experience, and token/payload efficiency whenever you see an opportunity during your testing and handler code review.
   > **CRITICAL**: Architectural consistency is paramount. Do not introduce undocumented architectural deviations. If you implement a structural or architectural improvement in one tool, you must apply it symmetrically to other applicable tools in the group or project.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
7. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
8. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

### Structured Error Response Pattern

All tools should return errors as strongly-typed structured objects instead of throwing. The expected pattern:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "VALIDATION_ERROR",
  "category": "validation",
  "recoverable": false,
  "metrics": { ... }
}
```

| Type                 | Source                                                                          | What you see                                                                                                              | Verdict            |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "...", code: "..."}` | Parseable JSON object with `success`, `error`, `code` (e.g., `VALIDATION_ERROR`, `CONFLICT_ERROR`), and `category` fields | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                                      | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field     | Bug — report as ❌ |

## Naming & Cleanup

- **Temporary tables**: `temp_*` (or `stress_*`) prefix
- **Temporary views**: `temp_view_*` (or `stress_view_*`) prefix
- Drop at the end of the script. If DROP fails due to lock, note and move on.
  - **Temporary files**: Delete the following test artifacts after testing:
  - `C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-dump.sql`
  - `C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db`
  - `C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-vacuum-copy.db`

---

## Group Focus: admin

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.admin.pragmaDatabaseList`
- `sqlite.admin.pragmaCompileOptions`
- `sqlite.admin.pragmaSettings`
- `sqlite.admin.pragmaTableInfo`
- `sqlite.admin.indexStats`
- `sqlite.admin.integrityCheck`
- `sqlite.admin.analyze`
- `sqlite.admin.dbstat`
- `sqlite.admin.createView`
- `sqlite.admin.listViews`
- `sqlite.admin.dropView`
- `sqlite.admin.listVirtualTables`
- `sqlite.admin.virtualTableInfo`
- `sqlite.admin.generateSeries`
- `sqlite.admin.createRtreeTable`
- `sqlite.admin.createSeriesTable`
- `sqlite.admin.backup`
- `sqlite.admin.verifyBackup`
- `sqlite.admin.restore`
- `sqlite.admin.dump` `[NATIVE ONLY]`
- `sqlite.admin.vacuum`
- `sqlite.admin.optimize`
- `sqlite.admin.pragmaOptimize`
- `sqlite.admin.analyzeCsvSchema`
- `sqlite.admin.createCsvTable`

- `sqlite.admin.reindex`
- `sqlite.admin.wal`
- `sqlite.admin.attachDatabase`
- `sqlite.admin.detachDatabase`
- `sqlite.admin.vacuumInto`
- `sqlite.admin.dropVirtualTable`
- _(cross-group helpers used in test procedures)_
- `sqlite.core.describeTable`
- `sqlite.core.dropTable`

> **Note**: The 7 **Server Audit Tools** (`sqlite_audit_list_backups`, `sqlite_audit_get_backup`, `sqlite_audit_diff_backup`, `sqlite_audit_restore_backup`, `sqlite_audit_cleanup`, `sqlite_audit_search`, `sqlite_server_config`) are not exposed in Code Mode by design. They are tested via direct tool calls in `test-tool-groups/test-admin-audit.md`.

## Phase 1: Pragma & Inspection — Happy Paths (batched)

1. `sqlite.admin.pragmaDatabaseList()` → verify database path matches `test-encrypted.db`
2. `sqlite.admin.pragmaCompileOptions()` → list of compile options
3. `sqlite.admin.pragmaCompileOptions({filter: "FTS"})` → filtered to FTS options
4. `sqlite.admin.pragmaSettings({pragma: "journal_mode"})` → `{value: "wal"}`
5. `sqlite.admin.pragmaTableInfo({table: "test_products"})` → columns: id, name, description, price, category, created_at
6. `sqlite.admin.indexStats()` → index statistics
7. `sqlite.admin.integrityCheck()` → `ok`
8. `sqlite.admin.analyze()` → success
9. `sqlite.admin.dbstat({summarize: true})` → per-table storage

## Phase 2: View Management (batched)

10. `sqlite.admin.createView({viewName: "temp_view_orders", selectQuery: "SELECT product_id, COUNT(*) as order_count, SUM(total_price) as revenue FROM test_orders GROUP BY product_id"})` → success
11. `sqlite.admin.listViews()` → `temp_view_orders` present
12. `sqlite.admin.dropView({viewName: "temp_view_orders"})` → success

## Phase 3: Virtual Tables (batched)

13. `sqlite.admin.listVirtualTables()` → `test_articles_fts` present
14. `sqlite.admin.virtualTableInfo({tableName: "test_articles_fts"})` → module and column info
15. `sqlite.admin.generateSeries({start: 1, stop: 5, step: 1})` → 5 values
16. `sqlite.admin.createRtreeTable({tableName: "temp_cm_rtree", dimensions: 2})` → R-Tree created
17. `sqlite.admin.createSeriesTable({tableName: "temp_cm_series", start: 1, stop: 10})` → regular table with 10 rows
18. `sqlite.admin.dropVirtualTable({tableName: "temp_cm_rtree"})` → success (virtual table dropped)
    Cleanup: drop `temp_cm_series` using `sqlite.core.dropTable` (regular table, not virtual)

## Phase 4: Backup/Restore (batched)

> Use absolute path for backup: `C:\Users\chris\Desktop\db-mcp\test-server\test-backup.db`

19. `sqlite.admin.backup({targetPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db"})` → success
20. `sqlite.admin.verifyBackup({backupPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db"})` → integrity verified
21. `sqlite.admin.restore({sourcePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db"})` → restore success
22. `sqlite.admin.dump({outputPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-dump.sql"})` → success with `path` and `durationMs`

## Phase 5: Optimization (batched)

23. `sqlite.admin.vacuum()` → success
24. `sqlite.admin.optimize()` → optimization details
25. `sqlite.admin.pragmaOptimize()` → distinct from `optimize` — runs `PRAGMA optimize`

## Phase 6: CSV (batched)

> Use absolute path: `C:\Users\chris\Desktop\db-mcp\test-server\sample.csv`

26. `sqlite.admin.analyzeCsvSchema({filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"})` → inferred column types
27. `sqlite.admin.createCsvTable({tableName: "temp_cm_csv", filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"})` → virtual table
28. Cleanup: drop `temp_cm_csv` (virtual)

## Phase 8: REINDEX & WAL Management (batched)

29. `sqlite.admin.reindex()` → reindex entire database, success with `durationMs`
30. `sqlite.admin.reindex({target: "test_products"})` → reindex all indexes on specific table, success
31. `sqlite.admin.reindex({target: "idx_orders_status"})` → reindex specific index, success
32. `sqlite.admin.wal({action: "status"})` → `{success: true, journalMode: "wal"}` (test.db uses WAL mode)
33. `sqlite.admin.wal({action: "disable"})` → Native: `{success: false}` with `DB_QUERY_FAILED` "database is locked" (due to active connections). WASM: `{success: true}` (virtual FS does not enforce connection locks). Then `sqlite.admin.wal({action: "enable"})` → `{success: true}`
34. `sqlite.admin.wal({action: "enable"})` → `{success: true}` with "already enabled" message (already WAL)
35. `sqlite.admin.wal({action: "checkpoint"})` → Native: success with walPages. WASM: `{success: false}` with `DB_QUERY_FAILED` "database table is locked" (due to active Code Mode connection). Then `sqlite.admin.wal({action: "checkpoint", checkpointMode: "FULL"})` → success

## Phase 9: Database Management (batched)

> Use absolute paths where required

36. `sqlite.admin.attachDatabase({filepath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db", alias: "temp_attached"})` → Depends on backup file existing from Phase 4. If not present, note dependency. Expect structured success with `alias` and `filepath`. (Note: In WASM mode, this succeeds by transparently creating an empty virtual file in the WASM virtual filesystem).
37. `sqlite.admin.pragmaDatabaseList()` → verify `temp_attached` appears in attached databases list
38. `sqlite.admin.detachDatabase({alias: "temp_attached"})` → success with `message`
39. `sqlite.admin.vacuumInto({outputPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-vacuum-copy.db"})` → success with `outputPath` and `sizeBytes`

## Phase 10: Admin Domain Errors (batched)

🔴 40. `sqlite.admin.pragmaTableInfo({table: "nonexistent_xyz"})` → report behavior
🔴 41. `sqlite.admin.virtualTableInfo({tableName: "nonexistent_xyz"})` → `{success: false}`
🔴 42. `sqlite.admin.verifyBackup({backupPath: "nonexistent_file.db"})` → `{success: false}`
🔴 43. `sqlite.admin.dropView({viewName: "nonexistent_xyz", ifExists: false})` → `{success: false}`
🔴 44. `sqlite.admin.attachDatabase({filepath: "nonexistent_file.db", alias: "bad_db"})` → `{success: false}`
🔴 45. `sqlite.admin.attachDatabase({filepath: "../../../etc/passwd", alias: "evil"})` → `{success: false}` (path traversal rejection)
🔴 46. `sqlite.admin.detachDatabase({alias: "main"})` → `{success: false}` (cannot detach main)
🔴 47. `sqlite.admin.detachDatabase({alias: "nonexistent_alias"})` → `{success: false}`
🔴 48. `sqlite.admin.vacuumInto({outputPath: "../../../tmp/evil.db"})` → `{success: false}` (path traversal rejection)
🔴 49. `sqlite.admin.dump({outputPath: "../../../tmp/evil.sql"})` → `{success: false}` (path traversal rejection)
🔴 50. `sqlite.admin.reindex({target: "nonexistent_xyz"})` → `{success: false}` (no such index or table)
🔴 51. `sqlite.admin.reindex({target: "../../etc/passwd"})` → `{success: false}` (identifier validation)
🔴 52. `sqlite.admin.attachDatabase({filepath: "C:\\Windows\\System32\\calc.exe", alias: "evil"})` → `{success: false}` (ALLOWED_IO_ROOTS boundary rejection)
🔴 53. `sqlite.admin.dump({outputPath: "C:\\Windows\\System32\\dump.sql"})` → `{success: false}` (ALLOWED_IO_ROOTS boundary rejection)
🔴 54. `sqlite.admin.vacuumInto({outputPath: "C:\\Windows\\System32\\vacuum.db"})` → `{success: false}` (ALLOWED_IO_ROOTS boundary rejection)

## Phase 11: Gotcha Edge Cases (batched)

55. `sqlite.admin.generateSeries({start: 1, stop: 10, step: 2})` → 5 values: 1, 3, 5, 7, 9 (non-default step value)
56. `sqlite.admin.pragmaSettings({pragma: "cache_size", value: "2000"})` → set cache_size, then `sqlite.admin.pragmaSettings({pragma: "cache_size"})` → verify read-back returns the set value
57. `sqlite.admin.createSeriesTable({tableName: "temp_cm_series_regular", start: 1, stop: 5})` → creates a REGULAR table (not virtual). Verify with `sqlite.core.describeTable({table: "temp_cm_series_regular"})` → success, then `sqlite.core.dropTable({table: "temp_cm_series_regular"})` → success (gotcha #15: use `dropTable`, not `dropVirtualTable`)
58. `sqlite.admin.dropVirtualTable({tableName: "test_products"})` → `{success: false}` — test_products is a regular table, not a virtual table (domain error)

## Phase 12: Multi-Step Workflow

### 12.1 — Database health check pipeline

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

### 12.2 — View lifecycle

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

🔴 59. `sqlite.admin.backup({})` → `{success: false}`
🔴 60. `sqlite.admin.restore({})` → `{success: false}`
🔴 61. `sqlite.admin.verifyBackup({})` → `{success: false}`
🔴 62. `sqlite.admin.pragmaTableInfo({})` → `{success: false}`
🔴 63. `sqlite.admin.pragmaSettings({})` → `{success: false}`

🔴 64. `sqlite.admin.createView({})` → `{success: false}`
🔴 65. `sqlite.admin.dropView({})` → `{success: false}`
🔴 66. `sqlite.admin.virtualTableInfo({})` → `{success: false}`
🔴 67. `sqlite.admin.dropVirtualTable({})` → `{success: false}`
🔴 68. `sqlite.admin.createCsvTable({})` → `{success: false}`
🔴 69. `sqlite.admin.analyzeCsvSchema({})` → `{success: false}`
🔴 70. `sqlite.admin.createRtreeTable({})` → `{success: false}`
🔴 71. `sqlite.admin.createSeriesTable({})` → `{success: false}`
🔴 72. `sqlite.admin.generateSeries({})` → `{success: false}`
🔴 73. `sqlite.admin.dbstat({})` → `{success: false}` or success (no required params)
🔴 74. `sqlite.admin.attachDatabase({})` → `{success: false}` handler error
🔴 75. `sqlite.admin.detachDatabase({})` → `{success: false}` handler error
🔴 76. `sqlite.admin.vacuumInto({})` → `{success: false}` handler error
🔴 77. `sqlite.admin.dump({})` → `{success: false}` handler error
🔴 78. `sqlite.admin.reindex({})` → success (target is optional — reindexes entire database)
🔴 79. `sqlite.admin.wal({})` → `{success: false}` handler error (action is required)

## Phase 14: Wrong-Type Numeric Coercion

🔴 80. `sqlite.admin.generateSeries({start: "abc", stop: 5, step: 1})` → handler error, NOT raw MCP `-32602`
🔴 81. `sqlite.admin.createSeriesTable({tableName: "temp_cm_coerce", start: "abc", stop: 5})` → handler error, NOT raw MCP

---

## Post-Test Procedures

### Reporting Rules

- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in help resources and runtime hints

### After Testing

1. **Triage findings**: If issues were found, create an implementation plan, making sure they are consistent with working patterns in other tools/tool groups. If the plan requires no user decisions, proceed directly to implementation.
2. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `src/constants/server-instructions/*.md` (per-group help files) — run `npm run generate:instructions` after editing to regenerate `server-instructions.ts`
   - Test database (`test-server/test.db`)
   - This prompt

### After Implementation

3. **Document**: Update `UNRELEASED.md`, `code-map.md` (if appropriate), and create a `memory-journal-mcp` entry detailing the changes and improvements made.
4. **Commit**: Stage and commit all changes — do NOT push.
5. **Validate**: Halt your work and instruct the user to validate the changes by running the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself. Also instruct the user to rebuild and restart the server.
6. **Live re-test**: Once the user confirms the server is restarted, test the fixes with direct MCP tool calls to confirm they are working.
7. **Final summary**: If no issues found, provide the final summary. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working.
