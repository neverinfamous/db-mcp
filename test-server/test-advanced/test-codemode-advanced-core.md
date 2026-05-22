# db-mcp Advanced Stress Test — [core]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode), not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js): All 21 core tools are fully WASM-compatible. No categories to skip or adjust.

## Code Mode Execution

- **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

All tests via `sqlite_execute_code`. Translation table:

| Direct Tool Call                            | Code Mode Equivalent                        |
| ------------------------------------------- | ------------------------------------------- |
| `sqlite_read_query({query: "..."})`         | `sqlite.core.readQuery({query: "..."})`     |
| `sqlite_write_query({query: "..."})`        | `sqlite.core.writeQuery({query: "..."})`    |
| `sqlite_create_table({...})`                | `sqlite.core.createTable({...})`            |
| `sqlite_describe_table({tableName: "..."})` | `sqlite.core.describeTable("...")`          |
| `sqlite_drop_table({tableName: "..."})`     | `sqlite.core.dropTable({tableName: "..."})` |
| `sqlite_create_index({...})`                | `sqlite.core.createIndex({...})`            |
| `sqlite_get_indexes({...})`                 | `sqlite.core.getIndexes({...})`             |

**Key rules:** State persists across calls. Do NOT pass `readonly: true`. Group related tests into single calls.

## Test Database Schema

| Table             | Rows | Key Columns                                               |
| ----------------- | ---- | --------------------------------------------------------- |
| test_products     | 16   | id, name, description, price (REAL), category, created_at |
| test_orders       | 20   | id, product_id (FK→test_products), total_price, status    |
| test_measurements | 200  | id, sensor_id (1-5), temperature, humidity, pressure      |
| test_events       | 100  | id, event_type, user_id, payload (JSON), event_date       |

## Naming & Cleanup

- **Temporary tables**: `stress_*` prefix
- **Temporary indexes**: `stress_idx_*` prefix
- If DROP fails due to lock, note and move on.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — monitor `metrics.tokenEstimate`. Report size in KB.
- ✅ Confirmed: Edge case handled correctly (inline only; omit from Final Summary)

### Error Message Quality Rating

| Quality Level     | Example                                                             | Verdict |
| ----------------- | ------------------------------------------------------------------- | ------- |
| **5 - Excellent** | `Table 'stress_empty_table' does not exist (code: TABLE_NOT_FOUND)` | ✅      |
| **4 - Good**      | `Table 'stress_empty_table' does not exist`                         | ✅      |
| **3 - Adequate**  | `SQLITE_ERROR: no such table: stress_empty_table`                   | ⚠️      |
| **2 - Poor**      | `SQLITE_ERROR: no such table`                                       | ⚠️      |
| **1 - Useless**   | `Query failed` or generic `Error occurred`                          | ❌      |

### Error Code Consistency

Flag any generic code (`RESOURCE_ERROR`, `UNKNOWN_ERROR`) that should be specific (e.g., `TABLE_NOT_FOUND`, `COLUMN_NOT_FOUND`). Treat as ⚠️.

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error` fields. MCP error ❌ = raw text, `isError: true`.

---

## core Group Tools (21 + codemode)

1. sqlite_read_query
2. sqlite_write_query
3. sqlite_create_table
4. sqlite_list_tables
5. sqlite_describe_table
6. sqlite_drop_table
7. sqlite_get_indexes
8. sqlite_create_index
9. sqlite_drop_index
10. sqlite_count
11. sqlite_exists
12. sqlite_upsert
13. sqlite_batch_insert
14. sqlite_truncate
15. sqlite_date_add
16. sqlite_date_diff
17. sqlite_list_triggers
18. sqlite_list_constraints
19. sqlite_alter_table
20. sqlite_create_trigger
21. sqlite_drop_trigger

---

### Category 1: Boundary Values & Empty States

**1.1 Empty Table Operations**

Create `stress_empty_table (id INTEGER PRIMARY KEY, name TEXT, value REAL)`, then test:

1. `sqlite.core.readQuery({query: "SELECT COUNT(*) AS n FROM stress_empty_table"})` → `{rows: [{n: 0}]}`
2. `sqlite.core.describeTable("stress_empty_table")` → valid schema with 3 columns
3. `sqlite.core.getIndexes({table: "stress_empty_table"})` → empty or primary key only
4. `sqlite.core.count({table: "stress_empty_table"})` → `{count: 0}`
5. `sqlite.core.exists({table: "stress_empty_table"})` → `{exists: false}` (no rows)

**1.2 Single-Row Table**

Insert one row: `(1, 'solo', 42.0)`, then:

6. `sqlite.core.readQuery({query: "SELECT * FROM stress_empty_table"})` → exactly 1 row
7. `sqlite.core.exists({table: "stress_empty_table"})` → `{exists: true}`
8. `sqlite.core.count({table: "stress_empty_table"})` → `{count: 1}`

**1.3 NULL-Heavy Data**

Insert 4 more rows: 3 with `name IS NULL AND value IS NULL`, 1 with actual values:

9. `sqlite.core.readQuery({query: "SELECT COUNT(*) AS n FROM stress_empty_table WHERE value IS NULL"})` → `{rows: [{n: 3}]}`
10. `sqlite.core.readQuery({query: "SELECT COUNT(value) AS n FROM stress_empty_table"})` → `{rows: [{n: 2}]}` (COUNT of non-null)
11. `sqlite.core.count({table: "stress_empty_table", column: "value"})` → 2 (non-null count)

**1.4 Extreme Numeric Values**

Insert: `(value: 99999999.99)`, `(value: -99999999.99)`, `(value: 0.0)`, `(value: 0.01)`:

12. `sqlite.stats.statsBasic({table: "stress_empty_table", column: "value"})` → verify min/max/avg handle extreme values

---

### Category 2: State Pollution & Idempotency

**2.1 Create-Drop-Recreate Cycles**

13. `sqlite.core.createTable(...)` → create `stress_cycle_table (id INTEGER PRIMARY KEY, data TEXT)`
14. `sqlite.core.createIndex({table: "stress_cycle_table", columns: ["data"], indexName: "stress_idx_cycle"})` → success
15. `sqlite.core.dropTable({table: "stress_cycle_table"})` → success
16. `sqlite.core.dropTable({table: "stress_cycle_table"})` → success with "does not exist" message (not raw crash)
17. `sqlite.core.createTable(...)` → recreate `stress_cycle_table` → success (no orphaned metadata)
18. Cleanup: drop `stress_cycle_table`

**2.2 Duplicate Object Detection**

19. `sqlite.core.createTable(...)` with table name `test_products` → expect error or "already exists"
20. `sqlite.core.createIndex(...)` on existing `idx_orders_status` → expect error or "already exists"

---

### Category 3: Error Message Quality

For each test, verify **structured response** (`{success: false, error: "..."}`). Rate each error message 1-5.

**3.1 Nonexistent Objects**

21. `sqlite.core.describeTable("nonexistent_table_xyz")` → error should mention table name
22. `sqlite.core.readQuery({query: "SELECT * FROM nonexistent_table_xyz"})` → error should mention table name
23. `sqlite.core.getIndexes({table: "nonexistent_table_xyz"})` → report behavior
24. `sqlite.core.writeQuery("INSERT INTO nonexistent_table_xyz VALUES (1)")` → structured error

**3.2 Invalid SQL**

25. `sqlite.core.readQuery({query: "SELEKT * FROM test_products"})` → structured error with SQL syntax context
26. `sqlite.core.writeQuery("INSERT INTO test_products (nonexistent_col) VALUES (1)")` → structured error mentioning column

**3.3 Type/Constraint Violations**

27. `sqlite.core.writeQuery("INSERT INTO test_products (id, name, price, category) VALUES (1, 'dup', 10.0, 'cat')")` → duplicate primary key error (id=1 exists)

---

### Category 4: Large Payload & Truncation Verification

28. `sqlite.core.readQuery({query: "SELECT * FROM test_measurements"})` → exactly 50 rows (default limit applied) — verify response size
29. `sqlite.core.readQuery({query: "SELECT * FROM test_measurements LIMIT 5"})` → exactly 5 rows
30. `sqlite.core.readQuery({query: "SELECT * FROM test_events LIMIT 100"})` → 100 rows — check payload size

---

### Category 5: Trigger & Constraint Edge Cases

**5.1 — Trigger lifecycle stress**

31. `sqlite.core.createTable({table: "stress_trigger_table", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "val", type: "INTEGER"}]})` → success
32. `sqlite.core.writeQuery("CREATE TRIGGER stress_trg_b_ins BEFORE INSERT ON stress_trigger_table BEGIN SELECT 1; END;")` → success
33. `sqlite.core.writeQuery("CREATE TRIGGER stress_trg_a_del AFTER DELETE ON stress_trigger_table BEGIN SELECT 1; END;")` → success
34. `sqlite.core.listTriggers()` → verify both triggers appear
35. `sqlite.core.listTriggers({table: "stress_trigger_table"})` → verify both appear and are filtered to 2
36. `sqlite.core.dropTable({table: "stress_trigger_table"})` → success (drops table and triggers)
37. `sqlite.core.listTriggers({table: "stress_trigger_table"})` → report behavior (table gone, triggers should be gone)

**5.2 — Constraint introspection on complex schema**

38. `sqlite.core.createTable({table: "stress_constraints_table", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "pid", type: "INTEGER"}, {name: "name", type: "TEXT"}]})` → success
39. `sqlite.core.writeQuery("ALTER TABLE stress_constraints_table ADD CONSTRAINT fk_pid FOREIGN KEY (pid) REFERENCES test_products(id)")` → success (or use CREATE TABLE with FK if ALTER fails)
40. `sqlite.core.createIndex({table: "stress_constraints_table", columns: ["name"], indexName: "stress_idx_name_uniq", unique: true})` → success
41. `sqlite.core.listConstraints({table: "stress_constraints_table"})` → verify PK, FK (if added), and UNIQUE index detected
42. `sqlite.core.listConstraints({table: "stress_constraints_table"})` → call twice to verify idempotency/caching
43. Cleanup: drop `stress_constraints_table`

---

### Category 6: Date Math Edge Cases

44. `sqlite.core.dateAdd({table: "test_events", column: "event_date", amount: -9999, unit: "years"})` → should handle extreme negative dates
45. `sqlite.core.dateDiff({table: "test_events", column1: "event_date", column2: "invalid_date_col", unit: "days"})` → should return a structured error about invalid column
46. `sqlite.core.dateAdd({table: "test_events", column: "event_date", amount: 0, unit: "days"})` → valid delta 0

---

### Category 7: ALTER TABLE Edge Cases

47. Create `stress_alter_table (id INTEGER PRIMARY KEY, name TEXT, value REAL)`, then:
48. `sqlite.core.alterTable({table: "stress_alter_table", operation: "add_column", column: "ts", type: "TEXT", nullable: true, defaultValue: "CURRENT_TIMESTAMP"})` → success (SQL expression default)
49. `sqlite.core.alterTable({table: "stress_alter_table", operation: "add_column", column: "empty", type: "TEXT", nullable: true, defaultValue: ""})` → success (empty string default)
50. `sqlite.core.alterTable({table: "stress_alter_table", operation: "add_column", column: "bad_pk", type: "INTEGER PRIMARY KEY"})` → structured error (SQLITE_LIMITATION — cannot add PRIMARY KEY)
51. `sqlite.core.alterTable({table: "stress_alter_table", operation: "add_column", column: "bad_uq", type: "TEXT UNIQUE"})` → structured error (SQLITE_LIMITATION — cannot add UNIQUE)
52. `sqlite.core.alterTable({table: "stress_alter_table", operation: "rename_column", column: "nonexistent", newName: "x"})` → structured error (COLUMN_NOT_FOUND)
53. Add 2 more columns, then drop all non-PK columns one by one until only `id` remains:
    - `sqlite.core.alterTable({table: "stress_alter_table", operation: "drop_column", column: "name"})` → success
    - Continue dropping until 1 column left
    - `sqlite.core.alterTable({table: "stress_alter_table", operation: "drop_column", column: "id"})` → structured error (SQLITE_LIMITATION — cannot drop last column)
54. `sqlite.core.alterTable({table: "stress_alter_table", operation: "rename_table", newName: "test_products"})` → structured error (TABLE_EXISTS)
55. Full lifecycle: rename table → verify with listTables → rename back → verify → cleanup

---

### Category 8: Trigger Stress

56. Create `stress_trg_table (id INTEGER PRIMARY KEY, val TEXT, updated_at TEXT)`, then:
57. `sqlite.core.createTrigger({name: "stress_trg_insert", table: "stress_trg_table", event: "INSERT", timing: "AFTER", body: "SELECT 1;", forEachRow: true})` → success
58. `sqlite.core.createTrigger({name: "stress_trg_update_cols", table: "stress_trg_table", event: "UPDATE", timing: "BEFORE", columns: ["val"], body: "SELECT 1;"})` → success (column-specific UPDATE trigger)
59. `sqlite.core.createTrigger({name: "stress_trg_when", table: "stress_trg_table", event: "DELETE", timing: "AFTER", body: "SELECT 1;", whenClause: "OLD.val IS NOT NULL"})` → success (WHEN clause)
60. `sqlite.core.listTriggers({table: "stress_trg_table"})` → 3 triggers with correct event/timing
61. `sqlite.core.createTrigger({name: "stress_trg_insert", table: "stress_trg_table", event: "INSERT", timing: "AFTER", body: "SELECT 1;", ifNotExists: true})` → success (no-op, trigger already exists)
62. `sqlite.core.createTrigger({name: "stress_trg_instead", table: "stress_trg_table", event: "INSERT", timing: "INSTEAD OF", body: "SELECT 1;"})` → structured error (INSTEAD OF only on views)
63. `sqlite.core.createTrigger({name: "stress_trg_bad_cols", table: "stress_trg_table", event: "INSERT", timing: "AFTER", columns: ["val"], body: "SELECT 1;"})` → structured error (columns only for UPDATE)
64. `sqlite.core.createTrigger({name: "stress_trg_empty", table: "stress_trg_table", event: "INSERT", timing: "AFTER", body: "   "})` → structured error (empty body)
65. `sqlite.core.dropTrigger({name: "stress_trg_nonexist", ifExists: true})` → `{success: true}` (no-op)
66. `sqlite.core.dropTrigger({name: "stress_trg_nonexist"})` → structured error (TRIGGER_NOT_FOUND)
67. Drop `stress_trg_table` → success (cascade-deletes triggers)
68. `sqlite.core.listTriggers({table: "stress_trg_table"})` → verify triggers are gone (table dropped)

---

### Final Cleanup

Drop all `stress_*` tables. Confirm `test_products` row count is still 16 (no pollution).

## Post-Test Procedures

1. **Cleanup**: Drop all `stress_*` objects
2. **Fix EVERY finding** — ❌ Fails, ⚠️ Issues, 📦 Payloads. All changes consistent with `code-map.md`
3. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
4. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
5. **Commit**: Stage and commit — do NOT push
6. **Re-test**: After server rebuild, re-test fixes with code mode calls
7. **Token audit**: Report most expensive block
