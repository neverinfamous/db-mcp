# db-mcp Code Mode Testing: [transactions]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **transactions** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

> **Note:** All 8 transaction tools are **`[NATIVE ONLY]`** — they are not available in WASM mode.

## WASM Mode

> [!CAUTION]
> **Skip this entire prompt in WASM mode.** All 8 transaction tools are `[NATIVE ONLY]` — they are not registered in the WASM adapter. The `sqlite.transactions` namespace exists but contains 0 methods. Use `test-tool-group-codemode-wasm-degradation.md` to verify this behavior.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — monitor `metrics.tokenEstimate`.

## Test Database Schema

| Table             | Rows | Key Columns                                                   |
| ----------------- | ---- | ------------------------------------------------------------- |
| test_products     | 16   | id, name, price, category                                     |
| test_orders       | 20   | id, product_id (FK), total_price, status                      |

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
await sqlite.transactions.savepoint({name: "sp1"});
await sqlite.transactions.rollbackTo({name: "sp1"});
await sqlite.transactions.release({name: "sp1"});
const result = await sqlite.transactions.commit();
return result;
```

### 2.2 — Transactional execute

```javascript
return await sqlite.transactions.execute({
  statements: ["SELECT 1 AS test", "SELECT 2 AS test2"]
});
```

Expected: Success with 2 statements executed.

---

## Phase 3: Transaction Domain Errors (batched where possible)

🔴 3.1 — Execute with invalid SQL:

```javascript
return await sqlite.transactions.execute({
  statements: ["INSERT INTO nonexistent_table VALUES (1)"]
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
const result = await sqlite.transactions.release({name: "nonexistent_sp_xyz"});
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
    "INSERT INTO temp_cm_txn VALUES (2, 'beta')"
  ]
});
if (!result || result.success === false) failures.push("transactionExecute failed");

// Verify data was committed
const count = await sqlite.core.count({table: "temp_cm_txn"});
if (count.count !== 2) failures.push(`expected 2 rows, got ${count.count}`);

// Cleanup
await sqlite.core.writeQuery("DROP TABLE IF EXISTS temp_cm_txn");

return { failures, success: failures.length === 0 };
```

### 5.2 — Status + execute cross-check

```javascript
const before = await sqlite.transactions.status();
const exec = await sqlite.transactions.execute({
  statements: ["SELECT COUNT(*) AS n FROM test_products"]
});
const after = await sqlite.transactions.status();
return { before, exec, after };
```

Expected: `before.active === false`, `after.active === false` (execute is self-contained).

---

## Post-Test Procedures

1. **Cleanup**: Ensure no active transaction is left open
3. **Triage findings**: Create implementation plan if issues found
4. **Scope of fixes**: Handler code, server-instructions, this prompt
5. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
6. **Commit**: Stage and commit — do NOT push
7. **Token audit**: Report most expensive block
8. **Final summary**: After testing/re-testing
