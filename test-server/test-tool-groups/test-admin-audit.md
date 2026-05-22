# db-mcp Tool Group Testing: [admin-audit]

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

## Group Focus: admin-audit

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### admin-audit Group Tools (5)

1. sqlite_audit_list_backups
2. sqlite_audit_get_backup
3. sqlite_audit_diff_backup
4. sqlite_audit_restore_backup
5. sqlite_audit_cleanup

**Checklist:**

1. `sqlite_core_execute({query: "CREATE TABLE temp_audit_test (id INTEGER PRIMARY KEY)"})` → This will trigger an automatic schema backup if the server is run with `--audit-backup`. Wait for it to complete.
2. `sqlite_audit_list_backups({})` → Verify the resulting list of backups contains at least one snapshot filename (e.g., `..._temp_audit_test.snapshot.json.gz`). Note the filename.
3. `sqlite_audit_get_backup({filename: "<filename_from_step_2>"})` → Retrieve the backup. Verify it contains `schema` and `timestamp`.
4. `sqlite_audit_diff_backup({filename: "<filename_from_step_2>"})` → Compare the backup to the current live schema. Should show no differences or minimal differences since we just made it.
5. `sqlite_core_execute({query: "DROP TABLE temp_audit_test"})` → Drop the table to change the live schema.
6. `sqlite_audit_diff_backup({filename: "<filename_from_step_2>"})` → Compare again. Should now show `temp_audit_test` as deleted or missing.
7. `sqlite_audit_restore_backup({filename: "<filename_from_step_2>", dryRun: true})` → Dry run a restore. Verify the preview shows `temp_audit_test` will be recreated.
8. `sqlite_audit_restore_backup({filename: "<filename_from_step_2>", dryRun: false})` → Actually restore the backup.
9. `sqlite_core_describe_table({table: "temp_audit_test"})` → Verify the table exists again.
10. `sqlite_core_execute({query: "DROP TABLE temp_audit_test"})` → Cleanup.
11. `sqlite_audit_cleanup({})` → Enforce retention policy (should succeed and report removed count).

**Code mode testing:**

Note: The audit tools are server-level and may not be exposed in Code Mode. If they are not exposed, this is expected behavior. If they are, test them via code mode.
12. `sqlite_execute_code({code: "return typeof sqlite.admin.auditListBackups"})` → If exposed, should be `"function"`. If not exposed, it will throw an error or be `"undefined"`. Document the result.

**Error path testing:**

🔴 13. `sqlite_audit_get_backup({filename: "nonexistent_backup.snapshot.json.gz"})` → structured error
🔴 14. `sqlite_audit_diff_backup({filename: "nonexistent_backup.snapshot.json.gz"})` → structured error
🔴 15. `sqlite_audit_restore_backup({filename: "nonexistent_backup.snapshot.json.gz"})` → structured error
🔴 16. `sqlite_audit_get_backup({filename: "../../../etc/passwd"})` → structured error (path traversal rejection)

**Zod validation sweep** — call each tool with `{}` (empty params) if it has required parameters. Must return handler error, NOT raw MCP error:

🔴 17. `sqlite_audit_get_backup({})` → handler error
🔴 18. `sqlite_audit_diff_backup({})` → handler error
🔴 19. `sqlite_audit_restore_backup({})` → handler error

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
