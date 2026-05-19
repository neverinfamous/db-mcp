# db-mcp (SQLite) Tool Group Testing: [vector]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All 11 vector tools are fully WASM-compatible. No items to skip or adjust.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **vector** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Report the response size in KB and suggest a concrete optimization.

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

> **Note:** When testing `sqlite_execute_code`, do **not** pass `readonly: true` unless specifically testing read-only filtering.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Report all failures, unexpected behaviors, or unnecessarily large payloads
4. Do not mention what already works well or issues documented in help resources
5. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
6. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.
7. **Deterministic checklist first**: Complete ALL items before freeform exploration.
8. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

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

- Raw MCP error (no `success` field) → report as ❌
- `{success: false, error: "..."}` → correct
- Successful response for invalid input → report as ⚠️

### Wrong-Type Numeric Parameter Coercion

For tools with optional numeric parameters (`limit`), call with `param: "abc"`. Must NOT return raw MCP `-32602`.

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

### Error Consistency Audit

1. Raw error instead of `{success: false}` → ❌
2. Must use `error` field name
3. Orphaned/inline output schemas → ⚠️

### Split Schema Pattern Verification

Verify parameter visibility and alias acceptance.

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_`
- If DROP fails due to database lock, move on.

---

## Group Focus: vector

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

> **Note:** Vector tools use pure JS computations (cosine, euclidean, dot product) with JSON-stored vectors — no native SQLite extension required. All 11 tools work identically in both WASM and Native modes.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### vector Group Tools (11)

4. sqlite_vector_create_table
5. sqlite_vector_store
6. sqlite_vector_batch_store
7. sqlite_vector_search
8. sqlite_vector_get
9. sqlite_vector_delete
10. sqlite_vector_count
11. sqlite_vector_stats
12. sqlite_vector_dimensions
13. sqlite_vector_normalize
14. sqlite_vector_distance
15. sqlite_execute_code

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

**Write operations (use temp tables):**

10. `sqlite_vector_create_table({tableName: "temp_vector_test", dimensions: 8, additionalColumns: [{name: "content", type: "TEXT"}, {name: "category", type: "TEXT"}]})` → success
11. `sqlite_vector_store({table: "temp_vector_test", idColumn: "id", vectorColumn: "vector", id: 1, vector: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]})` → success
12. `sqlite_vector_batch_store({table: "temp_vector_test", idColumn: "id", vectorColumn: "vector", items: [{id: 2, vector: [0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88]}, {id: 3, vector: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]}]})` → `{stored: 2}`
13. `sqlite_vector_count({table: "temp_vector_test"})` → `{count: 3}`
14. `sqlite_vector_delete({table: "temp_vector_test", idColumn: "id", ids: [1]})` → success
15. `sqlite_vector_count({table: "temp_vector_test"})` → `{count: 2}`
16. Cleanup: `sqlite_drop_table({table: "temp_vector_test"})`

**Code mode testing:**

17. `sqlite_execute_code({code: "const result = await sqlite.vector.count({table: 'test_embeddings'}); return result;"})` → `{count: 20}`
18. `sqlite_execute_code({code: "const result = await sqlite.vector.distance({vector1: [3, 4], vector2: [0, 0], metric: 'euclidean'}); return result;"})` → distance = 5.0

**Error path testing:**

🔴 19. `sqlite_vector_search({table: "nonexistent_table_xyz", vectorColumn: "embedding", queryVector: [1,2,3], metric: "cosine"})` → structured error
🔴 20. `sqlite_vector_distance({vector1: [1, 2, 3], vector2: [1, 2], metric: "cosine"})` → error about dimension mismatch

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 21. `sqlite_vector_create_table({})` → handler error
🔴 22. `sqlite_vector_store({})` → handler error
🔴 23. `sqlite_vector_batch_store({})` → handler error
🔴 24. `sqlite_vector_search({})` → handler error
🔴 25. `sqlite_vector_get({})` → handler error
🔴 26. `sqlite_vector_delete({})` → handler error
🔴 27. `sqlite_vector_count({})` → handler error
🔴 28. `sqlite_vector_stats({})` → handler error
🔴 29. `sqlite_vector_dimensions({})` → handler error
🔴 30. `sqlite_vector_normalize({})` → handler error
🔴 31. `sqlite_vector_distance({})` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing

---

## Troubleshooting

### Database is locked / file in use

1. Check for Node.js processes: `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"`
2. WAL/journal files are normal

### Reset script fails

1. Run with `-Verbose`: `.\reset-database.ps1 -Verbose`
