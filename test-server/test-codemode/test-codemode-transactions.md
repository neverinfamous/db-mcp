# db-mcp Tool Group Testing: [transactions]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **transactions** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB and suggest a concrete optimization.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

1. Use existing `test_*` tables for read operations.
2. Test each tool with realistic inputs based on the schema above.
3. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads.
4. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) a domain error and (b) a **Zod validation error** (call the tool with `{}` empty params). Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
5. **Output schema testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

All tools should return errors as structured objects instead of throwing. The expected pattern:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error — How to Distinguish

| Type                 | Source                                                             | What you see                                                                                                          | Verdict            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields                                                               | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field | Bug — report as ❌ |

### Zod Validation Errors

Calling a tool with wrong parameter types or missing required fields triggers a Zod validation error. If the handler has no outer `try/catch`, this surfaces as a raw MCP error (often `-32602`). Test every tool with `{}` (empty params) if it has required parameters — the response must be a handler error, not an MCP error.

**Fix:** Remove ALL `.min(N)` / `.max(N)` refinements from the schema and validate inside the handler instead.

### Wrong-Type Numeric Parameter Coercion

For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.

### Output Schema Validation Errors

The MCP SDK enforces `additionalProperties: false` on **output** schemas. If a handler returns fields not declared in its output schema, the SDK rejects the response with a raw `-32602` error.

**How to detect:** If a tool call with **correct, valid inputs** returns a raw MCP `-32602` mentioning "does not match the tool's output schema" or "additional properties", report as ❌ with both the tool name and the missing field(s).

### Error Consistency Audit

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌.
2. **Error field name**: All `{success: false}` responses should use `error` as the field name.
3. **Zod validation leaks**: If calling a tool with missing required field produces a raw MCP `-32602` error instead of a structured response, report as ❌.
4. **Output schema leaks**: If calling a tool with valid inputs produces a raw MCP `-32602` mentioning "output schema", report as ❌.

------------- | ---- | ---------------------------------------- |
| test_products | 16   | id, name, price, category                |
| test_orders   | 20   | id, product_id (FK), total_price, status |

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** Report as ❌.

1. **Batched scripting**: Bundle checks with `failures` array where possible.
2. **Error path testing**: Every tool with `{}` (Zod) and domain error.
3. **Token tracking**: Monitor `metrics.tokenEstimate`.
4. **Coverage Matrix**: `| Tool | Happy Path | Domain Error | Zod Error |`
5. **Deterministic checklist first**.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

> **⚠️ Transaction ordering matters**: Transaction tests must be sequential — each test depends on the state left by the previous one. Do NOT batch transaction lifecycle tests (begin/commit/rollback) into a single failures-array script. Run them individually to verify state transitions.

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

## Cleanup

- No permanent state — transactions rollback automatically on error.

---

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

---

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

---

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

---

## Phase 4: Transaction Zod Validation (batched)

🔴 4.1. `sqlite.transactions.begin({})` → success or handler error (no required params)
🔴 4.2. `sqlite.transactions.status({})` → success or handler error (no required params)
🔴 4.3. `sqlite.transactions.commit({})` → success or handler error (no required params)
🔴 4.4. `sqlite.transactions.rollback({})` → success or handler error (no required params)
🔴 4.5. `sqlite.transactions.execute({})` → `{success: false}` (missing `statements`)
🔴 4.6. `sqlite.transactions.savepoint({})` → `{success: false}` (missing `name`)
🔴 4.7. `sqlite.transactions.release({})` → `{success: false}` (missing `name`)
🔴 4.8. `sqlite.transactions.rollbackTo({})` → `{success: false}` (missing `name`)

---

## Phase 5: Multi-Step Workflow

### 5.1 — Transactional write with verification

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

### 5.2 — Status + execute cross-check

```javascript
const before = await sqlite.transactions.status();
const exec = await sqlite.transactions.execute({
  statements: ["SELECT COUNT(*) AS n FROM test_products"],
});
const after = await sqlite.transactions.status();
return { before, exec, after };
```

Expected: `before.active === false`, `after.active === false` (execute is self-contained).

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
