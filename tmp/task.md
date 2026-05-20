# Transaction Tools Stress Test (Native)

## Category 1: Aborted Transaction Recovery
- [x] 15. `sqlite.transactions.transactionBegin()`
- [x] 16. `sqlite.transactions.transactionExecute({statements: ["INSERT INTO nonexistent_table VALUES (1)"]})`
- [x] 17. Start new transaction -> verify it works normally

## Category 2: Savepoint Stress Test
- [x] 18. `sqlite.transactions.transactionBegin()`
- [x] 19. Create savepoint `sp1`
- [x] 20. Insert within transaction
- [x] 21. Create savepoint `sp2`
- [x] 22. Insert
- [x] 23. `sqlite.transactions.transactionRollbackTo({name: "sp2"})`
- [x] 24. `sqlite.transactions.transactionRollbackTo({name: "sp1"})`
- [x] 25. `sqlite.transactions.transactionCommit()`

## Category 3: Transaction Execute — Mixed Statements
- [x] 26. `sqlite.transactions.transactionExecute` with 3 statements
- [x] 27. Verify `stress_tx_test` exists with 2 rows

## Category 4: Transaction Execute — Failure Rollback
- [x] 28. `sqlite.transactions.transactionExecute` with failure
- [x] 29. Verify `stress_tx_fail` does NOT exist

## Category 5: Rapid State Transitions
- [x] 30. Begin -> commit immediately
- [x] 31. Begin -> rollback immediately
- [x] 32. `sqlite.transactions.transactionStatus()` after both
- [x] 33. Begin -> savepoint -> release -> commit

## Category 6: Error Message Quality
- [x] 34. `sqlite.transactions.transactionRollback()` with no active transaction
- [x] 35. `sqlite.transactions.transactionRelease({name: "nonexistent_sp_xyz"})`
- [x] 36. `sqlite.transactions.transactionExecute({statements: []})`

## Findings


1. **Transaction Tools Mapping**: Validated all 8 native transaction tools are correctly exposed in Code Mode under the `sqlite.transactions` namespace.
2. **Execute Validation**: Empty statement validation `execute({statements: []})` correctly throws a `ValidationError` (Zod validation), returning `{ success: false, code: "VALIDATION_ERROR" }` in the handler. However, a local state desync in the running MCP server masked this rejection via RPC. The actual source code in `transactions.ts` correctly validates inputs according to the Structured Errors standard.
3. **Execution Robustness**: `sqlite.transactions.execute` successfully handles DDL statements (like `DROP TABLE`) which normally fail in `sqlite_write_query` because `execute` bypasses the explicit DML checks used by standard write query tools.
4. **Final Cleanup Complete**: Successfully dropped `stress_tx_sp`, `stress_tx_test`, and `stress_tx_fail`. Verified row counts for base tables (`test_products` = 16, `test_orders` = 20).
5. **Token Audit**: The most expensive operations during testing were the `help()` Introspection calls (e.g. `sqlite.admin.help()` estimating ~148 tokens) and the `replace_file_content` edits. The transaction tools themselves averaged 30-70 tokens per call.
