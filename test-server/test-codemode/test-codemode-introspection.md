# db-mcp Code Mode Testing: [introspection]

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

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
> See [`code-map.md`](file:///C:/Users/chris/Desktop/db-mcp/test-server/code-map.md) for the complete test database schema (`test_*` tables).

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
> **Tool Availability & Code Mode**: If a test step requires `sqlite_execute_code` or a setup tool from a *different* group (e.g., `sqlite_write_query`), and that tool is missing from the active MCP registry due to injection scoping, do not fail the group. Use existing seed data/backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing the tools that *are* available.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) A **Zod validation error** (call the tool with `{}` empty params).
   Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
3. **Output Schema Testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
4. **Wrong-Type Coercion**: For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.
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

## Group Focus: introspection

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.introspection.dependencyGraph`
- `sqlite.introspection.topologicalSort`
- `sqlite.introspection.cascadeSimulator`
- `sqlite.introspection.schemaSnapshot`
- `sqlite.introspection.constraintAnalysis`
- `sqlite.introspection.migrationRisks`
- `sqlite.introspection.schemaDiff`
- `sqlite.introspection.storageAnalysis`
- `sqlite.introspection.indexAudit`
- `sqlite.introspection.queryPlan`

## Phase 1: Graph Analysis — Happy Paths (batched)

1. `sqlite.introspection.dependencyGraph({})` → nodes ≥ 2, edges includes `test_orders → test_products` (using `from` and `to`)
2. `sqlite.introspection.topologicalSort({})` → `test_products` before `test_orders` (FK dependency); `hasCycles: false`
3. `sqlite.introspection.cascadeSimulator({table: "test_products"})` → affectedTables includes `test_orders`
4. `sqlite.introspection.cascadeSimulator({table: "test_measurements"})` → affectedTables empty


## Phase 2: Schema Analysis — Happy Paths (batched)

5. `sqlite.introspection.schemaSnapshot({})` → `snapshot.tables` ≥ 11; `stats.indexes` ≥ 4; `generatedAt` present
6. `sqlite.introspection.constraintAnalysis({})` → `findings` array; `summary.totalFindings` ≥ 0
7. `sqlite.introspection.migrationRisks({statements: ["DROP TABLE test_products"]})` → risks non-empty, category is "destructive"
8. `sqlite.introspection.migrationRisks({statements: ["ALTER TABLE test_users ADD COLUMN age INTEGER"]})` → low risk
9. `sqlite.introspection.migrationRisks({statements: ["CREATE TABLE new_table (id INTEGER PRIMARY KEY)", "DROP TABLE test_products"]})` → `summary.totalStatements: 2`, `summary.highestRisk` ≥ "high"
10. `sqlite.introspection.schemaDiff({baseline: "current", target: "current"})` → `summary.totalChanges: 0`, `severity: "none"` (self-diff = no drift)
11. `sqlite.introspection.schemaDiff({baseline: "current", target: "current", sections: ["tables"]})` → `sections.tables` populated, `sections.views`/`indexes`/`triggers` absent


## Phase 3: Diagnostics — Happy Paths (batched)

12. `sqlite.introspection.storageAnalysis({})` → `database.pageSize > 0`, `database.totalPages > 0`; tables array present
13. `sqlite.introspection.indexAudit({})` → `findings` array; redundant index for `idx_orders_status`
14. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_products WHERE category = 'electronics'"})` → plan array non-empty
15. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_orders WHERE status = 'completed'"})` → index scan array contains `idx_orders_status_date`
16. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_products WHERE name = 'Laptop Pro 15'"})` → full scan array contains `test_products` (no index on name)


## Phase 4: Advanced Optional Parameters (batched)

> Test these granular optional parameters. Note: While previously thought to be Code Mode-only, these parameters are actually available in both Code Mode and direct tool calls.

17. `sqlite.introspection.schemaSnapshot({sections: ["tables"]})` → only tables section (no views/indexes)
18. `sqlite.introspection.schemaSnapshot({compact: true})` → compact mode omits columns from table entries
19. `sqlite.introspection.constraintAnalysis({table: "test_orders"})` → filtered to test_orders only
20. `sqlite.introspection.constraintAnalysis({checks: ["unindexed_fk"]})` → filtered to unindexed FK findings
21. `sqlite.introspection.storageAnalysis({includeTableDetails: false})` → database summary only (no tables array)
22. `sqlite.introspection.indexAudit({table: "test_orders"})` → filtered to test_orders indexes only
23. `sqlite.introspection.topologicalSort({direction: "drop"})` → drop order: test_orders before test_products


## Phase 5: Multi-Step Workflow

### 5.1 — Full database audit pipeline

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

### 5.2 — Query optimization analysis

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


## Phase 6: Zod Validation Sweep

🔴 24. `sqlite.introspection.dependencyGraph({})` → success or handler error (no required params)
🔴 25. `sqlite.introspection.topologicalSort({})` → success or handler error (no required params)
🔴 26. `sqlite.introspection.cascadeSimulator({})` → `{success: false}` (missing `table`)
🔴 27. `sqlite.introspection.schemaSnapshot({})` → success or handler error (no required params)
🔴 28. `sqlite.introspection.schemaDiff({})` → `{success: false}` (missing `baseline` and `target`)
🔴 29. `sqlite.introspection.constraintAnalysis({})` → success or handler error (no required params)
🔴 30. `sqlite.introspection.migrationRisks({})` → `{success: false}` (missing `statements`)
🔴 31. `sqlite.introspection.storageAnalysis({})` → success or handler error (no required params)
🔴 32. `sqlite.introspection.indexAudit({})` → success or handler error (no required params)
🔴 33. `sqlite.introspection.queryPlan({})` → `{success: false}` (missing `sql`)

---

> **Note**: No Wrong-Type Numeric Coercion phase is included for this group — none of the introspection tools have optional numeric parameters.

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
