# db-mcp Code Mode Testing: [introspection]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **introspection** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js): All 9 introspection tools are fully WASM-compatible. No phases to skip.
>
> **Minor difference**: `schemaSnapshot` may report `test_articles_fts` in virtual tables but it is not queryable (FTS5 is unavailable in WASM). Treat its presence as expected but non-functional.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — monitor `metrics.tokenEstimate`.

## Test Database Schema

| Table             | Rows | Key Columns                                            |
| ----------------- | ---- | ------------------------------------------------------ |
| test_products     | 16   | id, name, price, category                              |
| test_orders       | 20   | id, product_id (FK→test_products), total_price, status |
| test_measurements | 200  | id, sensor_id, temperature, humidity, pressure         |

**Key FK:** `test_orders.product_id → test_products.id`
**Redundant index (intentional):** `idx_orders_status` is a prefix of `idx_orders_status_date` — used to test index audit tools.

> All introspection tools are **read-only**. No cleanup required.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** Report as ❌.

1. **Batched scripting**: Bundle checks with `failures` array.
2. **Error path testing**: Every tool with `{}` (Zod) and domain error.
3. **Token tracking**: Monitor `metrics.tokenEstimate`.
4. **Coverage Matrix**: `| Tool | Happy Path | Domain Error | Zod Error |`
5. **Deterministic checklist first**.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## Phase 1: Graph Analysis — Happy Paths (batched)

1. `sqlite.introspection.dependencyGraph({})` → nodes ≥ 2, edges includes `test_orders → test_products` (using `from` and `to`)
2. `sqlite.introspection.topologicalSort({})` → `test_products` before `test_orders` (FK dependency); `hasCycles: false`
3. `sqlite.introspection.cascadeSimulator({table: "test_products"})` → affectedTables includes `test_orders`
4. `sqlite.introspection.cascadeSimulator({table: "test_measurements"})` → affectedTables empty

---

## Phase 2: Schema Analysis — Happy Paths (batched)

5. `sqlite.introspection.schemaSnapshot({})` → `snapshot.tables` ≥ 11; `stats.indexes` ≥ 4; `generatedAt` present
6. `sqlite.introspection.constraintAnalysis({})` → `findings` array; `summary.totalFindings` ≥ 0
7. `sqlite.introspection.migrationRisks({statements: ["DROP TABLE test_products"]})` → risks non-empty, category is "destructive"
8. `sqlite.introspection.migrationRisks({statements: ["ALTER TABLE test_users ADD COLUMN age INTEGER"]})` → low risk
9. `sqlite.introspection.migrationRisks({statements: ["CREATE TABLE new_table (id INTEGER PRIMARY KEY)", "DROP TABLE test_products"]})` → `summary.totalStatements: 2`, `summary.highestRisk` ≥ "high"

---

## Phase 3: Diagnostics — Happy Paths (batched)

10. `sqlite.introspection.storageAnalysis({})` → `database.pageSize > 0`, `database.totalPages > 0`; tables array present
11. `sqlite.introspection.indexAudit({})` → `findings` array; redundant index for `idx_orders_status`
12. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_products WHERE category = 'electronics'"})` → plan array non-empty
13. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_orders WHERE status = 'completed'"})` → index scan array contains `idx_orders_status_date`
14. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_products WHERE name = 'Laptop Pro 15'"})` → full scan array contains `test_products` (no index on name)

---

## Phase 4: Advanced Optional Parameters (batched)

> Test these granular optional parameters. Note: While previously thought to be Code Mode-only, these parameters are actually available in both Code Mode and direct tool calls.

15. `sqlite.introspection.schemaSnapshot({sections: ["tables"]})` → only tables section (no views/indexes)
16. `sqlite.introspection.schemaSnapshot({compact: true})` → compact mode omits columns from table entries
17. `sqlite.introspection.constraintAnalysis({table: "test_orders"})` → filtered to test_orders only
18. `sqlite.introspection.constraintAnalysis({checks: ["unindexed_fk"]})` → filtered to unindexed FK findings
19. `sqlite.introspection.storageAnalysis({includeTableDetails: false})` → database summary only (no tables array)
20. `sqlite.introspection.indexAudit({table: "test_orders"})` → filtered to test_orders indexes only
21. `sqlite.introspection.topologicalSort({direction: "drop"})` → drop order: test_orders before test_products

---

## Phase 5: Introspection Domain Errors (batched)

🔴 22. `sqlite.introspection.cascadeSimulator({table: "nonexistent_xyz"})` → `{success: false}`
🔴 23. `sqlite.introspection.queryPlan({sql: "DELETE FROM test_products WHERE id = 1"})` → `{success: false, error: "...only SELECT..."}`
🔴 24. `sqlite.introspection.storageAnalysis({limit: 0})` → Zod validation error (min: 1)
🔴 25. `sqlite.introspection.migrationRisks({statements: []})` → report behavior for empty array

---

## Phase 6: Introspection Zod Validation (batched)

🔴 26. `sqlite.introspection.dependencyGraph({})` → success or handler error (no required params)
🔴 27. `sqlite.introspection.topologicalSort({})` → success or handler error (no required params)
🔴 28. `sqlite.introspection.cascadeSimulator({})` → `{success: false}` (missing `table`)
🔴 29. `sqlite.introspection.schemaSnapshot({})` → success or handler error (no required params)
🔴 30. `sqlite.introspection.constraintAnalysis({})` → success or handler error (no required params)
🔴 31. `sqlite.introspection.migrationRisks({})` → `{success: false}` (missing `statements`)
🔴 32. `sqlite.introspection.storageAnalysis({})` → success or handler error (no required params)
🔴 33. `sqlite.introspection.indexAudit({})` → success or handler error (no required params)
🔴 34. `sqlite.introspection.queryPlan({})` → `{success: false}` (missing `sql`)

---

## Phase 7: Multi-Step Workflow

### 7.1 — Full database audit pipeline

```javascript
const failures = [];
// Step 1: Get dependency graph
const graph = await sqlite.introspection.dependencyGraph({});
if (!graph.nodes || graph.nodes.length < 2)
  failures.push("graph has too few nodes");

// Step 2: Schema snapshot
const snapshot = await sqlite.introspection.schemaSnapshot({ compact: true });
if (!snapshot.snapshot?.tables) failures.push("snapshot missing tables");

// Step 3: Index audit
const audit = await sqlite.introspection.indexAudit({});
const redundant = audit.findings?.filter((f) => f.type === "redundant");

// Step 4: Storage analysis
const storage = await sqlite.introspection.storageAnalysis({});

// Step 5: Constraint analysis
const constraints = await sqlite.introspection.constraintAnalysis({});

return {
  failures,
  success: failures.length === 0,
  summary: {
    tableCount: snapshot.snapshot?.tables?.length,
    fkRelationships: graph.stats?.totalRelationships,
    redundantIndexes: redundant?.length,
    storageSizeBytes: storage.database?.totalSizeBytes,
    constraintFindings: constraints.summary?.totalFindings,
  },
};
```

### 7.2 — Query optimization analysis

```javascript
const queries = [
  "SELECT * FROM test_products WHERE category = 'electronics'",
  "SELECT * FROM test_orders WHERE status = 'completed'",
  "SELECT * FROM test_products WHERE name = 'Laptop Pro 15'",
];
const plans = [];
for (const sql of queries) {
  const plan = await sqlite.introspection.queryPlan({ sql });
  plans.push({
    sql: sql.substring(0, 50),
    fullScans: plan.analysis?.fullScans?.length,
    indexScans: plan.analysis?.indexScans?.length,
  });
}
return plans;
```

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Token audit**: Report most expensive block
6. **Final summary**: After testing/re-testing
