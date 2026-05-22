# db-mcp Tool Group Testing: [vector]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **vector** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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

--------------- | ---- | --------------------------------------------------------- |
| test_embeddings | 20   | id, content, category, embedding (8-dim JSON float array) |

**Categories**: database, fitness, food, tech, travel (each ~4 rows)
**Row 1**: content="Machine learning fundamentals", category="tech", embedding=[0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01]

> Vector tools use pure JS computations (cosine, euclidean, dot product) with JSON-stored vectors — no native extension required. All 11 tools work identically in both WASM and Native modes.

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

## Cleanup

- Temporary tables: `temp_*` prefix. Drop at end of script.

---

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

---

## Phase 2: Vector Write Tools — Happy Paths (temp table)

10. `sqlite.vector.createTable({tableName: "temp_cm_vector", dimensions: 8, additionalColumns: [{name: "content", type: "TEXT"}, {name: "category", type: "TEXT"}]})` → success
11. `sqlite.vector.store({table: "temp_cm_vector", idColumn: "id", vectorColumn: "vector", id: 1, vector: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]})` → success
12. `sqlite.vector.batchStore({table: "temp_cm_vector", idColumn: "id", vectorColumn: "vector", items: [{id: 2, vector: [0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88]}, {id: 3, vector: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]}]})` → `{stored: 2}`
13. `sqlite.vector.count({table: "temp_cm_vector"})` → `{count: 3}`
14. `sqlite.vector.search({table: "temp_cm_vector", vectorColumn: "vector", queryVector: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], metric: "cosine", limit: 2})` → row 1 first
15. `sqlite.vector.delete({table: "temp_cm_vector", idColumn: "id", ids: [1]})` → success
16. `sqlite.vector.count({table: "temp_cm_vector"})` → `{count: 2}`
17. Cleanup: `sqlite.core.dropTable({tableName: "temp_cm_vector"})`

---

## Phase 3: Vector Domain Errors (batched)

🔴 18. `sqlite.vector.search({table: "nonexistent_xyz", vectorColumn: "embedding", queryVector: [1,2,3], metric: "cosine"})` → `{success: false}`
🔴 19. `sqlite.vector.distance({vector1: [1, 2, 3], vector2: [1, 2], metric: "cosine"})` → error about dimension mismatch
🔴 20. `sqlite.vector.get({table: "test_embeddings", idColumn: "id", vectorColumn: "embedding", id: 9999})` → report behavior (nonexistent row)

---

## Phase 4: Vector Zod Validation (batched)

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

---

## Phase 5: Multi-Step Workflow

### 5.1 — Similarity search pipeline

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

### 5.2 — Create → populate → search → teardown

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
await sqlite.core.dropTable({ tableName: "temp_cm_vec_pipe" });
return { failures, success: failures.length === 0 };
```

---

### 5.3 — Vector + JSON cross-group

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
await sqlite.core.dropTable({ tableName: "temp_cm_vec_json" });
return {
  failures,
  success: failures.length === 0,
  searchResult: results,
  jsonMeta: meta,
};
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
