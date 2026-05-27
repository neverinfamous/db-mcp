# db-mcp Code Mode Testing: [transactions]

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

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
> See [`code-map.md`](file:///C:/Users/chris/Desktop/db-mcp/test-server/code-map.md) for the complete test database schema (`test_*` tables).

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
> **Tool Availability & Code Mode**: If a test step requires `sqlite_execute_code` or a setup tool from a *different* group (e.g., `sqlite_write_query`), and that tool is missing from the active MCP registry due to injection scoping, do not fail the group. Use existing seed data/backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing the tools that *are* available.

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

## Group Focus: transactions

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.transactions.status` `[NATIVE ONLY]`
- `sqlite.transactions.begin` `[NATIVE ONLY]`
- `sqlite.transactions.rollback` `[NATIVE ONLY]`
- `sqlite.transactions.savepoint` `[NATIVE ONLY]`
- `sqlite.transactions.rollbackTo` `[NATIVE ONLY]`
- `sqlite.transactions.release` `[NATIVE ONLY]`
- `sqlite.transactions.commit` `[NATIVE ONLY]`
- `sqlite.transactions.execute` `[NATIVE ONLY]`
- *(cross-group helpers used in test procedures)*
- `sqlite.core.count`
- `sqlite.core.writeQuery`

## Phase 1: Transaction Lifecycle — Happy Paths (sequential)

> Run each as an individual `sqlite_execute_code` call to verify state transitions.

### 1.1 — Check initial state

```javascript
return await sqlite.transactions.status();
```

Expected: `{status: "none", active: false}`

### 1.2 — Begin transaction

```javascript
return await sqlite.transactions.begin();
```

Expected: Success, transaction ID returned.

### 1.3 — Verify active state

```javascript
return await sqlite.transactions.status();
```

Expected: `{status: "active", active: true}`

### 1.4 — Rollback

```javascript
return await sqlite.transactions.rollback();
```

Expected: Success.

### 1.5 — Verify none state after rollback

```javascript
return await sqlite.transactions.status();
```

Expected: `{status: "none", active: false}`


## Phase 2: Savepoints — Happy Paths (sequential)

### 2.1 — Begin + savepoint + release + commit

```javascript
await sqlite.transactions.begin();
await sqlite.transactions.savepoint({ name: "sp1" });
await sqlite.transactions.rollbackTo({ name: "sp1" });
await sqlite.transactions.release({ name: "sp1" });
const result = await sqlite.transactions.commit();
return result;
```

### 2.2 — Transactional execute

```javascript
return await sqlite.transactions.execute({
  statements: ["SELECT 1 AS test", "SELECT 2 AS test2"],
});
```

Expected: Success with 2 statements executed.


## Phase 3: Transaction Domain Errors (batched where possible)

🔴 3.1 — Execute with invalid SQL:

```javascript
return await sqlite.transactions.execute({
  statements: ["INSERT INTO nonexistent_table VALUES (1)"],
});
```

Expected: `{success: false}` with rollback info.

🔴 3.2 — Execute with empty array:

```javascript
return await sqlite.transactions.execute({ statements: [] });
```

Report behavior.

🔴 3.3 — Rollback with no active transaction:

```javascript
return await sqlite.transactions.rollback();
```

Report behavior when no transaction is active.

🔴 3.4 — Release nonexistent savepoint:

```javascript
await sqlite.transactions.begin();
const result = await sqlite.transactions.release({
  name: "nonexistent_sp_xyz",
});
await sqlite.transactions.rollback(); // cleanup
return result;
```

Expected: `{success: false}` — structured error.


## Phase 4: Multi-Step Workflow

### 4.1 — Transactional write with verification

```javascript
const failures = [];

// Execute a multi-statement transaction
const result = await sqlite.transactions.execute({
  statements: [
    "CREATE TABLE temp_cm_txn (id INTEGER PRIMARY KEY, val TEXT)",
    "INSERT INTO temp_cm_txn VALUES (1, 'alpha')",
    "INSERT INTO temp_cm_txn VALUES (2, 'beta')",
  ],
});
if (!result || result.success === false)
  failures.push("transactionExecute failed");

// Verify data was committed
const count = await sqlite.core.count({ table: "temp_cm_txn" });
if (count.count !== 2) failures.push(`expected 2 rows, got ${count.count}`);

// Cleanup
await sqlite.core.writeQuery("DROP TABLE IF EXISTS temp_cm_txn");

return { failures, success: failures.length === 0 };
```

### 4.2 — Status + execute cross-check

```javascript
const before = await sqlite.transactions.status();
const exec = await sqlite.transactions.execute({
  statements: ["SELECT COUNT(*) AS n FROM test_products"],
});
const after = await sqlite.transactions.status();
return { before, exec, after };
```

Expected: `before.active === false`, `after.active === false` (execute is self-contained).


## Phase 5: Zod Validation Sweep

🔴 5.1. `sqlite.transactions.begin({})` → success or handler error (no required params)
🔴 5.2. `sqlite.transactions.status({})` → success or handler error (no required params)
🔴 5.3. `sqlite.transactions.commit({})` → success or handler error (no required params)
🔴 5.4. `sqlite.transactions.rollback({})` → success or handler error (no required params)
🔴 5.5. `sqlite.transactions.execute({})` → `{success: false}` (missing `statements`)
🔴 5.6. `sqlite.transactions.savepoint({})` → `{success: false}` (missing `name`)
🔴 5.7. `sqlite.transactions.release({})` → `{success: false}` (missing `name`)
🔴 5.8. `sqlite.transactions.rollbackTo({})` → `{success: false}` (missing `name`)

---

> **Note**: No Wrong-Type Numeric Coercion phase is included for this group — none of the transaction tools have optional numeric parameters.

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
