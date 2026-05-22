# db-mcp Advanced Stress Test: [text]

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

### Category 1: Regex Edge Cases

1. `sqlite.text.regexMatch({table: "test_users", column: "email", pattern: "^[a-z]+\\.[a-z]+@"})` → match dotted local parts (test.user)
2. `sqlite.text.regexMatch({table: "test_users", column: "phone", pattern: "^\\+1"})` → US phone numbers only (6 users, 1 NULL excluded)
3. `sqlite.text.regexExtract({table: "test_users", column: "email", pattern: "@(.+)$", groupIndex: 1})` → full domain extraction
4. `sqlite.text.regexMatch({table: "test_users", column: "bio", pattern: ".*"})` → should match all non-NULL bios (all 9 users have bios)

---

### Category 2: Fuzzy/Phonetic Matching Stress

5. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "Keyborad", maxDistance: 3})` → find "Mechanical Keyboard" (Levenshtein)
6. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "LAPTOP", maxDistance: 2, tokenize: true})` → match "Laptop" token in "Laptop Pro 15"
7. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "xyznonexistent", maxDistance: 1})` → 0 results
8. `sqlite.text.phoneticMatch({table: "test_users", column: "username", search: "jon", algorithm: "soundex"})` → 0 results (Soundex: "jon"=J500 ≠ "johndoe"=J530; single-word usernames aren't tokenized)
9. `sqlite.text.phoneticMatch({table: "test_users", column: "username", search: "smith", algorithm: "soundex"})` → report behavior (janesmith contains "smith" as suffix)
10. `sqlite.text.advancedSearch({table: "test_users", column: "username", searchTerm: "jhn", techniques: ["exact", "fuzzy", "phonetic"], fuzzyThreshold: 0.3})` → should find John via fuzzy/phonetic

---

### Category 3: Text Transformation Edge Cases

11. `sqlite.text.normalize({table: "test_products", column: "name", mode: "strip_accents"})` → `"Café Décor Light"` → `"Cafe Decor Light"` — verify ALL rows returned
12. `sqlite.text.normalize({table: "test_products", column: "name", mode: "nfkc"})` → NFKC normalization
13. `sqlite.text.case({table: "test_users", column: "username", mode: "upper"})` → verify 9 uppercased usernames
14. `sqlite.text.case({table: "test_users", column: "username", mode: "lower"})` → idempotent (already lowercase)
15. `sqlite.text.substring({table: "test_users", column: "email", start: 1, length: 3})` → first 3 chars of each email

---

### Category 4: Validation Patterns

16. `sqlite.text.validate({table: "test_users", column: "email", pattern: "email"})` → expect all 9 valid
17. `sqlite.text.validate({table: "test_users", column: "phone", pattern: "phone"})` → report valid/invalid/null counts
18. `sqlite.text.validate({table: "test_users", column: "email", pattern: "custom", customPattern: "^.+@.+\\..{2,}$"})` → custom regex validation

---

### Category 5: Sentiment Analysis Edge Cases

19. `sqlite.text.sentiment({table: "test_articles", column: "body"})` → sentiment scores for all 8 articles
20. Create `stress_sentiment_test` with rows: `"I love this!"` (positive), `"This is terrible"` (negative), `""` (empty), `NULL` → report behavior for edge cases

---

### Category 6: FTS5 State Integrity `[NATIVE ONLY]`

21. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "database"})` → results about databases
22. `sqlite.text.ftsRebuild({table: "test_articles_fts"})` → success
23. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "database"})` → same results after rebuild (idempotent)
24. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "SQLite AND database"})` → boolean operator
25. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "\"full-text search\""})` → phrase query
26. `sqlite.text.ftsHeadline({table: "test_articles_fts", query: "SQLite"})` → highlighted results

---

### Category 7: WASM Boundary Verification

For WASM testing only:

27. Confirm FTS5 tools are NOT present in the tool list (WASM mode excludes them)
28. All 14 non-FTS text tools should work identically in WASM and Native

---

### Category 8: Error Message Quality

29. `sqlite.text.regexMatch({table: "nonexistent_table_xyz", column: "x", pattern: "."})` → structured error
30. `sqlite.text.fuzzyMatch({table: "test_users", column: "nonexistent_col", search: "test"})` → structured error
31. `sqlite.text.validate({table: "test_users", column: "email", pattern: "custom"})` → error about missing `customPattern`
32. `sqlite.text.ftsSearch({table: "nonexistent_fts_xyz", query: "test"})` `[NATIVE ONLY]` → structured error

---

### Final Cleanup

Drop `stress_*` tables. Confirm `test_articles` row count is still 8. Verify FTS index integrity with `sqlite.text.ftsMatchInfo` `[NATIVE ONLY]`.

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
