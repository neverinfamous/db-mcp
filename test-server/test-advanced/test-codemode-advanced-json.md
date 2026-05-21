# Advanced Stress Test — db-mcp — [json]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're in Native mode. If there is nothing to fix, don't update UNRELEASED.md.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode).

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js): All 24 JSON tools are fully WASM-compatible. No categories to skip or adjust.

## Code Mode Execution

- **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

All tests via `sqlite_execute_code`. Use `sqlite.json.*` for JSON tools, `sqlite.core.*` for read/write.
State persists across calls. Do NOT pass `readonly: true`. Group related tests into single calls.

## Test Database Schema

| Table           | Rows | Key Columns                                                   |
| --------------- | ---- | ------------------------------------------------------------- |
| test_jsonb_docs | 6    | id, doc (JSON), metadata (JSON), tags (JSON array), created_at |
| test_events     | 100  | id, event_type, user_id, payload (JSON), event_date           |

**test_jsonb_docs key data:**
- Row 1: `doc.type="article"`, `doc.author="Alice"`, `doc.views=1250`, `doc.rating=4.5`
- Row 4: `doc.nested.level1.level2 = "deep value"`
- Row 5: `doc.type="podcast"` (no `doc.views` field)

## Naming & Cleanup

- **Temporary tables**: `stress_*` prefix. Drop at end.
- If DROP fails due to lock, note and move on.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`) | ✅ Confirmed (inline only)

### Error Message Quality Rating

| Level | Verdict |
| --- | --- |
| 5 - Excellent (name + code + context) | ✅ |
| 4 - Good (name) | ✅ |
| 3 - Adequate (raw SQLite, informative) | ⚠️ |
| 2 - Poor (no object name) | ⚠️ |
| 1 - Useless (generic) | ❌ |

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## json Group Tools (24 + codemode)

1. sqlite_json_valid
2. sqlite_json_extract
3. sqlite_json_set
4. sqlite_json_remove
5. sqlite_json_type
6. sqlite_json_array_length
7. sqlite_json_array_append
8. sqlite_json_keys
9. sqlite_json_each
10. sqlite_json_group_array
11. sqlite_json_group_object
12. sqlite_json_pretty
13. sqlite_jsonb_convert
14. sqlite_json_storage_info
15. sqlite_json_normalize_column
16. sqlite_json_insert
17. sqlite_json_update
18. sqlite_json_select
19. sqlite_json_query
20. sqlite_json_validate_path
21. sqlite_json_merge
22. sqlite_json_analyze_schema
23. sqlite_create_json_collection
24. sqlite_json_security_scan

---

### Category 1: Deep JSON Operations

**1.1 Deeply Nested Access**

1. `sqlite.json.extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.level2", whereClause: "id = 4"})` → `"deep value"`
2. `sqlite.json.extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.nonexistent", whereClause: "id = 4"})` → null or empty (not error)
3. `sqlite.json.extract({table: "test_jsonb_docs", column: "doc", path: "$.nonexistent_key", whereClause: "id = 1"})` → null or empty

**1.2 Array Manipulation Edge Cases**

4. `sqlite.json.arrayLength({table: "test_jsonb_docs", column: "tags", whereClause: "id = 3"})` → 3 (["mcp","protocol","ai"])
5. Create `stress_json_test` with a row containing `tags = '[]'` (empty array) → `sqlite.json.arrayLength` → 0
6. `sqlite.json.each` on an empty array → 0 expanded rows (not error)

**1.3 Merge Conflict Behavior**

> `sqlite_json_merge` uses `json_patch()` which follows RFC 7396 merge-patch semantics.

Insert test rows into `stress_json_test`: row 2 = `{"a": 1, "b": {"c": 2}}`, row 3 = `{"a": [1, 2]}`:

7. `sqlite.json.merge({table: "stress_json_test", column: "tags", mergeData: {"b": {"d": 3}}, whereClause: "id = 2"})` → verify deep merge: `b.c` preserved, `b.d` added
8. `sqlite.json.merge({table: "stress_json_test", column: "tags", mergeData: {"a": [3, 4]}, whereClause: "id = 3"})` → arrays replaced (not concatenated) per RFC 7396

**1.4 Type Coercion Edge Cases**

9. `sqlite.json.type({table: "test_jsonb_docs", column: "doc", path: "$.views", whereClause: "id = 1"})` → `"integer"` (views=1250)
10. `sqlite.json.type({table: "test_jsonb_docs", column: "doc", path: "$.rating", whereClause: "id = 1"})` → `"real"` (rating=4.5)
11. `sqlite.json.type({table: "test_jsonb_docs", column: "doc", path: "$.nested", whereClause: "id = 4"})` → `"object"`

---

### Category 2: JSON Query & Filter Stress

> `sqlite_json_query` uses `filterPaths` (equality-only, `Record<path, value>`) and `selectPaths`.

12. `sqlite.json.query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article"}})` → 4 rows
13. `sqlite.json.query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article", "$.author": "Alice"}, selectPaths: ["$.title", "$.views"]})` → 1 row (Alice's article)
14. `sqlite.json.query({table: "test_events", column: "payload", filterPaths: {"$.page": "home"}})` → 25 rows (every 4th event)

---

### Category 3: Error Message Quality

15. `sqlite.json.extract({table: "nonexistent_table_xyz", column: "doc", path: "$.x"})` → structured error mentioning table name
16. `sqlite.json.extract({table: "test_jsonb_docs", column: "nonexistent_col", path: "$.x"})` → structured error mentioning column
17. `sqlite.json.set({table: "test_jsonb_docs", column: "doc", path: "$.author", value: "\"Modified\"", whereClause: "id = 99999"})` → report behavior for nonexistent row
18. `sqlite.json.validatePath({path: ""})` → report behavior for empty path

---

### Category 4: Write Operation Safety

19. Create `stress_json_write` table → insert 3 JSON documents → perform `sqlite.json.set`, `sqlite.json.remove`, `sqlite.json.insert` → verify mutations → cleanup
    > **Note:** `sqlite_json_insert` is a **row-level INSERT** (creates new row with JSON data, provided via the `data` parameter), not a path-level JSON insert.
20. `sqlite.json.normalizeColumn(...)` on `stress_json_write` → verify keys sorted/compacted without data loss

---

### Category 5: Security Scan Stress

21. `sqlite.json.securityScan({table: "test_jsonb_docs", column: "doc"})` → scan result with `riskLevel`
22. Create `stress_json_inject` with rows containing suspicious patterns (`<script>`, `' OR 1=1`, `${cmd}`) → `sqlite.json.securityScan` → verify detection
23. Cleanup: drop `stress_json_inject`

---

### Final Cleanup

Drop all `stress_*` tables. Confirm `test_jsonb_docs` row count is still 6 and contents unchanged.

## Post-Test Procedures

1. **Cleanup**: Drop all `stress_*` objects
2. **Fix EVERY finding** — ❌, ⚠️, 📦. Consistent with `code-map.md`
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Re-test**: After server rebuild
6. **Token audit**: Report most expensive block
