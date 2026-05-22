# db-mcp Advanced Stress Test: [core]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md` with any/all changes/fixes.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
| Table             | Rows | Key Columns                                               |
| ----------------- | ---- | --------------------------------------------------------- |
| test_products     | 16   | id, name, description, price (REAL), category, created_at |
| test_orders       | 20   | id, product_id (FK→test_products), total_price, status    |
| test_measurements | 200  | id, sensor_id (1-5), temperature, humidity, pressure      |
| test_events       | 100  | id, event_type, user_id, payload (JSON), event_date       |

## Reporting Format
- ❌ **Fail**: Tool errors or produces incorrect results (include error message)
- ⚠️ **Issue**: Unexpected behavior or improvement opportunity
- 📦 **Payload**: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB and suggest a concrete optimization.
- ✅ **Confirmed**: (Use inline only during testing; omit from Final Summary)

### Error Message Quality Rating
| Level                                  | Verdict |
| -------------------------------------- | ------- |
| 5 - Excellent (name + code + context)  | ✅      |
| 4 - Good (name)                        | ✅      |
| 3 - Adequate (raw SQLite, informative) | ⚠️      |
| 2 - Poor (no object name)              | ⚠️      |
| 1 - Useless (generic)                  | ❌      |

## Testing Requirements & Error Standards

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) A **Zod validation error** (call the tool with `{}` empty params).
   Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
3. **Output Schema Testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
4. **Wrong-Type Coercion**: For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.
5. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
6. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
7. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

### Structured Error Response Pattern
All tools should return errors as structured objects instead of throwing. The expected pattern:
```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                                                                          | Verdict            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields                                                               | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field | Bug — report as ❌ |

## Naming & Cleanup
- **Temporary tables**: `temp_*` (or `stress_*`) prefix
- **Temporary views**: `temp_view_*` (or `stress_view_*`) prefix
- Drop at the end of the script. If DROP fails due to lock, note and move on.

---

## Group Focus: core

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

8. sqlite_read_query
9. sqlite_write_query
10. sqlite_create_table
11. sqlite_list_tables
12. sqlite_describe_table
13. sqlite_drop_table
14. sqlite_get_indexes
15. sqlite_create_index
16. sqlite_drop_index
17. sqlite_count
18. sqlite_exists
19. sqlite_upsert
20. sqlite_batch_insert
21. sqlite_truncate
22. sqlite_date_add
23. sqlite_date_diff
24. sqlite_list_triggers
25. sqlite_list_constraints
26. sqlite_alter_table
27. sqlite_create_trigger
28. sqlite_drop_trigger

---

## Phase 1: Boundary Values & Empty States (batched)

**1.1 Empty Table Operations**

Create `stress_empty_table (id INTEGER PRIMARY KEY, name TEXT, value REAL)`, then test:

29. `sqlite.core.readQuery({query: "SELECT COUNT(*) AS n FROM stress_empty_table"})` → `{rows: [{n: 0}]}`
30. `sqlite.core.describeTable("stress_empty_table")` → valid schema with 3 columns
31. `sqlite.core.getIndexes({table: "stress_empty_table"})` → empty or primary key only
32. `sqlite.core.count({table: "stress_empty_table"})` → `{count: 0}`
33. `sqlite.core.exists({table: "stress_empty_table"})` → `{exists: false}` (no rows)

**1.2 Single-Row Table**

Insert one row: `(1, 'solo', 42.0)`, then:

34. `sqlite.core.readQuery({query: "SELECT * FROM stress_empty_table"})` → exactly 1 row
35. `sqlite.core.exists({table: "stress_empty_table"})` → `{exists: true}`
36. `sqlite.core.count({table: "stress_empty_table"})` → `{count: 1}`

**1.3 NULL-Heavy Data**

Insert 4 more rows: 3 with `name IS NULL AND value IS NULL`, 1 with actual values:

37. `sqlite.core.readQuery({query: "SELECT COUNT(*) AS n FROM stress_empty_table WHERE value IS NULL"})` → `{rows: [{n: 3}]}`
38. `sqlite.core.readQuery({query: "SELECT COUNT(value) AS n FROM stress_empty_table"})` → `{rows: [{n: 2}]}` (COUNT of non-null)
39. `sqlite.core.count({table: "stress_empty_table", column: "value"})` → 2 (non-null count)

**1.4 Extreme Numeric Values**

Insert: `(value: 99999999.99)`, `(value: -99999999.99)`, `(value: 0.0)`, `(value: 0.01)`:

40. `sqlite.stats.statsBasic({table: "stress_empty_table", column: "value"})` → verify min/max/avg handle extreme values

---

## Phase 2: State Pollution & Idempotency (batched)

**2.1 Create-Drop-Recreate Cycles**

41. `sqlite.core.createTable(...)` → create `stress_cycle_table (id INTEGER PRIMARY KEY, data TEXT)`
42. `sqlite.core.createIndex({table: "stress_cycle_table", columns: ["data"], indexName: "stress_idx_cycle"})` → success
43. `sqlite.core.dropTable({table: "stress_cycle_table"})` → success
44. `sqlite.core.dropTable({table: "stress_cycle_table"})` → success with "does not exist" message (not raw crash)
45. `sqlite.core.createTable(...)` → recreate `stress_cycle_table` → success (no orphaned metadata)
46. Cleanup: drop `stress_cycle_table`

**2.2 Duplicate Object Detection**

47. `sqlite.core.createTable(...)` with table name `test_products` → expect error or "already exists"
48. `sqlite.core.createIndex(...)` on existing `idx_orders_status` → expect error or "already exists"

---

## Phase 3: Error Message Quality (batched)

For each test, verify **structured response** (`{success: false, error: "..."}`). Rate each error message 1-5.

**3.1 Nonexistent Objects**

49. `sqlite.core.describeTable("nonexistent_table_xyz")` → error should mention table name
50. `sqlite.core.readQuery({query: "SELECT * FROM nonexistent_table_xyz"})` → error should mention table name
51. `sqlite.core.getIndexes({table: "nonexistent_table_xyz"})` → report behavior
52. `sqlite.core.writeQuery("INSERT INTO nonexistent_table_xyz VALUES (1)")` → structured error

**3.2 Invalid SQL**

53. `sqlite.core.readQuery({query: "SELEKT * FROM test_products"})` → structured error with SQL syntax context
54. `sqlite.core.writeQuery("INSERT INTO test_products (nonexistent_col) VALUES (1)")` → structured error mentioning column

**3.3 Type/Constraint Violations**

55. `sqlite.core.writeQuery("INSERT INTO test_products (id, name, price, category) VALUES (1, 'dup', 10.0, 'cat')")` → duplicate primary key error (id=1 exists)

---

## Phase 4: Large Payload & Truncation Verification (batched)

56. `sqlite.core.readQuery({query: "SELECT * FROM test_measurements"})` → exactly 50 rows (default limit applied) — verify response size
57. `sqlite.core.readQuery({query: "SELECT * FROM test_measurements LIMIT 5"})` → exactly 5 rows
58. `sqlite.core.readQuery({query: "SELECT * FROM test_events LIMIT 100"})` → 100 rows — check payload size

---

## Phase 5: Trigger & Constraint Edge Cases (batched)

**5.1 — Trigger lifecycle stress**

59. `sqlite.core.createTable({table: "stress_trigger_table", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "val", type: "INTEGER"}]})` → success
60. `sqlite.core.writeQuery("CREATE TRIGGER stress_trg_b_ins BEFORE INSERT ON stress_trigger_table BEGIN SELECT 1; END;")` → success
61. `sqlite.core.writeQuery("CREATE TRIGGER stress_trg_a_del AFTER DELETE ON stress_trigger_table BEGIN SELECT 1; END;")` → success
62. `sqlite.core.listTriggers()` → verify both triggers appear
63. `sqlite.core.listTriggers({table: "stress_trigger_table"})` → verify both appear and are filtered to 2
64. `sqlite.core.dropTable({table: "stress_trigger_table"})` → success (drops table and triggers)
65. `sqlite.core.listTriggers({table: "stress_trigger_table"})` → report behavior (table gone, triggers should be gone)

**5.2 — Constraint introspection on complex schema**

66. `sqlite.core.createTable({table: "stress_constraints_table", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "pid", type: "INTEGER"}, {name: "name", type: "TEXT"}], foreignKeys: [{column: "pid", targetTable: "test_products", targetColumn: "id"}]})` → success
67. `sqlite.core.writeQuery("ALTER TABLE stress_constraints_table ADD CONSTRAINT fk_pid FOREIGN KEY (pid) REFERENCES test_products(id)")` → failure (by design, `sqlite_write_query` strictly rejects DDL to prevent accidental schema changes)
68. `sqlite.core.createIndex({table: "stress_constraints_table", columns: ["name"], indexName: "stress_idx_name_uniq", unique: true})` → success
69. `sqlite.core.listConstraints({table: "stress_constraints_table"})` → verify PK, FK (if added), and UNIQUE index detected
70. `sqlite.core.listConstraints({table: "stress_constraints_table"})` → call twice to verify idempotency/caching
71. Cleanup: drop `stress_constraints_table`

---

## Phase 6: Date Math Edge Cases (batched)

72. `sqlite.core.dateAdd({table: "test_events", column: "event_date", amount: -9999, unit: "years"})` → should handle extreme negative dates
73. `sqlite.core.dateDiff({table: "test_events", column1: "event_date", column2: "invalid_date_col", unit: "days"})` → should return a structured error about invalid column
74. `sqlite.core.dateAdd({table: "test_events", column: "event_date", amount: 0, unit: "days"})` → valid delta 0

---

## Phase 7: ALTER TABLE Edge Cases (batched)

75. Create `stress_alter_table (id INTEGER PRIMARY KEY, name TEXT, value REAL)`, then:
76. `sqlite.core.alterTable({table: "stress_alter_table", operation: "add_column", column: "ts", type: "TEXT", nullable: true, defaultValue: "CURRENT_TIMESTAMP"})` → success (SQL expression default)
77. `sqlite.core.alterTable({table: "stress_alter_table", operation: "add_column", column: "empty", type: "TEXT", nullable: true, defaultValue: ""})` → success (empty string default)
78. `sqlite.core.alterTable({table: "stress_alter_table", operation: "add_column", column: "bad_pk", type: "INTEGER PRIMARY KEY"})` → structured error (SQLITE_LIMITATION — cannot add PRIMARY KEY)
79. `sqlite.core.alterTable({table: "stress_alter_table", operation: "add_column", column: "bad_uq", type: "TEXT UNIQUE"})` → structured error (SQLITE_LIMITATION — cannot add UNIQUE)
80. `sqlite.core.alterTable({table: "stress_alter_table", operation: "rename_column", column: "nonexistent", newName: "x"})` → structured error (COLUMN_NOT_FOUND)
81. Add 2 more columns, then drop all non-PK columns one by one until only `id` remains:
    - `sqlite.core.alterTable({table: "stress_alter_table", operation: "drop_column", column: "name"})` → success
    - Continue dropping until 1 column left
    - `sqlite.core.alterTable({table: "stress_alter_table", operation: "drop_column", column: "id"})` → structured error (SQLITE_LIMITATION — cannot drop last column)
82. `sqlite.core.alterTable({table: "stress_alter_table", operation: "rename_table", newName: "test_products"})` → structured error (TABLE_EXISTS)
83. Full lifecycle: rename table → verify with listTables → rename back → verify → cleanup

---

## Phase 8: Trigger Stress (batched)

84. Create `stress_trg_table (id INTEGER PRIMARY KEY, val TEXT, updated_at TEXT)`, then:
85. `sqlite.core.createTrigger({name: "stress_trg_insert", table: "stress_trg_table", event: "INSERT", timing: "AFTER", body: "SELECT 1;", forEachRow: true})` → success
86. `sqlite.core.createTrigger({name: "stress_trg_update_cols", table: "stress_trg_table", event: "UPDATE", timing: "BEFORE", columns: ["val"], body: "SELECT 1;"})` → success (column-specific UPDATE trigger)
87. `sqlite.core.createTrigger({name: "stress_trg_when", table: "stress_trg_table", event: "DELETE", timing: "AFTER", body: "SELECT 1;", whenClause: "OLD.val IS NOT NULL"})` → success (WHEN clause)
88. `sqlite.core.listTriggers({table: "stress_trg_table"})` → 3 triggers with correct event/timing
89. `sqlite.core.createTrigger({name: "stress_trg_insert", table: "stress_trg_table", event: "INSERT", timing: "AFTER", body: "SELECT 1;", ifNotExists: true})` → success (no-op, trigger already exists)
90. `sqlite.core.createTrigger({name: "stress_trg_instead", table: "stress_trg_table", event: "INSERT", timing: "INSTEAD OF", body: "SELECT 1;"})` → structured error (INSTEAD OF only on views)
91. `sqlite.core.createTrigger({name: "stress_trg_bad_cols", table: "stress_trg_table", event: "INSERT", timing: "AFTER", columns: ["val"], body: "SELECT 1;"})` → structured error (columns only for UPDATE)
92. `sqlite.core.createTrigger({name: "stress_trg_empty", table: "stress_trg_table", event: "INSERT", timing: "AFTER", body: "   "})` → structured error (empty body)
93. `sqlite.core.dropTrigger({name: "stress_trg_nonexist", ifExists: true})` → `{success: true}` (no-op)
94. `sqlite.core.dropTrigger({name: "stress_trg_nonexist"})` → structured error (TRIGGER_NOT_FOUND)
95. Drop `stress_trg_table` → success (cascade-deletes triggers)
96. `sqlite.core.listTriggers({table: "stress_trg_table"})` → verify triggers are gone (table dropped)

---

### Final Cleanup

Drop all `stress_*` tables. Confirm `test_products` row count is still 16 (no pollution).

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
