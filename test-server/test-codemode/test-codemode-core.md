# db-mcp Code Mode Testing: [core]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **core** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js): All 21 core tools are fully WASM-compatible. No phases to skip or adjust.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — **blocking, equally important as ❌ bugs**. You **MUST** monitor `metrics.tokenEstimate` for every operation. Report the response size in tokens/KB and suggest optimization.

## Test Database Schema

| Table             | Rows | Key Columns                                                                                 |
| ----------------- | ---- | ------------------------------------------------------------------------------------------- |
| test_products     | 16   | id, name, description, price (REAL), category (TEXT lowercase), created_at                  |
| test_orders       | 20   | id, product_id (FK→test_products), customer_name, quantity, total_price, order_date, status |
| test_jsonb_docs   | 6    | id, doc (JSON), metadata (JSON), tags (JSON array), created_at                              |
| test_articles     | 8    | id, title, body, author, category, published_at                                             |
| test_users        | 9    | id, username, email, phone, bio, created_at                                                 |
| test_measurements | 200  | id, sensor_id (INT 1-5), temperature, humidity, pressure, measured_at                       |
| test_embeddings   | 20   | id, content, category, embedding (8-dim JSON array)                                         |
| test_locations    | 15   | id, name, city, latitude, longitude, type                                                   |
| test_categories   | 17   | id, name, path, level                                                                       |
| test_events       | 100  | id, event_type, user_id (INT), payload (JSON), event_date                                   |

> **Note:** `sensor_id` is INTEGER (1-5). String values use **lowercase**. Do **not** pass `readonly: true` unless specifically testing readonly filtering.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** Any response that is a raw MCP error (no `success` field) is a bug — report as ❌.

1. **Batched scripting**: Bundle multiple checks into single `sqlite_execute_code` calls. Use a `failures` array pattern.
2. **Error path testing**: For **every** tool, test with `{}` (Zod) and a domain error. Both must return `{success: false, error: "..."}`.
3. **Token tracking**: Monitor `metrics.tokenEstimate` on every response. Report the most expensive block.
4. **Strict Coverage Matrix**: Maintain in `tmp/task.md`: `| Tool | Happy Path | Domain Error | Zod Error |`
5. **Deterministic checklist first**: Complete ALL numbered items before freeform exploration.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | What you see                                  | Verdict |
| -------------------- | --------------------------------------------- | ------- |
| **Handler error** ✅ | JSON object with `success` and `error` fields | Correct |
| **MCP error** ❌     | Raw text, `isError: true`, no `success` field | Bug     |

### Zod Refinement Leak Pattern

`.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. If `{}` or invalid values trigger raw MCP `-32602` instead of handler error, report as ❌.

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

## Batched Script Pattern

```javascript
const failures = [];

// Happy path
const count = await sqlite.core.readQuery({
  query: "SELECT COUNT(*) AS n FROM test_products",
});
if (!count.rows || count.rows[0].n !== 16)
  failures.push("readQuery: expected 16 products");

// Domain error
const err = await sqlite.core.describeTable("nonexistent_xyz");
if (err.success !== false)
  failures.push("describeTable(nonexistent): expected {success: false}");

// Zod empty params
const zod = await sqlite.core.createTable({});
if (zod.success !== false)
  failures.push("createTable({}): expected validation error");

return { failures, success: failures.length === 0 };
```

## Cleanup Conventions

- Temporary tables: `temp_*` prefix. Drop at end of each script.
- If DROP fails due to lock, note and move on.

---

## Phase 1: Core Group — Happy Paths (batched)

> **Instructions**: Construct a single `sqlite_execute_code` script to execute the numbered items below. Use the `sqlite.*` namespace. Compare responses against expected results and push deviations to a `failures` array.

**Read/Query tools:**

1. `sqlite.core.readQuery({query: "SELECT COUNT(*) AS n FROM test_products"})` → `{rows: [{n: 16}]}`
2. `sqlite.core.readQuery("SELECT name, price FROM test_products WHERE price > 500")` → 1 result: `Laptop Pro 15` (1299.99)
3. `sqlite.core.readQuery({query: "SELECT COUNT(*) AS n FROM test_orders WHERE status = 'completed'"})` → `{rows: [{n: 8}]}`
4. `sqlite.core.listTables()` → tables array includes `test_products`, `test_orders`, etc.
5. `sqlite.core.describeTable("test_products")` → columns include `id` (INTEGER), `name` (TEXT), `price` (REAL)
6. `sqlite.core.getIndexes({table: "test_orders"})` → includes `idx_orders_status`

**Convenience tools:**

7. `sqlite.core.count({table: "test_products"})` → `{count: 16}`
8. `sqlite.core.count({table: "test_products", column: "category", distinct: true})` → distinct category count
9. `sqlite.core.exists({table: "test_products", whereClause: "price > 1000"})` → `{exists: true}`
10. `sqlite.core.exists({table: "test_products", whereClause: "price > 99999"})` → `{exists: false}`
11. `sqlite.core.dateAdd({table: "test_orders", column: "order_date", amount: 7, unit: "days", whereClause: "id = 1"})` → returns `date_add_result` correctly calculated
12. `sqlite.core.dateDiff({table: "test_orders", column1: "order_date", column2: "'2025-01-01'", unit: "days", whereClause: "id = 1"})` → returns `date_diff_result` in days

**Write tools (use temp tables):**

13. `sqlite.core.createTable({table: "temp_cm_core", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "name", type: "TEXT"}, {name: "value", type: "REAL"}]})` → success
14. `sqlite.core.writeQuery("INSERT INTO temp_cm_core (id, name, value) VALUES (1, 'alpha', 10.5), (2, 'beta', 20.0)")` → `{rowsAffected: 2}`
15. `sqlite.core.upsert({table: "temp_cm_core", data: {id: 1, name: "alpha_updated", value: 15.0}, conflictColumn: "id"})` → success, row 1 updated
16. `sqlite.core.batchInsert({table: "temp_cm_core", rows: [{id: 3, name: "gamma", value: 30.0}, {id: 4, name: "delta", value: 40.0}]})` → 2 rows inserted
17. `sqlite.core.count({table: "temp_cm_core"})` → `{count: 4}`
18. `sqlite.core.truncate({table: "temp_cm_core"})` → success
19. `sqlite.core.count({table: "temp_cm_core"})` → `{count: 0}`

**Index lifecycle:**

20. `sqlite.core.writeQuery("INSERT INTO temp_cm_core (id, name) VALUES (1, 'test')")` → re-populate
21. `sqlite.core.createIndex({table: "temp_cm_core", columns: ["name"], indexName: "idx_temp_cm_name"})` → success
22. `sqlite.core.getIndexes({table: "temp_cm_core"})` → includes `idx_temp_cm_name`
23. `sqlite.core.dropIndex({indexName: "idx_temp_cm_name"})` → success
24. `sqlite.core.dropTable({table: "temp_cm_core"})` → success

**Parameter binding:**

25. `sqlite.core.readQuery({query: "SELECT name, price FROM test_products WHERE price > ?", params: [500]})` → 1 result: `Laptop Pro 15` (1299.99)
26. `sqlite.core.readQuery({query: "SELECT name FROM test_products WHERE category = ? AND price < ?", params: ["electronics", 100]})` → verify multi-parameter binding returns correct subset

**Trigger & constraint introspection:**

27. `sqlite.core.listTriggers()` → `triggers` array (may be empty in test DB — verify structure: `{triggers: [], count: 0}`)
28. `sqlite.core.listTriggers({table: "test_orders"})` → filtered by table (may be empty)
29. Create a trigger on a temp table for testing:
    ```javascript
    await sqlite.core.createTable({table: "temp_cm_triggers", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "name", type: "TEXT"}]});
    await sqlite.core.writeQuery("CREATE TRIGGER temp_trg_insert AFTER INSERT ON temp_cm_triggers BEGIN SELECT 1; END");
    return {success: true};
    ```
30. `sqlite.core.listTriggers({table: "temp_cm_triggers"})` → 1 trigger with `name: "temp_trg_insert"`, `event: "INSERT"`, `timing: "AFTER"`
31. `sqlite.core.listConstraints({table: "test_orders"})` → `primaryKey` includes `id`, `foreignKeys` includes FK to `test_products`, `uniqueIndexes` array present
32. `sqlite.core.listConstraints({table: "test_products"})` → `primaryKey` includes `id`, verify structure
33. Cleanup: drop trigger and temp table:
    ```javascript
    await sqlite.core.writeQuery("DROP TRIGGER IF EXISTS temp_trg_insert");
    await sqlite.core.dropTable({table: "temp_cm_triggers"});
    return {success: true};
    ```

**ALTER TABLE lifecycle:**

34. `sqlite.core.createTable({table: "temp_cm_alter", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "name", type: "TEXT"}]})` → setup
35. `sqlite.core.alterTable({table: "temp_cm_alter", operation: "add_column", column: "status", type: "TEXT", nullable: true})` → success
36. `sqlite.core.alterTable({table: "temp_cm_alter", operation: "add_column", column: "score", type: "INTEGER", nullable: false, defaultValue: 0})` → success (NOT NULL with default)
37. `sqlite.core.describeTable("temp_cm_alter")` → verify `status` and `score` columns present
38. `sqlite.core.alterTable({table: "temp_cm_alter", operation: "rename_column", column: "status", newName: "state"})` → success
39. `sqlite.core.alterTable({table: "temp_cm_alter", operation: "drop_column", column: "state"})` → success
40. `sqlite.core.alterTable({table: "temp_cm_alter", operation: "rename_table", newName: "temp_cm_alter_renamed"})` → success
41. `sqlite.core.alterTable({table: "temp_cm_alter_renamed", operation: "rename_table", newName: "temp_cm_alter"})` → rename back
42. `sqlite.core.dropTable({table: "temp_cm_alter"})` → cleanup

**Trigger lifecycle (structured API):**

43. `sqlite.core.createTable({table: "temp_cm_trg", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "val", type: "TEXT"}]})` → setup
44. `sqlite.core.createTrigger({name: "temp_trg_cm_audit", table: "temp_cm_trg", event: "INSERT", timing: "AFTER", body: "SELECT 1;"})` → success with `sql`
45. `sqlite.core.listTriggers({table: "temp_cm_trg"})` → 1 trigger
46. `sqlite.core.createTrigger({name: "temp_trg_cm_del", table: "temp_cm_trg", event: "DELETE", timing: "BEFORE", body: "SELECT 1;"})` → success
47. `sqlite.core.listTriggers({table: "temp_cm_trg"})` → 2 triggers
48. `sqlite.core.dropTrigger({name: "temp_trg_cm_audit"})` → success
49. `sqlite.core.dropTrigger({name: "temp_trg_cm_del", ifExists: true})` → success
50. `sqlite.core.dropTrigger({name: "temp_trg_cm_nonexist", ifExists: true})` → `{success: true}` (no-op, no error)
51. `sqlite.core.dropTable({table: "temp_cm_trg"})` → cleanup

**STRICT table & generated column enhancements:**

52. `sqlite.core.createTable({table: "temp_cm_strict", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "val", type: "TEXT"}], strict: true})` → success
53. `sqlite.core.describeTable("temp_cm_strict")` → verify structure
54. `sqlite.core.dropTable({table: "temp_cm_strict"})` → cleanup

---

## Phase 2: Core Group — Domain & Separation Errors (batched)

🔴 55. `sqlite.core.readQuery({query: "SELECT * FROM nonexistent_table"})` → `{success: false}`
🔴 56. `sqlite.core.writeQuery({query: "DROP TABLE nonexistent_table"})` → `{success: false}`
🔴 57. `sqlite.core.describeTable({table: "nonexistent_table"})` → `{success: false}`
🔴 58. `sqlite.core.getIndexes({table: "nonexistent_table"})` → `{success: false}`
🔴 59. `sqlite.core.createIndex({table: "nonexistent_table", columns: ["id"], indexName: "idx_bad"})` → `{success: false}`
🔴 60. `sqlite.core.listTriggers({table: "nonexistent_xyz"})` → report behavior (may return empty or error)
🔴 61. `sqlite.core.listConstraints({table: "nonexistent_xyz"})` → `{success: false}`

**Write/read separation (gotcha #1):**

🔴 62. `sqlite.core.writeQuery("SELECT * FROM test_products")` → `{success: false}` — writeQuery rejects SELECT statements
🔴 63. `sqlite.core.readQuery("INSERT INTO test_products (name) VALUES ('bad')")` → `{success: false}` — readQuery rejects INSERT/UPDATE/DELETE

**Boundary conditions:**

🔴 64. `sqlite.core.batchInsert({table: "test_products", rows: []})` → report behavior (empty rows array)

**ALTER TABLE domain errors:**

🔴 65. `sqlite.core.alterTable({table: "nonexistent_xyz", operation: "add_column", column: "x", type: "TEXT", nullable: true})` → `{success: false}` (TABLE_NOT_FOUND)
🔴 66. `sqlite.core.alterTable({table: "test_products", operation: "add_column", column: "name", type: "TEXT", nullable: true})` → `{success: false}` (COLUMN_EXISTS)
🔴 67. `sqlite.core.alterTable({table: "test_products", operation: "add_column", column: "x", type: "TEXT", nullable: false})` → `{success: false}` (NOT NULL without default)
🔴 68. `sqlite.core.alterTable({table: "test_products", operation: "rename_column", column: "nonexistent_col", newName: "x"})` → `{success: false}` (COLUMN_NOT_FOUND)
🔴 69. `sqlite.core.alterTable({table: "test_products", operation: "rename_table", newName: "test_orders"})` → `{success: false}` (TABLE_EXISTS)

**Trigger domain errors:**

🔴 70. `sqlite.core.createTrigger({name: "bad", table: "nonexistent_xyz", event: "INSERT", timing: "AFTER", body: "SELECT 1;"})` → `{success: false}`
🔴 71. `sqlite.core.createTrigger({name: "bad", table: "test_products", event: "INSERT", timing: "INSTEAD OF", body: "SELECT 1;"})` → `{success: false}` (INSTEAD OF only on views)
🔴 72. `sqlite.core.dropTrigger({name: "nonexistent_xyz"})` → `{success: false}` (TRIGGER_NOT_FOUND)

---

## Phase 3: Core Group — Zod Validation (batched)

🔴 73. `sqlite.core.readQuery({})` → `{success: false}` handler error
🔴 74. `sqlite.core.writeQuery({})` → `{success: false}` handler error
🔴 75. `sqlite.core.createTable({})` → `{success: false}` handler error
🔴 76. `sqlite.core.describeTable({})` → `{success: false}` handler error
🔴 77. `sqlite.core.dropTable({})` → `{success: false}` handler error
🔴 78. `sqlite.core.createIndex({})` → `{success: false}` handler error
🔴 79. `sqlite.core.dropIndex({})` → `{success: false}` handler error
🔴 80. `sqlite.core.dateAdd({})` → `{success: false}` handler error
🔴 81. `sqlite.core.dateDiff({})` → `{success: false}` handler error
🔴 82. `sqlite.core.getIndexes({})` → success (returns all indexes, table is optional)
🔴 83. `sqlite.core.listTriggers({})` → success (returns all triggers, table is optional)
🔴 84. `sqlite.core.listConstraints({})` → `{success: false}` (table is required)
🔴 85. `sqlite.core.count({})` → `{success: false}` handler error
🔴 86. `sqlite.core.exists({})` → `{success: false}` handler error
🔴 87. `sqlite.core.truncate({})` → `{success: false}` handler error
🔴 88. `sqlite.core.alterTable({})` → `{success: false}` handler error
🔴 89. `sqlite.core.createTrigger({})` → `{success: false}` handler error
🔴 90. `sqlite.core.dropTrigger({})` → `{success: false}` handler error

---

## Phase 4: Multi-Step Workflow (4 tests)

### 4.1 — ETL pipeline

```javascript
await sqlite.core.createTable({
  table: "temp_cm_etl",
  columns: [
    { name: "id", type: "INTEGER", primaryKey: true },
    { name: "raw", type: "TEXT" },
    { name: "processed", type: "TEXT" },
  ],
});
for (let i = 1; i <= 5; i++) {
  await sqlite.core.writeQuery({
    query: `INSERT INTO temp_cm_etl (raw) VALUES ('item_${i}')`,
  });
}
await sqlite.core.writeQuery("UPDATE temp_cm_etl SET processed = UPPER(raw)");
const result = await sqlite.core.readQuery("SELECT * FROM temp_cm_etl");
await sqlite.core.dropTable({ table: "temp_cm_etl", ifExists: true });
return result;
```

### 4.2 — Schema introspection + query

```javascript
const tables = await sqlite.core.listTables();
const first = tables.tables[0].name;
const schema = await sqlite.core.describeTable(first);
const sample = await sqlite.core.readQuery({
  query: `SELECT * FROM ${first} LIMIT 3`,
});
return {
  table: first,
  columnCount: schema.columns?.length,
  sampleRows: sample.rows?.length,
};
```

### 4.3 — Loop with accumulator

```javascript
const tables = await sqlite.core.listTables();
const counts = {};
for (const t of tables.tables.slice(0, 5)) {
  const r = await sqlite.core.count({ table: t.name });
  counts[t.name] = r.count;
}
return counts;
```

### 4.4 — Schema mutation + introspection verification

```javascript
const failures = [];
// Create table and verify it appears in introspection
await sqlite.core.createTable({
  table: "temp_cm_intro_check",
  columns: [
    { name: "id", type: "INTEGER", primaryKey: true },
    { name: "data", type: "TEXT" },
  ],
});
const snapshot = await sqlite.introspection.schemaSnapshot({ compact: true });
const found = snapshot.snapshot?.tables?.some(
  (t) => t.name === "temp_cm_intro_check",
);
if (!found) failures.push("temp table not in schema snapshot after creation");

// Drop table and verify it's gone
await sqlite.core.dropTable({ table: "temp_cm_intro_check" });
const after = await sqlite.introspection.schemaSnapshot({ compact: true });
const stillThere = after.snapshot?.tables?.some(
  (t) => t.name === "temp_cm_intro_check",
);
if (stillThere) failures.push("temp table still in snapshot after drop");

return { failures, success: failures.length === 0 };
```

---

## Post-Test Procedures

1. **Cleanup**: Confirm all `temp_*` tables are removed
2. **Triage findings**: Create implementation plan if issues found
3. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
4. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
5. **Commit**: Stage and commit — do NOT push
6. **Live re-test**: After server rebuild
7. **Token audit**: Report `metrics.tokenEstimate` for the most expensive block
8. **Final summary**: After testing/re-testing
