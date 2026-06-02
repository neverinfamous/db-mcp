# db-mcp Advanced Stress Testing: [text]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> **Adapter mode**: Call `list_adapters` at the start of testing to determine whether you are running against `native` or `wasm`. Apply the WASM Mode rules below if the adapter is `wasm`.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): Tools marked `[NATIVE ONLY]` in the checklist are unavailable and should be skipped. All unmarked tools are fully WASM-compatible.

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

## Group Focus: text

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.text.regexMatch`
- `sqlite.text.regexExtract`
- `sqlite.text.fuzzyMatch`
- `sqlite.text.phoneticMatch`
- `sqlite.text.advancedSearch`
- `sqlite.text.normalize`
- `sqlite.text.case`
- `sqlite.text.substring`
- `sqlite.text.replace`
- `sqlite.text.validate`
- `sqlite.text.sentiment`
- `sqlite.text.ftsSearch`
- `sqlite.text.ftsRebuild`
- `sqlite.text.ftsHeadline`
- `sqlite.text.ftsMatchInfo`

> **Note**: Tools not listed here (`split`, `concat`, `trim`, `ftsCreate`) are covered in the standard `test-codemode-text.md` prompt and do not require additional stress testing.

## Phase 1: Regex Edge Cases (batched)

1. `sqlite.text.regexMatch({table: "test_users", column: "email", pattern: "^[a-z]+\\.[a-z]+@"})` → match dotted local parts (test.user)
2. `sqlite.text.regexMatch({table: "test_users", column: "phone", pattern: "^\\+1"})` → US phone numbers only (6 users, 1 NULL excluded)
3. `sqlite.text.regexExtract({table: "test_users", column: "email", pattern: "@(.+)$", groupIndex: 1})` → full domain extraction
4. `sqlite.text.regexMatch({table: "test_users", column: "bio", pattern: ".*"})` → should match all non-NULL bios (all 9 users have bios)

## Phase 2: Fuzzy/Phonetic Matching Stress (batched)

5. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "Keyborad", maxDistance: 3})` → find "Mechanical Keyboard" (Levenshtein)
6. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "LAPTOP", maxDistance: 2, tokenize: true})` → match "Laptop" token in "Laptop Pro 15"
7. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "xyznonexistent", maxDistance: 1})` → 0 results
8. `sqlite.text.phoneticMatch({table: "test_users", column: "username", search: "jon", algorithm: "soundex"})` → 0 results (Soundex: "jon"=J500 ≠ "johndoe"=J530; single-word usernames aren't tokenized)
9. `sqlite.text.phoneticMatch({table: "test_users", column: "username", search: "smith", algorithm: "soundex"})` → report behavior (janesmith contains "smith" as suffix)
10. `sqlite.text.advancedSearch({table: "test_users", column: "username", searchTerm: "jhn", techniques: ["exact", "fuzzy", "phonetic"], fuzzyThreshold: 0.3})` → should find John via fuzzy/phonetic

## Phase 3: Text Transformation Edge Cases (batched)

11. `sqlite.text.normalize({table: "test_products", column: "name", mode: "strip_accents"})` → `"Café Décor Light"` → `"Cafe Decor Light"` — verify ALL rows returned
12. `sqlite.text.normalize({table: "test_products", column: "name", mode: "nfkc"})` → NFKC normalization
13. `sqlite.text.case({table: "test_users", column: "username", mode: "upper"})` → verify 9 uppercased usernames
14. `sqlite.text.case({table: "test_users", column: "username", mode: "lower"})` → idempotent (already lowercase)
15. `sqlite.text.substring({table: "test_users", column: "email", start: 1, length: 3})` → first 3 chars of each email

## Phase 4: Validation Patterns (batched)

16. `sqlite.text.validate({table: "test_users", column: "email", pattern: "email"})` → expect all 9 valid
17. `sqlite.text.validate({table: "test_users", column: "phone", pattern: "phone"})` → report valid/invalid/null counts
18. `sqlite.text.validate({table: "test_users", column: "email", pattern: "custom", customPattern: "^.+@.+\\..{2,}$"})` → custom regex validation

## Phase 5: Sentiment Analysis Edge Cases (batched)

19. `sqlite.text.sentiment({table: "test_articles", column: "body"})` → sentiment scores for all 8 articles
20. Create `stress_sentiment_test` with rows: `"I love this!"` (positive), `"This is terrible"` (negative), `""` (empty), `NULL` → report behavior for edge cases

## Phase 5.5: Text Replace Edge Cases (batched)

21. Create `stress_replace_test (id INTEGER PRIMARY KEY, content TEXT)` with rows: `(1, 'Hello World')`, `(2, '')`, `(3, NULL)`
22. `sqlite.text.replace({table: "stress_replace_test", column: "content", search: "World", replacement: ""})` → row 1 becomes `"Hello "` (replace with empty string)
23. `sqlite.text.replace({table: "stress_replace_test", column: "content", search: "missing", replacement: "found"})` → no changes (search pattern not found)
24. `sqlite.text.replace({table: "stress_replace_test", column: "content", search: ".*", replacement: "regex"})` → verify literal replacement (should NOT interpret as regex)

## Phase 6: FTS5 State Integrity `[NATIVE ONLY]` (batched)

25. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "database"})` → results about databases
26. `sqlite.text.ftsRebuild({table: "test_articles_fts"})` → success
27. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "database"})` → same results after rebuild (idempotent)
28. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "*", limit: 1})` → exactly 1 result, `nextCursor` provided
29. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "*", limit: 1, cursor: "<nextCursor>"})` → next cursor chunk retrieved
30. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "SQLite AND database"})` → boolean operator
31. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "\"full-text search\""})` → phrase query
32. `sqlite.text.ftsSearch({table: "test_articles_fts", query: '"unbalanced AND OR NOT quote'})` → should gracefully handle malformed FTS syntax without crashing the parser
33. `sqlite.text.ftsHeadline({table: "test_articles_fts", query: "SQLite"})` → highlighted results
34. `sqlite.text.hybridSearch({table: "test_articles", query: "database", queryVector: [0, 0, 0], vectorColumn: "embedding", ftsTable: "test_articles_fts"})` → results combining vector distance and FTS
35. `sqlite.text.hybridSearch({table: "test_articles", query: "database", queryVector: [0], vectorColumn: "embedding", ftsTable: "test_articles_fts"})` → structured error or handles dimension mismatch gracefully
36. `sqlite.text.hybridSearch({table: "test_articles", query: "database", queryVector: [0.1, 0.2, -0.1], vectorColumn: "embedding", ftsTable: "test_articles_fts", rrfK: 0})` → verify edge case `rrfK` is handled gracefully
37. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "SQLite", includeFacets: true})` → verify faceted categories exist and aren't overly large payloads


## Phase 7: WASM Boundary Verification (batched)

For WASM testing only:

38. Confirm FTS5 tools are NOT present in the tool list (WASM mode excludes them)
39. All 14 non-FTS text tools should work identically in WASM and Native

## Phase 8: Error Message Quality (batched)

40. `sqlite.text.regexMatch({table: "nonexistent_table_xyz", column: "x", pattern: "."})` → structured error
41. `sqlite.text.fuzzyMatch({table: "test_users", column: "nonexistent_col", search: "test"})` → structured error
42. `sqlite.text.validate({table: "test_users", column: "email", pattern: "custom"})` → error about missing `customPattern`
43. `sqlite.text.ftsSearch({table: "nonexistent_fts_xyz", query: "test"})` `[NATIVE ONLY]` → structured error

### Final Cleanup

Drop `stress_*` tables. Confirm `test_articles` row count is still 8. Verify FTS index integrity with `sqlite.text.ftsMatchInfo` `[NATIVE ONLY]`.

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
