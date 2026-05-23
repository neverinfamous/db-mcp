# db-mcp Code Mode Testing: [vector]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> We're currently testing Native mode.

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

- `sqlite.vector.count`
- `sqlite.vector.dimensions`
- `sqlite.vector.get`
- `sqlite.vector.search`
- `sqlite.vector.distance`
- `sqlite.vector.normalize`
- `sqlite.vector.stats`
- `sqlite.vector.createTable`
- `sqlite.vector.store`
- `sqlite.vector.batchStore`
- `sqlite.vector.delete`
- *(cross-group helpers used in test procedures)*
- `sqlite.core.dropTable`
- `sqlite.core.readQuery`
- `sqlite.core.writeQuery`
- `sqlite.json.extract`

## Phase 1: Vector Read Tools — Happy Paths (batched)

1. `sqlite.vector.count({table: "test_embeddings"})` → `{count: 20}`
2. `sqlite.vector.dimensions({table: "test_embeddings", vectorColumn: "embedding"})` → `{dimensions: 8}`
3. `sqlite.vector.get({table: "test_embeddings", idColumn: "id", vectorColumn: "embedding", id: 1})` → content="Machine learning fundamentals", 8 dims
4. `sqlite.vector.search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 3})` → row 1 first (exact match, similarity ≈ 1)
5. `sqlite.vector.search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 3, whereClause: "category = 'database'"})` → only database results
6. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [0, 1, 0], metric: "cosine"})` → ≈ 1.0 (orthogonal)
7. `sqlite.vector.distance({vector1: [3, 4], vector2: [0, 0], metric: "euclidean"})` → 5.0
8. `sqlite.vector.normalize({vector: [3, 4]})` → `{normalized: [0.6, 0.8], originalMagnitude: 5}`
9. `sqlite.vector.stats({table: "test_embeddings", vectorColumn: "embedding"})` → min/max/avg magnitude


## Phase 2: Vector Write Tools — Happy Paths (temp table)

10. `sqlite.vector.createTable({tableName: "temp_cm_vector", dimensions: 8, additionalColumns: [{name: "content", type: "TEXT"}, {name: "category", type: "TEXT"}]})` → success
11. `sqlite.vector.store({table: "temp_cm_vector", idColumn: "id", vectorColumn: "vector", id: 1, vector: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]})` → success
12. `sqlite.vector.batchStore({table: "temp_cm_vector", idColumn: "id", vectorColumn: "vector", items: [{id: 2, vector: [0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88]}, {id: 3, vector: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]}]})` → `{stored: 2}`
13. `sqlite.vector.count({table: "temp_cm_vector"})` → `{count: 3}`
14. `sqlite.vector.search({table: "temp_cm_vector", vectorColumn: "vector", queryVector: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], metric: "cosine", limit: 2})` → row 1 first
15. `sqlite.vector.delete({table: "temp_cm_vector", idColumn: "id", ids: [1]})` → success
16. `sqlite.vector.count({table: "temp_cm_vector"})` → `{count: 2}`
17. Cleanup: `sqlite.core.dropTable({table: "temp_cm_vector"})`


## Phase 3: Vector Domain Errors (batched)

🔴 18. `sqlite.vector.search({table: "nonexistent_xyz", vectorColumn: "embedding", queryVector: [1,2,3], metric: "cosine"})` → `{success: false}`
🔴 19. `sqlite.vector.distance({vector1: [1, 2, 3], vector2: [1, 2], metric: "cosine"})` → error about dimension mismatch
🔴 20. `sqlite.vector.get({table: "test_embeddings", idColumn: "id", vectorColumn: "embedding", id: 9999})` → report behavior (nonexistent row)


## Phase 4: Multi-Step Workflow

### 4.1 — Similarity search pipeline

```javascript
const failures = [];
// Get first embedding
const row1 = await sqlite.core.readQuery(
  "SELECT embedding FROM test_embeddings WHERE id = 1",
);
const vec = JSON.parse(row1.rows[0].embedding);

// Search for similar
const similar = await sqlite.vector.search({
  table: "test_embeddings",
  vectorColumn: "embedding",
  queryVector: vec,
  metric: "cosine",
  limit: 5,
});
if (!similar || !similar.rows || similar.rows.length < 1)
  failures.push("search returned no results");

// Get stats
const vstats = await sqlite.vector.stats({
  table: "test_embeddings",
  vectorColumn: "embedding",
});
if (!vstats) failures.push("stats failed");

// Distance calc
const dist = await sqlite.vector.distance({
  vector1: vec,
  vector2: vec,
  metric: "cosine",
});
// Self-distance should be 0 (or very close)

return {
  failures,
  success: failures.length === 0,
  resultCount: similar?.rows?.length,
  selfDistance: dist.distance,
};
```

### 4.2 — Create → populate → search → teardown

```javascript
const failures = [];
await sqlite.vector.createTable({
  tableName: "temp_cm_vec_pipe",
  dimensions: 3,
});
await sqlite.vector.batchStore({
  table: "temp_cm_vec_pipe",
  idColumn: "id",
  vectorColumn: "vector",
  items: [
    { id: 1, vector: [1, 0, 0] },
    { id: 2, vector: [0, 1, 0] },
    { id: 3, vector: [0, 0, 1] },
  ],
});
const results = await sqlite.vector.search({
  table: "temp_cm_vec_pipe",
  vectorColumn: "vector",
  queryVector: [1, 0, 0],
  metric: "cosine",
  limit: 3,
});
if (results.rows[0].id !== 1) failures.push("expected row 1 as closest match");
await sqlite.core.dropTable({ table: "temp_cm_vec_pipe" });
return { failures, success: failures.length === 0 };
```


### 4.3 — Vector + JSON cross-group

```javascript
const failures = [];
// Create vector table with metadata column
await sqlite.vector.createTable({
  tableName: "temp_cm_vec_json",
  dimensions: 3,
  additionalColumns: [{ name: "metadata", type: "TEXT" }],
});
// Store vector with JSON metadata
await sqlite.vector.store({
  table: "temp_cm_vec_json",
  idColumn: "id",
  vectorColumn: "vector",
  id: 1,
  vector: [1, 0, 0],
});
await sqlite.core.writeQuery({
  query: `UPDATE temp_cm_vec_json SET metadata = '{"category": "test", "score": 0.95}' WHERE id = 1`,
});
// Search and extract JSON from results
const results = await sqlite.vector.search({
  table: "temp_cm_vec_json",
  vectorColumn: "vector",
  queryVector: [1, 0, 0],
  metric: "cosine",
  limit: 1,
});
if (!results.rows || results.rows.length === 0)
  failures.push("vector search returned no results");
const meta = await sqlite.json.extract({
  table: "temp_cm_vec_json",
  column: "metadata",
  path: "$.category",
  whereClause: "id = 1",
});
if (!meta || meta.success === false)
  failures.push("JSON extract from vector table failed");
await sqlite.core.dropTable({ table: "temp_cm_vec_json" });
return {
  failures,
  success: failures.length === 0,
  searchResult: results,
  jsonMeta: meta,
};
```


## Phase 5: Zod Validation Sweep

🔴 21. `sqlite.vector.createTable({})` → `{success: false}`
🔴 22. `sqlite.vector.store({})` → `{success: false}`
🔴 23. `sqlite.vector.batchStore({})` → `{success: false}`
🔴 24. `sqlite.vector.search({})` → `{success: false}`
🔴 25. `sqlite.vector.get({})` → `{success: false}`
🔴 26. `sqlite.vector.delete({})` → `{success: false}`
🔴 27. `sqlite.vector.count({})` → `{success: false}`
🔴 28. `sqlite.vector.stats({})` → `{success: false}`
🔴 29. `sqlite.vector.dimensions({})` → `{success: false}`
🔴 30. `sqlite.vector.normalize({})` → `{success: false}`
🔴 31. `sqlite.vector.distance({})` → `{success: false}`


## Phase 6: Wrong-Type Numeric Coercion

🔴 32. `sqlite.vector.search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.1, 0.2, 0.3], metric: "cosine", limit: "abc"})` → handler error, NOT raw MCP `-32602`

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
