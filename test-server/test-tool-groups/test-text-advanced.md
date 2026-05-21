# db-mcp Tool Group Testing: [text-advanced]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js), apply these adjustments:
>
> - **Skip FTS5 tools** (items 5-9: `sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`, `sqlite_fts_headline`) — `[NATIVE ONLY]`. These tools are not registered in WASM and direct calls will fail with "unknown tool".
> - **Skip FTS5 checklist items** 6-11 — all require FTS5 tools.
> - **Skip error items** for FTS5 (item 14).
> - **Skip Zod items** for FTS5 (items 20-24).

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **text-advanced** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

## Test Database Schema

The test database (test-server/test.db) contains these tables with JSON-relevant columns:

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
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

1. Use existing `test_*` tables for read operations.
2. Create temporary tables with `temp_*` prefix for write operations.
3. Test each tool with realistic inputs based on the schema above.
4. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads.
5. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) a domain error and (b) a **Zod validation error** (call the tool with `{}` empty params). Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
6. **Output schema testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
7. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

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

### Output Schema Validation Errors

The MCP SDK enforces `additionalProperties: false` on **output** schemas. If a handler returns fields not declared in its output schema, the SDK rejects the response with a raw `-32602` error.

**How to detect:** If a tool call with **correct, valid inputs** returns a raw MCP `-32602` mentioning "does not match the tool's output schema" or "additional properties", report as ❌ with both the tool name and the missing field(s).

### Error Consistency Audit

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌.
2. **Error field name**: All `{success: false}` responses should use `error` as the field name.
3. **Zod validation leaks**: If calling a tool with missing required field produces a raw MCP `-32602` error instead of a structured response, report as ❌.
4. **Output schema leaks**: If calling a tool with valid inputs produces a raw MCP `-32602` mentioning "output schema", report as ❌.

---

## Group Focus: text-advanced

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

> **FTS Testing Notes:** After `sqlite_fts_create`, always call `sqlite_fts_rebuild` before searching. `test_articles` searchable terms: `SQLite`, `database`, `JSON`, `FTS`, `vector`, `API`, `search`, `MCP`.

### text-advanced Group Tools (9)

1. sqlite_fuzzy_match
2. sqlite_phonetic_match
3. sqlite_advanced_search
4. sqlite_text_sentiment
5. sqlite_fts_create `[NATIVE ONLY]`
6. sqlite_fts_search `[NATIVE ONLY]`
7. sqlite_fts_rebuild `[NATIVE ONLY]`
8. sqlite_fts_match_info `[NATIVE ONLY]`
9. sqlite_fts_headline `[NATIVE ONLY]`

**Checklist:**

1. `sqlite_fuzzy_match({table: "test_products", column: "name", search: "Laptp", maxDistance: 3})` → results include `Laptop Pro 15`
2. `sqlite_fuzzy_match({table: "test_products", column: "name", search: "Laptp", tokenize: false})` → verify behavior without tokenization
3. `sqlite_phonetic_match({table: "test_products", column: "name", search: "Labtop"})` → should find `Laptop Pro 15` via Soundex (both produce L131)
4. `sqlite_phonetic_match({table: "test_products", column: "name", search: "Labtop", algorithm: "metaphone"})` → test metaphone algorithm
5. `sqlite_advanced_search({table: "test_products", column: "name", searchTerm: "keyboard", techniques: ["exact", "fuzzy", "phonetic"]})` → should find `Mechanical Keyboard`
6. `sqlite_advanced_search({table: "test_products", column: "name", searchTerm: "Labtop", techniques: ["phonetic"]})` → test with single technique

**FTS5 tools `[NATIVE ONLY]`:**

7. `sqlite_fts_create({sourceTable: "test_users", columns: ["username", "bio"], ftsTable: "temp_users_fts"})` → FTS5 virtual table created
8. `sqlite_fts_rebuild({table: "temp_users_fts"})` → rebuild index before searching
9. `sqlite_fts_search({table: "temp_users_fts", query: "test*"})` → verify results from test_users data (prefix query needed since no standalone "test" token exists)
10. Cleanup: `sqlite_drop_table({table: "temp_users_fts"})` (drop the temp FTS table using sqlite_write_query or core drop_table)
11. `sqlite_fts_search({table: "test_articles_fts", query: "SQLite"})` → at least 1 result (article 1: "Introduction to SQLite")
12. `sqlite_fts_search({table: "test_articles_fts", query: "MCP protocol"})` → matches article 3: "The Model Context Protocol Explained"
13. `sqlite_fts_search({table: "test_articles_fts", query: "nonexistent_term_xyz"})` → 0 results
14. `sqlite_fts_match_info({table: "test_articles_fts", query: "database"})` → match info with scoring data
15. `sqlite_fts_rebuild({table: "test_articles_fts"})` → success

**Error path testing:**

🔴 16. `sqlite_fuzzy_match({table: "test_users", column: "nonexistent_col", search: "test"})` → structured error with code `COLUMN_NOT_FOUND`
🔴 17. `sqlite_fts_search({table: "nonexistent_fts_xyz", query: "test"})` `[NATIVE ONLY]` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 18. `sqlite_fuzzy_match({})` → handler error
🔴 19. `sqlite_phonetic_match({})` → handler error
🔴 20. `sqlite_advanced_search({})` → handler error
🔴 21. `sqlite_text_sentiment({})` → handler error
🔴 22. `sqlite_fts_create({})` `[NATIVE ONLY]` → handler error
🔴 23. `sqlite_fts_search({})` `[NATIVE ONLY]` → handler error
🔴 24. `sqlite_fts_rebuild({})` `[NATIVE ONLY]` → handler error
🔴 25. `sqlite_fts_match_info({})` `[NATIVE ONLY]` → handler error
🔴 26. `sqlite_fts_headline({})` `[NATIVE ONLY]` → handler error

---

## Post-Test Procedures

### Reporting Rules

- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in help resources and runtime hints

### After Testing

1. **Triage findings**: If issues were found, create an implementation plan. If the plan requires no user decisions, proceed directly to implementation
2. **Scope of fixes** includes corrections to handler code, `src/constants/server-instructions/*.md`, test database, or this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: Test fixes with direct MCP tool calls after server rebuild
6. **Final summary**: Provide summary after testing/re-testing confirms fixes
