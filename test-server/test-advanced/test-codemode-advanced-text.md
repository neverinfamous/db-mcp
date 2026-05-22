# db-mcp Advanced Stress Test: [text]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **text** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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

----------------- | ---- | -------------------------------------------------------- |
| test_products     | 16   | id, name (row 16: `Café Décor Light`), price, category   |
| test_users        | 9    | id, username, email, phone, bio                          |
| test_articles     | 8    | id, title, body, author, category                        |
| test_articles_fts | —    | FTS5 virtual table (title, body columns) `[NATIVE ONLY]` |

**Key data:**

- Emails: `@example.com`, `@company.org`, `@gmail.com`; one dotted local: `test.user@gmail.com`
- Phones: `+1-555-0101`, `+44-20-7123-4567`, `+82-2-1234-5678` (1 NULL)
- Usernames: lowercase single-word (`johndoe`, `janesmith`, `testuser`, etc.)

## Naming & Cleanup

- **Temporary tables/FTS**: `stress_*` prefix. Drop at end.

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

## text Group Tools — Native (19)

1. sqlite_regex_extract
2. sqlite_regex_match
3. sqlite_text_split
4. sqlite_text_concat
5. sqlite_text_replace
6. sqlite_text_trim
7. sqlite_text_case
8. sqlite_text_substring
9. sqlite_fuzzy_match
10. sqlite_phonetic_match
11. sqlite_text_normalize
12. sqlite_text_validate
13. sqlite_advanced_search
14. sqlite_text_sentiment
15. sqlite_fts_create `[NATIVE ONLY]`
16. sqlite_fts_search `[NATIVE ONLY]`
17. sqlite_fts_rebuild `[NATIVE ONLY]`
18. sqlite_fts_match_info `[NATIVE ONLY]`
19. sqlite_fts_headline `[NATIVE ONLY]`

### WASM (14)

Same minus the 5 FTS5 tools (items 15-19).

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
