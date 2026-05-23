# db-mcp Advanced Stress Testing: [admin]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> We're currently testing Native mode.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): Tools marked `[NATIVE ONLY]` in the checklist are unavailable and should be skipped. All unmarked tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
> See [`code-map.md`](file:///C:/Users/chris/Desktop/db-mcp/test-server/code-map.md) for the complete test database schema (`test_*` tables).

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
5. **Proactive Improvements**: You are highly encouraged to proactively improve functionality, performance, security, agent experience, and token/payload efficiency whenever you see an opportunity during your testing and handler code review.
   > **CRITICAL**: Architectural consistency is paramount. Do not introduce undocumented architectural deviations. If you implement a structural or architectural improvement in one tool, you must apply it symmetrically to other applicable tools in the group or project.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
7. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
8. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

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

- `sqlite.admin.pragmaDatabaseList`
- `sqlite.admin.pragmaCompileOptions`
- `sqlite.admin.pragmaSettings`
- `sqlite.admin.pragmaTableInfo`
- `sqlite.admin.pragmaOptimize`
- `sqlite.admin.indexStats`
- `sqlite.admin.integrityCheck`
- `sqlite.admin.analyze`
- `sqlite.admin.dbstat`
- `sqlite.admin.vacuum`
- `sqlite.admin.optimize`
- `sqlite.admin.createView`
- `sqlite.admin.listViews`
- `sqlite.admin.dropView`
- `sqlite.admin.listVirtualTables`
- `sqlite.admin.virtualTableInfo`
- `sqlite.admin.dropVirtualTable`
- `sqlite.admin.createCsvTable`
- `sqlite.admin.analyzeCsvSchema`
- `sqlite.admin.createRtreeTable`
- `sqlite.admin.createSeriesTable`
- `sqlite.admin.generateSeries`
- `sqlite.admin.backup`
- `sqlite.admin.restore`
- `sqlite.admin.verifyBackup`
- `sqlite.admin.appendInsight`
- `sqlite.admin.dump`
- `sqlite.admin.attachDatabase`
- `sqlite.admin.detachDatabase`
- `sqlite.admin.vacuumInto`
- `sqlite.admin.reindex`
- `sqlite.admin.wal`

## Phase 1: View Lifecycle Stress (batched)

1. `sqlite.admin.createView({viewName: "stress_view_orders", selectQuery: "SELECT product_id, COUNT(*) as cnt FROM test_orders GROUP BY product_id"})` → success
2. `sqlite.admin.listViews()` → verify `stress_view_orders` present
3. `sqlite.admin.dropView({viewName: "stress_view_orders"})` → success
4. `sqlite.admin.dropView({viewName: "stress_view_orders"})` → structured error or "not found" (not raw crash)
5. `sqlite.admin.createView({viewName: "stress_view_orders", selectQuery: "SELECT product_id, COUNT(*) as cnt FROM test_orders GROUP BY product_id"})` → recreate success


## Phase 2: Virtual Table Edge Cases (batched)

6. `sqlite.admin.createRtreeTable({tableName: "stress_rtree_test", dimensions: 2})` → success
7. `sqlite.admin.listVirtualTables()` → verify `stress_rtree_test` present alongside `test_articles_fts` (Native)
8. `sqlite.admin.virtualTableInfo({tableName: "stress_rtree_test"})` → correct module and column info
9. `sqlite.admin.dropVirtualTable({tableName: "stress_rtree_test"})` → success
10. `sqlite.admin.virtualTableInfo({tableName: "nonexistent_vtable_xyz"})` → structured error


## Phase 3: Backup/Restore Integrity (batched)

> Use absolute path: `C:\Users\chris\Desktop\db-mcp\test-server\stress-backup.db`

11. `sqlite.admin.backup({targetPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-backup.db"})` → success
12. `sqlite.admin.verifyBackup({backupPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-backup.db"})` → integrity verified
13. `sqlite.admin.verifyBackup({backupPath: "nonexistent_file.db"})` → structured error
14. `sqlite.admin.dump({outputPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-dump.sql"})` → success
15. `sqlite.admin.dump({outputPath: "C:\\Windows\\System32\\stress-dump.sql"})` → structured security error
16. Note backup and dump files for manual removal


## Phase 4: Pragma Edge Cases (batched)

17. `sqlite.admin.pragmaCompileOptions({filter: "THREAD"})` → filtered result subset
18. `sqlite.admin.pragmaCompileOptions({filter: "FTS"})` → filtered to FTS options
19. `sqlite.admin.pragmaSettings({pragma: "journal_mode"})` → `{value: "wal"}`
20. `sqlite.admin.pragmaTableInfo({table: "nonexistent_table_xyz"})` → report behavior


## Phase 5: Series & CSV Edge Cases (batched)

21. `sqlite.admin.generateSeries({start: 1, stop: 100, step: 1})` → 100 values — check payload size
22. `sqlite.admin.generateSeries({start: 1, stop: 1, step: 1})` → single value
23. `sqlite.admin.analyzeCsvSchema({filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"})` → inferred types
24. `sqlite.admin.createCsvTable({tableName: "stress_csv", filePath: "nonexistent_file.csv"})` → structured error


## Phase 6: Database Management Edge Cases (batched)

25. `sqlite.admin.attachDatabase({filepath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-backup.db", alias: "stress_attached"})` → success (attaches backup from Category 3)
26. `sqlite.admin.attachDatabase({filepath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-backup.db", alias: "stress_attached"})` → error (alias in use)
27. `sqlite.admin.detachDatabase({alias: "stress_attached"})` → success
28. `sqlite.admin.detachDatabase({alias: "stress_attached"})` → error (already detached)
29. `sqlite.admin.vacuumInto({outputPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-vacuum.db"})` → success
30. `sqlite.admin.vacuumInto({outputPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\stress-vacuum.db"})` → error (file already exists)
31. Note vacuum file for manual removal


## Phase 7: Error Message Quality (batched)

32. `sqlite.admin.dropView({viewName: "nonexistent_view_xyz"})` → structured error
33. `sqlite.admin.verifyBackup({backupPath: "nonexistent_backup.db"})` → structured error
34. `sqlite.admin.createCsvTable({tableName: "stress_csv", filePath: "nonexistent_file.csv"})` → structured error
35. `sqlite.admin.attachDatabase({filepath: "../../../etc/passwd", alias: "evil"})` → structured error (path traversal)


## Phase 8: WASM Boundary Verification (batched)

For WASM testing only:

36. Verify that backup/restore/verify, CSV, R-Tree, and vacuumInto tools return `{success: false}` structured errors (not crashes). Confirm all other admin tools produce identical results in WASM and Native.


## Phase 9: REINDEX & WAL Edge Cases (batched)

37. `sqlite.admin.reindex()` → full DB reindex, verify `durationMs > 0`
38. `sqlite.admin.reindex({target: "test_products"})` → table-specific, verify success
39. `sqlite.admin.reindex({target: "idx_orders_status"})` → index-specific, verify success
40. `sqlite.admin.reindex({target: "../../etc/passwd"})` → structured error (identifier validation rejects non-alphanumeric)
41. `sqlite.admin.wal({action: "status"})` → verify `journalMode` matches expectation (should be "wal")
42. `sqlite.admin.wal({action: "enable"})` → already WAL → "already enabled" message, not error
43. `sqlite.admin.wal({action: "checkpoint", checkpointMode: "PASSIVE"})` → success with `walPages` and `checkpointedPages`
44. `sqlite.admin.wal({action: "checkpoint", checkpointMode: "TRUNCATE"})` → success, verify pages


### Final Cleanup

Drop all `stress_*` tables and views. Confirm `test_products` (16 rows) and `test_orders` (20 rows) unchanged.

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
