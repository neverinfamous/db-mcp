# db-mcp Code Mode Testing: [json]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

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

## Group Focus: json

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.json.extract`
- `sqlite.json.keys`
- `sqlite.json.type`
- `sqlite.json.arrayLength`
- `sqlite.json.valid`
- `sqlite.json.validatePath`
- `sqlite.json.pretty`
- `sqlite.json.each`
- `sqlite.json.analyzeSchema`
- `sqlite.json.select`
- `sqlite.json.query`
- `sqlite.json.storageInfo`
- `sqlite.json.groupArray`
- `sqlite.json.groupObject`
- `sqlite.json.jsonbConvert`
- `sqlite.json.normalizeColumn`
- `sqlite.json.securityScan`
- `sqlite.json.diff`
- `sqlite.json.createJsonCollection`
- `sqlite.json.set`
- `sqlite.json.update`
- `sqlite.json.insert`
- `sqlite.json.remove`
- `sqlite.json.arrayAppend`
- `sqlite.json.merge`
- `sqlite.core.writeQuery`
- `sqlite.stats.statsBasic`

## Phase 1: JSON Read Tools — Happy Paths (batched)

> Bundle items 1-19 into 1-2 `sqlite_execute_code` calls.

1. `sqlite.json.extract({table: "test_jsonb_docs", column: "doc", path: "$.author", whereClause: "id = 1"})` → contains `"Alice"`
2. `sqlite.json.extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.level2", whereClause: "id = 4"})` → `"deep value"`
3. `sqlite.json.keys({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → keys include `type`, `title`, `author`, `views`, `rating`
4. `sqlite.json.type({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → `"array"`
5. `sqlite.json.type({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → `"object"`
6. `sqlite.json.arrayLength({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → `3`
7. `sqlite.json.valid({json: '{"type":"article","author":"Alice"}'})` → `{valid: true}`
8. `sqlite.json.validatePath({path: "$.author"})` → valid
9. `sqlite.json.pretty({json: '{"type":"article","author":"Alice","views":1250}'})` → formatted JSON
10. `sqlite.json.each({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → 3 rows: database, tutorial, beginner
11. `sqlite.json.analyzeSchema({table: "test_jsonb_docs", column: "doc"})` → inferred schema
12. `sqlite.json.select({table: "test_jsonb_docs", column: "doc", paths: ["$.author", "$.views"]})` → rows with author/views
13. `sqlite.json.query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article"}})` → 4 rows
14. `sqlite.json.storageInfo({table: "test_jsonb_docs", column: "doc"})` → storage analysis
15. `sqlite.json.groupArray({table: "test_jsonb_docs", valueColumn: "json_extract(doc, '$.author')", allowExpressions: true})` → array of authors
16. `sqlite.json.groupObject({table: "test_jsonb_docs", keyColumn: "json_extract(doc, '$.author')", valueColumn: "json_extract(doc, '$.views')", allowExpressions: true})` → author→views map
17. `sqlite.json.jsonbConvert({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → conversion result
18. `sqlite.json.normalizeColumn({table: "test_jsonb_docs", column: "doc"})` → normalization report
19. `sqlite.json.securityScan({table: "test_jsonb_docs", column: "doc"})` → security scan result with riskLevel
20. `sqlite.json.diff({table: "test_jsonb_docs", column: "doc", path1: "$.type", path2: "$.author"})` → `diffs` array with per-row comparisons showing `path1Value`, `path2Value`, `identical: false`
21. `sqlite.json.diff({table: "test_jsonb_docs", column: "doc", path1: "$.type", path2: "$.type"})` → all rows `identical: true`


## Phase 2: JSON Write Tools — Happy Paths (temp table)

22. `sqlite.json.createJsonCollection({tableName: "temp_cm_json"})` → creates collection table
23. Insert a row into temp_cm_json with JSON data, then:
24. `sqlite.json.set(...)` on temp_cm_json → set a JSON value
25. `sqlite.json.update(...)` on temp_cm_json → update existing key
26. `sqlite.json.insert(...)` on temp_cm_json → insert new row with JSON data (Note: db-mcp's json.insert creates a new row via SQL INSERT, it does not wrap json_insert())
27. `sqlite.json.remove(...)` on temp_cm_json → remove a key
28. `sqlite.json.arrayAppend(...)` on temp_cm_json → append to array
29. `sqlite.json.merge({table: "test_jsonb_docs", column: "doc", mergeData: {"featured": true}, whereClause: "id = 999"})` → `{rowsAffected: 0}` (non-destructive)
30. Cleanup: drop temp_cm_json


## Phase 3: JSON Domain Errors (batched)

🔴 31. `sqlite.json.extract({table: "nonexistent_xyz", column: "doc", path: "$.x"})` → `{success: false}`
🔴 32. `sqlite.json.extract({table: "test_jsonb_docs", column: "nonexistent_col", path: "$.x"})` → report behavior
🔴 33. `sqlite.json.validatePath({path: "invalid path !@#"})` → report behavior
🔴 34. `sqlite.json.securityScan({table: "nonexistent_xyz", column: "doc"})` → `{success: false}`
🔴 35. `sqlite.json.diff({table: "nonexistent_xyz", column: "doc", path1: "$.x", path2: "$.y"})` → `{success: false}`


## Phase 4: Gotcha Edge Cases (batched)

36. `sqlite.json.each({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1", limit: 2})` → only 2 rows returned (not all array items) — `limit` param prevents row multiplication bloat (gotcha #6)
37. `sqlite.json.groupObject({table: "test_jsonb_docs", keyColumn: "id", valueColumn: "json_extract(doc, '$.author')", allowExpressions: true})` → 6 key-value pairs with unique keys — verify behavior when keys are guaranteed unique (gotcha #7)
38. `sqlite.json.normalizeColumn({table: "test_jsonb_docs", column: "doc", outputFormat: "text"})` → verify explicit text output differs from default `preserve` mode (gotcha #9)
39. `sqlite.json.groupArray({table: "test_jsonb_docs", valueColumn: "COUNT(*)", allowExpressions: true})` → report behavior — `allowExpressions` is designed for column extraction (e.g., `json_extract`), NOT aggregate functions (gotcha #8)


## Phase 5: Multi-Step Workflow

### 5.1 — JSON ETL pipeline

```javascript
// Create collection, populate, analyze, clean up
await sqlite.json.createJsonCollection({ tableName: "temp_cm_json_etl" });
// Insert 3 documents
for (let i = 1; i <= 3; i++) {
  await sqlite.core.writeQuery({
    query: `INSERT INTO temp_cm_json_etl (data) VALUES ('{"index":${i},"label":"item_${i}","tags":["test"]}')`,
  });
}
const schema = await sqlite.json.analyzeSchema({
  table: "temp_cm_json_etl",
  column: "data",
});
const scan = await sqlite.json.securityScan({
  table: "temp_cm_json_etl",
  column: "data",
});
await sqlite.core.writeQuery({
  query: "DROP TABLE IF EXISTS temp_cm_json_etl",
});
return {
  schemaFields: Object.keys(schema.schema.properties).length > 0,
  riskLevel: scan.riskLevel,
};
```

### 5.2 — Cross-group JSON + stats

```javascript
const extract = await sqlite.json.extract({
  table: "test_jsonb_docs",
  column: "doc",
  path: "$.views",
});
const stats = await sqlite.stats.statsBasic({
  table: "test_products",
  column: "price",
});
return { jsonExtract: extract, priceStats: stats };
```


### 5.3 — Security scan positive detection

```javascript
const failures = [];
await sqlite.json.createJsonCollection({ tableName: "temp_cm_json_sec" });
await sqlite.core.writeQuery({
  query: `INSERT INTO temp_cm_json_sec (data) VALUES ('{"password": "secret123", "api_key": "sk-abc123", "query": "DROP TABLE users; --", "html": "<script>alert(1)</script>"}')`,
});
const scan = await sqlite.json.securityScan({
  table: "temp_cm_json_sec",
  column: "data",
});
await sqlite.core.writeQuery({
  query: "DROP TABLE IF EXISTS temp_cm_json_sec",
});
if (scan.riskLevel === "low")
  failures.push("expected riskLevel > low for malicious data");
return { failures, success: failures.length === 0, riskLevel: scan.riskLevel };
```

Expected: `riskLevel` > "low", findings include PII keys (`password`, `api_key`) and/or injection/XSS patterns.


## Phase 6: Zod Validation Sweep

🔴 40. `sqlite.json.valid({})` → `{success: false}`
🔴 41. `sqlite.json.extract({})` → `{success: false}`
🔴 42. `sqlite.json.set({})` → `{success: false}`
🔴 43. `sqlite.json.remove({})` → `{success: false}`
🔴 44. `sqlite.json.type({})` → `{success: false}`
🔴 45. `sqlite.json.arrayLength({})` → `{success: false}`
🔴 46. `sqlite.json.arrayAppend({})` → `{success: false}`
🔴 47. `sqlite.json.keys({})` → `{success: false}`
🔴 48. `sqlite.json.each({})` → `{success: false}`
🔴 49. `sqlite.json.groupArray({})` → `{success: false}`
🔴 50. `sqlite.json.groupObject({})` → `{success: false}`
🔴 51. `sqlite.json.pretty({})` → `{success: false}`
🔴 52. `sqlite.json.jsonbConvert({})` → `{success: false}`
🔴 53. `sqlite.json.storageInfo({})` → `{success: false}`
🔴 54. `sqlite.json.normalizeColumn({})` → `{success: false}`
🔴 55. `sqlite.json.insert({})` → `{success: false}`
🔴 56. `sqlite.json.update({})` → `{success: false}`
🔴 57. `sqlite.json.select({})` → `{success: false}`
🔴 58. `sqlite.json.query({})` → `{success: false}`
🔴 59. `sqlite.json.validatePath({})` → `{success: false}`
🔴 60. `sqlite.json.merge({})` → `{success: false}`
🔴 61. `sqlite.json.analyzeSchema({})` → `{success: false}`
🔴 62. `sqlite.json.createJsonCollection({})` → `{success: false}`
🔴 63. `sqlite.json.securityScan({})` → `{success: false}`
🔴 64. `sqlite.json.diff({})` → `{success: false}` handler error

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
