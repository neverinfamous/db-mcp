# db-mcp Tool Group Testing: [migration]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **migration** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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

---

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

---

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
  rollbackSql: "DROP TABLE IF EXISTS temp_cm_mig_rollback",
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
return await sqlite.core.readQuery(
  "SELECT name FROM sqlite_master WHERE name = 'temp_cm_mig_rollback'",
);
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
