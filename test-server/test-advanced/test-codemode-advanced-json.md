# db-mcp Advanced Stress Test: [json]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **json** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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

--------------- | ---- | -------------------------------------------------------------- |
| test_jsonb_docs | 6    | id, doc (JSON), metadata (JSON), tags (JSON array), created_at |
| test_events     | 100  | id, event_type, user_id, payload (JSON), event_date            |

**test_jsonb_docs key data:**

- Row 1: `doc.type="article"`, `doc.author="Alice"`, `doc.views=1250`, `doc.rating=4.5`
- Row 4: `doc.nested.level1.level2 = "deep value"`
- Row 5: `doc.type="podcast"` (no `doc.views` field)

## Naming & Cleanup

- **Temporary tables**: `stress_*` prefix. Drop at end.
- If DROP fails due to lock, note and move on.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`) | ✅ Confirmed (inline only)

### Error Message Quality Rating

| Level                                  | Verdict |
| -------------------------------------- | ------- |
| 5 - Excellent (name + code + context)  | ✅      |
| 4 - Good (name)                        | ✅      |
| 3 - Adequate (raw SQLite, informative) | ⚠️      |
| 2 - Poor (no object name)              | ⚠️      |
| 1 - Useless (generic)                  | ❌      |

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## json Group Tools (24 + codemode)

1. sqlite_json_valid
2. sqlite_json_extract
3. sqlite_json_set
4. sqlite_json_remove
5. sqlite_json_type
6. sqlite_json_array_length
7. sqlite_json_array_append
8. sqlite_json_keys
9. sqlite_json_each
10. sqlite_json_group_array
11. sqlite_json_group_object
12. sqlite_json_pretty
13. sqlite_jsonb_convert
14. sqlite_json_storage_info
15. sqlite_json_normalize_column
16. sqlite_json_insert
17. sqlite_json_update
18. sqlite_json_select
19. sqlite_json_query
20. sqlite_json_validate_path
21. sqlite_json_merge
22. sqlite_json_analyze_schema
23. sqlite_create_json_collection
24. sqlite_json_security_scan

---

### Category 1: Deep JSON Operations

**1.1 Deeply Nested Access**

1. `sqlite.json.extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.level2", whereClause: "id = 4"})` → `"deep value"`
2. `sqlite.json.extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.nonexistent", whereClause: "id = 4"})` → null or empty (not error)
3. `sqlite.json.extract({table: "test_jsonb_docs", column: "doc", path: "$.nonexistent_key", whereClause: "id = 1"})` → null or empty

**1.2 Array Manipulation Edge Cases**

4. `sqlite.json.arrayLength({table: "test_jsonb_docs", column: "tags", whereClause: "id = 3"})` → 3 (["mcp","protocol","ai"])
5. Create `stress_json_test` with a row containing `tags = '[]'` (empty array) → `sqlite.json.arrayLength` → 0
6. `sqlite.json.each` on an empty array → 0 expanded rows (not error)

**1.3 Merge Conflict Behavior**

> `sqlite_json_merge` uses `json_patch()` which follows RFC 7396 merge-patch semantics.

Insert test rows into `stress_json_test`: row 2 = `{"a": 1, "b": {"c": 2}}`, row 3 = `{"a": [1, 2]}`:

7. `sqlite.json.merge({table: "stress_json_test", column: "tags", mergeData: {"b": {"d": 3}}, whereClause: "id = 2"})` → verify deep merge: `b.c` preserved, `b.d` added
8. `sqlite.json.merge({table: "stress_json_test", column: "tags", mergeData: {"a": [3, 4]}, whereClause: "id = 3"})` → arrays replaced (not concatenated) per RFC 7396

**1.4 Type Coercion Edge Cases**

9. `sqlite.json.type({table: "test_jsonb_docs", column: "doc", path: "$.views", whereClause: "id = 1"})` → `"integer"` (views=1250)
10. `sqlite.json.type({table: "test_jsonb_docs", column: "doc", path: "$.rating", whereClause: "id = 1"})` → `"real"` (rating=4.5)
11. `sqlite.json.type({table: "test_jsonb_docs", column: "doc", path: "$.nested", whereClause: "id = 4"})` → `"object"`

---

### Category 2: JSON Query & Filter Stress

> `sqlite_json_query` uses `filterPaths` (equality-only, `Record<path, value>`) and `selectPaths`.

12. `sqlite.json.query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article"}})` → 4 rows
13. `sqlite.json.query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article", "$.author": "Alice"}, selectPaths: ["$.title", "$.views"]})` → 1 row (Alice's article)
14. `sqlite.json.query({table: "test_events", column: "payload", filterPaths: {"$.page": "home"}})` → 25 rows (every 4th event)

---

### Category 3: Error Message Quality

15. `sqlite.json.extract({table: "nonexistent_table_xyz", column: "doc", path: "$.x"})` → structured error mentioning table name
16. `sqlite.json.extract({table: "test_jsonb_docs", column: "nonexistent_col", path: "$.x"})` → structured error mentioning column
17. `sqlite.json.set({table: "test_jsonb_docs", column: "doc", path: "$.author", value: "\"Modified\"", whereClause: "id = 99999"})` → report behavior for nonexistent row
18. `sqlite.json.validatePath({path: ""})` → report behavior for empty path

---

### Category 4: Write Operation Safety

19. Create `stress_json_write` table → insert 3 JSON documents → perform `sqlite.json.set`, `sqlite.json.remove`, `sqlite.json.insert` → verify mutations → cleanup
    > **Note:** `sqlite_json_insert` is a **row-level INSERT** (creates new row with JSON data, provided via the `data` parameter), not a path-level JSON insert.
20. `sqlite.json.normalizeColumn(...)` on `stress_json_write` → verify keys sorted/compacted without data loss

---

### Category 5: Security Scan Stress

21. `sqlite.json.securityScan({table: "test_jsonb_docs", column: "doc"})` → scan result with `riskLevel`
22. Create `stress_json_inject` with rows containing suspicious patterns (`<script>`, `' OR 1=1`, `${cmd}`) → `sqlite.json.securityScan` → verify detection
23. Cleanup: drop `stress_json_inject`

---

### Category 6: JSON Diff Edge Cases

24. `sqlite.json.diff({table: "test_jsonb_docs", column: "doc", path1: "$.type", path2: "$.nonexistent"})` → verify `path2Value` is null/missing, `identical: false`
25. `sqlite.json.diff({table: "test_jsonb_docs", column: "doc", path1: "$.missing_1", path2: "$.missing_2"})` → both null/missing, `identical: true`
26. `sqlite.json.diff({table: "test_jsonb_docs", column: "doc", path1: "$.type", path2: "$.type", whereClause: "id = 1"})` → only 1 diff object returned, `identical: true`

---

### Final Cleanup

Drop all `stress_*` tables. Confirm `test_jsonb_docs` row count is still 6 and contents unchanged.

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
