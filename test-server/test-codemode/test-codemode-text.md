# db-mcp Tool Group Testing: [text]

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

------------- | ---- | ----------------------------------------------------------------- |
| test_products | 16   | id, name (row 16: `Café Décor Light` — accented), price, category |
| test_users    | 9    | id, username, email, phone, bio                                   |
| test_articles | 8    | id, title, body, author, category, published_at                   |

**Test data:**

- Emails: `@example.com`, `@company.org`, `@gmail.com`, etc. One user (`testuser`) has `test.user@gmail.com`
- Phone formats: `+1-555-0101`, `+44-20-7123-4567`, `+82-2-1234-5678`
- FTS searchable terms: `SQLite`, `database`, `JSON`, `FTS`, `vector`, `API`, `search`, `MCP`

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** Report as ❌.

1. **Batched scripting**: Bundle checks with `failures` array.
2. **Error path testing**: Every tool with `{}` (Zod) and domain error.
3. **Token tracking**: Monitor `metrics.tokenEstimate`.
4. **Coverage Matrix**: `| Tool | Happy Path | Domain Error | Zod Error |`
5. **Deterministic checklist first**.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

## Cleanup

- Temporary tables: `temp_*` and any created `test_articles_fts`. Drop at end of script using `DROP TABLE IF EXISTS`.

---

## Phase 1: Text Tools — Happy Paths (batched)

> Bundle items 1-14 into 1-2 `sqlite_execute_code` calls.

1. `sqlite.text.regexMatch({table: "test_users", column: "email", pattern: "@gmail\\.com$"})` → at least 1 result
2. `sqlite.text.regexExtract({table: "test_users", column: "email", pattern: "@([^.]+)\\.", groupIndex: 1})` → domain parts
3. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "Laptp", maxDistance: 3})` → `Laptop Pro 15`
4. `sqlite.text.phoneticMatch({table: "test_products", column: "name", search: "Labtop"})` → `Laptop Pro 15`
5. `sqlite.text.validate({table: "test_users", column: "email", pattern: "email"})` → all 9 valid
6. `sqlite.text.validate({table: "test_users", column: "phone", pattern: "phone"})` → valid/invalid counts
7. `sqlite.text.case({table: "test_users", column: "username", mode: "upper"})` → uppercased
8. `sqlite.text.normalize({table: "test_products", column: "name", mode: "strip_accents"})` → `Café Décor Light` → `Cafe Decor Light`
9. `sqlite.text.split({table: "test_users", column: "email", delimiter: "@"})` → local + domain parts
10. `sqlite.text.concat({table: "test_users", columns: ["username", "email"], separator: " - "})` → concatenated
11. `sqlite.text.trim({table: "test_users", column: "bio"})` → trimmed
12. `sqlite.text.substring({table: "test_users", column: "username", start: 1, length: 4})` → first 4 chars
13. `sqlite.text.sentiment({text: "I love this product"})` → sentiment scores
14. `sqlite.text.advancedSearch({table: "test_products", column: "name", searchTerm: "keyboard", techniques: ["exact", "fuzzy", "phonetic"]})` → finds `Mechanical Keyboard`

---

## Phase 2: FTS5 Tools `[NATIVE ONLY]` — Happy Paths (batched)

15. `sqlite.text.ftsCreate({sourceTable: "test_users", columns: ["username", "bio"], tableName: "temp_cm_fts"})` → created
16. `sqlite.text.ftsRebuild({table: "temp_cm_fts"})` → rebuilt
17. `sqlite.text.ftsSearch({table: "temp_cm_fts", query: "test*"})` → results
18. `sqlite.text.ftsMatchInfo({table: "temp_cm_fts", query: "test*"})` → match info with scoring
19. `sqlite.text.ftsHeadline({table: "test_articles_fts", query: "SQLite"})` → highlighted results
20. Cleanup: drop `temp_cm_fts` (automatically drops associated sync triggers)
21. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "SQLite"})` → at least 1 result
22. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "MCP protocol"})` → article 3
23. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "nonexistent_term_xyz"})` → 0 results

---

## Phase 3: Text Write Tool (temp table)

24. `sqlite.text.replace({table: "test_users", column: "email", searchPattern: "@example.com", replaceWith: "@test.org", whereClause: "email LIKE '%@example.com'"})` → 1 row affected
25. Revert: `sqlite.text.replace({table: "test_users", column: "email", searchPattern: "@test.org", replaceWith: "@example.com", whereClause: "email LIKE '%@test.org'"})` → 1 row reverted

---

## Phase 4: Text Domain Errors (batched)

🔴 26. `sqlite.text.regexMatch({table: "nonexistent_xyz", column: "x", pattern: "."})` → `{success: false}`
🔴 27. `sqlite.text.fuzzyMatch({table: "test_users", column: "nonexistent_col", search: "test"})` → `{success: false}`
🔴 28. `sqlite.text.ftsSearch({table: "nonexistent_fts_xyz", query: "test"})` `[NATIVE ONLY]` → `{success: false}`

---

## Phase 5: Text Zod Validation (batched)

🔴 29. `sqlite.text.regexExtract({})` → `{success: false}`
🔴 30. `sqlite.text.regexMatch({})` → `{success: false}`
🔴 31. `sqlite.text.split({})` → `{success: false}`
🔴 32. `sqlite.text.concat({})` → `{success: false}`
🔴 33. `sqlite.text.replace({})` → `{success: false}`
🔴 34. `sqlite.text.trim({})` → `{success: false}`
🔴 35. `sqlite.text.case({})` → `{success: false}`
🔴 36. `sqlite.text.substring({})` → `{success: false}`
🔴 37. `sqlite.text.fuzzyMatch({})` → `{success: false}`
🔴 38. `sqlite.text.phoneticMatch({})` → `{success: false}`
🔴 39. `sqlite.text.normalize({})` → `{success: false}`
🔴 40. `sqlite.text.validate({})` → `{success: false}`
🔴 41. `sqlite.text.advancedSearch({})` → `{success: false}`
🔴 42. `sqlite.text.sentiment({})` → `{success: false}`
🔴 43. `sqlite.text.ftsCreate({})` `[NATIVE ONLY]` → `{success: false}`
🔴 44. `sqlite.text.ftsSearch({})` `[NATIVE ONLY]` → `{success: false}`
🔴 45. `sqlite.text.ftsRebuild({})` `[NATIVE ONLY]` → `{success: false}`
🔴 46. `sqlite.text.ftsMatchInfo({})` `[NATIVE ONLY]` → `{success: false}`
🔴 47. `sqlite.text.ftsHeadline({})` `[NATIVE ONLY]` → `{success: false}`

---

## Phase 5.5: Gotcha Edge Cases (batched)

48. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "Laptop Pro 15", tokenize: false, maxDistance: 3})` → full-string matching (default tokenizes into words and matches per-token, gotcha #10)
49. `sqlite.text.phoneticMatch({table: "test_products", column: "name", search: "Labtop", algorithm: "metaphone"})` → test Metaphone algorithm variant (default is Soundex)
50. `sqlite.text.advancedSearch({table: "test_products", column: "name", searchTerm: "keyboard", techniques: ["phonetic"]})` → single technique instead of all 3 — verify it works in isolation

---

## Phase 6: Multi-Step Workflow

### 6.1 — Text analysis pipeline

```javascript
const failures = [];
// Validate emails, extract domains, search fuzzy, combine results
const validation = await sqlite.text.validate({
  table: "test_users",
  column: "email",
  pattern: "email",
});
const domains = await sqlite.text.regexExtract({
  table: "test_users",
  column: "email",
  pattern: "@([^.]+)\\.",
  groupIndex: 1,
});
const fuzzy = await sqlite.text.fuzzyMatch({
  table: "test_products",
  column: "name",
  search: "keybord",
  maxDistance: 3,
});
if (!validation.success) failures.push("validation failed");
if (!domains.success) failures.push("domain extraction failed");
if (!fuzzy.success) failures.push("fuzzy search failed");
return {
  failures,
  success: failures.length === 0,
  summary: {
    validEmails: validation?.validCount,
    domainCount: domains?.matches?.length,
    fuzzyHits: fuzzy?.matches?.length,
  },
};
```

---

### 6.2 — FTS5 rebuild requirement verification `[NATIVE ONLY]`

```javascript
const failures = [];
// Create FTS5 table
await sqlite.text.ftsCreate({
  sourceTable: "test_users",
  columns: ["username", "bio"],
  tableName: "temp_cm_fts_rebuild",
});
// Search BEFORE rebuild — should return >0 results since ftsCreate now auto-populates
const before = await sqlite.text.ftsSearch({
  table: "temp_cm_fts_rebuild",
  query: "developer",
});
if (!before.results || before.results.length === 0)
  failures.push(
    "FTS5 search returned 0 results before rebuild — ftsCreate did not auto-populate the index",
  );
// Rebuild to ensure the tool itself works without error
await sqlite.text.ftsRebuild({ table: "temp_cm_fts_rebuild" });
// Search AFTER rebuild — should return results
const after = await sqlite.text.ftsSearch({
  table: "temp_cm_fts_rebuild",
  query: "developer",
});
if (!after.results || after.results.length === 0)
  failures.push("FTS5 search returned 0 results after rebuild");
// Cleanup
await sqlite.admin.dropTable({table: "temp_cm_fts_rebuild"});
return {
  failures,
  success: failures.length === 0,
  beforeCount: before.results?.length || 0,
  afterCount: after.results?.length || 0,
};
```

Expected: `beforeCount: > 0`, `afterCount: > 0` — validates that `ftsCreate` automatically populates the index (bypassing old gotcha expectations), and that `ftsRebuild` executes successfully.

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
