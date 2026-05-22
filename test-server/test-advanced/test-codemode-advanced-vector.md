# db-mcp Advanced Stress Test: [vector]

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
