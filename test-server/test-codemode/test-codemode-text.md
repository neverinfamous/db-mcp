# db-mcp Code Mode Testing: [text]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **text** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js), apply these adjustments:

- **Skip Phase 2** entirely — all FTS5 tools (items 15-23) are `[NATIVE ONLY]`.
- **Phase 4** (Domain Errors): Skip item 28 (`ftsSearch`) — `[NATIVE ONLY]`.
- **Phase 5** (Zod Validation): Skip items 43-47 (`ftsCreate`, `ftsSearch`, `ftsRebuild`, `ftsMatchInfo`, `ftsHeadline`) — `[NATIVE ONLY]`.
- All other phases (1, 3, 6) are fully WASM-compatible — 14 text tools work identically.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — monitor `metrics.tokenEstimate`.

## Test Database Schema

| Table         | Rows | Key Columns                                       |
| ------------- | ---- | ------------------------------------------------- |
| test_products | 16   | id, name (row 16: `Café Décor Light` — accented), price, category |
| test_users    | 9    | id, username, email, phone, bio                   |
| test_articles | 8    | id, title, body, author, category, published_at   |

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
const validation = await sqlite.text.validate({table: "test_users", column: "email", pattern: "email"});
const domains = await sqlite.text.regexExtract({table: "test_users", column: "email", pattern: "@([^.]+)\\.", groupIndex: 1});
const fuzzy = await sqlite.text.fuzzyMatch({table: "test_products", column: "name", search: "keybord", maxDistance: 3});
if (!validation.success) failures.push("validation failed");
if (!domains.success) failures.push("domain extraction failed");
if (!fuzzy.success) failures.push("fuzzy search failed");
return { failures, success: failures.length === 0, summary: { validEmails: validation?.validCount, domainCount: domains?.matches?.length, fuzzyHits: fuzzy?.matches?.length } };
```

---

### 6.2 — FTS5 rebuild requirement verification `[NATIVE ONLY]`

```javascript
const failures = [];
// Create FTS5 table
await sqlite.text.ftsCreate({sourceTable: "test_users", columns: ["username", "bio"], tableName: "temp_cm_fts_rebuild"});
// Search BEFORE rebuild — should return 0 results
const before = await sqlite.text.ftsSearch({table: "temp_cm_fts_rebuild", query: "admin"});
if (before.rows?.length > 0) failures.push("FTS5 search returned results before rebuild — gotcha #5 may not apply");
// Rebuild to populate index
await sqlite.text.ftsRebuild({table: "temp_cm_fts_rebuild"});
// Search AFTER rebuild — should return results
const after = await sqlite.text.ftsSearch({table: "temp_cm_fts_rebuild", query: "admin"});
if (!after.rows || after.rows.length === 0) failures.push("FTS5 search returned 0 results after rebuild");
// Cleanup
await sqlite.core.writeQuery("DROP TABLE IF EXISTS temp_cm_fts_rebuild");
return { failures, success: failures.length === 0, beforeCount: before.rows?.length || 0, afterCount: after.rows?.length || 0 };
```

Expected: `beforeCount: 0`, `afterCount: > 0` — validates that `ftsRebuild` is required after `ftsCreate` to populate the index (gotcha #5).

---

## Post-Test Procedures

1. **Cleanup**: Drop `temp_*` FTS tables
3. **Triage findings**: Create implementation plan if issues found
4. **Scope of fixes**: Handler code, server-instructions, this prompt
5. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
6. **Commit**: Stage and commit — do NOT push
7. **Token audit**: Report most expensive block
8. **Final summary**: After testing/re-testing
