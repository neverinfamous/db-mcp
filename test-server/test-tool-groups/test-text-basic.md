# db-mcp Tool Group Testing: [text-basic]

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

## Group Focus: text-basic

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### text-basic Group Tools (11)

1. sqlite_regex_extract
2. sqlite_regex_match
3. sqlite_text_split
4. sqlite_text_concat
5. sqlite_text_replace
6. sqlite_text_trim
7. sqlite_text_case
8. sqlite_text_substring
9. sqlite_text_validate
10. sqlite_text_normalize
11. sqlite_execute_code

**Test data reference:**

- `test_users` (9 rows): Emails include `@example.com`, `@company.org`, `@gmail.com`, etc. One user (`testuser`) has `test.user@gmail.com`. Phone formats: `+1-555-0101`, `+44-20-7123-4567`, `+82-2-1234-5678`
- `test_products` row 16: `name = 'Café Décor Light'` — has accented characters for `strip_accents` testing

**Checklist:**

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

12. `sqlite_execute_code({code: "const result = await sqlite.text.regexMatch({table: 'test_users', column: 'email', pattern: '@gmail\\\\.com$'}); return result;"})` → at least 1 result

**Error path testing:**

🔴 13. `sqlite_regex_match({table: "nonexistent_table_xyz", column: "x", pattern: "."})` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 14. `sqlite_regex_extract({})` → handler error
🔴 15. `sqlite_regex_match({})` → handler error
🔴 16. `sqlite_text_split({})` → handler error
🔴 17. `sqlite_text_concat({})` → handler error
🔴 18. `sqlite_text_replace({})` → handler error
🔴 19. `sqlite_text_trim({})` → handler error
🔴 20. `sqlite_text_case({})` → handler error
🔴 21. `sqlite_text_substring({})` → handler error
🔴 22. `sqlite_text_normalize({})` → handler error
🔴 23. `sqlite_text_validate({})` → handler error
🔴 24. `sqlite_execute_code({})` → handler error


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
