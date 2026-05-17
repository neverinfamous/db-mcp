# db-mcp Code Mode Testing: [transactions]

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **transactions** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

> **Note:** All 8 transaction tools are **`[NATIVE ONLY]`** — they are not available in WASM mode.

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
return await sqlite.transactions.transactionStatus();
```

Expected: `{status: "none", active: false}`

### 1.2 — Begin transaction

```javascript
return await sqlite.transactions.transactionBegin();
```

Expected: Success, transaction ID returned.

### 1.3 — Verify active state

```javascript
return await sqlite.transactions.transactionStatus();
```

Expected: `{status: "active", active: true}`

### 1.4 — Rollback

```javascript
return await sqlite.transactions.transactionRollback();
```

Expected: Success.

### 1.5 — Verify none state after rollback

```javascript
return await sqlite.transactions.transactionStatus();
```

Expected: `{status: "none", active: false}`

---

## Phase 2: Savepoints — Happy Paths (sequential)

### 2.1 — Begin + savepoint + release + commit

```javascript
await sqlite.transactions.transactionBegin();
await sqlite.transactions.transactionSavepoint({name: "sp1"});
await sqlite.transactions.transactionRollbackTo({name: "sp1"});
await sqlite.transactions.transactionRelease({name: "sp1"});
const result = await sqlite.transactions.transactionCommit();
return result;
```

### 2.2 — Transactional execute

```javascript
return await sqlite.transactions.transactionExecute({
  statements: ["SELECT 1 AS test", "SELECT 2 AS test2"]
});
```

Expected: Success with 2 statements executed.

---

## Phase 3: Transaction Domain Errors (batched where possible)

🔴 3.1 — Execute with invalid SQL:

```javascript
return await sqlite.transactions.transactionExecute({
  statements: ["INSERT INTO nonexistent_table VALUES (1)"]
});
```

Expected: `{success: false}` with rollback info.

🔴 3.2 — Execute with empty array:

```javascript
return await sqlite.transactions.transactionExecute({ statements: [] });
```

Report behavior.

🔴 3.3 — Rollback with no active transaction:

```javascript
return await sqlite.transactions.transactionRollback();
```

Report behavior when no transaction is active.

🔴 3.4 — Release nonexistent savepoint:

```javascript
await sqlite.transactions.transactionBegin();
const result = await sqlite.transactions.transactionRelease({name: "nonexistent_sp_xyz"});
await sqlite.transactions.transactionRollback(); // cleanup
return result;
```

Expected: `{success: false}` — structured error.

---

## Phase 4: Transaction Zod Validation (batched)

🔴 4.1. `sqlite.transactions.transactionBegin({})` → success or handler error (no required params)
🔴 4.2. `sqlite.transactions.transactionStatus({})` → success or handler error (no required params)
🔴 4.3. `sqlite.transactions.transactionCommit({})` → success or handler error (no required params)
🔴 4.4. `sqlite.transactions.transactionRollback({})` → success or handler error (no required params)
🔴 4.5. `sqlite.transactions.transactionExecute({})` → `{success: false}` (missing `statements`)
🔴 4.6. `sqlite.transactions.transactionSavepoint({})` → `{success: false}` (missing `name`)
🔴 4.7. `sqlite.transactions.transactionRelease({})` → `{success: false}` (missing `name`)
🔴 4.8. `sqlite.transactions.transactionRollbackTo({})` → `{success: false}` (missing `name`)

---

## Phase 5: Multi-Step Workflow

### 5.1 — Transactional write with verification

```javascript
const failures = [];

// Execute a multi-statement transaction
const result = await sqlite.transactions.transactionExecute({
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
const before = await sqlite.transactions.transactionStatus();
const exec = await sqlite.transactions.transactionExecute({
  statements: ["SELECT COUNT(*) AS n FROM test_products"]
});
const after = await sqlite.transactions.transactionStatus();
return { before, exec, after };
```

Expected: `before.active === false`, `after.active === false` (transactionExecute is self-contained).

---

## Post-Test Procedures

1. **Cleanup**: Ensure no active transaction is left open
2. **Triage findings**: Create implementation plan if issues found
3. **Scope of fixes**: Handler code, server-instructions, this prompt
4. **Validate**: Test suite, lint + typecheck, changelog
5. **Commit**: Stage and commit — do NOT push
6. **Token audit**: Report most expensive block
7. **Final summary**: After testing/re-testing
