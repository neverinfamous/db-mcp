# db-mcp Advanced Stress Test — [transactions]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode).

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

> **Note:** All 8 transaction tools are **`[NATIVE ONLY]`** — they are not available in WASM mode.

## WASM Mode

> [!CAUTION]
> **Skip this entire prompt in WASM mode.** All 8 transaction tools are `[NATIVE ONLY]` — they are not registered in the WASM adapter. The `sqlite.transactions` namespace exists but contains 0 methods. Use `test-tool-group-codemode-wasm-degradation.md` to verify this behavior.

## Code Mode Execution

- **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

All tests via `sqlite_execute_code`. Use `sqlite.transactions.*` for transaction tools, `sqlite.core.*` for read/write.
State persists across calls. Do NOT pass `readonly: true`.

> **⚠️ Transaction tests are sequential** — each depends on state from the previous. Run lifecycle tests individually, not batched.

## Test Database Schema

| Table             | Rows | Key Columns                                                   |
| ----------------- | ---- | ------------------------------------------------------------- |
| test_products     | 16   | id, name, price, category                                     |
| test_orders       | 20   | id, product_id (FK), total_price, status                      |

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

1. **Cleanup**: Roll back any active transaction, drop all `stress_*` objects
2. **Fix EVERY finding** — ❌, ⚠️, 📦
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Re-test**: After server rebuild
6. **Token audit**: Report most expensive block
