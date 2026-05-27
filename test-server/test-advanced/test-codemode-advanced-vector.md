# db-mcp Advanced Stress Testing: [vector]

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

## Group Focus: vector

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.vector.createTable`
- `sqlite.vector.store`
- `sqlite.vector.batchStore`
- `sqlite.vector.search`
- `sqlite.vector.get`
- `sqlite.vector.delete`
- `sqlite.vector.count`
- `sqlite.vector.stats`
- `sqlite.vector.dimensions`
- `sqlite.vector.normalize`
- `sqlite.vector.distance`

## Phase 1: Boundary Values (batched)

> **Note:** `createTable` uses `tableName`, other ops use `table`. Store/batch-store require `idColumn` and `vectorColumn`.

**1.1 Empty Vector Table**

1. `sqlite.vector.createTable({tableName: "stress_vec_empty", dimensions: 4})` → success
2. `sqlite.vector.count({table: "stress_vec_empty"})` → `{count: 0}`
3. `sqlite.vector.search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 2, 3, 4], metric: "cosine", limit: 5})` → empty results (not error)
4. `sqlite.vector.stats({table: "stress_vec_empty", vectorColumn: "vector"})` → graceful: `{count: 0, message: "No valid vectors found"}`
5. `sqlite.vector.dimensions({table: "stress_vec_empty", vectorColumn: "vector"})` → `{dimensions: null, message: "No vectors found"}` (inferred from data)

**1.2 Single-Vector Table**

6. `sqlite.vector.store({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", id: 1, vector: [1, 0, 0, 0]})` → success
7. `sqlite.vector.search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 0, 0, 0], metric: "cosine", limit: 5})` → 1 result, similarity ≈ 1


## Phase 2: Distance Metric Verification (batched)

8. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [0, 1, 0], metric: "cosine"})` → ≈ 1.0 (orthogonal)
9. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [1, 0, 0], metric: "cosine"})` → ≈ 0.0 (identical)
10. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [-1, 0, 0], metric: "cosine"})` → ≈ 2.0 (opposite)
11. `sqlite.vector.distance({vector1: [3, 4], vector2: [0, 0], metric: "euclidean"})` → exactly 5.0
12. `sqlite.vector.distance({vector1: [1, 2, 3], vector2: [1, 2, 3], metric: "euclidean"})` → exactly 0.0
13. `sqlite.vector.normalize({vector: [3, 4]})` → `{normalized: [0.6, 0.8], originalMagnitude: 5.0}`
14. `sqlite.vector.normalize({vector: [0, 0, 0]})` → `{normalized: [0, 0, 0], originalMagnitude: 0}` (zero vector, no crash)


## Phase 3: Dimension Mismatch (batched)

> Dimension validation on store is best-effort. `distance` enforces strictly.

15. `sqlite.vector.store({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", id: 2, vector: [1, 2]})` → dimension mismatch error (table has 4-dim rows)
16. `sqlite.vector.search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 2], metric: "cosine"})` → search runs (dimension mismatch silently handled via try/catch)
17. `sqlite.vector.distance({vector1: [1, 2, 3], vector2: [1, 2], metric: "cosine"})` → structured error: "Vector dimensions must match"


## Phase 4: Batch Operations (batched)

18. `sqlite.vector.batchStore({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", items: []})` → `{stored: 0, message: "No items provided"}`
19. `sqlite.vector.batchStore(...)` with 50 vectors into `stress_vec_empty` → `{stored: 50}`
20. `sqlite.vector.count({table: "stress_vec_empty"})` → `{count: 51}` (1 from earlier + 50 batch)


## Phase 5: Category Filtering (batched)

21. `sqlite.vector.search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 20, whereClause: "category = 'tech'"})` → only tech results (4 rows)
22. `sqlite.vector.search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 20, whereClause: "category = 'nonexistent'"})` → 0 results (not error)


## Phase 6: Error Message Quality (batched)

23. `sqlite.vector.search({table: "nonexistent_table_xyz", vectorColumn: "v", queryVector: [1, 2, 3], metric: "cosine"})` → structured error mentioning table name
24. `sqlite.vector.get({table: "test_embeddings", idColumn: "id", vectorColumn: "embedding", id: 99999})` → `{success: false, error: "Vector not found"}`
25. `sqlite.vector.delete({table: "test_embeddings", idColumn: "id", ids: [99999]})` → `{success: true, deleted: 0}` (idempotent)


### Final Cleanup

Drop `stress_vec_empty`. Confirm `test_embeddings` count is still 20.

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
