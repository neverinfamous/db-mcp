# db-mcp Advanced Stress Testing: [migration]

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

> See `code-map.md` in the `test-server/` directory for the complete test database schema (`test_*` tables).

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

### Code Mode Methods

- `sqlite.migration.migrationInit`
- `sqlite.migration.migrationRecord`
- `sqlite.migration.migrationApply`
- `sqlite.migration.migrationRollback`
- `sqlite.migration.migrationHistory`
- `sqlite.migration.migrationStatus`
- _(cross-group helpers used in test procedures)_
- `sqlite.core.getIndexes`
- `sqlite.core.dropTable`

## Phase 1: Initialization & Idempotency (batched)

1. `sqlite.migration.migrationInit({})` → success, `_mcp_migrations` table created
2. `sqlite.migration.migrationInit({})` → idempotent: should succeed without error
3. `sqlite.migration.migrationStatus({})` → empty/clean state
4. `sqlite.migration.migrationHistory({})` → empty list

## Phase 2: Full Lifecycle (Record → Apply → Rollback) (batched)

**2.1 Simple ALTER TABLE Migration**

5. `sqlite.migration.migrationRecord({version: "stress_001_add_col", description: "Add stress flag", sql: "ALTER TABLE test_products ADD COLUMN stress_flag INTEGER DEFAULT 0"})` → recorded (SQL not executed)
6. `sqlite.migration.migrationStatus({})` → shows 1 recorded migration
7. Verify column is NOT yet added
8. `sqlite.migration.migrationApply({version: "stress_001_add_col", description: "Add stress flag", sql: "ALTER TABLE test_products ADD COLUMN stress_flag INTEGER DEFAULT 0"})` → applied (SQL executed)
9. `sqlite.migration.migrationStatus({})` → shows 1 applied

**2.2 CREATE TABLE Migration**

10. `sqlite.migration.migrationApply({version: "stress_002_create_table", description: "Create data table", sql: "CREATE TABLE stress_migration_data (id INTEGER PRIMARY KEY, name TEXT NOT NULL, value REAL)", rollbackSql: "DROP TABLE IF EXISTS stress_migration_data"})` → applied
11. `sqlite.migration.migrationHistory({})` → both migrations with timestamps

**2.3 Rollback Chain**

12. `sqlite.migration.migrationRollback({version: "stress_002_create_table"})` → rollback with stored rollbackSql
13. Verify `stress_migration_data` is gone
14. `sqlite.migration.migrationHistory({})` → check status

## Phase 3: State Pollution & Ordering (batched)

**3.1 Re-Record After Rollback**

15. `sqlite.migration.migrationApply({version: "stress_003_recreate", description: "Recreate", sql: "CREATE TABLE stress_migration_data (id INTEGER PRIMARY KEY, value TEXT)", rollbackSql: "DROP TABLE IF EXISTS stress_migration_data"})` → applied
16. `sqlite.migration.migrationStatus({})` → verify counts

**3.2 Duplicate Detection**

17. `sqlite.migration.migrationRecord({version: "stress_001_add_col", description: "Duplicate", sql: "SELECT 1"})` → errors with DUPLICATE_VERSION

**3.3 SHA-256 Duplicate SQL Detection**

18. `sqlite.migration.migrationRecord({version: "stress_004_dup_sql", description: "Dup SQL", sql: "ALTER TABLE test_products ADD COLUMN stress_flag INTEGER DEFAULT 0"})` → errors with DUPLICATE_MIGRATION

**3.4 Multi-Statement Apply Verification**

19. `sqlite.migration.migrationApply({version: "stress_005_index", description: "Add index", sql: "CREATE INDEX stress_idx_flag ON test_products(stress_flag)", rollbackSql: "DROP INDEX IF EXISTS stress_idx_flag"})` → applied
20. Verify index created with `sqlite.core.getIndexes({table: "test_products"})`

## Phase 4: Error Message Quality (batched)

Rate each error response 1-5:

21. `sqlite.migration.migrationRollback({version: "nonexistent_migration_xyz"})` → errors with MIGRATION_NOT_FOUND (mentions version)
22. `sqlite.migration.migrationRecord({})` → errors with VALIDATION_ERROR (lists missing required fields)
23. `sqlite.migration.migrationRollback({version: "stress_001_add_col"})` → errors with ROLLBACK_SQL_MISSING (rated 5/5 for clarity)

### Final Cleanup

24. Drop `_mcp_migrations`: `sqlite.core.dropTable({table: "_mcp_migrations"})`
25. Drop `stress_migration_data`: `sqlite.core.dropTable({table: "stress_migration_data"})`
26. Drop `stress_idx_flag`: _Handled by database reset below_
27. **Reset database** with `Set-Location C:\Users\chris\Desktop\db-mcp\test-server; .\reset-database.ps1` to undo `stress_flag` column on `test_products`
28. After reset, verify: `test_products` has 16 rows and original columns (no `stress_flag`)

## Phase 5: Error Paths & Recovery (batched)

**5.1 Apply Failures**

🔴 29. `sqlite.migration.migrationApply({version: "stress_006_bad_sql", description: "Bad SQL", sql: "ALTER TABLE nonexistent_xyz ADD COLUMN foo TEXT"})` → records but execute fails
🔴 30. `sqlite.migration.migrationStatus({})` → verify failed migration state is tracked

**5.2 Nonexistent Migration Operations**

🔴 31. `sqlite.migration.migrationRollback({version: "nonexistent_migration_xyz"})` → structured error (not raw MCP)

**5.3 Zod Validation Errors**

🔴 32. `sqlite.migration.migrationRecord({})` → Zod error for missing required params — must be handler error
🔴 33. `sqlite.migration.migrationApply({})` → Zod error for missing required params
🔴 34. `sqlite.migration.migrationRollback({})` → Zod error for missing `version`

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
