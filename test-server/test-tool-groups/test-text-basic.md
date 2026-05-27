# db-mcp Tool Group Testing: [text-basic]

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

> [!NOTE]
> **Tool Availability & Code Mode**: The `sqlite_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a *different* group (e.g., `sqlite_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `sqlite_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, or a raw text string wrapped in `isError: true` with no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.
> 
> ⚠️ **ARCHITECTURAL NOTE — `isError: true` rules for tools with `outputSchema`**: The MCP SDK uses `isError` to decide whether to validate `structuredContent` against the `outputSchema`. Getting this wrong causes either raw `-32602` crashes or valid responses wrapped in error frames. **This is now handled automatically by the server framework in `tools.ts`**, but as a tester, you must verify the SDK output matches this rule:
>
> | Response | `isError: true` | SDK behavior | Verdict |
> |---|---|---|---|
> | `success: true` | **Absent** | Validates `structuredContent` → passes | ✅ Correct |
> | `success: true` | **Present** | Skips validation, wraps in error frame | ❌ Bug — valid response shown as error |
> | `success: false` | **Present** | Skips validation (error shape won't match success schema) | ✅ Correct |
> | `success: false` | **Absent** | Validates error against success schema → fails | ❌ Bug — raw `-32602` |
>
> **TL;DR**: `isError: true` on errors, absent on successes. The framework handles this automatically when your handler returns `success: false`.

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

## Group Focus: text-basic

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Group Tools (10) + Code Mode

- `sqlite_regex_extract`
- `sqlite_regex_match`
- `sqlite_text_split`
- `sqlite_text_concat`
- `sqlite_text_replace`
- `sqlite_text_trim`
- `sqlite_text_case`
- `sqlite_text_substring`
- `sqlite_text_validate`
- `sqlite_text_normalize`
- *(Code Mode executor)*
- `sqlite_execute_code`

## Phase 1: Core Check (batched)

1. `sqlite_regex_match({table: "test_users", column: "email", pattern: "@gmail\\.com$"})` → at least 1 result (`test.user@gmail.com`)
2. `sqlite_regex_extract({table: "test_users", column: "email", pattern: "@([^.]+)\\.", groupIndex: 1})` → extract domain parts (example, company, startup, etc.)
3. `sqlite_text_validate({table: "test_users", column: "email", pattern: "email"})` → all 9 rows should be valid emails
4. `sqlite_text_validate({table: "test_users", column: "phone", pattern: "phone"})` → report valid/invalid counts (one user has NULL phone)
5. `sqlite_text_case({table: "test_users", column: "username", mode: "upper"})` → all usernames uppercased
6. `sqlite_text_normalize({table: "test_products", column: "name", mode: "strip_accents"})` → `Café Décor Light` becomes `Cafe Decor Light`
7. `sqlite_text_split({table: "test_users", column: "email", delimiter: "@"})` → each email split into local + domain parts
8. `sqlite_text_concat({table: "test_users", columns: ["username", "email"], separator: " - "})` → concatenated strings
9. `sqlite_text_replace({table: "test_users", column: "email", searchPattern: "@example.com", replaceWith: "@test.org", whereClause: "email LIKE '%@example.com'"})` → 1 row affected (write operation — revert with `searchPattern: "@test.org", replaceWith: "@example.com", whereClause: "email LIKE '%@test.org'"` afterward)
10. `sqlite_text_trim({table: "test_users", column: "bio"})` → trimmed bios
11. `sqlite_text_substring({table: "test_users", column: "username", start: 1, length: 4})` → first 4 chars of each username

**Code mode testing:**

12. `sqlite_execute_code({code: "const result = await sqlite.text.regexMatch({table: 'test_users', column: 'email', pattern: '@gmail\\\\.com$'}); return result;"})` → returns matching rows via Code Mode bridge

## Phase 2: Domain Errors (batched)

🔴 13. `sqlite_regex_match({table: "nonexistent_xyz", column: "name", pattern: "test"})` → `{success: false}` — structured error mentioning table name
🔴 14. `sqlite_regex_extract({table: "nonexistent_xyz", column: "name", pattern: "(.*)", groupIndex: 0})` → `{success: false}`
🔴 15. `sqlite_text_split({table: "nonexistent_xyz", column: "name", delimiter: ","})` → `{success: false}`
🔴 16. `sqlite_text_concat({table: "nonexistent_xyz", columns: ["a", "b"]})` → `{success: false}`
🔴 17. `sqlite_text_replace({table: "nonexistent_xyz", column: "name", searchPattern: "a", replaceWith: "b"})` → `{success: false}`
🔴 18. `sqlite_text_trim({table: "nonexistent_xyz", column: "name"})` → `{success: false}`
🔴 19. `sqlite_text_case({table: "nonexistent_xyz", column: "name", mode: "upper"})` → `{success: false}`
🔴 20. `sqlite_text_substring({table: "nonexistent_xyz", column: "name", start: 1, length: 5})` → `{success: false}`
🔴 21. `sqlite_text_validate({table: "nonexistent_xyz", column: "name", pattern: "email"})` → `{success: false}`
🔴 22. `sqlite_text_normalize({table: "nonexistent_xyz", column: "name", mode: "strip_accents"})` → `{success: false}`

## Phase 3: Zod Validation Sweep

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error (`{success: false, error: "Validation error: ..."}`), NOT raw MCP error:

🔴 23. `sqlite_regex_extract({})` → handler error
🔴 24. `sqlite_regex_match({})` → handler error
🔴 25. `sqlite_text_split({})` → handler error
🔴 26. `sqlite_text_concat({})` → handler error
🔴 27. `sqlite_text_replace({})` → handler error
🔴 28. `sqlite_text_trim({})` → handler error
🔴 29. `sqlite_text_case({})` → handler error
🔴 30. `sqlite_text_substring({})` → handler error
🔴 31. `sqlite_text_validate({})` → handler error
🔴 32. `sqlite_text_normalize({})` → handler error

## Phase 4: Wrong-Type Numeric Coercion

> For every tool with optional numeric parameters, pass `"abc"` instead of a number. Must return a handler error, NOT a raw MCP `-32602` error.

🔴 33. `sqlite_text_substring({table: "test_users", column: "username", start: "abc", length: 4})` → handler error
🔴 34. `sqlite_text_substring({table: "test_users", column: "username", start: 1, length: "abc"})` → handler error

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
