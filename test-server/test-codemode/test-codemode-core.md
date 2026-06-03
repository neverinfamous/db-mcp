# db-mcp Code Mode Testing: [core]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> **Adapter mode**: Call `list_adapters` at the start of testing to determine whether you are running against `native` or `wasm`. Apply the WASM Mode rules below if the adapter is `wasm`.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> [!WARNING]
> **Stale Build Issues:** The MCP server runs from the compiled `dist/` directory, NOT `src/`. If you encounter inexplicable behavior (e.g., tools executing old logic or throwing validation errors for things already fixed in the source code), the server might be running a stale build. Check if the compiled code in `dist/` matches the source code in `src/`. If out of sync, stop and instruct the user to run `npm run build` and restart the server before continuing testing.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference

> See `code-map.md` in the `test-server/` directory for the complete test database schema (`test_*` tables).

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

> [!NOTE]
> **Tool Availability & Code Mode**: The `sqlite_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a _different_ group (e.g., `sqlite_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `sqlite_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, or a raw text string wrapped in `isError: true` with no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.
>
> ⚠️ **ARCHITECTURAL NOTE — `isError: true` rules for tools with `outputSchema`**: The MCP SDK uses `isError` to decide whether to validate `structuredContent` against the `outputSchema`. Getting this wrong causes either raw `-32602` crashes or valid responses wrapped in error frames. **This is now handled automatically by the server framework in `tools.ts`**, but as a tester, you must verify the SDK output matches this rule:
>
> | Response         | `isError: true` | SDK behavior                                              | Verdict                                |
> | ---------------- | --------------- | --------------------------------------------------------- | -------------------------------------- |
> | `success: true`  | **Absent**      | Validates `structuredContent` → passes                    | ✅ Correct                             |
> | `success: true`  | **Present**     | Skips validation, wraps in error frame                    | ❌ Bug — valid response shown as error |
> | `success: false` | **Present**     | Skips validation (error shape won't match success schema) | ✅ Correct                             |
> | `success: false` | **Absent**      | Validates error against success schema → fails            | ❌ Bug — raw `-32602`                  |
>
> **TL;DR**: `isError: true` on errors, absent on successes. The framework handles this automatically when your handler returns `success: false`.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) An **empty parameters test** (call the tool with `{}`).
     Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
     > **Note on Aliases & Zod**: Tools that support legacy parameter aliases (e.g. `tableName` instead of `table`) often use `.default("")` in their Zod schema so the SDK validation lets the payload reach the handler's alias-resolution logic. For these tools, calling with `{}` will pass Zod validation and correctly trigger a handler-level domain error (e.g. `TABLE_NOT_FOUND`) instead of a strict Zod `invalid_type` error. **This is expected behavior.** Do NOT remove `.default("")` from schemas to force a Zod error, as this will break alias compatibility.
3. **Output Schema Testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
4. **Wrong-Type Coercion**: For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.
   > **Note on Zod Coercion & Validation Errors**: When passing `"abc"` to a numeric field, receiving a structured handler error like `{ success: false, error: "limit: Expected number, received string", code: "VALIDATION_ERROR" }` is **correct**. This proves the global SDK monkey-patch successfully intercepted Zod's `invalid_type` error and transformed it into a structured domain error. Do NOT attempt to "fix" `coerceNumber` or schema definitions to bypass this Zod validation or force a silent fallback to `undefined`.
5. **Proactive Improvements**: You are highly encouraged to proactively improve functionality, performance, security, agent experience, and token/payload efficiency whenever you see an opportunity during your testing and handler code review.
   > **CRITICAL**: Architectural consistency is paramount. Do not introduce undocumented architectural deviations. If you implement a structural or architectural improvement in one tool, you must apply it symmetrically to other applicable tools in the group or project.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
7. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
8. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

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

### Code Mode Methods

- `sqlite.core.readQuery`
- `sqlite.core.listTables`
- `sqlite.core.describeTable`
- `sqlite.core.getIndexes`
- `sqlite.core.count`
- `sqlite.core.exists`
- `sqlite.core.dateAdd`
- `sqlite.core.dateDiff`
- `sqlite.core.enableVersioning`
- `sqlite.core.disableVersioning`
- `sqlite.core.checkVersion`
- `sqlite.core.conditionalUpdate`
- `sqlite.core.createTable`
- `sqlite.core.writeQuery`
- `sqlite.core.upsert`
- `sqlite.core.batchInsert`
- `sqlite.core.truncate`
- `sqlite.core.createIndex`
- `sqlite.core.dropIndex`
- `sqlite.core.dropTable`
- `sqlite.core.listTriggers`
- `sqlite.core.createTrigger`
- `sqlite.core.listConstraints`
- `sqlite.core.dropTrigger`
- `sqlite.core.alterTable`

> **Cross-group dependency**: Phase 3 workflow 4.4 uses `sqlite.introspection.schemaSnapshot` for schema verification.

## Phase 1: Core Group — Happy Paths (batched)

> **Instructions**: Construct a single `sqlite_execute_code` script to execute the numbered items below. Use the `sqlite.*` namespace. Compare responses against expected results and push deviations to a `failures` array.

**Read/Query tools:**

1. `sqlite.core.readQuery({query: "SELECT COUNT(*) AS n FROM test_products"})` → `{rows: [{n: 16}]}`
2. `sqlite.core.readQuery("SELECT name, price FROM test_products WHERE price > 500")` → 1 result: `Laptop Pro 15` (1299.99)
3. `sqlite.core.readQuery({query: "SELECT COUNT(*) AS n FROM test_orders WHERE status = 'completed'"})` → `{rows: [{n: 8}]}`
4. `sqlite.core.readQuery("SELECT * FROM test_users")` → should return JSON rows of test_users
5. `sqlite.core.readQuery("SELECT * FROM test_measurements")` → return 50 rows (automatic limit) and `nextCursor` populated
6. `sqlite.core.readQuery({query: "SELECT * FROM test_measurements", cursor: "<nextCursor>"})` → return next batch of rows via opaque pagination
7. `sqlite.core.readQuery({query: "SELECT * FROM test_products", stream: true, chunkSize: 5})` → returns rows successfully (verifies that `stream: true` degrades gracefully to full buffering in Code Mode)
8. `sqlite.core.listTables()` → tables array includes `test_products`, `test_orders`, etc.
9. `sqlite.core.describeTable("test_products")` → columns include `id` (INTEGER), `name` (TEXT), `price` (REAL)
10. `sqlite.core.getIndexes({table: "test_orders"})` → includes `idx_orders_status`

**Convenience tools:**

10. `sqlite.core.count({table: "test_products"})` → `{count: 16}`
11. `sqlite.core.count({table: "test_products", column: "category", distinct: true})` → distinct category count
12. `sqlite.core.exists({table: "test_products", whereClause: "price > 1000"})` → `{exists: true}`
13. `sqlite.core.exists({table: "test_products", whereClause: "price > 99999"})` → `{exists: false}`
14. `sqlite.core.dateAdd({table: "test_orders", column: "order_date", amount: 7, unit: "days", whereClause: "id = 1"})` → `{rows: [{date_add_result: ...}]}`
15. `sqlite.core.dateDiff({table: "test_orders", column1: "order_date", column2: "'2025-01-01'", unit: "days", whereClause: "id = 1"})` → `{rows: [{date_diff_result: ...}]}`

**Write tools (use temp tables):**

13. `sqlite.core.createTable({table: "temp_cm_core", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "name", type: "TEXT"}, {name: "value", type: "REAL"}]})` → success
14. `sqlite.core.writeQuery("INSERT INTO temp_cm_core (id, name, value) VALUES (1, 'alpha', 10.5), (2, 'beta', 20.0)")` → `{rowsAffected: 2}`
15. `sqlite.core.upsert({table: "temp_cm_core", data: {id: 1, name: "alpha_updated", value: 15.0}, conflictColumns: ["id"]})` → success, row 1 updated
16. `sqlite.core.batchInsert({table: "temp_cm_core", rows: [{id: 3, name: "gamma", value: 30.0}, {id: 4, name: "delta", value: 40.0}]})` → 2 rows inserted
17. `sqlite.core.count({table: "temp_cm_core"})` → `{count: 4}`

**OCC tools lifecycle:**

18. `sqlite.core.enableVersioning({table: "temp_cm_core"})` → success
19. `sqlite.core.checkVersion({table: "temp_cm_core", rowId: 1})` → `{version: 1}`
20. `sqlite.core.writeQuery({query: "UPDATE temp_cm_core SET value = 16.0 WHERE id = 1", expectedVersion: 1})` → success
21. `sqlite.core.checkVersion({table: "temp_cm_core", rowId: 1})` → `{version: 2}`
22. `sqlite.core.conditionalUpdate({table: "temp_cm_core", conditions: [{column: "id", operator: "=", value: 1}], data: {value: 17.0}, expectedVersion: 2})` → `{rowsAffected: 1}`
23. `sqlite.core.disableVersioning({table: "temp_cm_core"})` → success

**Write tools (cleanup):**

24. `sqlite.core.truncate({table: "temp_cm_core"})` → success
25. `sqlite.core.count({table: "temp_cm_core"})` → `{count: 0}`

**Index lifecycle:**

26. `sqlite.core.writeQuery("INSERT INTO temp_cm_core (id, name) VALUES (1, 'test')")` → re-populate
27. `sqlite.core.createIndex({table: "temp_cm_core", columns: ["name"], indexName: "idx_temp_cm_name"})` → success
28. `sqlite.core.getIndexes({table: "temp_cm_core"})` → includes `idx_temp_cm_name`
29. `sqlite.core.dropIndex({indexName: "idx_temp_cm_name"})` → success
30. `sqlite.core.dropTable({table: "temp_cm_core"})` → success

**Parameter binding:**

31. `sqlite.core.readQuery({query: "SELECT name, price FROM test_products WHERE price > ?", params: [500]})` → 1 result: `Laptop Pro 15` (1299.99)
32. `sqlite.core.readQuery({query: "SELECT name FROM test_products WHERE category = ? AND price < ?", params: ["electronics", 100]})` → 4 results

**Trigger & constraint introspection:**

27. `sqlite.core.listTriggers()` → `triggers` array (may be empty in test DB — verify structure: `{triggers: [], count: 0}`)
28. `sqlite.core.listTriggers({table: "test_orders"})` → filtered by table (may be empty)
29. Create a trigger on a temp table for testing:
    ```javascript
    await sqlite.core.createTable({
      table: "temp_cm_triggers",
      columns: [
        { name: "id", type: "INTEGER", primaryKey: true },
        { name: "name", type: "TEXT" },
      ],
    });
    await sqlite.core.createTrigger({
      name: "temp_trg_insert",
      table: "temp_cm_triggers",
      event: "INSERT",
      timing: "AFTER",
      body: "INSERT INTO temp_cm_triggers (name) VALUES ('fired')",
    });
    return { success: true };
    ```
30. `sqlite.core.listTriggers({table: "temp_cm_triggers"})` → 1 trigger with `name: "temp_trg_insert"`, `event: "INSERT"`, `timing: "AFTER"`
31. `sqlite.core.listConstraints({table: "test_orders"})` → `primaryKey` includes `id`, `foreignKeys` includes FK to `test_products`, `uniqueIndexes` array present
32. `sqlite.core.listConstraints({table: "test_products"})` → `primaryKey` includes `id`, verify structure
33. Cleanup: drop trigger and temp table:
    ```javascript
    await sqlite.core.dropTrigger({ name: "temp_trg_insert" });
    await sqlite.core.dropTable({ table: "temp_cm_triggers" });
    return { success: true };
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

## Phase 2: Core Group — Domain & Separation Errors (batched)

🔴 55. `sqlite.core.readQuery({query: "SELECT * FROM nonexistent_table"})` → `{success: false}`
🔴 56. `sqlite.core.writeQuery({query: "DROP TABLE nonexistent_table"})` → `{success: false}`
🔴 57. `sqlite.core.describeTable({table: "nonexistent_table"})` → `{success: false}`
🔴 58. `sqlite.core.getIndexes({table: "nonexistent_table"})` → `{success: false}`
🔴 59. `sqlite.core.createIndex({table: "nonexistent_table", columns: ["id"], indexName: "idx_bad"})` → `{success: false}`
🔴 60. `sqlite.core.listTriggers({table: "nonexistent_xyz"})` → `{success: false}` (TABLE_NOT_FOUND)
🔴 61. `sqlite.core.listConstraints({table: "nonexistent_xyz"})` → `{success: false}`

**Write/read separation (gotcha #1):**

🔴 62. `sqlite.core.writeQuery("SELECT * FROM test_products")` → `{success: false}` — writeQuery rejects SELECT statements
🔴 63. `sqlite.core.readQuery("INSERT INTO test_products (name) VALUES ('bad')")` → `{success: false}` — readQuery rejects INSERT/UPDATE/DELETE

**Boundary conditions:**

🔴 64. `sqlite.core.batchInsert({table: "test_products", rows: []})` → `{success: false}` handler error (VALIDATION_ERROR)

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

**OCC domain errors:**

🔴 73. `sqlite.core.enableVersioning({table: "nonexistent_xyz"})` → `{success: false}`
🔴 74. `sqlite.core.checkVersion({table: "nonexistent_xyz", rowId: 1})` → `{success: false}`
🔴 75. `sqlite.core.conditionalUpdate({table: "nonexistent_xyz", conditions: [{column: "id", operator: "=", value: 1}], data: {val: 1}, expectedVersion: 1})` → `{success: false}`

```javascript
// Test missing expectedVersion ConflictError
await sqlite.core.createTable({
  table: "temp_occ_err",
  columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
});
await sqlite.core.writeQuery("INSERT INTO temp_occ_err (id) VALUES (1)");
await sqlite.core.enableVersioning({ table: "temp_occ_err" });
const res = await sqlite.core.writeQuery(
  "UPDATE temp_occ_err SET id=2 WHERE id=1",
);
// The writeQuery call should THROW a structured ConflictError indicating expectedVersion is required.
// Note: If you don't wrap it in try/catch in Code Mode, the sandbox execution returns the structured error naturally.
```

🔴 76. Ensure the `temp_occ_err` code mode snippet returns `{success: false}` with ConflictError details, then drop `temp_occ_err`.

## Phase 3: Multi-Step Workflow (4 tests)

### 3.1 — ETL pipeline

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

### 3.2 — Schema introspection + query

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

### 3.3 — Loop with accumulator

```javascript
const tables = await sqlite.core.listTables();
const counts = {};
for (const t of tables.tables.slice(0, 5)) {
  const r = await sqlite.core.count({ table: t.name });
  counts[t.name] = r.count;
}
return counts;
```

### 3.4 — Schema mutation + introspection verification

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

## Phase 4: Zod Validation Sweep

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
🔴 91. `sqlite.core.enableVersioning({})` → `{success: false}` handler error
🔴 92. `sqlite.core.disableVersioning({})` → `{success: false}` handler error
🔴 93. `sqlite.core.checkVersion({})` → `{success: false}` handler error
🔴 94. `sqlite.core.conditionalUpdate({})` → `{success: false}` handler error

## Phase 5: Wrong-Type Numeric Coercion

🔴 95. `sqlite.core.dateAdd({table: "test_orders", column: "order_date", amount: "abc", unit: "days"})` → handler error, NOT raw MCP
🔴 96. `sqlite.core.dateDiff({table: "test_orders", column1: "order_date", column2: "'2025-01-01'", unit: "days", limit: "abc"})` → handler error, NOT raw MCP
🔴 97. `sqlite.core.checkVersion({table: "test_orders", rowId: "abc"})` → handler error, NOT raw MCP
🔴 98. `sqlite.core.conditionalUpdate({table: "test_orders", conditions: [{column: "id", operator: "=", value: 1}], data: {x: 1}, expectedVersion: "abc"})` → handler error, NOT raw MCP

---

## Post-Test Procedures

### Reporting Rules

- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in help resources and runtime hints

### After Testing

1. **Triage findings**: If issues were found, create an implementation plan, making sure they are consistent with working patterns in other tools/tool groups. If the plan requires no user decisions, proceed directly to implementation.
2. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `src/constants/server-instructions/*.md` (per-group help files) — run `npm run generate:instructions` after editing to regenerate `server-instructions.ts`
   - Test database (`test-server/test.db`)
   - This prompt

### After Implementation

3. **Document**: Update `UNRELEASED.md`, `code-map.md` (if appropriate), and create a `memory-journal-mcp` entry detailing the changes and improvements made.
4. **Commit**: Stage and commit all changes — do NOT push.
5. **Validate**: Halt your work and instruct the user to validate the changes by running the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself. Also instruct the user to rebuild and restart the server.
6. **Live re-test**: Once the user confirms the server is restarted, test the fixes with direct MCP tool calls to confirm they are working.
7. **Final summary**: If no issues found, provide the final summary. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working.
