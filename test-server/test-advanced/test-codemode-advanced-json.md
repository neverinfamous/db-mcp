# db-mcp Advanced Stress Testing: [json]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> **Adapter mode**: Call `list_adapters` at the start of testing to determine whether you are running against `native` or `wasm`. Apply the WASM Mode rules below if the adapter is `wasm`.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> [!WARNING]
> **Stale Build Issues:** The MCP server runs from the compiled `dist/` directory, NOT `src/`. If you encounter inexplicable behavior (e.g., tools executing old logic or throwing validation errors for things already fixed in the source code), the server might be running a stale build. Check if the compiled code in `dist/` matches the source code in `src/`. If out of sync, stop and instruct the user to run `npm run build` and restart the server before continuing testing.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference

> See `code-map.md` in the `test-server/` directory for the complete test database schema (`test_*` tables).

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

> [!NOTE]
> **Tool Availability & Code Mode**: The `sqlite_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a _different_ group (e.g., `sqlite_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `sqlite_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

> [!IMPORTANT]
> **Testing Code Mode**: Do NOT write test scripts to the filesystem. Pass your JavaScript snippets directly to the `sqlite_execute_code` tool's `code` parameter. Do NOT wrap your tests in monolithic `try/catch` blocks that suppress or transform the server's natural error output. You must allow the server to return its native structured error responses so you can evaluate them against the standards below.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, or a raw text string wrapped in `isError: true` with no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.
>
> ⚠️ **ARCHITECTURAL NOTE — `isError: true` rules for tools with `outputSchema`**: The MCP SDK uses `isError` to decide whether to validate `structuredContent` against the `outputSchema`. Getting this wrong causes either raw `-32602` crashes or valid responses wrapped in error frames. **This is now handled automatically by the server framework in `tools.ts`**, but as a tester, you must verify the SDK output matches this rule:
>
> | Response         | `isError: true` | SDK behavior                                              | Verdict                                |
> | ---------------- | --------------- | --------------------------------------------------------- | -------------------------------------- |
> | `success: true`  | **Absent**      | Validates `structuredContent` → passes                    | ✅ Correct                             |
> | `success: true`  | **Present**     | Skips validation, wraps in error frame                    | ❌ Bug — valid response shown as error |
> | `success: false` | **Present**     | Skips validation (error shape won't match success schema) | ✅ Correct                             |
> | `success: false` | **Absent**      | Validates error against success schema → fails            | ❌ Bug — raw `-32602`                  |
>
> **TL;DR**: `isError: true` on errors, absent on successes. The framework handles this automatically when your handler returns `success: false`.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) An **empty parameters test** (call the tool with `{}`).
     Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
     > **Note on Aliases & Zod**: Tools that support legacy parameter aliases (e.g. `tableName` instead of `table`) often use `.default("")` in their Zod schema so the SDK validation lets the payload reach the handler's alias-resolution logic. For these tools, calling with `{}` will pass Zod validation and correctly trigger a handler-level domain error (e.g. `TABLE_NOT_FOUND`) instead of a strict Zod `invalid_type` error. **This is expected behavior.** Do NOT remove `.default("")` from schemas to force a Zod error, as this will break alias compatibility.
3. **Output Schema Testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
4. **Wrong-Type Coercion**: For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.
   > **Note on Zod Coercion & Validation Errors**: When passing `"abc"` to a numeric field, receiving a structured handler error like `{ success: false, error: "limit: Expected number, received string", code: "VALIDATION_ERROR" }` is **correct**. This proves the global SDK monkey-patch successfully intercepted Zod's `invalid_type` error and transformed it into a structured domain error. Do NOT attempt to "fix" `coerceNumber` or schema definitions to bypass this Zod validation or force a silent fallback to `undefined`.
5. **Proactive Improvements**: You are highly encouraged to proactively improve functionality, performance, security, agent experience, and token/payload efficiency whenever you see an opportunity during your testing and handler code review.
   > **CRITICAL**: Architectural consistency is paramount. Do not introduce undocumented architectural deviations. If you implement a structural or architectural improvement in one tool, you must apply it symmetrically to other applicable tools in the group or project.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
7. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
8. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

### Structured Error Response Pattern

All tools should return errors as strongly-typed structured objects instead of throwing. The expected pattern:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "VALIDATION_ERROR",
  "category": "validation",
  "recoverable": false,
  "metrics": { ... }
}
```

| Type                 | Source                                                                          | What you see                                                                                                              | Verdict            |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "...", code: "..."}` | Parseable JSON object with `success`, `error`, `code` (e.g., `VALIDATION_ERROR`, `CONFLICT_ERROR`), and `category` fields | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                                      | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field     | Bug — report as ❌ |

## Naming & Cleanup

- **Temporary tables**: `temp_*` (or `stress_*`) prefix
- **Temporary views**: `temp_view_*` (or `stress_view_*`) prefix
- Drop at the end of the script. If DROP fails due to lock, note and move on.
  

---

## Group Focus: json

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.json.valid`
- `sqlite.json.extract`
- `sqlite.json.set`
- `sqlite.json.remove`
- `sqlite.json.type`
- `sqlite.json.arrayLength`
- `sqlite.json.arrayAppend`
- `sqlite.json.keys`
- `sqlite.json.each`
- `sqlite.json.groupArray`
- `sqlite.json.groupObject`
- `sqlite.json.pretty`
- `sqlite.json.jsonbConvert`
- `sqlite.json.storageInfo`
- `sqlite.json.normalizeColumn`
- `sqlite.json.insert`
- `sqlite.json.update`
- `sqlite.json.select`
- `sqlite.json.query`
- `sqlite.json.validatePath`
- `sqlite.json.merge`
- `sqlite.json.analyzeSchema`
- `sqlite.json.createJsonCollection`
- `sqlite.json.securityScan`
- `sqlite.json.diff`

## Phase 1: Deep JSON Operations (batched)

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

## Phase 2: JSON Query & Filter Stress (batched)

> `sqlite_json_query` uses `filterPaths` (equality-only, `Record<path, value>`) and `selectPaths`.

12. `sqlite.json.query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article"}})` → 4 rows
13. `sqlite.json.query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article", "$.author": "Alice"}, selectPaths: ["$.title", "$.views"]})` → 1 row (Alice's article)
14. `sqlite.json.query({table: "test_events", column: "payload", filterPaths: {"$.page": "home"}})` → 25 rows (every 4th event)

## Phase 3: Error Message Quality (batched)

15. `sqlite.json.extract({table: "nonexistent_table_xyz", column: "doc", path: "$.x"})` → structured error mentioning table name
16. `sqlite.json.extract({table: "test_jsonb_docs", column: "nonexistent_col", path: "$.x"})` → structured error mentioning column
17. `sqlite.json.set({table: "test_jsonb_docs", column: "doc", path: "$.author", value: "\"Modified\"", whereClause: "id = 99999"})` → report behavior for nonexistent row
18. `sqlite.json.validatePath({path: ""})` → report behavior for empty path

## Phase 4: Write Operation Safety (batched)

19. Create `stress_json_write` table → insert 3 JSON documents → perform `sqlite.json.set`, `sqlite.json.remove`, `sqlite.json.insert({table: "stress_json_write", column: "data", data: {"new": "row"}})` → verify mutations → cleanup
    > **Note:** `sqlite_json_insert` is a **row-level INSERT** (creates new row with JSON data, provided via the `data` parameter), not a path-level JSON insert.
20. `sqlite.json.normalizeColumn(...)` on `stress_json_write` → verify keys sorted/compacted without data loss

## Phase 5: Security Scan Stress (batched)

21. `sqlite.json.securityScan({table: "test_jsonb_docs", column: "doc"})` → scan result with `riskLevel`
22. Create `stress_json_inject` with rows containing suspicious patterns (`<script>`, `' OR 1=1`, `${cmd}`) → `sqlite.json.securityScan` → verify detection
23. Cleanup: drop `stress_json_inject`

## Phase 6: JSON Diff Edge Cases (batched)

24. `sqlite.json.diff({table: "test_jsonb_docs", column: "doc", path1: "$.type", path2: "$.nonexistent"})` → verify `path2Value` is null/missing, `identical: false`
25. `sqlite.json.diff({table: "test_jsonb_docs", column: "doc", path1: "$.missing_1", path2: "$.missing_2"})` → both null/missing, `identical: true`
26. `sqlite.json.diff({table: "test_jsonb_docs", column: "doc", path1: "$.type", path2: "$.type", whereClause: "id = 1"})` → only 1 diff object returned, `identical: true`

### Final Cleanup

Drop all `stress_*` tables. Confirm `test_jsonb_docs` row count is still 6 and contents unchanged.

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
