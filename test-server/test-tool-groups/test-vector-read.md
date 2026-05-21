# db-mcp (SQLite) Tool Group Testing: [vector-read]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All 7 vector-read tools are fully WASM-compatible. No items to skip or adjust.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **vector-read** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

## Test Database Schema

| Table             | Rows | Columns                                                                       | JSON Columns                                                                              |
| ----------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| test_products     | 16   | id, name, description, price, category, created_at                            | —                                                                                         |
| test_orders       | 20   | id, product_id (FK), customer_name, quantity, total_price, order_date, status | —                                                                                         |
| test_jsonb_docs   | 6    | id, doc, metadata, tags, created_at                                           | **doc**, **metadata** (nested), **tags** (array)                                          |
| test_articles     | 8    | id, title, body, author, category, published_at                               | —                                                                                         |
| test_users        | 9    | id, username, email, phone, bio, created_at                                   | —                                                                                         |
| test_measurements | 200  | id, sensor_id, temperature, humidity, pressure, measured_at                   | —                                                                                         |
| test_embeddings   | 20   | id, content, category, embedding                                              | **embedding** (8-dim float array); category values: database, fitness, food, tech, travel |
| test_locations    | 15   | id, name, city, latitude, longitude, type                                     | —                                                                                         |
| test_categories   | 17   | id, name, path, level                                                         | —                                                                                         |
| test_events       | 100  | id, event_type, user_id (INT, 8 values), payload, event_date                  | **payload** (JSON)                                                                        |

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
3. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                      | Verdict            |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields           | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, `isError: true` — no `success` field      | Bug — report as ❌ |

### Zod Validation Errors

**Zod refinement leak pattern:** `.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. **Fix:** Remove refinements from schema, validate inside handler.

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

---

## Group Focus: vector-read

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

> **Note:** Vector tools use pure JS computations (cosine, euclidean, dot product) with JSON-stored vectors — no native SQLite extension required. All 11 tools work identically in both WASM and Native modes.

### vector-read Group Tools (7)

1. sqlite_vector_search
2. sqlite_vector_get
3. sqlite_vector_count
4. sqlite_vector_stats
5. sqlite_vector_dimensions
6. sqlite_vector_distance
7. sqlite_vector_normalize

**Test data:** `test_embeddings` (20 rows, 8-dim vectors, categories: tech, database, food, fitness, travel). Row 1: content="Machine learning fundamentals", embedding=[0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01].

**Checklist:**

1. `sqlite_vector_count({table: "test_embeddings"})` → `{count: 20}`
2. `sqlite_vector_dimensions({table: "test_embeddings", vectorColumn: "embedding"})` → `{dimensions: 8}`
3. `sqlite_vector_get({table: "test_embeddings", idColumn: "id", vectorColumn: "embedding", id: 1})` → verify content="Machine learning fundamentals", category="tech", embedding has 8 dimensions
4. `sqlite_vector_search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 3})` → top result should be row 1 (exact match, \_similarity ≈ 1)
5. `sqlite_vector_search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 3, whereClause: "category = 'database'"})` → only database category results
6. `sqlite_vector_distance({vector1: [1, 0, 0], vector2: [0, 1, 0], metric: "cosine"})` → distance ≈ 1.0 (orthogonal vectors)
7. `sqlite_vector_distance({vector1: [3, 4], vector2: [0, 0], metric: "euclidean"})` → distance = 5.0
8. `sqlite_vector_normalize({vector: [3, 4]})` → `{normalized: [0.6, 0.8], originalMagnitude: 5}`
9. `sqlite_vector_stats({table: "test_embeddings", vectorColumn: "embedding"})` → verify min/max/avg magnitude

**Code mode testing:**

10. `sqlite_execute_code({code: "const result = await sqlite.vector.count({table: 'test_embeddings'}); return result;"})` → `{count: 20}`
11. `sqlite_execute_code({code: "const result = await sqlite.vector.distance({vector1: [3, 4], vector2: [0, 0], metric: 'euclidean'}); return result;"})` → distance = 5.0

**Error path testing:**

🔴 12. `sqlite_vector_search({table: "nonexistent_table_xyz", vectorColumn: "embedding", queryVector: [1,2,3], metric: "cosine"})` → structured error
🔴 13. `sqlite_vector_distance({vector1: [1, 2, 3], vector2: [1, 2], metric: "cosine"})` → error about dimension mismatch

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 14. `sqlite_vector_search({})` → handler error
🔴 15. `sqlite_vector_get({})` → handler error
🔴 16. `sqlite_vector_count({})` → handler error
🔴 17. `sqlite_vector_stats({})` → handler error
🔴 18. `sqlite_vector_dimensions({})` → handler error
🔴 19. `sqlite_vector_normalize({})` → handler error
🔴 20. `sqlite_vector_distance({})` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing
