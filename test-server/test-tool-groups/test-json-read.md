# db-mcp Tool Group Testing: [json-read]

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

## Group Focus: json-read

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### json-read Group Tools (19)

8. sqlite_json_valid
9. sqlite_json_extract
10. sqlite_json_type
11. sqlite_json_array_length
12. sqlite_json_keys
13. sqlite_json_each
14. sqlite_json_group_array
15. sqlite_json_group_object
16. sqlite_json_pretty
17. sqlite_jsonb_convert
18. sqlite_json_storage_info
19. sqlite_json_normalize_column
20. sqlite_json_select
21. sqlite_json_query
22. sqlite_json_validate_path
23. sqlite_json_analyze_schema
24. sqlite_json_security_scan
25. sqlite_json_diff
26. sqlite_execute_code

**Test data reference (test_jsonb_docs):**

| id  | doc.type | doc.author | doc.views | metadata.source | tags                                 |
| --- | -------- | ---------- | --------- | --------------- | ------------------------------------ |
| 1   | article  | Alice      | 1250      | blog            | ["database","tutorial","beginner"]   |
| 2   | article  | Bob        | 890       | docs            | ["json","advanced","sqlite"]         |
| 3   | video    | Carol      | 5400      | youtube         | ["mcp","protocol","ai"]              |
| 4   | article  | David      | 670       | wiki            | ["fts5","search","indexing"]         |
| 5   | podcast  | Eve        | —         | spotify         | ["performance","tips","podcast"]     |
| 6   | article  | Frank      | 2100      | medium          | ["vector","embeddings","similarity"] |

Row 4 has nested path: `doc → nested → level1 → level2 = "deep value"`

## Phase 1: Core Check (batched)

27. `sqlite_json_extract({table: "test_jsonb_docs", column: "doc", path: "$.author", whereClause: "id = 1"})` → result contains `"Alice"`
28. `sqlite_json_extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.level2", whereClause: "id = 4"})` → result contains `"deep value"`
29. `sqlite_json_keys({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → keys include `type`, `title`, `author`, `views`, `rating`
30. `sqlite_json_type({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → `"array"`
31. `sqlite_json_type({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → `"object"`
32. `sqlite_json_array_length({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → `3`
33. `sqlite_json_valid({json: "{\"type\":\"article\",\"title\":\"Getting Started with SQLite\",\"author\":\"Alice\",\"views\":1250,\"rating\":4.5}"})` → `{valid: true}`
34. `sqlite_json_validate_path({path: "$.author"})` → valid
35. `sqlite_json_pretty({json: "{\"type\":\"article\",\"author\":\"Alice\",\"views\":1250}"})` → formatted JSON with indentation
36. `sqlite_json_each({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1", limit: 2})` → exactly 2 expanded rows: `database`, `tutorial` (Tests `limit` parameter)
37. `sqlite_json_analyze_schema({table: "test_jsonb_docs", column: "doc"})` → inferred schema with `type`, `author`, etc.
38. `sqlite_json_select({table: "test_jsonb_docs", column: "doc", paths: ["$.author", "$.views"]})` → rows with author and views columns
39. `sqlite_json_query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article"}, limit: 2})` → exactly 2 rows (Tests `limit` parameter)
40. `sqlite_json_storage_info({table: "test_jsonb_docs", column: "doc"})` → storage analysis
41. `sqlite_json_group_array({table: "test_jsonb_docs", valueColumn: "json_extract(doc, '$.author')", allowExpressions: true})` → array of all authors
42. `sqlite_json_group_object({table: "test_jsonb_docs", valueColumn: "json_extract(doc, '$.views')", allowExpressions: true})` → object mapping keys (rowid by default) to view counts (Tests missing groupByColumn parameter)
43. `sqlite_jsonb_convert({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → JSONB binary conversion result
44. `sqlite_json_normalize_column({table: "test_jsonb_docs", column: "doc", outputFormat: "text"})` → normalization report for the doc column as raw text (Tests `outputFormat` parameter)
45. `sqlite_json_security_scan({table: "test_events", column: "payload"})` → security scan report
46. `sqlite_json_diff({table: "test_jsonb_docs", column: "doc", path1: "$.type", path2: "$.author"})` → `diffs` array with per-row comparisons showing `path1Value`, `path2Value`, `identical` (should be `false` for most rows since type≠author)
47. `sqlite_json_diff({table: "test_jsonb_docs", column: "doc", path1: "$.type", path2: "$.type"})` → all rows `identical: true` (same path compared to itself)

**Code mode testing:**

48. `sqlite_execute_code({code: "const result = await sqlite.json.extract({table: 'test_jsonb_docs', column: 'doc', path: '$.author', whereClause: 'id = 1'}); return result;"})` → result contains `"Alice"`
49. `sqlite_execute_code({code: "const keys = await sqlite.json.keys({table: 'test_jsonb_docs', column: 'doc', whereClause: 'id = 1'}); return keys;"})` → keys include `type`, `title`, `author`

**Error path testing:**

🔴 50. `sqlite_json_extract({table: "nonexistent_table_xyz", column: "doc", path: "$.x"})` → structured error
🔴 51. `sqlite_json_extract({table: "test_jsonb_docs", column: "nonexistent_col", path: "$.x"})` → report behavior
🔴 52. `sqlite_json_validate_path({path: "invalid path !@#"})` → report behavior
🔴 53. `sqlite_json_diff({table: "nonexistent_xyz", column: "doc", path1: "$.x", path2: "$.y"})` → `{success: false}`

## Phase 2: Zod Validation Sweep

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error (`{success: false, error: "Validation error: ..."}`), NOT raw MCP error:

🔴 54. `sqlite_json_valid({})` → handler error
🔴 55. `sqlite_json_extract({})` → handler error
🔴 56. `sqlite_json_type({})` → handler error
🔴 57. `sqlite_json_array_length({})` → handler error
🔴 58. `sqlite_json_keys({})` → handler error
🔴 59. `sqlite_json_each({})` → handler error
🔴 60. `sqlite_json_group_array({})` → handler error
🔴 61. `sqlite_json_group_object({})` → handler error
🔴 62. `sqlite_json_pretty({})` → handler error
🔴 63. `sqlite_jsonb_convert({})` → handler error
🔴 64. `sqlite_json_storage_info({})` → handler error
🔴 65. `sqlite_json_normalize_column({})` → handler error
🔴 66. `sqlite_json_select({})` → handler error
🔴 67. `sqlite_json_query({})` → handler error
🔴 68. `sqlite_json_validate_path({})` → handler error
🔴 69. `sqlite_json_analyze_schema({})` → handler error
🔴 70. `sqlite_json_security_scan({})` → handler error
🔴 71. `sqlite_json_diff({})` → handler error
🔴 72. `sqlite_execute_code({})` → handler error


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
