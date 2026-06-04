# db-mcp Code Mode Testing: [text]

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
- `sqlite.text.hybridSearch`
- `sqlite.text.replace`
- _(cross-group helpers used in test procedures)_
- `sqlite.core.dropTable`

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
14. `sqlite.text.advancedSearch({table: "test_products", column: "name", searchTerm: "keyboard", techniques: ["exact", "fuzzy", "phonetic"], includeFacets: true})` → finds `Mechanical Keyboard` and includes faceted breakdown

## Phase 2: FTS5 Tools `[NATIVE ONLY]` — Happy Paths (batched)

15. `sqlite.text.ftsCreate({sourceTable: "test_users", columns: ["username", "bio"], tableName: "temp_cm_fts"})` → created
16. `sqlite.text.ftsRebuild({table: "temp_cm_fts"})` → rebuilt
17. `sqlite.text.ftsSearch({table: "temp_cm_fts", query: "test*"})` → results
18. `sqlite.text.ftsMatchInfo({table: "temp_cm_fts", query: "test*"})` → match info with scoring
19. `sqlite.text.ftsHeadline({table: "test_articles_fts", query: "SQLite"})` → highlighted results
20. Cleanup: drop `temp_cm_fts` (automatically drops associated sync triggers)
21. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "SQLite"})` → at least 1 result
22. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "MCP protocol", includeFacets: true})` → article 3 and facets block
23. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "*", limit: 1})` → return exactly 1 result and `nextCursor` populated
24. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "*", limit: 1, cursor: "<nextCursor>"})` → return next result via opaque pagination
25. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "nonexistent_term_xyz"})` → 0 results
26. Create FTS table for embeddings: `sqlite.text.ftsCreate({sourceTable: "test_embeddings", columns: ["content", "category"], tableName: "test_embeddings_fts"})`
27. `sqlite.text.hybridSearch({table: "test_embeddings", query: "future of interfaces", queryVector: [0.1, 0.2, -0.1, 0.5, -0.3, 0.8, -0.2, 0.4], vectorColumn: "embedding", ftsTable: "test_embeddings_fts", rrfK: 60})` → results combining vector distance and FTS rank via Reciprocal Rank Fusion
28. Cleanup: drop `test_embeddings_fts`

## Phase 3: Text Write Tool (temp table)

29. `sqlite.text.replace({table: "test_users", column: "email", searchPattern: "@example.com", replaceWith: "@test.org", whereClause: "email LIKE '%@example.com'"})` → 1 row affected
30. Revert: `sqlite.text.replace({table: "test_users", column: "email", searchPattern: "@test.org", replaceWith: "@example.com", whereClause: "email LIKE '%@test.org'"})` → 1 row reverted

## Phase 4: Text Domain Errors (batched)

🔴 31. `sqlite.text.regexMatch({table: "nonexistent_xyz", column: "x", pattern: "."})` → `{success: false}`
🔴 32. `sqlite.text.fuzzyMatch({table: "test_users", column: "nonexistent_col", search: "test"})` → `{success: false}`
🔴 33. `sqlite.text.ftsSearch({table: "nonexistent_fts_xyz", query: "test"})` `[NATIVE ONLY]` → `{success: false}`
🔴 34. `sqlite.text.ftsSearch({table: "test_articles_fts", query: '"unbalanced AND OR NOT quote'})` `[NATIVE ONLY]` → should gracefully handle malformed FTS syntax without crashing the parser (via `sanitizeFtsQuery`)

## Phase 5: Gotcha Edge Cases (batched)

35. `sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "Laptop Pro 15", tokenize: false, maxDistance: 3})` → full-string matching (default tokenizes into words and matches per-token, gotcha #10)
36. `sqlite.text.phoneticMatch({table: "test_products", column: "name", search: "Labtop", algorithm: "metaphone"})` → test Metaphone algorithm variant (default is Soundex)
37. `sqlite.text.advancedSearch({table: "test_products", column: "name", searchTerm: "keyboard", techniques: ["phonetic"]})` → single technique instead of all 3 — verify it works in isolation

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
await sqlite.core.dropTable({ table: "temp_cm_fts_rebuild" });
return {
  failures,
  success: failures.length === 0,
  beforeCount: before.results?.length || 0,
  afterCount: after.results?.length || 0,
};
```

Expected: `beforeCount: > 0`, `afterCount: > 0` — validates that `ftsCreate` automatically populates the index (bypassing old gotcha expectations), and that `ftsRebuild` executes successfully.

## Phase 7: Zod Validation Sweep

🔴 38. `sqlite.text.regexExtract({})` → `{success: false}`
🔴 39. `sqlite.text.regexMatch({})` → `{success: false}`
🔴 40. `sqlite.text.split({})` → `{success: false}`
🔴 41. `sqlite.text.concat({})` → `{success: false}`
🔴 42. `sqlite.text.replace({})` → `{success: false}`
🔴 43. `sqlite.text.trim({})` → `{success: false}`
🔴 44. `sqlite.text.case({})` → `{success: false}`
🔴 45. `sqlite.text.substring({})` → `{success: false}`
🔴 46. `sqlite.text.fuzzyMatch({})` → `{success: false}`
🔴 47. `sqlite.text.phoneticMatch({})` → `{success: false}`
🔴 48. `sqlite.text.normalize({})` → `{success: false}`
🔴 49. `sqlite.text.validate({})` → `{success: false}`
🔴 50. `sqlite.text.advancedSearch({})` → `{success: false}`
🔴 51. `sqlite.text.sentiment({})` → `{success: false}`
🔴 52. `sqlite.text.ftsCreate({})` `[NATIVE ONLY]` → `{success: false}`
🔴 53. `sqlite.text.ftsSearch({})` `[NATIVE ONLY]` → `{success: false}`
🔴 54. `sqlite.text.ftsRebuild({})` `[NATIVE ONLY]` → `{success: false}`
🔴 55. `sqlite.text.ftsMatchInfo({})` `[NATIVE ONLY]` → `{success: false}`
🔴 56. `sqlite.text.ftsHeadline({})` `[NATIVE ONLY]` → `{success: false}`
🔴 57. `sqlite.text.hybridSearch({})` → `{success: false}`

## Phase 8: Wrong-Type Numeric Coercion

🔴 58. `sqlite.text.fuzzyMatch({table: "test_users", column: "username", search: "test", maxDistance: "abc"})` → handler error, NOT raw MCP `-32602`
🔴 59. `sqlite.text.substring({table: "test_users", column: "username", start: "abc", length: 5})` → handler error, NOT raw MCP
🔴 60. `sqlite.text.ftsSearch({table: "test_articles_fts", query: "SQLite", limit: "abc"})` `[NATIVE ONLY]` → handler error, NOT raw MCP

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
