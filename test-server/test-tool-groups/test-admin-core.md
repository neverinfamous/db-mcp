# db-mcp Tool Group Testing: [admin-core]

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

> _No specific table schema required for this test group._

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

| Type                 | Source                                                             | What you see                                                                                                          | Verdict            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "...", code: "..."}` | Parseable JSON object with `success`, `error`, `code` (e.g., `VALIDATION_ERROR`, `CONFLICT_ERROR`), and `category` fields | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field | Bug — report as ❌ |

## Naming & Cleanup

- **Temporary tables**: `temp_*` (or `stress_*`) prefix
- **Temporary views**: `temp_view_*` (or `stress_view_*`) prefix
- Drop at the end of the script. If DROP fails due to lock, note and move on.
  - **Temporary files**: Delete the following test artifacts after testing:
  - `C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-dump.sql`
  - `C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db`
  - `C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-vacuum-copy.db`

---

## Group Focus: admin-core

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Group Tools (23N/22W) + Code Mode

- `sqlite_create_view`
- `sqlite_list_views`
- `sqlite_drop_view`
- `sqlite_dbstat`
- `sqlite_vacuum`
- `sqlite_backup`
- `sqlite_analyze`
- `sqlite_integrity_check`
- `sqlite_optimize`
- `sqlite_restore`
- `sqlite_verify_backup`
- `sqlite_index_stats`
- `sqlite_pragma_compile_options`
- `sqlite_pragma_database_list`
- `sqlite_pragma_optimize`
- `sqlite_pragma_settings`
- `sqlite_pragma_table_info`

- `sqlite_attach_database`
- `sqlite_detach_database`
- `sqlite_vacuum_into`
- `sqlite_dump [NATIVE ONLY]`
- `sqlite_reindex`
- `sqlite_wal`
- _(Code Mode executor)_
- `sqlite_execute_code`

## Phase 1: PRAGMA Diagnostics (batched)

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

## Phase 2: Backup/Restore (batched)

13. `sqlite_backup({targetPath: "<absolute-path>/test-server/test-backup.db"})` → success with backup file info (⚠️ use absolute path — relative paths resolve from IDE CWD)
14. `sqlite_verify_backup({backupPath: "<absolute-path>/test-server/test-backup.db"})` → integrity verified
15. `sqlite_restore({sourcePath: "<absolute-path>/test-server/test-backup.db"})` → restore from backup, verify success
16. `sqlite_dump({outputPath: "<absolute-path>/test-server/test-dump.sql"})` → success with `path` and `durationMs`
17. Cleanup: note backup file location for manual removal if desired

## Phase 3: Database Management (batched)

18. `sqlite_attach_database({filepath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-backup.db", alias: "temp_attached"})` → Expect structured success with `alias` and `filepath`. (Requires test-backup.db from step 13)
19. `sqlite_pragma_database_list()` → verify `temp_attached` appears in attached databases list
20. `sqlite_detach_database({alias: "temp_attached"})` → success with `message`
21. `sqlite_vacuum_into({outputPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-vacuum-copy.db"})` → success with `outputPath` and `sizeBytes`

## Phase 4: View Management (batched)

22. `sqlite_create_view({viewName: "temp_view_orders", selectQuery: "SELECT product_id, COUNT(*) as order_count, SUM(total_price) as revenue FROM test_orders GROUP BY product_id"})` → success
23. `sqlite_list_views` → verify `temp_view_orders` present
24. `sqlite_drop_view({viewName: "temp_view_orders"})` → success

## Phase 6: REINDEX (batched)

26. `sqlite_reindex({})` → reindex entire database, success with `durationMs`
27. `sqlite_reindex({target: "test_products"})` → reindex all indexes on specific table, success
28. `sqlite_reindex({target: "idx_orders_status"})` → reindex specific index, success

## Phase 7: WAL Management (batched)

29. `sqlite_wal({action: "status"})` → `{success: true, journalMode: "wal"}` (test.db uses WAL mode)
30. `sqlite_wal({action: "disable"})` → `{success: false, error: "Write query failed: database is locked"}` (expected domain error since MCP server holds active connections to WAL DB), then `sqlite_wal({action: "enable"})` → `{success: true}` (verifies WAL is still enabled)
31. `sqlite_wal({action: "enable"})` → `{success: true, message: "WAL mode is already enabled"}` (already in WAL)
32. `sqlite_wal({action: "checkpoint"})` → success with `walPages` and `checkpointedPages`, then `sqlite_wal({action: "checkpoint", checkpointMode: "FULL"})` → success

**Code mode testing:**

33. `sqlite_execute_code({code: "const result = await sqlite.admin.integrityCheck(); return result;"})` → `ok` result
34. `sqlite_execute_code({code: "const result = await sqlite.admin.pragmaSettings({pragma: 'journal_mode'}); return result;"})` → `{pragma: "journal_mode", value: "wal"}`

**Error path testing:**

🔴 35. `sqlite_pragma_table_info({table: "nonexistent_table_xyz"})` → report behavior
🔴 36. `sqlite_verify_backup({backupPath: "nonexistent_file.db"})` → structured error
🔴 37. `sqlite_attach_database({filepath: "nonexistent_file.db", alias: "bad_db"})` → `{success: false}`
🔴 38. `sqlite_attach_database({filepath: "../../../etc/passwd", alias: "evil"})` → `{success: false}` (path traversal rejection)
🔴 39. `sqlite_detach_database({alias: "main"})` → `{success: false}` (cannot detach main)
🔴 40. `sqlite_detach_database({alias: "nonexistent_alias"})` → `{success: false}`
🔴 41. `sqlite_dump({outputPath: "../../../etc/passwd"})` → `{success: false}` (path traversal rejection)
🔴 42. `sqlite_reindex({target: "nonexistent_xyz"})` → `{success: false}` (no such index or table)
🔴 43. `sqlite_reindex({target: "../../etc/passwd"})` → `{success: false}` (identifier validation)
🔴 44. `sqlite_backup({targetPath: "../../../etc/evil.db"})` → `{success: false}` (path traversal rejection)
🔴 45. `sqlite_restore({sourcePath: "nonexistent_backup_xyz.db"})` → `{success: false}`
🔴 46. `sqlite_create_view({viewName: "temp_bad_view", selectQuery: "SELEKT * FROM nowhere"})` → `{success: false}` (invalid SQL)
🔴 47. `sqlite_drop_view({viewName: "nonexistent_view_xyz"})` → `{success: false}`
🔴 48. `sqlite_vacuum_into({outputPath: "../../../etc/evil.db"})` → `{success: false}` (path traversal rejection)
🔴 49. `sqlite_wal({action: "invalid_action_xyz"})` → `{success: false}` (invalid action value)
🔴 50. `sqlite_attach_database({filepath: "C:\\Windows\\System32\\calc.exe", alias: "evil"})` → `{success: false}` (ALLOWED_IO_ROOTS boundary rejection)
🔴 51. `sqlite_dump({outputPath: "C:\\Windows\\System32\\dump.sql"})` → `{success: false}` (ALLOWED_IO_ROOTS boundary rejection)
🔴 52. `sqlite_vacuum_into({outputPath: "C:\\Windows\\System32\\vacuum.db"})` → `{success: false}` (ALLOWED_IO_ROOTS boundary rejection)
🔴 53. `sqlite_backup({targetPath: "C:\\Windows\\System32\\backup.db"})` → `{success: false}` (ALLOWED_IO_ROOTS boundary rejection)
🔴 54. `sqlite_restore({sourcePath: "C:\\Windows\\System32\\backup.db"})` → `{success: false}` (ALLOWED_IO_ROOTS boundary rejection)

## Phase 8: Zod Validation Sweep

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error (`{success: false, error: "Validation error: ..."}`), NOT raw MCP error:

🔴 55. `sqlite_backup({})` → handler error
🔴 56. `sqlite_restore({})` → handler error
🔴 57. `sqlite_verify_backup({})` → handler error
🔴 58. `sqlite_pragma_table_info({})` → handler error
🔴 59. `sqlite_pragma_settings({})` → handler error (has required `pragma` param)

🔴 60. `sqlite_create_view({})` → handler error
🔴 61. `sqlite_drop_view({})` → handler error
🔴 62. `sqlite_dbstat({})` → handler error (or success if no required params)
🔴 63. `sqlite_attach_database({})` → handler error
🔴 64. `sqlite_detach_database({})` → handler error
🔴 65. `sqlite_vacuum_into({})` → handler error
🔴 66. `sqlite_dump({})` → handler error
🔴 67. `sqlite_reindex({})` → success (target is optional — reindexes entire database)
🔴 68. `sqlite_wal({})` → handler error (action is required)
🔴 69. `sqlite_analyze({})` → success (no required params)
🔴 70. `sqlite_integrity_check({})` → success (no required params)
🔴 71. `sqlite_optimize({})` → success (no required params)
🔴 72. `sqlite_pragma_optimize({})` → success (no required params)
🔴 73. `sqlite_vacuum({})` → success (no required params)
🔴 74. `sqlite_pragma_compile_options({})` → success (no required params)
🔴 75. `sqlite_pragma_database_list({})` → success (no required params)
🔴 76. `sqlite_list_views({})` → success (no required params)
🔴 77. `sqlite_index_stats({})` → success (no required params)

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
