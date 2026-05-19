# db-mcp (SQLite) Tool Group Testing: [introspection]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All 9 introspection tools are fully WASM-compatible. No items to skip.
>
> **Minor difference**: `sqlite_schema_snapshot` may report `test_articles_fts` in the `tables` array but it is not queryable (FTS5 is unavailable in WASM). Treat its presence as expected but non-functional.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **introspection** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Report the response size in KB and suggest a concrete optimization.

## Test Database Schema

| Table             | Rows | Columns                                                                       | JSON Columns                                                                              |
| ----------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| test_products     | 16   | id, name, description, price, category, created_at                            | —                                                                                         |
| test_orders       | 20   | id, product_id (FK), customer_name, quantity, total_price, order_date, status | —                                                                                         |
| test_jsonb_docs   | 6    | id, doc, metadata, tags, created_at                                           | **doc**, **metadata** (nested), **tags** (array)                                          |
| test_articles     | 8    | id, title, body, author, category, published_at                               | —                                                                                         |
| test_users        | 9    | id, username, email, phone, bio, created_at                                   | —                                                                                         |
| test_measurements | 200  | id, sensor_id, temperature, humidity, pressure, measured_at                   | —                                                                                         |
| test_embeddings   | 20   | id, content, category, embedding                                              | **embedding** (8-dim float array); category values: database, fitness, food, tech, travel |
| test_locations    | 15   | id, name, city, latitude, longitude, type                                     | —                                                                                         |
| test_categories   | 17   | id, name, path, level                                                         | —                                                                                         |
| test_events       | 100  | id, event_type, user_id (INT, 8 values), payload, event_date                  | **payload** (JSON)                                                                        |

**Key FK:** `test_orders.product_id → test_products.id`
**Redundant index (intentional):** `idx_orders_status` is a prefix of `idx_orders_status_date` — used to test index audit tools.

> **Note:** When testing `sqlite_execute_code`, do **not** pass `readonly: true` unless specifically testing read-only filtering.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. Report all failures, unexpected behaviors, or unnecessarily large payloads
3. Do not mention what already works well or issues documented in help resources
4. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
5. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.
6. **Deterministic checklist first**: Complete ALL items before freeform exploration.
7. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                      | Verdict            |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields           | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, `isError: true` — no `success` field      | Bug — report as ❌ |

### Zod Validation Errors

**Zod refinement leak pattern:** `.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. **Fix:** Remove refinements from schema, validate inside handler.

- Raw MCP error (no `success` field) → report as ❌
- `{success: false, error: "..."}` → correct
- Successful response for invalid input → report as ⚠️

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

### Error Consistency Audit

1. Raw error instead of `{success: false}` → ❌
2. Must use `error` field name
3. Orphaned/inline output schemas → ⚠️

### Split Schema Pattern Verification

Verify parameter visibility and alias acceptance.

---

## Group Focus: introspection

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

> **Note:** All introspection tools are **read-only**. The test database has one FK relationship (`test_orders.product_id → test_products.id`) and a deliberately redundant index (`idx_orders_status` is a prefix of `idx_orders_status_date`) for audit testing.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### introspection Group Tools (9)

4. sqlite_dependency_graph
5. sqlite_topological_sort
6. sqlite_cascade_simulator
7. sqlite_schema_snapshot
8. sqlite_constraint_analysis
9. sqlite_migration_risks
10. sqlite_storage_analysis
11. sqlite_index_audit
12. sqlite_query_plan
13. sqlite_execute_code

**Checklist — Graph Analysis:**

1. `sqlite_dependency_graph({})` → nodes ≥ 2, edges includes `test_orders → test_products` (FK); stats.totalRelationships ≥ 1
2. `sqlite_topological_sort({})` → order array with `test_products` before `test_orders` (FK dependency); hasCycles = false
3. `sqlite_cascade_simulator({table: "test_products"})` → affectedTables includes `test_orders` (FK dependent)
4. `sqlite_cascade_simulator({table: "test_measurements"})` → affectedTables is empty (no tables reference it via FK)
5. `sqlite_cascade_simulator({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}`

**Checklist — Schema Analysis:**

6. `sqlite_schema_snapshot({})` → snapshot.tables ≥ 11 (10 test\_ tables + FTS virtual); stats.indexes ≥ 4; generatedAt present
7. `sqlite_constraint_analysis({})` → findings array; summary.totalFindings ≥ 0; summary.byType and bySeverity objects present
8. `sqlite_migration_risks({statements: ["DROP TABLE test_products"]})` → risks array non-empty; risk category includes data_loss or destructive
9. `sqlite_migration_risks({statements: ["ALTER TABLE test_users ADD COLUMN age INTEGER"]})` → low risk
10. `sqlite_migration_risks({statements: ["CREATE TABLE new_table (id INTEGER PRIMARY KEY)", "DROP TABLE test_products"]})` → summary.totalStatements = 2; summary.highestRisk ≥ "high"

**Checklist — Diagnostics:**

11. `sqlite_storage_analysis({})` → database.pageSize > 0, database.totalPages > 0, database.totalSizeBytes = pageSize × totalPages; recommendations array present
12. `sqlite_storage_analysis({})` → tables array contains "test_measurements" (largest by row count); verify each entry has name, sizeBytes, rowCount
13. `sqlite_index_audit({})` → findings array present; summary has redundant, missingFk, total fields
14. `sqlite_index_audit({})` → findings includes type="redundant" for `idx_orders_status` (prefix of `idx_orders_status_date`)
15. `sqlite_query_plan({sql: "SELECT * FROM test_products WHERE category = 'electronics'"})` → plan array non-empty; analysis.fullScans may or may not include test_products (idx_products_category exists)
16. `sqlite_query_plan({sql: "SELECT * FROM test_orders WHERE status = 'completed'"})` → analysis.indexScans present (idx_orders_status exists)
17. `sqlite_query_plan({sql: "SELECT * FROM test_products WHERE name = 'Laptop Pro 15'"})` → analysis.fullScans includes test_products (no index on name); suggestions non-empty
18. `sqlite_query_plan({sql: "WITH recent AS (SELECT * FROM test_orders ORDER BY order_date DESC LIMIT 5) SELECT * FROM recent"})` → plan contains CTE-related entries

**Code mode testing (params only accessible via code mode):**

19. `sqlite_execute_code({code: "const result = await sqlite.introspection.schemaSnapshot({}); return { tableCount: result.snapshot.tables.length, hasStats: !!result.stats };"})` → tableCount ≥ 11, hasStats = true
20. `sqlite_execute_code({code: "const result = await sqlite.introspection.queryPlan({sql: 'SELECT * FROM test_products WHERE category = \\u0027electronics\\u0027'}); return result;"})` → plan array present
21. `sqlite_execute_code({code: "const result = await sqlite.introspection.schemaSnapshot({sections: ['tables']}); return { hasTables: !!result.snapshot.tables, hasViews: !!result.snapshot.views, hasIndexes: !!result.snapshot.indexes };"})` → hasTables=true, hasViews=false, hasIndexes=false
22. `sqlite_execute_code({code: "const result = await sqlite.introspection.schemaSnapshot({compact: true}); const t = result.snapshot.tables[0]; return { name: t.name, hasColumns: !!t.columns };"})` → hasColumns=false (compact omits columns)
23. `sqlite_execute_code({code: "const result = await sqlite.introspection.constraintAnalysis({table: 'test_orders'}); return { count: result.findings.length, allTestOrders: result.findings.every(f => f.table === 'test_orders') };"})` → allTestOrders=true
24. `sqlite_execute_code({code: "const result = await sqlite.introspection.constraintAnalysis({checks: ['unindexed_fk']}); return { count: result.findings.length, allUnindexedFk: result.findings.every(f => f.type === 'unindexed_fk') };"})` → allUnindexedFk=true
25. `sqlite_execute_code({code: "const result = await sqlite.introspection.storageAnalysis({includeTableDetails: false}); return { hasTables: !!result.tables, hasDatabase: !!result.database };"})` → hasTables=false, hasDatabase=true
26. `sqlite_execute_code({code: "const result = await sqlite.introspection.indexAudit({table: 'test_orders'}); return { count: result.findings.length, allTestOrders: result.findings.every(f => f.table === 'test_orders') };"})` → allTestOrders=true
27. `sqlite_execute_code({code: "const result = await sqlite.introspection.topologicalSort({direction: 'drop'}); return { direction: result.direction, first: result.order[0], last: result.order[result.order.length - 1] };"})` → direction="drop", test_orders before test_products in order

**Error path testing:**

🔴 28. `sqlite_query_plan({sql: "DELETE FROM test_products WHERE id = 1"})` → `{success: false, error: "...only SELECT..."}` (non-SELECT rejected)
🔴 29. `sqlite_query_plan({})` → Zod validation error (missing required `sql`). Must be handler error, NOT raw MCP error.
🔴 30. `sqlite_cascade_simulator({})` → Zod validation error (missing required `table`)
🔴 31. `sqlite_migration_risks({statements: []})` → report behavior for empty array
🔴 32. `sqlite_execute_code({code: "return await sqlite.introspection.storageAnalysis({limit: 0});", readonly: true})` → Zod validation error (min: 1) — `limit` param only accessible via code mode

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 33. `sqlite_dependency_graph({})` → handler error (or success if no required params)
🔴 34. `sqlite_topological_sort({})` → handler error (or success if no required params)
🔴 35. `sqlite_cascade_simulator({})` → handler error
🔴 36. `sqlite_schema_snapshot({})` → handler error (or success if no required params)
🔴 37. `sqlite_constraint_analysis({})` → handler error (or success if no required params)
🔴 38. `sqlite_migration_risks({})` → handler error
🔴 39. `sqlite_storage_analysis({})` → handler error (or success if no required params)
🔴 40. `sqlite_index_audit({})` → handler error (or success if no required params)
🔴 41. `sqlite_query_plan({})` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing

---

## Troubleshooting

### Database is locked / file in use

1. Check for Node.js processes: `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"`
2. WAL/journal files are normal

### Reset script fails

1. Run with `-Verbose`: `.\reset-database.ps1 -Verbose`
