# db-mcp Tool Group Testing: [introspection]

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
10. `sqlite.introspection.schemaDiff({baseline: "current", target: "current"})` → `summary.totalChanges: 0`, `severity: "none"` (self-diff = no drift)
11. `sqlite.introspection.schemaDiff({baseline: "current", target: "current", sections: ["tables"]})` → `sections.tables` populated, `sections.views`/`indexes`/`triggers` absent

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
🔴 26. `sqlite.introspection.schemaDiff({baseline: "current"})` → Zod error for missing `target`

---

## Phase 6: Introspection Zod Validation (batched)

🔴 27. `sqlite.introspection.dependencyGraph({})` → success or handler error (no required params)
🔴 28. `sqlite.introspection.topologicalSort({})` → success or handler error (no required params)
🔴 29. `sqlite.introspection.cascadeSimulator({})` → `{success: false}` (missing `table`)
🔴 30. `sqlite.introspection.schemaSnapshot({})` → success or handler error (no required params)
🔴 31. `sqlite.introspection.schemaDiff({})` → `{success: false}` (missing `baseline` and `target`)
🔴 32. `sqlite.introspection.constraintAnalysis({})` → success or handler error (no required params)
🔴 33. `sqlite.introspection.migrationRisks({})` → `{success: false}` (missing `statements`)
🔴 34. `sqlite.introspection.storageAnalysis({})` → success or handler error (no required params)
🔴 35. `sqlite.introspection.indexAudit({})` → success or handler error (no required params)
🔴 36. `sqlite.introspection.queryPlan({})` → `{success: false}` (missing `sql`)

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
