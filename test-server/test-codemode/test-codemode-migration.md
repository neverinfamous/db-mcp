# db-mcp Code Mode Testing: [migration]

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

> [!WARNING]
> **Stale Build Issues:** The MCP server runs from the compiled `dist/` directory, NOT `src/`. If you encounter inexplicable behavior (e.g., tools executing old logic or throwing validation errors for things already fixed in the source code), the server might be running a stale build. Check if the compiled code in `dist/` matches the source code in `src/`. If out of sync, stop and instruct the user to run `npm run build` and restart the server before continuing testing.

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
  

---

## Group Focus: migration

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.migration.migrationInit`
- `sqlite.migration.migrationStatus`
- `sqlite.migration.migrationRecord`
- `sqlite.migration.migrationHistory`
- `sqlite.migration.migrationApply`
- `sqlite.migration.migrationRollback`
- _(cross-group helpers used in test procedures)_
- `sqlite.core.readQuery`

## Phase 1: Initialization & Recording — Happy Paths (sequential)

### 1.1 — Init migrations

```javascript
return await sqlite.migration.migrationInit();
```

Expected: `{success: true}`, creates `_mcp_migrations` table (idempotent).

### 1.2 — Init again (idempotency)

```javascript
return await sqlite.migration.migrationInit();
```

Expected: Succeeds without error.

### 1.3 — Check status (empty)

```javascript
return await sqlite.migration.migrationStatus();
```

Expected: No migrations applied.

### 1.4 — Record a migration (no execution)

```javascript
return await sqlite.migration.migrationRecord({
  version: "1.0.0",
  description: "Create temp table",
  migrationSql:
    "CREATE TABLE temp_cm_mig_test (id INTEGER PRIMARY KEY, name TEXT)",
});
```

Expected: Recorded (SQL not executed — only logged).

### 1.5 — Check status (1 migration)

```javascript
return await sqlite.migration.migrationStatus();
```

Expected: Count incremented.

### 1.6 — Check history

```javascript
return await sqlite.migration.migrationHistory();
```

Expected: Version 1.0.0 listed.

## Phase 2: Apply & Execute — Happy Paths (sequential)

### 2.1 — Apply a migration (SQL executed)

```javascript
return await sqlite.migration.migrationApply({
  version: "1.0.1",
  description: "Create applied table",
  migrationSql:
    "CREATE TABLE temp_cm_mig_applied (id INTEGER PRIMARY KEY, value TEXT)",
});
```

Expected: Applied (SQL executed AND recorded).

### 2.2 — Verify table exists

```javascript
return await sqlite.core.readQuery(
  "SELECT name FROM sqlite_master WHERE name = 'temp_cm_mig_applied'",
);
```

Expected: Table exists.

### 2.3 — Check history (2 migrations)

```javascript
return await sqlite.migration.migrationHistory();
```

Expected: Both 1.0.0 and 1.0.1 listed.

### 2.4 — Apply multi-statement migration (SQL executed atomically)

```javascript
return await sqlite.migration.migrationApply({
  version: "1.0.1a",
  description: "Multi-statement DDL",
  migrationSql:
    "CREATE TABLE temp_cm_mig_multi (id INTEGER PRIMARY KEY, name TEXT); CREATE INDEX temp_idx_mig_multi_name ON temp_cm_mig_multi (name);",
  rollbackSql:
    "DROP INDEX IF EXISTS temp_idx_mig_multi_name; DROP TABLE IF EXISTS temp_cm_mig_multi;",
});
```

Expected: Both CREATE TABLE and CREATE INDEX executed. Verify with `sqlite.core.getIndexes({table: "temp_cm_mig_multi"})` → `temp_idx_mig_multi_name` present.

## Phase 3: SHA-256 Deduplication

### 3.1 — Duplicate SQL detection

```javascript
return await sqlite.migration.migrationRecord({
  version: "1.0.2",
  description: "Duplicate test",
  migrationSql:
    "CREATE TABLE temp_cm_mig_test (id INTEGER PRIMARY KEY, name TEXT)",
});
```

Expected: Fail — duplicate SQL hash detected.

## Phase 4: Rollback — Happy Paths (sequential)

### 4.1 — Rollback without rollback SQL

```javascript
return await sqlite.migration.migrationRollback({ version: "1.0.1" });
```

Expected: Informative error (no rollbackSql was provided).

### 4.2 — Apply with rollback SQL

```javascript
return await sqlite.migration.migrationApply({
  version: "1.0.3",
  description: "With rollback",
  migrationSql: "CREATE TABLE temp_cm_mig_rollback (id INTEGER PRIMARY KEY)",
  rollbackSql: "DROP TABLE IF EXISTS temp_cm_mig_rollback",
});
```

Expected: Applied with rollback SQL stored.

### 4.2b — Dry-run rollback (preview only)

```javascript
const preview = await sqlite.migration.migrationRollback({
  version: "1.0.3",
  dryRun: true,
});
const history = await sqlite.migration.migrationHistory();
return { preview, historyStillContains103: history };
```

Expected: `preview` returns the rollback SQL that _would_ be executed without actually running it. Version 1.0.3 should still be present in migration history after the dry-run.

### 4.3 — Execute rollback

```javascript
return await sqlite.migration.migrationRollback({ version: "1.0.3" });
```

Expected: Rollback SQL executed.

### 4.4 — Verify table gone

```javascript
return await sqlite.core.readQuery(
  "SELECT name FROM sqlite_master WHERE name = 'temp_cm_mig_rollback'",
);
```

Expected: Table does NOT exist.

## Phase 5: Migration Domain Errors (batched)

🔴 5.1. `sqlite.migration.migrationApply({version: "bad version!", description: "Invalid", migrationSql: "SELECT 1"})` → report behavior
🔴 5.2. `sqlite.migration.migrationRollback({version: "nonexistent_version"})` → `{success: false}`

## Phase 6: Multi-Step Workflow

### 6.1 — Full migration lifecycle

```javascript
const failures = [];
// Init
await sqlite.migration.migrationInit();

// Apply
await sqlite.migration.migrationApply({
  version: "9.9.1",
  description: "Lifecycle test",
  migrationSql:
    "CREATE TABLE temp_cm_mig_lifecycle (id INTEGER PRIMARY KEY, val TEXT)",
  rollbackSql: "DROP TABLE IF EXISTS temp_cm_mig_lifecycle",
});

// Verify
const status = await sqlite.migration.migrationStatus();
const history = await sqlite.migration.migrationHistory();
const tableExists = await sqlite.core.readQuery(
  "SELECT name FROM sqlite_master WHERE name = 'temp_cm_mig_lifecycle'",
);

if (!tableExists.rows || tableExists.rows.length === 0)
  failures.push("table not created after apply");

// Rollback
await sqlite.migration.migrationRollback({ version: "9.9.1" });
const afterRollback = await sqlite.core.readQuery(
  "SELECT name FROM sqlite_master WHERE name = 'temp_cm_mig_lifecycle'",
);
if (afterRollback.rows && afterRollback.rows.length > 0)
  failures.push("table still exists after rollback");

return {
  failures,
  success: failures.length === 0,
  statusBefore: status,
  historyEntries: history,
};
```

## Phase 7: Zod Validation Sweep

🔴 7.1. `sqlite.migration.migrationInit({})` → success (no required params)
🔴 7.2. `sqlite.migration.migrationRecord({})` → `{success: false}` (missing required params)
🔴 7.3. `sqlite.migration.migrationApply({})` → `{success: false}` (missing required params)
🔴 7.4. `sqlite.migration.migrationRollback({})` → `{success: false}` (missing `version`)
🔴 7.5. `sqlite.migration.migrationHistory({})` → success (no required params)
🔴 7.6. `sqlite.migration.migrationStatus({})` → success (no required params)

## Phase 8: Wrong-Type Numeric Coercion

🔴 8.1. `sqlite.migration.migrationHistory({limit: "abc"})` → handler error, NOT raw MCP `-32602`

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
