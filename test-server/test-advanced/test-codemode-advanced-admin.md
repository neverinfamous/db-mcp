# db-mcp Advanced Stress Testing: [admin]

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
> _No specific table schema required for this test group._

> **CSV testing**: Use absolute path `C:\Users\chris\Desktop\db-mcp\test-server\sample.csv`.

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

8. sqlite.admin.pragmaDatabaseList
9. sqlite.admin.pragmaCompileOptions
10. sqlite.admin.pragmaSettings
11. sqlite.admin.pragmaTableInfo
12. sqlite.admin.pragmaOptimize
13. sqlite.admin.indexStats
14. sqlite.admin.integrityCheck
15. sqlite.admin.analyze
16. sqlite.admin.dbstat
17. sqlite.admin.vacuum
18. sqlite.admin.optimize
19. sqlite.admin.createView
20. sqlite.admin.listViews
21. sqlite.admin.dropView
22. sqlite.admin.listVirtualTables
23. sqlite.admin.virtualTableInfo
24. sqlite.admin.dropVirtualTable
25. sqlite.admin.createCsvTable
26. sqlite.admin.analyzeCsvSchema
27. sqlite.admin.createRtreeTable
28. sqlite.admin.createSeriesTable
29. sqlite.admin.generateSeries
30. sqlite.admin.backup
31. sqlite.admin.restore
32. sqlite.admin.verifyBackup
33. sqlite.admin.appendInsight
34. sqlite.admin.dump
35. sqlite.admin.attachDatabase
36. sqlite.admin.detachDatabase
37. sqlite.admin.vacuumInto
38. sqlite.admin.reindex
39. sqlite.admin.wal


## Phase 1: View Lifecycle Stress (batched)

40. `sqlite.admin.createView({viewName: "stress_view_orders", selectQuery: "SELECT product_id, COUNT(*) as cnt FROM test_orders GROUP BY product_id"})` → success
41. `sqlite.admin.listViews()` → verify `stress_view_orders` present
42. `sqlite.admin.dropView({viewName: "stress_view_orders"})` → success
43. `sqlite.admin.dropView({viewName: "stress_view_orders"})` → structured error or "not found" (not raw crash)
44. `sqlite.admin.createView({viewName: "stress_view_orders", selectQuery: "SELECT product_id, COUNT(*) as cnt FROM test_orders GROUP BY product_id"})` → recreate success


## Phase 2: Virtual Table Edge Cases (batched)

45. `sqlite.admin.createRtreeTable({tableName: "stress_rtree_test", dimensions: 2})` → success
46. `sqlite.admin.listVirtualTables()` → verify `stress_rtree_test` present alongside `test_articles_fts` (Native)
47. `sqlite.admin.virtualTableInfo({tableName: "stress_rtree_test"})` → correct module and column info
48. `sqlite.admin.dropVirtualTable({tableName: "stress_rtree_test"})` → success
49. `sqlite.admin.virtualTableInfo({tableName: "nonexistent_vtable_xyz"})` → structured error


## Phase 3: Backup/Restore Integrity (batched)

> Use absolute path: `C:\Users\chris\Desktop\db-mcp\test-server\stress-backup.db`

50. `sqlite.admin.backup({targetPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-backup.db"})` → success
51. `sqlite.admin.verifyBackup({backupPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-backup.db"})` → integrity verified
52. `sqlite.admin.verifyBackup({backupPath: "nonexistent_file.db"})` → structured error
53. `sqlite.admin.dump({outputPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-dump.sql"})` → success
54. `sqlite.admin.dump({outputPath: "C:\\Windows\\System32\\stress-dump.sql"})` → structured security error
55. Note backup and dump files for manual removal


## Phase 4: Pragma Edge Cases (batched)

56. `sqlite.admin.pragmaCompileOptions({filter: "THREAD"})` → filtered result subset
57. `sqlite.admin.pragmaCompileOptions({filter: "FTS"})` → filtered to FTS options
58. `sqlite.admin.pragmaSettings({pragma: "journal_mode"})` → `{value: "wal"}`
59. `sqlite.admin.pragmaTableInfo({table: "nonexistent_table_xyz"})` → report behavior


## Phase 5: Series & CSV Edge Cases (batched)

60. `sqlite.admin.generateSeries({start: 1, stop: 100, step: 1})` → 100 values — check payload size
61. `sqlite.admin.generateSeries({start: 1, stop: 1, step: 1})` → single value
62. `sqlite.admin.analyzeCsvSchema({filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"})` → inferred types
63. `sqlite.admin.createCsvTable({tableName: "stress_csv", filePath: "nonexistent_file.csv"})` → structured error


## Phase 6: Database Management Edge Cases (batched)

64. `sqlite.admin.attachDatabase({filepath: "C:\\\\Users\\\\chris\\\\Desktop\\\\db-mcp\\\\test-server\\\\stress-backup.db", alias: "stress_attached"})` → success (attaches backup from Category 3)
65. `sqlite.admin.attachDatabase({filepath: "C:\\\\Users\\\\chris\\\\Desktop\\\\db-mcp\\\\test-server\\\\stress-backup.db", alias: "stress_attached"})` → error (alias in use)
66. `sqlite.admin.detachDatabase({alias: "stress_attached"})` → success
67. `sqlite.admin.detachDatabase({alias: "stress_attached"})` → error (already detached)
68. `sqlite.admin.vacuumInto({outputPath: "C:\\\\Users\\\\chris\\\\Desktop\\\\db-mcp\\\\test-server\\\\stress-vacuum.db"})` → success
69. `sqlite.admin.vacuumInto({outputPath: "C:\\\\Users\\\\chris\\\\Desktop\\\\db-mcp\\\\test-server\\\\stress-vacuum.db"})` → error (file already exists)
70. Note vacuum file for manual removal


## Phase 7: Error Message Quality (batched)

71. `sqlite.admin.dropView({viewName: "nonexistent_view_xyz"})` → structured error
72. `sqlite.admin.verifyBackup({backupPath: "nonexistent_backup.db"})` → structured error
73. `sqlite.admin.createCsvTable({tableName: "stress_csv", filePath: "nonexistent_file.csv"})` → structured error
74. `sqlite.admin.attachDatabase({filepath: "../../../etc/passwd", alias: "evil"})` → structured error (path traversal)


## Phase 8: WASM Boundary Verification (batched)

For WASM testing only:

75. Verify that backup/restore/verify, CSV, R-Tree, and vacuumInto tools return `{success: false}` structured errors (not crashes). Confirm all other admin tools produce identical results in WASM and Native.


## Phase 9: REINDEX & WAL Edge Cases (batched)

76. `sqlite.admin.reindex()` → full DB reindex, verify `durationMs > 0`
77. `sqlite.admin.reindex({target: "test_products"})` → table-specific, verify success
78. `sqlite.admin.reindex({target: "idx_orders_status"})` → index-specific, verify success
79. `sqlite.admin.reindex({target: "../../etc/passwd"})` → structured error (identifier validation rejects non-alphanumeric)
80. `sqlite.admin.wal({action: "status"})` → verify `journalMode` matches expectation (should be "wal")
81. `sqlite.admin.wal({action: "enable"})` → already WAL → "already enabled" message, not error
82. `sqlite.admin.wal({action: "checkpoint", checkpointMode: "PASSIVE"})` → success with `walPages` and `checkpointedPages`
83. `sqlite.admin.wal({action: "checkpoint", checkpointMode: "TRUNCATE"})` → success, verify pages


### Final Cleanup

Drop all `stress_*` tables and views. Confirm `test_products` (16 rows) and `test_orders` (20 rows) unchanged.


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
