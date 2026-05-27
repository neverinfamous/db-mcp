# db-mcp Tool Group Testing: [migration]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> **Adapter mode**: Call `list_adapters` at the start of testing to determine whether you are running against `native` or `wasm`. Apply the WASM Mode rules below if the adapter is `wasm`.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

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

> [!NOTE]
> **Tool Availability & Code Mode**: The `sqlite_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a *different* group (e.g., `sqlite_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `sqlite_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, or a raw text string wrapped in `isError: true` with no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.
> 
> ⚠️ **AGENT TRAP — `isError: true` rules for tools with `outputSchema`**: The MCP SDK uses `isError` to decide whether to validate `structuredContent` against the `outputSchema`. Getting this wrong causes either raw `-32602` crashes or valid responses wrapped in error frames. **Both are bugs.** The rule:
>
> | Response | `isError: true` | SDK behavior | Verdict |
> |---|---|---|---|
> | `success: true` | **Absent** | Validates `structuredContent` → passes | ✅ Correct |
> | `success: true` | **Present** | Skips validation, wraps in error frame | ❌ Bug — valid response shown as error |
> | `success: false` | **Present** | Skips validation (error shape won't match success schema) | ✅ Correct |
> | `success: false` | **Absent** | Validates error against success schema → fails | ❌ Bug — raw `-32602` |
>
> **TL;DR**: `isError: true` on errors, absent on successes. Do NOT blanket-add or blanket-remove it.

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

## Group Focus: migration

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Built-in Tools (3)

- `server_info`
- `server_health`
- `list_adapters`

### Group Tools (6) + Code Mode

- `sqlite_migration_init`
- `sqlite_migration_record`
- `sqlite_migration_apply`
- `sqlite_migration_rollback`
- `sqlite_migration_history`
- `sqlite_migration_status`
- *(Code Mode executor)*
- `sqlite_execute_code`

## Phase 1: Initialization & Recording (batched)

1. `sqlite_migration_init` → `{success: true}`, creates `_mcp_migrations` table (idempotent — safe to call multiple times)
2. `sqlite_migration_init` → call again to verify idempotency (should succeed without error)
3. `sqlite_migration_status` → verify empty state (no migrations applied yet)
4. `sqlite_migration_record({version: "1.0.0", description: "Create temp table", sql: "CREATE TABLE temp_migration_test (id INTEGER PRIMARY KEY, name TEXT)"})` → recorded (not executed — only logged)
5. `sqlite_migration_status` → verify migration count incremented
6. `sqlite_migration_history` → verify migration 1.0.0 listed with status "recorded"

## Phase 2: Apply & Execute (batched)

7. `sqlite_migration_apply({version: "1.0.1", description: "Create temp migration table", sql: "CREATE TABLE temp_migration_applied (id INTEGER PRIMARY KEY, value TEXT)"})` → applied (SQL executed AND recorded)
8. Verify: `sqlite_read_query({query: "SELECT name FROM sqlite_master WHERE name = 'temp_migration_applied'"})` → table exists
9. `sqlite_migration_history` → verify both 1.0.0 and 1.0.1 listed
10. `sqlite_migration_status` → verify count shows 2 migrations

## Phase 3: SHA-256 Deduplication (batched)

11. `sqlite_migration_record({version: "1.0.2", description: "Duplicate test", sql: "CREATE TABLE temp_migration_test (id INTEGER PRIMARY KEY, name TEXT)"})` → should fail (duplicate SQL detected via SHA-256 hash)

## Phase 4: Rollback (batched)

12. `sqlite_migration_rollback({version: "1.0.1"})` → report behavior (rollback requires rollback SQL to have been recorded; if none was provided during apply, rollback should return an informative error)
13. `sqlite_migration_apply({version: "1.0.3", description: "With rollback", sql: "CREATE TABLE temp_migration_rollback (id INTEGER PRIMARY KEY)", rollbackSql: "DROP TABLE IF EXISTS temp_migration_rollback"})` → applied with rollback SQL stored
14. `sqlite_migration_rollback({version: "1.0.3", dryRun: true})` → preview mode: returns `{success: true, dryRun: true, rollbackSql: "DROP TABLE IF EXISTS temp_migration_rollback"}` without executing
15. Verify: `sqlite_read_query({query: "SELECT name FROM sqlite_master WHERE name = 'temp_migration_rollback'"})` → table should STILL exist (dryRun must not execute the SQL)
16. `sqlite_migration_rollback({version: "1.0.3"})` → should execute the rollback SQL
17. Verify: `sqlite_read_query({query: "SELECT name FROM sqlite_master WHERE name = 'temp_migration_rollback'"})` → table should NOT exist

## Phase 5: Pagination (batched)

18. `sqlite_migration_history({limit: 1})` → verify only 1 migration entry returned
19. `sqlite_migration_history({limit: 1, offset: 1})` → verify returns the second entry (different from item 18)

**Code mode testing:**

20. `sqlite_execute_code({code: "const result = await sqlite.migration.migrationStatus(); return result;"})` → migration status summary
21. `sqlite_execute_code({code: "const result = await sqlite.migration.migrationHistory(); return result;"})` → migration history list

**Error path testing:**

🔴 22. `sqlite_migration_apply({version: "bad version!", description: "Invalid", sql: "SELECT 1"})` → report behavior (invalid version format)
🔴 23. `sqlite_migration_rollback({version: "nonexistent_version"})` → structured error

## Phase 6: Zod Validation Sweep

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error (`{success: false, error: "Validation error: ..."}`), NOT raw MCP error:

🔴 24. `sqlite_migration_init({})` → handler error (or success if no required params)
🔴 25. `sqlite_migration_record({})` → handler error
🔴 26. `sqlite_migration_apply({})` → handler error
🔴 27. `sqlite_migration_rollback({})` → handler error
🔴 28. `sqlite_migration_history({})` → handler error (or success if no required params)
🔴 29. `sqlite_migration_status({})` → handler error (or success if no required params)

## Phase 7: Wrong-Type Numeric Coercion

> For every tool with optional numeric parameters, pass `"abc"` instead of a number. Must return a handler error, NOT a raw MCP `-32602` error.

🔴 30. `sqlite_migration_history({limit: "abc"})` → handler error

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
