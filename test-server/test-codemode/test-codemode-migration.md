# db-mcp Code Mode Testing: [migration]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're currently in Native mode.
> If there is nothing to fix, don't update UNRELEASED.md.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **migration** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

> **⚠️ After testing, run `Set-Location C:\Users\chris\Desktop\db-mcp\test-server; .\reset-database.ps1`** — migration testing creates the `_mcp_migrations` tracking table and modifies schema. Always reset after.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js): All 6 migration tools are fully WASM-compatible. No phases to skip or adjust.

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

> **⚠️ Migration ordering matters**: Migration tests are stateful — each depends on the previous. Run lifecycle tests sequentially, not batched.

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

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
  migrationSql: "CREATE TABLE temp_cm_mig_test (id INTEGER PRIMARY KEY, name TEXT)"
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

---

## Phase 2: Apply & Execute — Happy Paths (sequential)

### 2.1 — Apply a migration (SQL executed)

```javascript
return await sqlite.migration.migrationApply({
  version: "1.0.1",
  description: "Create applied table",
  migrationSql: "CREATE TABLE temp_cm_mig_applied (id INTEGER PRIMARY KEY, value TEXT)"
});
```

Expected: Applied (SQL executed AND recorded).

### 2.2 — Verify table exists

```javascript
return await sqlite.core.readQuery("SELECT name FROM sqlite_master WHERE name = 'temp_cm_mig_applied'");
```

Expected: Table exists.

### 2.3 — Check history (2 migrations)

```javascript
return await sqlite.migration.migrationHistory();
```

Expected: Both 1.0.0 and 1.0.1 listed.

---

## Phase 3: SHA-256 Deduplication

### 3.1 — Duplicate SQL detection

```javascript
return await sqlite.migration.migrationRecord({
  version: "1.0.2",
  description: "Duplicate test",
  migrationSql: "CREATE TABLE temp_cm_mig_test (id INTEGER PRIMARY KEY, name TEXT)"
});
```

Expected: Fail — duplicate SQL hash detected.

---

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
  rollbackSql: "DROP TABLE IF EXISTS temp_cm_mig_rollback"
});
```

Expected: Applied with rollback SQL stored.

### 4.3 — Execute rollback

```javascript
return await sqlite.migration.migrationRollback({ version: "1.0.3" });
```

Expected: Rollback SQL executed.

### 4.4 — Verify table gone

```javascript
return await sqlite.core.readQuery("SELECT name FROM sqlite_master WHERE name = 'temp_cm_mig_rollback'");
```

Expected: Table does NOT exist.

---

## Phase 5: Migration Domain Errors (batched)

🔴 5.1. `sqlite.migration.migrationApply({version: "bad version!", description: "Invalid", migrationSql: "SELECT 1"})` → report behavior
🔴 5.2. `sqlite.migration.migrationRollback({version: "nonexistent_version"})` → `{success: false}`

---

## Phase 6: Migration Zod Validation (batched)

🔴 6.1. `sqlite.migration.migrationInit({})` → success (no required params)
🔴 6.2. `sqlite.migration.migrationRecord({})` → `{success: false}` (missing required params)
🔴 6.3. `sqlite.migration.migrationApply({})` → `{success: false}` (missing required params)
🔴 6.4. `sqlite.migration.migrationRollback({})` → `{success: false}` (missing `version`)
🔴 6.5. `sqlite.migration.migrationHistory({})` → success (no required params)
🔴 6.6. `sqlite.migration.migrationStatus({})` → success (no required params)

---

## Phase 7: Multi-Step Workflow

### 7.1 — Full migration lifecycle

```javascript
const failures = [];
// Init
await sqlite.migration.migrationInit();

// Apply
await sqlite.migration.migrationApply({
  version: "9.9.1",
  description: "Lifecycle test",
  migrationSql: "CREATE TABLE temp_cm_mig_lifecycle (id INTEGER PRIMARY KEY, val TEXT)",
  rollbackSql: "DROP TABLE IF EXISTS temp_cm_mig_lifecycle"
});

// Verify
const status = await sqlite.migration.migrationStatus();
const history = await sqlite.migration.migrationHistory();
const tableExists = await sqlite.core.readQuery("SELECT name FROM sqlite_master WHERE name = 'temp_cm_mig_lifecycle'");

if (!tableExists.rows || tableExists.rows.length === 0) failures.push("table not created after apply");

// Rollback
await sqlite.migration.migrationRollback({version: "9.9.1"});
const afterRollback = await sqlite.core.readQuery("SELECT name FROM sqlite_master WHERE name = 'temp_cm_mig_lifecycle'");
if (afterRollback.rows && afterRollback.rows.length > 0) failures.push("table still exists after rollback");

return { failures, success: failures.length === 0, statusBefore: status, historyEntries: history };
```

---

## Post-Test Procedures

1. **⚠️ Explicit Cleanup**: Execute a final Code Mode script to `DROP TABLE IF EXISTS` all `temp_*` tables created during the test, as the active MCP server lock prevents the reset script from clearing them.
2. **⚠️ Reset database**: Run `Set-Location C:\Users\chris\Desktop\db-mcp\test-server; .\reset-database.ps1` to re-seed the test database.
3. **Triage findings**: Create implementation plan if issues found
4. **Scope of fixes**: Handler code, server-instructions, this prompt
5. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
6. **Commit**: Stage and commit — do NOT push
7. **Token audit**: Report most expensive block
8. **Final summary**: After testing/re-testing
