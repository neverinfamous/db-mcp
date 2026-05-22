# db-mcp Advanced Stress Test: [introspection]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **introspection** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB and suggest a concrete optimization.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

1. Use existing `test_*` tables for read operations.
2. Test each tool with realistic inputs based on the schema above.
3. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads.
4. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) a domain error and (b) a **Zod validation error** (call the tool with `{}` empty params). Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
5. **Output schema testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

All tools should return errors as structured objects instead of throwing. The expected pattern:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error — How to Distinguish

| Type                 | Source                                                             | What you see                                                                                                          | Verdict            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields                                                               | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field | Bug — report as ❌ |

### Zod Validation Errors

Calling a tool with wrong parameter types or missing required fields triggers a Zod validation error. If the handler has no outer `try/catch`, this surfaces as a raw MCP error (often `-32602`). Test every tool with `{}` (empty params) if it has required parameters — the response must be a handler error, not an MCP error.

**Fix:** Remove ALL `.min(N)` / `.max(N)` refinements from the schema and validate inside the handler instead.

### Wrong-Type Numeric Parameter Coercion

For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.

### Output Schema Validation Errors

The MCP SDK enforces `additionalProperties: false` on **output** schemas. If a handler returns fields not declared in its output schema, the SDK rejects the response with a raw `-32602` error.

**How to detect:** If a tool call with **correct, valid inputs** returns a raw MCP `-32602` mentioning "does not match the tool's output schema" or "additional properties", report as ❌ with both the tool name and the missing field(s).

### Error Consistency Audit

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌.
2. **Error field name**: All `{success: false}` responses should use `error` as the field name.
3. **Zod validation leaks**: If calling a tool with missing required field produces a raw MCP `-32602` error instead of a structured response, report as ❌.
4. **Output schema leaks**: If calling a tool with valid inputs produces a raw MCP `-32602` mentioning "output schema", report as ❌.

----------------- | ---- | ------------------------------------------------------ |
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
