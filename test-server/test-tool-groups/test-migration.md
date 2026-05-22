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

----------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| test_products     | 16   | id, name, description, price, category, created_at                            | —                                                                                         |
| test_orders       | 20   | id, product_id (FK), customer_name, quantity, total_price, order_date, status | —                                                                                         |
| test_jsonb_docs   | 6    | id, doc, metadata, tags, created_at                                           | **doc**, **metadata** (nested), **tags** (array)                                          |
| test_articles     | 8    | id, title, body, author, category, published_at                               | —                                                                                         |
| test_users        | 9    | id, username, email, phone, bio, created_at                                   | —                                                                                         |
| test_measurements | 200  | id, sensor_id, temperature, humidity, pressure, measured_at                   | —                                                                                         |
| test_embeddings   | 20   | id, content, category, embedding                                              | **embedding** (8-dim float array); category values: database, fitness, food, tech, travel |
| test_locations    | 15   | id, name, city, latitude, longitude, type                                     | —                                                                                         |
| test_categories   | 17   | id, name, path, level                                                         | —                                                                                         |
| test_events       | 100  | id, event_type, user_id (INT, 8 values), payload, event_date                  | **payload** (JSON)                                                                        |

> **Note:** When testing `sqlite_execute_code`, do **not** pass `readonly: true` unless specifically testing read-only filtering.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. Report all failures, unexpected behaviors, or unnecessarily large payloads
3. Do not mention what already works well or issues documented in help resources
4. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
5. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.
6. **Deterministic checklist first**: Complete ALL items before freeform exploration.
7. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                | Verdict            |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields     | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, `isError: true` — no `success` field | Bug — report as ❌ |

### Zod Validation Errors

**Zod refinement leak pattern:** `.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. **Fix:** Remove refinements from schema, validate inside handler.

- Raw MCP error (no `success` field) → report as ❌
- `{success: false, error: "..."}` → correct
- Successful response for invalid input → report as ⚠️

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

### Error Consistency Audit

1. Raw error instead of `{success: false}` → ❌
2. Must use `error` field name
3. Orphaned/inline output schemas → ⚠️

### Split Schema Pattern Verification

Verify parameter visibility and alias acceptance.

---

## Group Focus: migration

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

> **⚠️ After testing, run `Set-Location C:\Users\chris\Desktop\db-mcp\test-server; .\reset-database.ps1`** — migration testing creates the `_mcp_migrations` tracking table and modifies the database schema. Always reset the database after completing migration tests.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### migration Group Tools (6)

4. sqlite_migration_init
5. sqlite_migration_record
6. sqlite_migration_apply
7. sqlite_migration_rollback
8. sqlite_migration_history
9. sqlite_migration_status
10. sqlite_execute_code

**Checklist — Initialization & Recording:**

1. `sqlite_migration_init` → `{success: true}`, creates `_mcp_migrations` table (idempotent — safe to call multiple times)
2. `sqlite_migration_init` → call again to verify idempotency (should succeed without error)
3. `sqlite_migration_status` → verify empty state (no migrations applied yet)
4. `sqlite_migration_record({version: "1.0.0", description: "Create temp table", sql: "CREATE TABLE temp_migration_test (id INTEGER PRIMARY KEY, name TEXT)"})` → recorded (not executed — only logged)
5. `sqlite_migration_status` → verify migration count incremented
6. `sqlite_migration_history` → verify migration 1.0.0 listed with status "recorded"

**Checklist — Apply & Execute:**

7. `sqlite_migration_apply({version: "1.0.1", description: "Create temp migration table", sql: "CREATE TABLE temp_migration_applied (id INTEGER PRIMARY KEY, value TEXT)"})` → applied (SQL executed AND recorded)
8. Verify: `sqlite_read_query({query: "SELECT name FROM sqlite_master WHERE name = 'temp_migration_applied'"})` → table exists
9. `sqlite_migration_history` → verify both 1.0.0 and 1.0.1 listed
10. `sqlite_migration_status` → verify count shows 2 migrations

**Checklist — SHA-256 Deduplication:**

11. `sqlite_migration_record({version: "1.0.2", description: "Duplicate test", sql: "CREATE TABLE temp_migration_test (id INTEGER PRIMARY KEY, name TEXT)"})` → should fail (duplicate SQL detected via SHA-256 hash)

**Checklist — Rollback:**

12. `sqlite_migration_rollback({version: "1.0.1"})` → report behavior (rollback requires rollback SQL to have been recorded; if none was provided during apply, rollback should return an informative error)
13. `sqlite_migration_apply({version: "1.0.3", description: "With rollback", sql: "CREATE TABLE temp_migration_rollback (id INTEGER PRIMARY KEY)", rollbackSql: "DROP TABLE IF EXISTS temp_migration_rollback"})` → applied with rollback SQL stored
14. `sqlite_migration_rollback({version: "1.0.3"})` → should execute the rollback SQL
15. Verify: `sqlite_read_query({query: "SELECT name FROM sqlite_master WHERE name = 'temp_migration_rollback'"})` → table should NOT exist
16. `sqlite_migration_rollback({version: "1.0.3", dryRun: true})` → report behavior (preview mode)

**Code mode testing:**

17. `sqlite_execute_code({code: "const result = await sqlite.migration.migrationStatus(); return result;"})` → migration status summary
18. `sqlite_execute_code({code: "const result = await sqlite.migration.migrationHistory(); return result;"})` → migration history list

**Error path testing:**

🔴 19. `sqlite_migration_apply({version: "bad version!", description: "Invalid", sql: "SELECT 1"})` → report behavior (invalid version format)
🔴 20. `sqlite_migration_rollback({version: "nonexistent_version"})` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 21. `sqlite_migration_init({})` → handler error (or success if no required params)
🔴 22. `sqlite_migration_record({})` → handler error
🔴 23. `sqlite_migration_apply({})` → handler error
🔴 24. `sqlite_migration_rollback({})` → handler error
🔴 25. `sqlite_migration_history({})` → handler error (or success if no required params)
🔴 26. `sqlite_migration_status({})` → handler error (or success if no required params)

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
