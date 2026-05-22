# db-mcp Code Mode Testing: [text]

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

## Group Focus: text

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.text.regexMatch`
- `sqlite.text.regexExtract`
- `sqlite.text.fuzzyMatch`
- `sqlite.text.phoneticMatch`
- `sqlite.text.validate`
- `sqlite.text.case`
- `sqlite.text.normalize`
- `sqlite.text.split`
- `sqlite.text.concat`
- `sqlite.text.trim`
- `sqlite.text.substring`
- `sqlite.text.sentiment`
- `sqlite.text.advancedSearch`
- `sqlite.text.ftsCreate`
- `sqlite.text.ftsRebuild`
- `sqlite.text.ftsSearch`
- `sqlite.text.ftsMatchInfo`
- `sqlite.text.ftsHeadline`
- `sqlite.text.replace`
- `sqlite.admin.dropTable`

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


## Phase 3: Text Write Tool (temp table)

24. `sqlite.text.replace({table: "test_users", column: "email", searchPattern: "@example.com", replaceWith: "@test.org", whereClause: "email LIKE '%@example.com'"})` → 1 row affected
25. Revert: `sqlite.text.replace({table: "test_users", column: "email", searchPattern: "@test.org", replaceWith: "@example.com", whereClause: "email LIKE '%@test.org'"})` → 1 row reverted


## Phase 4: Text Domain Errors (batched)

🔴 26. `sqlite.text.regexMatch({table: "nonexistent_xyz", column: "x", pattern: "."})` → `{success: false}`
🔴 27. `sqlite.text.fuzzyMatch({table: "test_users", column: "nonexistent_col", search: "test"})` → `{success: false}`
🔴 28. `sqlite.text.ftsSearch({table: "nonexistent_fts_xyz", query: "test"})` `[NATIVE ONLY]` → `{success: false}`


## Phase 5: Gotcha Edge Cases (batched)

29. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "Laptop Pro 15", tokenize: false, maxDistance: 3})` → full-string matching (default tokenizes into words and matches per-token, gotcha #10)
30. `sqlite.text.phoneticMatch({table: "test_products", column: "name", search: "Labtop", algorithm: "metaphone"})` → test Metaphone algorithm variant (default is Soundex)
31. `sqlite.text.advancedSearch({table: "test_products", column: "name", searchTerm: "keyboard", techniques: ["phonetic"]})` → single technique instead of all 3 — verify it works in isolation


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


## Phase 7: Zod Validation Sweep

🔴 32. `sqlite.text.regexExtract({})` → `{success: false}`
🔴 33. `sqlite.text.regexMatch({})` → `{success: false}`
🔴 34. `sqlite.text.split({})` → `{success: false}`
🔴 35. `sqlite.text.concat({})` → `{success: false}`
🔴 36. `sqlite.text.replace({})` → `{success: false}`
🔴 37. `sqlite.text.trim({})` → `{success: false}`
🔴 38. `sqlite.text.case({})` → `{success: false}`
🔴 39. `sqlite.text.substring({})` → `{success: false}`
🔴 40. `sqlite.text.fuzzyMatch({})` → `{success: false}`
🔴 41. `sqlite.text.phoneticMatch({})` → `{success: false}`
🔴 42. `sqlite.text.normalize({})` → `{success: false}`
🔴 43. `sqlite.text.validate({})` → `{success: false}`
🔴 44. `sqlite.text.advancedSearch({})` → `{success: false}`
🔴 45. `sqlite.text.sentiment({})` → `{success: false}`
🔴 46. `sqlite.text.ftsCreate({})` `[NATIVE ONLY]` → `{success: false}`
🔴 47. `sqlite.text.ftsSearch({})` `[NATIVE ONLY]` → `{success: false}`
🔴 48. `sqlite.text.ftsRebuild({})` `[NATIVE ONLY]` → `{success: false}`
🔴 49. `sqlite.text.ftsMatchInfo({})` `[NATIVE ONLY]` → `{success: false}`
🔴 50. `sqlite.text.ftsHeadline({})` `[NATIVE ONLY]` → `{success: false}`


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
