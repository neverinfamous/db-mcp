# db-mcp Advanced Stress Testing: [introspection]

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

> [!IMPORTANT]
> **Testing Code Mode**: Do NOT write test scripts to the filesystem. Pass your JavaScript snippets directly to the `sqlite_execute_code` tool's `code` parameter. Do NOT wrap your tests in monolithic `try/catch` blocks that suppress or transform the server's natural error output. You must allow the server to return its native structured error responses so you can evaluate them against the standards below.

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

All tools should return errors as strongly-typed structured objects instead of throwing. The expected pattern:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "VALIDATION_ERROR",
  "category": "validation",
  "recoverable": false,
  "metrics": { ... }
}
```

| Type                 | Source                                                                          | What you see                                                                                                              | Verdict            |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "...", code: "..."}` | Parseable JSON object with `success`, `error`, `code` (e.g., `VALIDATION_ERROR`, `CONFLICT_ERROR`), and `category` fields | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                                      | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field     | Bug — report as ❌ |

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
- `sqlite.introspection.schemaDiff`
- `sqlite.introspection.constraintAnalysis`
- `sqlite.introspection.migrationRisks`
- `sqlite.introspection.storageAnalysis`
- `sqlite.introspection.indexAudit`
- `sqlite.introspection.queryPlan`

## Phase 1: Graph Analysis Edge Cases (batched)

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

## Phase 2: Schema Snapshot Completeness (batched)

10. `sqlite.introspection.schemaSnapshot({})` → full snapshot:
    - tables ≥ 11 (10 regular + FTS virtual)
    - indexes ≥ 4 (`idx_orders_status`, `idx_orders_date`, `idx_products_category`, `idx_orders_status_date`)
    - generatedAt is valid ISO timestamp
11. `sqlite.introspection.schemaSnapshot({sections: ["indexes"]})` → only indexes section. Tables absent.
12. `sqlite.introspection.schemaSnapshot({sections: ["tables", "indexes"]})` → both sections present
13. `sqlite.introspection.schemaSnapshot({compact: true})` → tables present but columns arrays absent
14. `sqlite.introspection.schemaSnapshot({compact: false})` → column details (name, type, nullable, pk) present

## Phase 3: Constraint Analysis Stress (batched)

15. `sqlite.introspection.constraintAnalysis({})` → all tables analyzed. Verify summary.byType and summary.bySeverity keys.
16. `sqlite.introspection.constraintAnalysis({checks: ["unindexed_fk"]})` → only unindexed FK findings.
17. `sqlite.introspection.constraintAnalysis({table: "test_users"})` → only test_users findings. No other tables referenced.
18. `sqlite.introspection.constraintAnalysis({table: "nonexistent_table_xyz"})` → report behavior: empty findings or structured error?

## Phase 4: Storage Analysis & Index Audit Depth (batched)

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
27. `sqlite.introspection.indexAudit({recommendComposite: true, queriesToAnalyze: ["SELECT * FROM test_users WHERE email = 'test@example.com' AND created_at > '2023-01-01'"]})` → output includes `missing_composite_index` indicating a suggested composite index scan.
28. `sqlite.introspection.indexAudit({recommendComposite: true, queriesToAnalyze: ["INVALID SQL SYNTAX EXPLAIN"]})` → queries should be skipped or result in graceful error reporting, not raw crash.
29. `sqlite.introspection.indexAudit({table: "test_products"})` → only test_products findings. `idx_products_category` NOT redundant.
30. `sqlite.introspection.indexAudit({table: "test_measurements"})` → 200 rows, no secondary indexes. `unindexed_large_table` threshold is 1000 → no finding expected.

## Phase 5: Query Plan Deep Analysis (batched)

31. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_orders WHERE status = 'completed'"})` → use `idx_orders_status_date` (SQLite prefers the multi-column index)
32. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_products WHERE name = 'Laptop Pro 15'"})` → full scan (no index on name). Verify `analysis.fullScans` includes `test_products`, `suggestions` array exists.
33. `sqlite.introspection.queryPlan({sql: "SELECT p.name, o.quantity FROM test_products p JOIN test_orders o ON o.product_id = p.id WHERE o.status = 'completed'"})` → join plan with multiple entries.
34. `sqlite.introspection.queryPlan({sql: "SELECT * FROM test_orders WHERE status = 'completed' AND order_date > '2026-01-20'"})` → compound WHERE. Verify index choice.
35. `sqlite.introspection.queryPlan({sql: "SELECT COUNT(*) FROM test_measurements GROUP BY sensor_id"})` → GROUP BY without dedicated index. Expect full scan.
36. `sqlite.introspection.queryPlan({sql: "WITH top_orders AS (SELECT * FROM test_orders ORDER BY total_price DESC LIMIT 5) SELECT t.*, p.name FROM top_orders t JOIN test_products p ON p.id = t.product_id"})` → CTE + JOIN plan.

## Phase 6: Migration Risk Assessment Depth (batched)

37. `sqlite.introspection.migrationRisks({statements: ["DROP TABLE test_products"]})` → critical/high risk. Mentions FK dependents.
38. `sqlite.introspection.migrationRisks({statements: ["ALTER TABLE test_products ADD COLUMN temp_col TEXT"]})` → low risk (additive)
39. `sqlite.introspection.migrationRisks({statements: ["CREATE INDEX idx_temp ON test_products(name)"]})` → low risk
40. `sqlite.introspection.migrationRisks({statements: ["DROP INDEX idx_orders_status"]})` → medium risk. Verify `riskLevel: "medium"`, `category: "index_removal"`.
41. `sqlite.introspection.migrationRisks({statements: ["ALTER TABLE test_products ADD COLUMN temp1 TEXT", "DROP TABLE test_orders", "CREATE TABLE new_orders (id INTEGER PRIMARY KEY)"]})` → 3 statements, mixed risk. `summary.totalStatements = 3`, `summary.highestRisk ≥ "high"`.

## Phase 7: Schema Diff Stress (batched)

42. `sqlite.introspection.schemaDiff({baseline: "current", target: "current"})` → self-diff: `summary.totalChanges: 0`, `severity: "none"`, all sections empty
43. Mutation-diff workflow:
    ```javascript
    // Take baseline snapshot
    const baseline = (
      await sqlite.introspection.schemaSnapshot({ compact: false })
    ).snapshot;
    // Create temp table to introduce drift
    await sqlite.core.createTable({
      table: "stress_diff_temp",
      columns: [
        { name: "id", type: "INTEGER", primaryKey: true },
        { name: "val", type: "TEXT" },
      ],
    });
    // Diff baseline against current (which now has the extra table)
    const diff = await sqlite.introspection.schemaDiff({
      baseline,
      target: "current",
    });
    // Cleanup
    await sqlite.core.dropTable({ table: "stress_diff_temp" });
    const failures = [];
    if (diff.summary?.totalChanges !== 1)
      failures.push(`expected 1 change, got ${diff.summary?.totalChanges}`);
    if (
      !diff.sections?.tables?.added?.some((t) => t.name === "stress_diff_temp")
    )
      failures.push("stress_diff_temp not in added tables");
    if (diff.summary?.severity !== "low")
      failures.push(
        `expected severity 'low' for add-only, got '${diff.summary?.severity}'`,
      );
    return { failures, success: failures.length === 0, diff: diff.summary };
    ```
44. `sqlite.introspection.schemaDiff({baseline: "current", target: "current", sections: ["indexes"]})` → only `sections.indexes` populated; `sections.tables`/`views`/`triggers` absent
45. `sqlite.introspection.schemaDiff({baseline: "current"})` → Zod error for missing `target` — must be handler error, NOT raw MCP
46. `sqlite.introspection.schemaDiff({})` → Zod error for missing both `baseline` and `target`

## Phase 8: Error Message Quality (batched)

47. `sqlite.introspection.queryPlan({sql: "DELETE FROM test_products WHERE id = 1"})` → structured error rejecting non-SELECT
48. `sqlite.introspection.queryPlan({sql: "SELECT * FROM nonexistent_table_xyz"})` → structured error mentioning table
49. `sqlite.introspection.queryPlan({})` → Zod error for missing `sql` — must be handler error, NOT raw MCP
50. `sqlite.introspection.cascadeSimulator({})` → Zod error for missing `table`
51. `sqlite.introspection.migrationRisks({})` → Zod error for missing `statements`
52. `sqlite.introspection.storageAnalysis({limit: 0})` → Zod error (min: 1)
53. `sqlite.introspection.storageAnalysis({limit: -5})` → Zod error

### Final Cleanup

All tools read-only — no cleanup needed. Confirm `test_products` (16), `test_orders` (20), `test_measurements` (200) unchanged.

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
