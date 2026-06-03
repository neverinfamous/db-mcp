# db-mcp Tool Group Testing: [core-data]

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

> _No specific table schema required for this test group._

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

## Group Focus: core-data

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Built-in Tools (3)

- `server_info`
- `server_health`
- `list_adapters`

### Group Tools (9)

- `sqlite_read_query`
- `sqlite_write_query`
- `sqlite_upsert`
- `sqlite_batch_insert`
- `sqlite_count`
- `sqlite_exists`
- `sqlite_truncate`
- `sqlite_date_add`
- `sqlite_date_diff`

## Phase 1: Core Check (batched)

1. `server_info` → verify server name, version, adapter info present
2. `server_health` → verify healthy status
3. `list_adapters` → verify at least one adapter listed
4. `sqlite_read_query({query: "SELECT COUNT(*) AS n FROM test_products"})` → `{rows: [{n: 16}]}`
5. `sqlite_read_query({query: "SELECT name, price FROM test_products WHERE price > ?", params: [500]})` → 1 result: `Laptop Pro 15` (1299.99) (Note: Parameter binding test)
6. `sqlite_read_query({query: "SELECT COUNT(*) AS n FROM test_orders WHERE status = 'completed'"})` → `{rows: [{n: 8}]}`
7. `sqlite_read_query({query: "SELECT * FROM test_measurements"})` → return 50 rows (automatic limit) and `nextCursor` populated
8. `sqlite_read_query({query: "SELECT * FROM test_measurements", cursor: "<nextCursor>"})` → return next batch of rows via opaque pagination
9. `sqlite_read_query({query: "SELECT * FROM test_measurements", cursor: "invalid_cursor_string_123"})` → structured error indicating invalid or corrupted cursor format
10. `sqlite_create_table({table: "temp_core_test2", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "val", type: "TEXT"}]})` → success
11. `sqlite_batch_insert({table: "temp_core_test2", rows: [{id: 1, val: "a"}, {id: 2, val: "b"}], returning: true})` → `{rowsAffected: 2}` and returns inserted rows (Note: Test `returning` parameter)
12. `sqlite_upsert({table: "temp_core_test2", data: {id: 1, val: "c"}, conflictColumns: ["id"], updateColumns: ["val"], returning: true})` → `{rowsAffected: 1}` and returns updated row
13. `sqlite_count({table: "test_products"})` → `{count: 16}`
14. `sqlite_exists({table: "test_products", where: "id = 1"})` → `{exists: true}`
15. `sqlite_truncate({table: "temp_core_test2"})` → `{rowsAffected: 2}`
16. `sqlite_write_query({query: "INSERT INTO temp_core_test2 (id, val) VALUES (99, 'returning_test') RETURNING *"})` → verify `rows` array contains the inserted row with `id: 99` (Note: SQL RETURNING clause passed through directly)
17. `sqlite_batch_insert({table: "temp_core_test2", rows: [{id: 100, val: "no_return"}], returning: false})` → verify `rowsAffected: 1` WITHOUT a `rows` array (negative test for returning parameter)
18. `sqlite_drop_table({table: "temp_core_test2"})` → success
19. `sqlite_date_add({table: "test_orders", column: "order_date", amount: 7, unit: "days", whereClause: "id = 1"})` → return result with `date_add_result` column showing date + 7 days
20. `sqlite_date_diff({table: "test_orders", column1: "order_date", column2: "'2025-01-01'", unit: "days", whereClause: "id = 1"})` → return result with `date_diff_result` showing difference in days
21. `sqlite_read_query({query: "SELECT * FROM test_products", stream: true, chunkSize: 5})` → returns rows successfully (verifies that `stream: true` gracefully degrades to full buffering without error when the testing client does not provide a `_meta.progressToken`)

**Error path testing:**

🔴 22. `sqlite_read_query({query: "SELECT * FROM nonexistent_table_xyz"})` → structured error mentioning table name
🔴 23. `sqlite_write_query({query: "INSERT INTO nonexistent_table_xyz VALUES (1)"})` → `{success: false}` — structured error
🔴 24. `sqlite_upsert({table: "nonexistent_table_xyz", data: {id: 1}, conflictColumns: ["id"]})` → `{success: false}`
🔴 25. `sqlite_batch_insert({table: "nonexistent_table_xyz", rows: [{id: 1}]})` → `{success: false}`
🔴 26. `sqlite_count({table: "nonexistent_table_xyz"})` → `{success: false}`
🔴 27. `sqlite_exists({table: "nonexistent_table_xyz"})` → `{success: false}`
🔴 28. `sqlite_truncate({table: "nonexistent_table_xyz"})` → `{success: false}`
🔴 29. `sqlite_date_add({table: "nonexistent_table_xyz", column: "created", amount: 1, unit: "days"})` → `{success: false}`
🔴 30. `sqlite_date_diff({table: "nonexistent_table_xyz", column1: "created", column2: "updated", unit: "days"})` → `{success: false}`

## Phase 2: Zod Validation Sweep

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error (`{success: false, error: "Validation error: ..."}`), NOT raw MCP error:

🔴 31. `sqlite_read_query({})` → handler error
🔴 32. `sqlite_write_query({})` → handler error
🔴 33. `sqlite_upsert({})` → handler error
🔴 34. `sqlite_batch_insert({})` → handler error
🔴 35. `sqlite_count({})` → handler error
🔴 36. `sqlite_exists({})` → handler error
🔴 37. `sqlite_truncate({})` → handler error
🔴 38. `sqlite_date_add({})` → handler error
🔴 39. `sqlite_date_diff({})` → handler error

**Built-in tools** — these take no required params, so `{}` should return a successful response (confirming graceful handling):

🔴 40. `server_info({})` → should succeed (no required params)
🔴 41. `server_health({})` → should succeed (no required params)
🔴 42. `list_adapters({})` → should succeed (no required params)

## Phase 3: Wrong-Type Numeric Coercion

> For every tool with optional numeric parameters, pass `"abc"` instead of a number. Must return a handler error, NOT a raw MCP `-32602` error.

🔴 43. `sqlite_date_add({table: "test_orders", column: "order_date", amount: "abc", unit: "days"})` → handler error

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
