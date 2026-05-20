# Transactions Stress Test

## Category 1: Aborted Transaction Recovery
- [x] transactionBegin() -> get transaction ID
- [x] transactionExecute({statements: ["INSERT INTO nonexistent_table VALUES (1)"]}) -> should fail
- [x] Start new transaction -> verify works normally
*(Fixed transactionExecute to properly rollback active transactions on failure if rollbackOnError is true)*

## Category 2: Savepoint Stress Test
- [x] transactionBegin()
- [x] Create savepoint sp1
- [x] sqlite.core.writeQuery("INSERT INTO stress_tx_sp (id, val) VALUES (1, 'a')")
- [x] Create savepoint sp2
- [x] sqlite.core.writeQuery("INSERT INTO stress_tx_sp (id, val) VALUES (2, 'b')")
- [x] transactionRollbackTo({name: "sp2"})
- [x] transactionRollbackTo({name: "sp1"})
- [x] transactionCommit()

## Category 3: Transaction Execute — Mixed Statements
- [x] transactionExecute({statements: ["CREATE TABLE stress_tx_test (id INTEGER PRIMARY KEY, name TEXT)", "INSERT INTO stress_tx_test VALUES (1, 'alpha')", "INSERT INTO stress_tx_test VALUES (2, 'beta')"]})
- [x] Verify stress_tx_test exists with 2 rows

## Category 4: Transaction Execute — Failure Rollback
- [x] transactionExecute({statements: ["CREATE TABLE stress_tx_fail (id INT)", "INSERT INTO nonexistent_xyz VALUES (1)", "CREATE TABLE stress_tx_fail2 (id INT)"]})
- [x] Verify: stress_tx_fail does NOT exist

## Category 5: Rapid State Transitions
- [x] Begin -> commit immediately
- [x] Begin -> rollback immediately
- [x] transactionStatus() -> verify {active: false}
- [x] Begin -> savepoint -> release -> commit

## Category 6: Error Message Quality
- [x] transactionRollback() with no active transaction
- [x] transactionRelease({name: "nonexistent_sp_xyz"})
- [x] transactionExecute({statements: []})

## Final Cleanup
- [x] Rollback open transactions
- [x] Drop stress_tx_sp, stress_tx_test, stress_tx_fail
- [x] Confirm test_products (16) and test_orders (20) unchanged
