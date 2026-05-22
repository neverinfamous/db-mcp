# db-mcp Tool Group Testing: [admin-core]

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

## Group Focus: admin-core

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### admin-core Group Tools (25)

8. sqlite_create_view
9. sqlite_list_views
10. sqlite_drop_view
11. sqlite_dbstat
12. sqlite_vacuum
13. sqlite_backup
14. sqlite_analyze
15. sqlite_integrity_check
16. sqlite_optimize
17. sqlite_restore
18. sqlite_verify_backup
19. sqlite_index_stats
20. sqlite_pragma_compile_options
21. sqlite_pragma_database_list
22. sqlite_pragma_optimize
23. sqlite_pragma_settings
24. sqlite_pragma_table_info
25. sqlite_append_insight
26. sqlite_attach_database
27. sqlite_detach_database
28. sqlite_vacuum_into
29. sqlite_dump
30. sqlite_reindex
31. sqlite_wal
32. sqlite_execute_code

## Phase 1: PRAGMA Diagnostics (batched)

33. `sqlite_pragma_database_list` → verify database path matches `test.db`
34. `sqlite_index_stats` → verify index statistics for test database
35. `sqlite_dbstat({summarize: true})` → per-table storage metrics
36. `sqlite_integrity_check` → `ok` result
37. `sqlite_analyze` → success
38. `sqlite_vacuum` → success
39. `sqlite_optimize` → success with optimization details
40. `sqlite_pragma_optimize` → success (note: distinct from `sqlite_optimize` — this runs `PRAGMA optimize`)
41. `sqlite_pragma_compile_options` → verify list of compile options returned
42. `sqlite_pragma_compile_options({filter: "FTS"})` → filtered subset containing FTS-related options (`ENABLE_FTS3`, `ENABLE_FTS4`, `ENABLE_FTS5`)
43. `sqlite_pragma_settings({pragma: "journal_mode"})` → `{value: "wal"}`
44. `sqlite_pragma_table_info({table: "test_products"})` → verify columns: id, name, description, price, category, created_at

## Phase 2: Backup/Restore (batched)

45. `sqlite_backup({targetPath: "<absolute-path>/test-server/test-backup.db"})` → success with backup file info (⚠️ use absolute path — relative paths resolve from IDE CWD)
46. `sqlite_verify_backup({backupPath: "<absolute-path>/test-server/test-backup.db"})` → integrity verified
47. `sqlite_restore({sourcePath: "<absolute-path>/test-server/test-backup.db"})` → restore from backup, verify success
48. `sqlite_dump({outputPath: "<absolute-path>/test-server/test-dump.sql"})` → success with `path` and `durationMs`
49. Cleanup: note backup file location for manual removal if desired

## Phase 3: Database Management (batched)

50. `sqlite_attach_database({filepath: "C:\\\\Users\\\\chris\\\\Desktop\\\\db-mcp\\\\test-server\\\\test-backup.db", alias: "temp_attached"})` → Expect structured success with `alias` and `filepath`. (Requires test-backup.db from step 13)
51. `sqlite_pragma_database_list()` → verify `temp_attached` appears in attached databases list
52. `sqlite_detach_database({alias: "temp_attached"})` → success with `message`
53. `sqlite_vacuum_into({outputPath: "C:\\\\Users\\\\chris\\\\Desktop\\\\db-mcp\\\\test-server\\\\test-vacuum-copy.db"})` → success with `outputPath` and `sizeBytes`

## Phase 4: View Management (batched)

54. `sqlite_create_view({viewName: "temp_view_orders", selectQuery: "SELECT product_id, COUNT(*) as order_count, SUM(total_price) as revenue FROM test_orders GROUP BY product_id"})` → success
55. `sqlite_list_views` → verify `temp_view_orders` present
56. `sqlite_drop_view({viewName: "temp_view_orders"})` → success

## Phase 5: Insights (batched)

57. `sqlite_append_insight({insight: "Test insight for verification"})` → success

## Phase 6: REINDEX (batched)

58. `sqlite_reindex({})` → reindex entire database, success with `durationMs`
59. `sqlite_reindex({target: "test_products"})` → reindex all indexes on specific table, success
60. `sqlite_reindex({target: "idx_orders_status"})` → reindex specific index, success

## Phase 7: WAL Management (batched)

61. `sqlite_wal({action: "status"})` → `{success: true, journalMode: "wal"}` (test.db uses WAL mode)
62. `sqlite_wal({action: "enable"})` → `{success: true, message: "WAL mode is already enabled"}` (already in WAL)
63. `sqlite_wal({action: "checkpoint"})` → success with `walPages` and `checkpointedPages`
64. `sqlite_wal({action: "checkpoint", checkpointMode: "FULL"})` → success with checkpoint stats

**Code mode testing:**

65. `sqlite_execute_code({code: "const result = await sqlite.admin.integrityCheck(); return result;"})` → `ok` result
66. `sqlite_execute_code({code: "const result = await sqlite.admin.pragmaSettings({pragma: 'journal_mode'}); return result;"})` → `{pragma: "journal_mode", value: "wal"}`

**Error path testing:**

🔴 67. `sqlite_pragma_table_info({table: "nonexistent_table_xyz"})` → report behavior
🔴 68. `sqlite_verify_backup({backupPath: "nonexistent_file.db"})` → structured error
🔴 69. `sqlite_attach_database({filepath: "nonexistent_file.db", alias: "bad_db"})` → `{success: false}`
🔴 70. `sqlite_attach_database({filepath: "../../../etc/passwd", alias: "evil"})` → `{success: false}` (path traversal rejection)
🔴 71. `sqlite_detach_database({alias: "main"})` → `{success: false}` (cannot detach main)
🔴 72. `sqlite_detach_database({alias: "nonexistent_alias"})` → `{success: false}`
🔴 73. `sqlite_dump({outputPath: "../../../etc/passwd"})` → `{success: false}` (path traversal rejection)
🔴 74. `sqlite_reindex({target: "nonexistent_xyz"})` → `{success: false}` (no such index or table)
🔴 75. `sqlite_reindex({target: "../../etc/passwd"})` → `{success: false}` (identifier validation)

## Phase 8: Zod Validation Sweep

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error (`{success: false, error: "Validation error: ..."}`), NOT raw MCP error:

🔴 76. `sqlite_backup({})` → handler error
🔴 77. `sqlite_restore({})` → handler error
🔴 78. `sqlite_verify_backup({})` → handler error
🔴 79. `sqlite_pragma_table_info({})` → handler error
🔴 80. `sqlite_pragma_settings({})` → handler error (has required `pragma` param)
🔴 81. `sqlite_append_insight({})` → handler error
🔴 82. `sqlite_create_view({})` → handler error
🔴 83. `sqlite_drop_view({})` → handler error
🔴 84. `sqlite_dbstat({})` → handler error (or success if no required params)
🔴 85. `sqlite_attach_database({})` → handler error
🔴 86. `sqlite_detach_database({})` → handler error
🔴 87. `sqlite_vacuum_into({})` → handler error
🔴 88. `sqlite_dump({})` → handler error
🔴 89. `sqlite_reindex({})` → success (target is optional — reindexes entire database)
🔴 90. `sqlite_wal({})` → handler error (action is required)


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
