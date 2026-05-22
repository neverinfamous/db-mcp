# db-mcp Advanced Stress Test — [introspection]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode).

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js): All 10 introspection tools are fully WASM-compatible. No categories to skip.
>
> **Minor difference**: `schemaSnapshot` may report `test_articles_fts` in virtual tables but it is not queryable (FTS5 is unavailable in WASM). Treat its presence as expected but non-functional.

> **Code Mode Required:** Several optional params (`table`, `direction`, `sections`, `compact`, `checks`, `includeTableDetails`, `limit`) are defined in tool schemas but NOT exposed in MCP tool definitions. Use `sqlite_execute_code` to test these params via `sqlite.introspection.*` API.

## Code Mode Execution

- **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

All tests via `sqlite_execute_code`. Use `sqlite.introspection.*` for all introspection tools.
State persists across calls. All introspection tools are **read-only** — no cleanup needed.

## Test Database Schema

| Table             | Rows | Key Columns                                            |
| ----------------- | ---- | ------------------------------------------------------ |
| test_products     | 16   | id, name, price, category                              |
| test_orders       | 20   | id, product_id (FK→test_products), total_price, status |
| test_measurements | 200  | id, sensor_id, temperature, humidity, pressure         |

**Key FK:** `test_orders.product_id → test_products.id`
**Redundant index (intentional):** `idx_orders_status` is a prefix of `idx_orders_status_date` — used to test index audit.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`) | ✅ Confirmed (inline only)

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## introspection Group Tools (10)

1. sqlite_dependency_graph
2. sqlite_topological_sort
3. sqlite_cascade_simulator
4. sqlite_schema_snapshot
5. sqlite_schema_diff
6. sqlite_constraint_analysis
7. sqlite_migration_risks
8. sqlite_storage_analysis
9. sqlite_index_audit
10. sqlite_query_plan

---

### Category 1: Graph Analysis Edge Cases

**1.1 Full Dependency Graph**

1. `sqlite.introspection.dependencyGraph({})` → full graph. Verify edge `test_orders → test_products` present.
2. `sqlite.introspection.dependencyGraph({includeRowCounts: false})` → verify rowCount omitted.
3. Verify `stats.rootTables` and `stats.leafTables` are populated and disjoint.

**1.2 Topological Sort Direction Stress**

4. `sqlite.introspection.topologicalSort({direction: "create"})` → `test_products` BEFORE `test_orders`
5. `sqlite.introspection.topologicalSort({direction: "drop"})` → `test_orders` BEFORE `test_products`
6. Verify both directions list the same set of tables (just reordered)

**1.3 Cascade Chains**

7. `sqlite.introspection.cascadeSimulator({table: "test_products"})` → affectedTables includes `test_orders` with FK action
8. `sqlite.introspection.cascadeSimulator({table: "test_measurements"})` → affectedTables empty (leaf table)
9. `sqlite.introspection.cascadeSimulator({table: "test_orders"})` → affectedTables empty (nothing references test_orders via FK)

---

### Category 2: Schema Snapshot Completeness

10. `sqlite.introspection.schemaSnapshot({})` → full snapshot:
    - tables ≥ 11 (10 regular + FTS virtual)
    - indexes ≥ 4 (`idx_orders_status`, `idx_orders_date`, `idx_products_category`, `idx_orders_status_date`)
    - generatedAt is valid ISO timestamp
11. `sqlite.introspection.schemaSnapshot({sections: ["indexes"]})` → only indexes section. Tables absent.
12. `sqlite.introspection.schemaSnapshot({sections: ["tables", "indexes"]})` → both sections present
13. `sqlite.introspection.schemaSnapshot({compact: true})` → tables present but columns arrays absent
14. `sqlite.introspection.schemaSnapshot({compact: false})` → column details (name, type, nullable, pk) present

---

### Category 3: Constraint Analysis Stress

15. `sqlite.introspection.constraintAnalysis({})` → all tables analyzed. Verify summary.byType and summary.bySeverity keys.
16. `sqlite.introspection.constraintAnalysis({checks: ["unindexed_fk"]})` → only unindexed FK findings.
17. `sqlite.introspection.constraintAnalysis({table: "test_users"})` → only test_users findings. No other tables referenced.
18. `sqlite.introspection.constraintAnalysis({table: "nonexistent_table_xyz"})` → report behavior: empty findings or structured error?

---

### Category 4: Storage Analysis & Index Audit Depth

**4.1 Storage Analysis Verification**

19. `sqlite.introspection.storageAnalysis({})` → verify database.totalSizeBytes = pageSize × totalPages (arithmetic check)
20. `sqlite.introspection.storageAnalysis({})` → verify tables sorted by size descending
21. `sqlite.introspection.storageAnalysis({includeTableDetails: false})` → tables absent. Database-level metrics present.
22. `sqlite.introspection.storageAnalysis({limit: 3})` → only top 3 tables (if supported)
23. `sqlite.introspection.storageAnalysis({})` → verify fragmentationPct 0-100, journalMode and autoVacuum non-empty

**4.2 Index Audit Cross-Validation**

24. `sqlite.introspection.indexAudit({})` → flag `idx_orders_status` as `type: "redundant"` (prefix of `idx_orders_status_date`). Field name is `index`.
25. `sqlite.introspection.indexAudit({})` → verify `redundantOf` points to `idx_orders_status_date`
26. `sqlite.introspection.indexAudit({})` → check for `missing_fk_index` on `test_orders.product_id`
27. `sqlite.introspection.indexAudit({table: "test_products"})` → only test_products findings. `idx_products_category` NOT redundant.
28. `sqlite.introspection.indexAudit({table: "test_measurements"})` → 200 rows, no secondary indexes. `unindexed_large_table` threshold is 1000 → no finding expected.

---

### Category 5: Query Plan Deep Analysis

29. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_orders WHERE status = 'completed'"})` → use `idx_orders_status`
30. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_products WHERE name = 'Laptop Pro 15'"})` → full scan (no index on name). Verify `analysis.fullScans` includes `test_products`, `suggestions` array exists.
31. `sqlite.introspection.queryPlan({sql: "SELECT p.name, o.quantity FROM test_products p JOIN test_orders o ON o.product_id = p.id WHERE o.status = 'completed'"})` → join plan with multiple entries.
32. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_orders WHERE status = 'completed' AND order_date > '2026-01-20'"})` → compound WHERE. Verify index choice.
33. `sqlite.introspection.queryPlan({sql: "SELECT COUNT(*) FROM test_measurements GROUP BY sensor_id"})` → GROUP BY without dedicated index. Expect full scan.
34. `sqlite.introspection.queryPlan({sql: "WITH top_orders AS (SELECT * FROM test_orders ORDER BY total_price DESC LIMIT 5) SELECT t.*, p.name FROM top_orders t JOIN test_products p ON p.id = t.product_id"})` → CTE + JOIN plan.

---

### Category 6: Migration Risk Assessment Depth

35. `sqlite.introspection.migrationRisks({statements: ["DROP TABLE test_products"]})` → critical/high risk. Mentions FK dependents.
36. `sqlite.introspection.migrationRisks({statements: ["ALTER TABLE test_products ADD COLUMN temp_col TEXT"]})` → low risk (additive)
37. `sqlite.introspection.migrationRisks({statements: ["CREATE INDEX idx_temp ON test_products(name)"]})` → low risk
38. `sqlite.introspection.migrationRisks({statements: ["DROP INDEX idx_orders_status"]})` → medium risk. Verify `riskLevel: "medium"`, `category: "index_removal"`.
39. `sqlite.introspection.migrationRisks({statements: ["ALTER TABLE test_products ADD COLUMN temp1 TEXT", "DROP TABLE test_orders", "CREATE TABLE new_orders (id INTEGER PRIMARY KEY)"]})` → 3 statements, mixed risk. `summary.totalStatements = 3`, `summary.highestRisk ≥ "high"`.

---

### Category 8: Schema Diff Stress

47. `sqlite.introspection.schemaDiff({baseline: "current", target: "current"})` → self-diff: `summary.totalChanges: 0`, `severity: "none"`, all sections empty
48. Mutation-diff workflow:
    ```javascript
    // Take baseline snapshot
    const baseline = (await sqlite.introspection.schemaSnapshot({compact: false})).snapshot;
    // Create temp table to introduce drift
    await sqlite.core.createTable({table: "stress_diff_temp", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "val", type: "TEXT"}]});
    // Diff baseline against current (which now has the extra table)
    const diff = await sqlite.introspection.schemaDiff({baseline, target: "current"});
    // Cleanup
    await sqlite.core.dropTable({table: "stress_diff_temp"});
    const failures = [];
    if (diff.summary?.totalChanges !== 1) failures.push(`expected 1 change, got ${diff.summary?.totalChanges}`);
    if (!diff.sections?.tables?.added?.some(t => t.name === "stress_diff_temp")) failures.push("stress_diff_temp not in added tables");
    if (diff.summary?.severity !== "low") failures.push(`expected severity 'low' for add-only, got '${diff.summary?.severity}'`);
    return {failures, success: failures.length === 0, diff: diff.summary};
    ```
49. `sqlite.introspection.schemaDiff({baseline: "current", target: "current", sections: ["indexes"]})` → only `sections.indexes` populated; `sections.tables`/`views`/`triggers` absent
50. `sqlite.introspection.schemaDiff({baseline: "current"})` → Zod error for missing `target` — must be handler error, NOT raw MCP
51. `sqlite.introspection.schemaDiff({})` → Zod error for missing both `baseline` and `target`

---

### Category 9: Error Message Quality

52. `sqlite.introspection.queryPlan({sql: "DELETE FROM test_products WHERE id = 1"})` → structured error rejecting non-SELECT
53. `sqlite.introspection.queryPlan({sql: "SELECT * FROM nonexistent_table_xyz"})` → structured error mentioning table
54. `sqlite.introspection.queryPlan({})` → Zod error for missing `sql` — must be handler error, NOT raw MCP
55. `sqlite.introspection.cascadeSimulator({})` → Zod error for missing `table`
56. `sqlite.introspection.migrationRisks({})` → Zod error for missing `statements`
57. `sqlite.introspection.storageAnalysis({limit: 0})` → Zod error (min: 1)
58. `sqlite.introspection.storageAnalysis({limit: -5})` → Zod error

---

### Final Cleanup

All tools read-only — no cleanup needed. Confirm `test_products` (16), `test_orders` (20), `test_measurements` (200) unchanged.

## Post-Test Procedures

1. **Fix EVERY finding** — ❌, ⚠️, 📦
2. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
3. **Commit**: Stage and commit — do NOT push
4. **Re-test**: After server rebuild
5. **Token audit**: Report most expensive block
