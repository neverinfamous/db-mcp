# db-mcp Code Mode Testing: [json]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **json** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js): All 26 JSON tools are fully WASM-compatible. No phases to skip or adjust.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — monitor `metrics.tokenEstimate` for every operation.

## Test Database Schema

| Table           | Rows | Key Columns                                                    |
| --------------- | ---- | -------------------------------------------------------------- |
| test_products   | 16   | id, name, price (REAL), category (TEXT lowercase)              |
| test_jsonb_docs | 6    | id, doc (JSON), metadata (JSON), tags (JSON array), created_at |
| test_events     | 100  | id, event_type, user_id (INT), payload (JSON), event_date      |

**test_jsonb_docs data:**

| id  | doc.type | doc.author | doc.views | metadata.source | tags                                 |
| --- | -------- | ---------- | --------- | --------------- | ------------------------------------ |
| 1   | article  | Alice      | 1250      | blog            | ["database","tutorial","beginner"]   |
| 2   | article  | Bob        | 890       | docs            | ["json","advanced","sqlite"]         |
| 3   | video    | Carol      | 5400      | youtube         | ["mcp","protocol","ai"]              |
| 4   | article  | David      | 670       | wiki            | ["fts5","search","indexing"]         |
| 5   | podcast  | Eve        | —         | spotify         | ["performance","tips","podcast"]     |
| 6   | article  | Frank      | 2100      | medium          | ["vector","embeddings","similarity"] |

Row 4 has nested: `doc.nested.level1.level2 = "deep value"`

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** Report as ❌.

1. **Batched scripting**: Bundle checks into single `sqlite_execute_code` calls with `failures` array.
2. **Error path testing**: Every tool tested with `{}` (Zod) and domain error. Must return `{success: false}`.
3. **Token tracking**: Monitor `metrics.tokenEstimate`. Report most expensive block.
4. **Coverage Matrix**: `| Tool | Happy Path | Domain Error | Zod Error |`
5. **Deterministic checklist first**.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

Handler error ✅ = JSON with `success` + `error` fields. MCP error ❌ = raw text, `isError: true`.

## Cleanup

- Temporary tables: `temp_*` prefix. Drop at end of each script.

---

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

---

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

---

## Phase 3: JSON Domain Errors (batched)

🔴 31. `sqlite.json.extract({table: "nonexistent_xyz", column: "doc", path: "$.x"})` → `{success: false}`
🔴 32. `sqlite.json.extract({table: "test_jsonb_docs", column: "nonexistent_col", path: "$.x"})` → report behavior
🔴 33. `sqlite.json.validatePath({path: "invalid path !@#"})` → report behavior
🔴 34. `sqlite.json.securityScan({table: "nonexistent_xyz", column: "doc"})` → `{success: false}`
🔴 35. `sqlite.json.diff({table: "nonexistent_xyz", column: "doc", path1: "$.x", path2: "$.y"})` → `{success: false}`

---

## Phase 4: JSON Zod Validation (batched)

🔴 36. `sqlite.json.valid({})` → `{success: false}`
🔴 37. `sqlite.json.extract({})` → `{success: false}`
🔴 38. `sqlite.json.set({})` → `{success: false}`
🔴 39. `sqlite.json.remove({})` → `{success: false}`
🔴 40. `sqlite.json.type({})` → `{success: false}`
🔴 41. `sqlite.json.arrayLength({})` → `{success: false}`
🔴 42. `sqlite.json.arrayAppend({})` → `{success: false}`
🔴 43. `sqlite.json.keys({})` → `{success: false}`
🔴 44. `sqlite.json.each({})` → `{success: false}`
🔴 45. `sqlite.json.groupArray({})` → `{success: false}`
🔴 46. `sqlite.json.groupObject({})` → `{success: false}`
🔴 47. `sqlite.json.pretty({})` → `{success: false}`
🔴 48. `sqlite.json.jsonbConvert({})` → `{success: false}`
🔴 49. `sqlite.json.storageInfo({})` → `{success: false}`
🔴 50. `sqlite.json.normalizeColumn({})` → `{success: false}`
🔴 51. `sqlite.json.insert({})` → `{success: false}`
🔴 52. `sqlite.json.update({})` → `{success: false}`
🔴 53. `sqlite.json.select({})` → `{success: false}`
🔴 54. `sqlite.json.query({})` → `{success: false}`
🔴 55. `sqlite.json.validatePath({})` → `{success: false}`
🔴 56. `sqlite.json.merge({})` → `{success: false}`
🔴 57. `sqlite.json.analyzeSchema({})` → `{success: false}`
🔴 58. `sqlite.json.createJsonCollection({})` → `{success: false}`
🔴 59. `sqlite.json.securityScan({})` → `{success: false}`
🔴 60. `sqlite.json.diff({})` → `{success: false}` handler error

---

## Phase 4.5: Gotcha Edge Cases (batched)

61. `sqlite.json.each({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1", limit: 2})` → only 2 rows returned (not all array items) — `limit` param prevents row multiplication bloat (gotcha #6)
62. `sqlite.json.groupObject({table: "test_jsonb_docs", keyColumn: "id", valueColumn: "json_extract(doc, '$.author')", allowExpressions: true})` → 6 key-value pairs with unique keys — verify behavior when keys are guaranteed unique (gotcha #7)
63. `sqlite.json.normalizeColumn({table: "test_jsonb_docs", column: "doc", outputFormat: "text"})` → verify explicit text output differs from default `preserve` mode (gotcha #9)
64. `sqlite.json.groupArray({table: "test_jsonb_docs", valueColumn: "COUNT(*)", allowExpressions: true})` → report behavior — `allowExpressions` is designed for column extraction (e.g., `json_extract`), NOT aggregate functions (gotcha #8)

---

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

---

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

---

## Post-Test Procedures

1. **Cleanup**: Confirm all `temp_*` tables removed
2. **Triage findings**: Create implementation plan if issues found
3. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
4. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
5. **Commit**: Stage and commit — do NOT push
6. **Token audit**: Report most expensive block
7. **Final summary**: After testing/re-testing
