# Advanced Stress Test — db-mcp — [transactions]

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode).

> **Note:** All 8 transaction tools are **`[NATIVE ONLY]`** — they are not available in WASM mode.

## Code Mode Execution

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

15. `sqlite.transactions.transactionBegin()` → get transaction ID
16. `sqlite.transactions.transactionExecute({statements: ["INSERT INTO nonexistent_table VALUES (1)"]})` → should fail
17. Start new transaction → verify it works normally (no lingering aborted state)

---

### Category 2: Savepoint Stress Test

18. `sqlite.transactions.transactionBegin()` → begin
19. Create savepoint `sp1`
20. `sqlite.core.writeQuery("INSERT INTO stress_tx_sp (id, val) VALUES (1, 'a')")` → insert within transaction (create `stress_tx_sp` first)
21. Create savepoint `sp2`
22. `sqlite.core.writeQuery("INSERT INTO stress_tx_sp (id, val) VALUES (2, 'b')")` → insert
23. `sqlite.transactions.transactionRollbackTo({name: "sp2"})` → should undo sp2's insert
24. `sqlite.transactions.transactionRollbackTo({name: "sp1"})` → should undo all inserts
25. `sqlite.transactions.transactionCommit()` → only pre-sp1 state persists

---

### Category 3: Transaction Execute — Mixed Statements

26. `sqlite.transactions.transactionExecute({statements: ["CREATE TABLE stress_tx_test (id INTEGER PRIMARY KEY, name TEXT)", "INSERT INTO stress_tx_test VALUES (1, 'alpha')", "INSERT INTO stress_tx_test VALUES (2, 'beta')"]})` → success, 3 statements
27. Verify `stress_tx_test` exists with 2 rows

---

### Category 4: Transaction Execute — Failure Rollback

28. `sqlite.transactions.transactionExecute({statements: ["CREATE TABLE stress_tx_fail (id INT)", "INSERT INTO nonexistent_xyz VALUES (1)", "CREATE TABLE stress_tx_fail2 (id INT)"]})` → failure
29. Verify: `stress_tx_fail` does NOT exist (atomic rollback worked)

---

### Category 5: Rapid State Transitions

30. Begin → commit immediately (empty transaction)
31. Begin → rollback immediately (empty transaction)
32. `sqlite.transactions.transactionStatus()` → verify `{active: false}` after both
33. Begin → savepoint → release → commit (minimal lifecycle)

---

### Category 6: Error Message Quality

34. `sqlite.transactions.transactionRollback()` with no active transaction → report behavior
35. `sqlite.transactions.transactionRelease({name: "nonexistent_sp_xyz"})` → structured error
36. `sqlite.transactions.transactionExecute({statements: []})` → report behavior for empty array

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
3. **Validate**: Test suite, lint + typecheck, changelog
4. **Commit**: Stage and commit — do NOT push
5. **Re-test**: After server rebuild
6. **Token audit**: Report most expensive block
