# db-mcp Advanced Stress Test: [transactions]

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

## Naming & Cleanup

- **Temporary tables**: `stress_*` prefix. Drop at end.
- If an active transaction is left open, roll it back before cleanup.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`) | ✅ Confirmed (inline only)

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## transactions Group Tools — Native Only (8)

1. sqlite_transaction_begin
2. sqlite_transaction_commit
3. sqlite_transaction_rollback
4. sqlite_transaction_savepoint
5. sqlite_transaction_release
6. sqlite_transaction_rollback_to
7. sqlite_transaction_execute
8. sqlite_transaction_status

---

### Category 1: Aborted Transaction Recovery

15. `sqlite.transactions.begin()` → get transaction ID
16. `sqlite.transactions.execute({statements: ["INSERT INTO nonexistent_table VALUES (1)"]})` → should fail
17. Start new transaction → verify it works normally (no lingering aborted state)

---

### Category 2: Savepoint Stress Test

18. `sqlite.transactions.begin()` → begin
19. Create savepoint `sp1`
20. `sqlite.core.writeQuery("INSERT INTO stress_tx_sp (id, val) VALUES (1, 'a')")` → insert within transaction (create `stress_tx_sp` first)
21. Create savepoint `sp2`
22. `sqlite.core.writeQuery("INSERT INTO stress_tx_sp (id, val) VALUES (2, 'b')")` → insert
23. `sqlite.transactions.rollbackTo({name: "sp2"})` → should undo sp2's insert
24. `sqlite.transactions.rollbackTo({name: "sp1"})` → should undo all inserts
25. `sqlite.transactions.commit()` → only pre-sp1 state persists

---

### Category 3: Transaction Execute — Mixed Statements

26. `sqlite.transactions.execute({statements: ["CREATE TABLE stress_tx_test (id INTEGER PRIMARY KEY, name TEXT)", "INSERT INTO stress_tx_test VALUES (1, 'alpha')", "INSERT INTO stress_tx_test VALUES (2, 'beta')"]})` → success, 3 statements
27. Verify `stress_tx_test` exists with 2 rows

---

### Category 4: Transaction Execute — Failure Rollback

28. `sqlite.transactions.execute({statements: ["CREATE TABLE stress_tx_fail (id INT)", "INSERT INTO nonexistent_xyz VALUES (1)", "CREATE TABLE stress_tx_fail2 (id INT)"]})` → failure
29. Verify: `stress_tx_fail` does NOT exist (atomic rollback worked)

---

### Category 5: Rapid State Transitions

30. Begin → commit immediately (empty transaction)
31. Begin → rollback immediately (empty transaction)
32. `sqlite.transactions.status()` → verify `{active: false}` after both
33. Begin → savepoint → release → commit (minimal lifecycle)

---

### Category 6: Error Message Quality

34. `sqlite.transactions.rollback()` with no active transaction → report behavior
35. `sqlite.transactions.release({name: "nonexistent_sp_xyz"})` → structured error
36. `sqlite.transactions.execute({statements: []})` → report behavior for empty array

---

### Category 7: WASM Boundary Verification

For WASM testing only:

37. Confirm all 8 transaction tools are NOT present in the tool list

---

### Final Cleanup

Drop `stress_tx_sp`, `stress_tx_test`, `stress_tx_fail` if they exist. Confirm `test_products` (16 rows) and `test_orders` (20 rows) unchanged.

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
