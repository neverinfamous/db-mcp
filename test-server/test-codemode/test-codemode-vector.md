# db-mcp Code Mode Testing: [vector]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **vector** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js): All 11 vector tools are fully WASM-compatible. No phases to skip or adjust.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — monitor `metrics.tokenEstimate`.

## Test Database Schema

| Table           | Rows | Key Columns                                               |
| --------------- | ---- | --------------------------------------------------------- |
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

1. **Cleanup**: Drop `temp_*` tables
2. **Triage findings**: Create implementation plan if issues found
3. **Scope of fixes**: Handler code, server-instructions, this prompt
4. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
5. **Commit**: Stage and commit — do NOT push
6. **Token audit**: Report most expensive block
7. **Final summary**: After testing/re-testing
