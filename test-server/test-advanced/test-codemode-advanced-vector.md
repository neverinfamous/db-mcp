# db-mcp Advanced Stress Test: [vector]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md` with any/all changes/fixes.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
> *No specific table schema required for this test group.*

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
5. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
6. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
7. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

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

## vector Group Tools (11)

8. sqlite_vector_create_table
9. sqlite_vector_store
10. sqlite_vector_batch_store
11. sqlite_vector_search
12. sqlite_vector_get
13. sqlite_vector_delete
14. sqlite_vector_count
15. sqlite_vector_stats
16. sqlite_vector_dimensions
17. sqlite_vector_normalize
18. sqlite_vector_distance

---

## Phase 1: Boundary Values (batched)

> **Note:** `createTable` uses `tableName`, other ops use `table`. Store/batch-store require `idColumn` and `vectorColumn`.

**1.1 Empty Vector Table**

19. `sqlite.vector.createTable({tableName: "stress_vec_empty", dimensions: 4})` → success
20. `sqlite.vector.count({table: "stress_vec_empty"})` → `{count: 0}`
21. `sqlite.vector.search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 2, 3, 4], metric: "cosine", limit: 5})` → empty results (not error)
22. `sqlite.vector.stats({table: "stress_vec_empty", vectorColumn: "vector"})` → graceful: `{count: 0, message: "No valid vectors found"}`
23. `sqlite.vector.dimensions({table: "stress_vec_empty", vectorColumn: "vector"})` → `{dimensions: null, message: "No vectors found"}` (inferred from data)

**1.2 Single-Vector Table**

24. `sqlite.vector.store({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", id: 1, vector: [1, 0, 0, 0]})` → success
25. `sqlite.vector.search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 0, 0, 0], metric: "cosine", limit: 5})` → 1 result, similarity ≈ 1

---

## Phase 2: Distance Metric Verification (batched)

26. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [0, 1, 0], metric: "cosine"})` → ≈ 1.0 (orthogonal)
27. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [1, 0, 0], metric: "cosine"})` → ≈ 0.0 (identical)
28. `sqlite.vector.distance({vector1: [1, 0, 0], vector2: [-1, 0, 0], metric: "cosine"})` → ≈ 2.0 (opposite)
29. `sqlite.vector.distance({vector1: [3, 4], vector2: [0, 0], metric: "euclidean"})` → exactly 5.0
30. `sqlite.vector.distance({vector1: [1, 2, 3], vector2: [1, 2, 3], metric: "euclidean"})` → exactly 0.0
31. `sqlite.vector.normalize({vector: [3, 4]})` → `{normalized: [0.6, 0.8], originalMagnitude: 5.0}`
32. `sqlite.vector.normalize({vector: [0, 0, 0]})` → `{normalized: [0, 0, 0], originalMagnitude: 0}` (zero vector, no crash)

---

## Phase 3: Dimension Mismatch (batched)

> Dimension validation on store is best-effort. `distance` enforces strictly.

33. `sqlite.vector.store({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", id: 2, vector: [1, 2]})` → dimension mismatch error (table has 4-dim rows)
34. `sqlite.vector.search({table: "stress_vec_empty", vectorColumn: "vector", queryVector: [1, 2], metric: "cosine"})` → search runs (dimension mismatch silently handled via try/catch)
35. `sqlite.vector.distance({vector1: [1, 2, 3], vector2: [1, 2], metric: "cosine"})` → structured error: "Vector dimensions must match"

---

## Phase 4: Batch Operations (batched)

36. `sqlite.vector.batchStore({table: "stress_vec_empty", idColumn: "id", vectorColumn: "vector", items: []})` → `{stored: 0, message: "No items provided"}`
37. `sqlite.vector.batchStore(...)` with 50 vectors into `stress_vec_empty` → `{stored: 50}`
38. `sqlite.vector.count({table: "stress_vec_empty"})` → `{count: 51}` (1 from earlier + 50 batch)

---

## Phase 5: Category Filtering (batched)

39. `sqlite.vector.search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 20, whereClause: "category = 'tech'"})` → only tech results (4 rows)
40. `sqlite.vector.search({table: "test_embeddings", vectorColumn: "embedding", queryVector: [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01], metric: "cosine", limit: 20, whereClause: "category = 'nonexistent'"})` → 0 results (not error)

---

## Phase 6: Error Message Quality (batched)

41. `sqlite.vector.search({table: "nonexistent_table_xyz", vectorColumn: "v", queryVector: [1, 2, 3], metric: "cosine"})` → structured error mentioning table name
42. `sqlite.vector.get({table: "test_embeddings", idColumn: "id", vectorColumn: "embedding", id: 99999})` → `{success: false, error: "Vector not found"}`
43. `sqlite.vector.delete({table: "test_embeddings", idColumn: "id", ids: [99999]})` → `{success: true, deleted: 0}` (idempotent)

---

### Final Cleanup

Drop `stress_vec_empty`. Confirm `test_embeddings` count is still 20.

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
