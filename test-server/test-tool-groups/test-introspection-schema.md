# db-mcp Tool Group Testing: [introspection-schema]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're in Native mode. If there is nothing to fix, don't update UNRELEASED.md.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All 6 schema introspection tools are fully WASM-compatible. No items to skip.
>
> **Minor difference**: `sqlite_schema_snapshot` may report `test_articles_fts` in the `tables` array but it is not queryable (FTS5 is unavailable in WASM). Treat its presence as expected but non-functional.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **introspection-schema** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

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

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
3. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.

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

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

---

## Group Focus: introspection-schema

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### introspection-schema Group Tools (6)

1. sqlite_dependency_graph
2. sqlite_topological_sort
3. sqlite_cascade_simulator
4. sqlite_schema_snapshot
5. sqlite_constraint_analysis
6. sqlite_migration_risks

**Checklist:**

**Graph Analysis:**

1. `sqlite_dependency_graph({})` → nodes ≥ 2, edges includes `test_orders → test_products` (FK); stats.totalRelationships ≥ 1
2. `sqlite_topological_sort({})` → order array with `test_products` before `test_orders` (FK dependency); hasCycles = false
3. `sqlite_topological_sort({direction: "drop"})` → order array with `test_orders` before `test_products` (reverse topo sort)
4. `sqlite_cascade_simulator({table: "test_products"})` → affectedTables includes `test_orders` (FK dependent)
5. `sqlite_cascade_simulator({table: "test_measurements"})` → affectedTables is empty (no tables reference it via FK)
6. `sqlite_cascade_simulator({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}`

**Schema Analysis:**

7. `sqlite_schema_snapshot({})` → snapshot.tables ≥ 11 (10 test\_ tables + FTS virtual); stats.indexes ≥ 4; generatedAt present
8. `sqlite_schema_snapshot({sections: ["tables"]})` → snapshot.tables is populated, but views/indexes should be missing or empty
9. `sqlite_schema_snapshot({compact: true})` → columns array should be omitted or minimal
10. `sqlite_constraint_analysis({})` → findings array; summary.totalFindings ≥ 0; summary.byType and bySeverity objects present
11. `sqlite_constraint_analysis({table: "test_orders"})` → findings restricted to `test_orders`
12. `sqlite_constraint_analysis({checks: ["unindexed_fk"]})` → findings restricted to `unindexed_fk`
13. `sqlite_migration_risks({statements: ["DROP TABLE test_products"]})` → risks array non-empty; risk category includes data_loss or destructive
14. `sqlite_migration_risks({statements: ["ALTER TABLE test_users ADD COLUMN age INTEGER"]})` → low risk
15. `sqlite_migration_risks({statements: ["CREATE TABLE new_table (id INTEGER PRIMARY KEY)", "DROP TABLE test_products"]})` → summary.totalStatements = 2; summary.highestRisk ≥ "high"

**Error path testing:**

🔴 16. `sqlite_cascade_simulator({})` → Zod validation error (missing required `table`). Must be handler error, NOT raw MCP error.
🔴 17. `sqlite_migration_risks({statements: []})` → report behavior for empty array

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 18. `sqlite_dependency_graph({})` → handler error (or success if no required params)
🔴 19. `sqlite_topological_sort({})` → handler error (or success if no required params)
🔴 20. `sqlite_schema_snapshot({})` → handler error (or success if no required params)
🔴 21. `sqlite_constraint_analysis({})` → handler error (or success if no required params)
🔴 22. `sqlite_migration_risks({})` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing
