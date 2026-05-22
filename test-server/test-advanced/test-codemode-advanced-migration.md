# db-mcp Advanced Stress Test: [migration]

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

## Naming & Cleanup

- **Temporary tables**: `stress_*` prefix.
- **After testing**: Run `Set-Location C:\Users\chris\Desktop\db-mcp\test-server; .\reset-database.ps1` to undo schema modifications.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`) | ✅ Confirmed (inline only)

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## migration Group Tools (6)

1. sqlite_migration_init
2. sqlite_migration_record
3. sqlite_migration_apply
4. sqlite_migration_rollback
5. sqlite_migration_history
6. sqlite_migration_status

---

### Category 1: Initialization & Idempotency

1. `sqlite.migration.migrationInit({})` → success, `_mcp_migrations` table created
2. `sqlite.migration.migrationInit({})` → idempotent: should succeed without error
3. `sqlite.migration.migrationStatus({})` → empty/clean state
4. `sqlite.migration.migrationHistory({})` → empty list

---

### Category 2: Full Lifecycle (Record → Apply → Rollback)

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

---

### Category 3: State Pollution & Ordering

**3.1 Re-Record After Rollback**

15. `sqlite.migration.migrationApply({version: "stress_003_recreate", description: "Recreate", sql: "CREATE TABLE stress_migration_data (id INTEGER PRIMARY KEY, value TEXT)", rollbackSql: "DROP TABLE IF EXISTS stress_migration_data"})` → applied
16. `sqlite.migration.migrationStatus({})` → verify counts

**3.2 Duplicate Detection**

17. `sqlite.migration.migrationRecord({version: "stress_001_add_col", description: "Duplicate", sql: "SELECT 1"})` → report behavior: should error (duplicate version) or allow?

**3.3 SHA-256 Duplicate SQL Detection**

18. `sqlite.migration.migrationRecord({version: "stress_004_dup_sql", description: "Dup SQL", sql: "ALTER TABLE test_products ADD COLUMN stress_flag INTEGER DEFAULT 0"})` → report behavior: same SQL hash as stress_001

**3.4 Multi-Statement Apply Verification**

19. `sqlite.migration.migrationApply({version: "stress_005_index", description: "Add index", sql: "CREATE INDEX stress_idx_flag ON test_products(stress_flag)", rollbackSql: "DROP INDEX IF EXISTS stress_idx_flag"})` → applied
20. Verify index created with `sqlite.core.getIndexes({table: "test_products"})`

---

### Category 4: Error Paths & Recovery

**4.1 Apply Failures**

21. `sqlite.migration.migrationApply({version: "stress_006_bad_sql", description: "Bad SQL", sql: "ALTER TABLE nonexistent_xyz ADD COLUMN foo TEXT"})` → records but execute fails
22. `sqlite.migration.migrationStatus({})` → verify failed migration state is tracked

**4.2 Nonexistent Migration Operations**

23. `sqlite.migration.migrationRollback({version: "nonexistent_migration_xyz"})` → structured error (not raw MCP)

**4.3 Zod Validation Errors**

24. `sqlite.migration.migrationRecord({})` → Zod error for missing required params — must be handler error
25. `sqlite.migration.migrationApply({})` → Zod error for missing required params
26. `sqlite.migration.migrationRollback({})` → Zod error for missing `version`

---

### Category 5: Error Message Quality

Rate each error response 1-5:

27. `sqlite.migration.migrationRollback({version: "nonexistent_migration_xyz"})` → does it mention the version?
28. `sqlite.migration.migrationRecord({})` → does it list missing required fields?
29. `sqlite.migration.migrationRollback({version: "stress_001_add_col"})` → rate error clarity (no rollbackSql stored)

---

### Final Cleanup

1. Drop `_mcp_migrations`: `sqlite.admin.dropTable({table: "_mcp_migrations"})`
2. Drop `stress_migration_data`: `sqlite.admin.dropTable({table: "stress_migration_data"})`
3. Drop `stress_idx_flag`: _Handled by database reset below_
4. **Reset database** with `Set-Location C:\Users\chris\Desktop\db-mcp\test-server; .\reset-database.ps1` to undo `stress_flag` column on `test_products`
5. After reset, verify: `test_products` has 16 rows and original columns (no `stress_flag`)

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
