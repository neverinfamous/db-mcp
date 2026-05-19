# db-mcp Code Mode Testing: [core]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **core** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js), apply these adjustments:

- All 14 core tools are fully WASM-compatible — no phases to skip.
- **Phase 2.1** (top-level help): Expect fewer than 10 groups — `transactions` is not listed (0 tools registered in WASM). `totalMethods` will be ~125 instead of ~151.
- **Phase 2.3** (all groups exist): The `transactions` group property exists on the `sqlite` object but returns 0 methods. Adjust the assertion to allow 0 methods for `transactions`.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — **blocking, equally important as ❌ bugs**. You **MUST** monitor `metrics.tokenEstimate` for every operation. Report the response size in tokens/KB and suggest optimization.

## Test Database Schema

| Table             | Rows | Key Columns                                                   |
| ----------------- | ---- | ------------------------------------------------------------- |
| test_products     | 16   | id, name, description, price (REAL), category (TEXT lowercase), created_at |
| test_orders       | 20   | id, product_id (FK→test_products), customer_name, quantity, total_price, order_date, status |
| test_jsonb_docs   | 6    | id, doc (JSON), metadata (JSON), tags (JSON array), created_at |
| test_articles     | 8    | id, title, body, author, category, published_at               |
| test_users        | 9    | id, username, email, phone, bio, created_at                   |
| test_measurements | 200  | id, sensor_id (INT 1-5), temperature, humidity, pressure, measured_at |
| test_embeddings   | 20   | id, content, category, embedding (8-dim JSON array)           |
| test_locations    | 15   | id, name, city, latitude, longitude, type                     |
| test_categories   | 17   | id, name, path, level                                         |
| test_events       | 100  | id, event_type, user_id (INT), payload (JSON), event_date     |

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

| Type                 | What you see                                          | Verdict    |
| -------------------- | ----------------------------------------------------- | ---------- |
| **Handler error** ✅ | JSON object with `success` and `error` fields         | Correct    |
| **MCP error** ❌     | Raw text, `isError: true`, no `success` field         | Bug        |

### Zod Refinement Leak Pattern

`.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. If `{}` or invalid values trigger raw MCP `-32602` instead of handler error, report as ❌.

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

## Batched Script Pattern

```javascript
const failures = [];

// Happy path
const count = await sqlite.core.readQuery({query: "SELECT COUNT(*) AS n FROM test_products"});
if (!count.rows || count.rows[0].n !== 16) failures.push("readQuery: expected 16 products");

// Domain error
const err = await sqlite.core.describeTable("nonexistent_xyz");
if (err.success !== false) failures.push("describeTable(nonexistent): expected {success: false}");

// Zod empty params
const zod = await sqlite.core.createTable({});
if (zod.success !== false) failures.push("createTable({}): expected validation error");

return { failures, success: failures.length === 0 };
```

## Cleanup Conventions

- Temporary tables: `temp_*` prefix. Drop at end of each script.
- If DROP fails due to lock, note and move on.

---

## Phase 1: Sandbox Basics (6 tests)

> These tests validate the Code Mode sandbox itself — run them first.

### 1.1 — Simple return value

```javascript
return 42;
```

Expected: `{success: true, result: 42}`

### 1.2 — Object return

```javascript
return { name: "test", values: [1, 2, 3] };
```

### 1.3 — Async/await support

```javascript
const result = await Promise.resolve("async works");
return result;
```

### 1.4 — Runtime error handling

```javascript
const x = undefinedVariable;
return x;
```

Expected: `{success: false, error: "...not defined..."}` — structured, not crash.

### 1.5 — Empty code

Call `sqlite_execute_code` with `code: ""`.
Expected: `{success: false}` with validation error, not raw MCP error.

### 1.6 — Empty params

Call `sqlite_execute_code` with `{}` (no `code` param).
Expected: structured handler error, NOT raw MCP `-32602`.

---

## Phase 2: API Discoverability (6 tests)

### 2.1 — Top-level help

```javascript
return await sqlite.help();
```

Expected: `{groups: [...], totalMethods: <number>, usage: "..."}` with 10 groups listed (including transactions). **WASM**: Fewer groups — `transactions` is absent; `totalMethods` ≈ 125.

### 2.2 — Group help (core)

```javascript
return await sqlite.core.help();
```

Expected: `{group: "core", methods: [...]}` with methods including `readQuery`, `writeQuery`, `listTables`, `describeTable`, `upsert`, `batchInsert`, `count`, `exists`, `truncate`.

### 2.3 — All groups exist

```javascript
const groups = ["core", "json", "text", "stats", "vector", "admin", "transactions", "geo", "introspection", "migration"];
const results = {};
for (const g of groups) {
  const h = await sqlite[g].help();
  results[g] = h.methods.length;
}
return results;
```

Expected: All 10 groups return >0 methods. **WASM**: `transactions` returns 0 methods — adjust assertion to allow this.

### 2.4 — Method aliases resolve

```javascript
const r1 = await sqlite.core.query("SELECT 1 AS num");
const r2 = await sqlite.core.readQuery("SELECT 1 AS num");
return { aliasResult: r1, canonicalResult: r2 };
```

Expected: Both return identical results.

### 2.5 — Top-level convenience aliases

```javascript
const tables = await sqlite.listTables();
return { success: true, tableCount: tables.tables?.length };
```

### 2.6 — Positional args

```javascript
return await sqlite.core.readQuery("SELECT name FROM test_products LIMIT 2");
```

Expected: Works with string positional arg (not just object).

---

## Phase 3: Security & Error Handling (6 tests)

### 3.1 — Blocked pattern (require)

```javascript
const fs = require("fs");
return fs.readFileSync("/etc/passwd");
```

Expected: `{success: false, code: "CODEMODE_VALIDATION_FAILED"}`

### 3.2 — Blocked pattern (process)

```javascript
return process.env;
```

Expected: `{success: false}` — blocked pattern or runtime error.

### 3.3 — Blocked pattern (eval)

```javascript
return eval("1+1");
```

Expected: `{success: false, code: "CODEMODE_VALIDATION_FAILED"}`

### 3.4 — Timeout enforcement

```javascript
while (true) {}
```

Call with `timeout: 2000`. Expected: `{success: false}` with timeout error within ~2s.

### 3.5 — Invalid tool call via API

```javascript
return await sqlite.core.readQuery({ query: "SELECT * FROM nonexistent_xyz" });
```

Expected: Returns `{success: false, error: "..."}` — sandbox must not crash.

### 3.6 — Undefined API group

```javascript
return await sqlite.nonexistent.help();
```

Expected: runtime error, not crash.

---

## Phase 4: Core Group — Happy Paths (batched)

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

**Write tools (use temp tables):**

11. `sqlite.core.createTable({table: "temp_cm_core", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "name", type: "TEXT"}, {name: "value", type: "REAL"}]})` → success
12. `sqlite.core.writeQuery("INSERT INTO temp_cm_core (id, name, value) VALUES (1, 'alpha', 10.5), (2, 'beta', 20.0)")` → `{rowsAffected: 2}`
13. `sqlite.core.upsert({table: "temp_cm_core", data: {id: 1, name: "alpha_updated", value: 15.0}, conflictColumn: "id"})` → success, row 1 updated
14. `sqlite.core.batchInsert({table: "temp_cm_core", rows: [{id: 3, name: "gamma", value: 30.0}, {id: 4, name: "delta", value: 40.0}]})` → 2 rows inserted
15. `sqlite.core.count({table: "temp_cm_core"})` → `{count: 4}`
16. `sqlite.core.truncate({table: "temp_cm_core"})` → success
17. `sqlite.core.count({table: "temp_cm_core"})` → `{count: 0}`

**Index lifecycle:**

18. `sqlite.core.writeQuery("INSERT INTO temp_cm_core (id, name) VALUES (1, 'test')")` → re-populate
19. `sqlite.core.createIndex({table: "temp_cm_core", columns: ["name"], indexName: "idx_temp_cm_name"})` → success
20. `sqlite.core.getIndexes({table: "temp_cm_core"})` → includes `idx_temp_cm_name`
21. `sqlite.core.dropIndex({indexName: "idx_temp_cm_name"})` → success
22. `sqlite.core.dropTable({table: "temp_cm_core"})` → success

---

## Phase 5: Core Group — Domain Errors (batched)

🔴 23. `sqlite.core.readQuery({query: "SELECT * FROM nonexistent_xyz"})` → `{success: false}`
🔴 24. `sqlite.core.writeQuery("INSERT INTO nonexistent_xyz VALUES (1)")` → `{success: false}`
🔴 25. `sqlite.core.describeTable("nonexistent_xyz")` → `{success: false}` mentioning table
🔴 26. `sqlite.core.getIndexes({table: "nonexistent_xyz"})` → report behavior
🔴 27. `sqlite.core.dropTable({table: "nonexistent_xyz", ifExists: false})` → `{success: false}`
🔴 28. `sqlite.core.count({table: "nonexistent_xyz"})` → `{success: false}`
🔴 29. `sqlite.core.exists({table: "nonexistent_xyz"})` → `{success: false}`
🔴 30. `sqlite.core.upsert({table: "nonexistent_xyz", data: {id: 1}})` → `{success: false}`
🔴 31. `sqlite.core.batchInsert({table: "nonexistent_xyz", rows: [{id: 1}]})` → `{success: false}`
🔴 32. `sqlite.core.truncate({table: "nonexistent_xyz"})` → `{success: false}`

---

## Phase 6: Core Group — Zod Validation (batched)

🔴 33. `sqlite.core.readQuery({})` → `{success: false}` handler error
🔴 34. `sqlite.core.writeQuery({})` → `{success: false}` handler error
🔴 35. `sqlite.core.createTable({})` → `{success: false}` handler error
🔴 36. `sqlite.core.describeTable({})` → `{success: false}` handler error
🔴 37. `sqlite.core.dropTable({})` → `{success: false}` handler error
🔴 38. `sqlite.core.createIndex({})` → `{success: false}` handler error
🔴 39. `sqlite.core.dropIndex({})` → `{success: false}` handler error
🔴 40. `sqlite.core.upsert({})` → `{success: false}` handler error
🔴 41. `sqlite.core.batchInsert({})` → `{success: false}` handler error
🔴 42. `sqlite.core.count({})` → `{success: false}` handler error
🔴 43. `sqlite.core.exists({})` → `{success: false}` handler error
🔴 44. `sqlite.core.truncate({})` → `{success: false}` handler error

---

## Phase 7: Readonly Mode (5 tests)

All tests use `readonly: true` on the `sqlite_execute_code` call.

### 7.1 — Read operations work

```javascript
// readonly: true
return await sqlite.core.readQuery("SELECT COUNT(*) AS cnt FROM test_products");
```

Expected: `{success: true, rows: [{cnt: 16}]}`

### 7.2 — Write operations blocked

```javascript
// readonly: true
return await sqlite.core.writeQuery("INSERT INTO test_products (name) VALUES ('blocked')");
```

Expected: `{success: false, code: "CODEMODE_READONLY_VIOLATION"}`

### 7.3 — Read methods still discoverable

```javascript
// readonly: true
const help = await sqlite.core.help();
return { hasWriteQuery: help.methods.includes("writeQuery"), methods: help.methods };
```

Expected: `writeQuery` still appears in help (for discoverability) but is guarded.

### 7.4 — Create table blocked

```javascript
// readonly: true
return await sqlite.core.writeQuery("CREATE TABLE temp_readonly_test (id INTEGER)");
```

Expected: `{success: false, code: "CODEMODE_READONLY_VIOLATION"}`

### 7.5 — Stats read-only works

```javascript
// readonly: true
return await sqlite.stats.statsBasic({ table: "test_products", column: "price" });
```

Expected: succeeds — stats tools are read-only.

---

## Phase 8: Multi-Step Workflow (3 tests)

### 8.1 — ETL pipeline

```javascript
await sqlite.core.createTable({
  table: "temp_cm_etl", 
  columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "raw", type: "TEXT"}, {name: "processed", type: "TEXT"}]
});
for (let i = 1; i <= 5; i++) {
  await sqlite.core.writeQuery({ query: `INSERT INTO temp_cm_etl (raw) VALUES ('item_${i}')` });
}
await sqlite.core.writeQuery("UPDATE temp_cm_etl SET processed = UPPER(raw)");
const result = await sqlite.core.readQuery("SELECT * FROM temp_cm_etl");
await sqlite.core.dropTable({table: "temp_cm_etl", ifExists: true});
return result;
```

### 8.2 — Schema introspection + query

```javascript
const tables = await sqlite.core.listTables();
const first = tables.tables[0].name;
const schema = await sqlite.core.describeTable(first);
const sample = await sqlite.core.readQuery({ query: `SELECT * FROM ${first} LIMIT 3` });
return { table: first, columnCount: schema.columns?.length, sampleRows: sample.rows?.length };
```

### 8.3 — Loop with accumulator

```javascript
const tables = await sqlite.core.listTables();
const counts = {};
for (const t of tables.tables.slice(0, 5)) {
  const r = await sqlite.core.count({ table: t.name });
  counts[t.name] = r.count;
}
return counts;
```

---

## Post-Test Procedures

1. **Cleanup**: Confirm all `temp_*` tables are removed
3. **Triage findings**: Create implementation plan if issues found
4. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
5. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
6. **Commit**: Stage and commit — do NOT push
6. **Live re-test**: After server rebuild
7. **Token audit**: Report `metrics.tokenEstimate` for the most expensive block
8. **Final summary**: After testing/re-testing
