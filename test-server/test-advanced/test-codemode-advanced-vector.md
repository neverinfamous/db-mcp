# Advanced Stress Test — db-mcp — [vector]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're in Native mode. If there is nothing to fix, don't update UNRELEASED.md.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode).

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js): All 11 vector tools are fully WASM-compatible. No categories to skip or adjust.

## Code Mode Execution

- **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

All tests via `sqlite_execute_code`. Use `sqlite.vector.*` for vector tools, `sqlite.core.*` for read/write.
State persists across calls. Do NOT pass `readonly: true`. Group related tests into single calls.

## Test Database Schema

| Table           | Rows | Key Columns                                                     |
| --------------- | ---- | --------------------------------------------------------------- |
| test_embeddings | 20   | id, content, category, embedding (8-dim JSON float array)       |

**Categories**: database, fitness, food, tech, travel (each ~4 rows)
**Row 1**: content="Machine learning fundamentals", embedding=[0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01]

> Vector tools use pure JS computations with JSON-stored vectors — all 11 tools work identically in WASM and Native.

## Naming & Cleanup

- **Temporary tables**: `stress_*` prefix. Drop at end.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`) | ✅ Confirmed (inline only)

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## vector Group Tools (11)

1. sqlite_vector_create_table
2. sqlite_vector_store
3. sqlite_vector_batch_store
4. sqlite_vector_search
5. sqlite_vector_get
6. sqlite_vector_delete
7. sqlite_vector_count
8. sqlite_vector_stats
9. sqlite_vector_dimensions
10. sqlite_vector_normalize
11. sqlite_vector_distance

---

### Category 1: Boundary Values

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

---

### Category 2: Distance Metric Verification

8. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [0, 1, 0], metric: "cosine"})` → ≈ 1.0 (orthogonal)
9. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [1, 0, 0], metric: "cosine"})` → ≈ 0.0 (identical)
10. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [-1, 0, 0], metric: "cosine"})` → ≈ 2.0 (opposite)
11. `sqlite.vector.distance({vector1: [3, 4], vector2: [0, 0], metric: "euclidean"})` → exactly 5.0
12. `sqlite.vector.distance({vector1: [1, 2, 3], vector2: [1, 2, 3], metric: "euclidean"})` → exactly 0.0
13. `sqlite.vector.normalize({vector: [3, 4]})` → `{normalized: [0.6, 0.8], originalMagnitude: 5.0}`
14. `sqlite.vector.normalize({vector: [0, 0, 0]})` → `{normalized: [0, 0, 0], originalMagnitude: 0}` (zero vector, no crash)

---

### Category 3: Dimension Mismatch

> Dimension validation on store is best-effort. `distance` enforces strictly.

15. `sqlite.vector.store({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", id: 2, vector: [1, 2]})` → dimension mismatch error (table has 4-dim rows)
16. `sqlite.vector.search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 2], metric: "cosine"})` → search runs (dimension mismatch silently handled via try/catch)
17. `sqlite.vector.distance({vector1: [1, 2, 3], vector2: [1, 2], metric: "cosine"})` → structured error: "Vector dimensions must match"

---

### Category 4: Batch Operations

18. `sqlite.vector.batchStore({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", items: []})` → `{stored: 0, message: "No items provided"}`
19. `sqlite.vector.batchStore(...)` with 50 vectors into `stress_vec_empty` → `{stored: 50}`
20. `sqlite.vector.count({table: "stress_vec_empty"})` → `{count: 51}` (1 from earlier + 50 batch)

---

### Category 5: Category Filtering

21. `sqlite.vector.search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 20, whereClause: "category = 'tech'"})` → only tech results (4 rows)
22. `sqlite.vector.search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 20, whereClause: "category = 'nonexistent'"})` → 0 results (not error)

---

### Category 6: Error Message Quality

23. `sqlite.vector.search({table: "nonexistent_table_xyz", vectorColumn: "v", queryVector: [1, 2, 3], metric: "cosine"})` → structured error mentioning table name
24. `sqlite.vector.get({table: "test_embeddings", idColumn: "id", vectorColumn: "embedding", id: 99999})` → `{success: false, error: "Vector not found"}`
25. `sqlite.vector.delete({table: "test_embeddings", idColumn: "id", ids: [99999]})` → `{success: true, deleted: 0}` (idempotent)

---

### Final Cleanup

Drop `stress_vec_empty`. Confirm `test_embeddings` count is still 20.

## Post-Test Procedures

1. **Cleanup**: Drop all `stress_*` objects
2. **Fix EVERY finding** — ❌, ⚠️, 📦
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Re-test**: After server rebuild
6. **Token audit**: Report most expensive block
