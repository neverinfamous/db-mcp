# db-mcp (SQLite) Tool Group Testing: [json]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All 24 JSON tools are fully WASM-compatible. No items to skip or adjust.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **json** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB and suggest a concrete optimization (e.g., filter system tables, add `compact` option, omit empty arrays).

## Test Database Schema

The test database (test-server/test.db) contains these tables with JSON-relevant columns:

| Table             | Rows | Columns                                                                       | JSON Columns                                                                              |
| ----------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| test_products     | 16   | id, name, description, price, category, created_at                            | —                                                                                         |
| test_orders       | 20   | id, product_id (FK), customer_name, quantity, total_price, order_date, status | —                                                                                         |
| test_jsonb_docs   | 6    | id, doc, metadata, tags, created_at                                           | **doc**, **metadata** (nested), **tags** (array)                                          |
| test_articles     | 8    | id, title, body, author, category, published_at                               | —                                                                                         |
| test_users        | 9    | id, username, email, phone, bio, created_at                                   | —                                                                                         |
| test_measurements | 200  | id, sensor_id, temperature, humidity, pressure, measured_at                   | —                                                                                         |
| test_embeddings   | 20   | id, content, category, embedding                                              | **embedding** (8-dim float array); category values: database, fitness, food, tech, travel |
| test_locations    | 15   | id, name, city, latitude, longitude, type                                     | —                                                                                         |
| test_categories   | 17   | id, name, path, level                                                         | —                                                                                         |
| test_events       | 100  | id, event_type, user_id (INT, 8 values), payload, event_date                  | **payload** (JSON)                                                                        |

**Primary JSON test tables:**

- `test_jsonb_docs.doc` — Row 1: `{"type":"article","title":"Getting Started with SQLite","author":"Alice","views":1250,"rating":4.5}`, Row 3: `{"type":"video",...,"duration":3600}`, Row 4 has `nested.level1.level2 = "deep value"`
- `test_jsonb_docs.metadata` — Object with keys: source, language, version, quality, subscribers
- `test_jsonb_docs.tags` — Array of strings like `["database","tutorial","beginner"]`
- `test_events.payload` — Object with keys: page (values: home, products, cart, checkout), session (values: sess_1000+)

> **Note:** String values in test data use **lowercase** (e.g., `category = 'electronics'`, not `'Electronics'`). Use case-sensitive matching in queries.

> **Note:** `test_measurements.sensor_id` is an **INTEGER** column (values 1-5), not a string. Use `sensor_id = 1`, not `sensor_id = 'S001'`.

> **Note:** When testing `sqlite_execute_code`, do **not** pass `readonly: true` unless specifically testing read-only filtering. The `readonly` flag makes write methods return structured errors (`{success: false, code: "CODEMODE_READONLY_VIOLATION"}`). Methods remain callable but reject write operations. Use `readonly: false` (or omit it) to get the full API surface.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

1. Use existing `test_*` tables for read operations (SELECT, COUNT, queries)
2. Create temporary tables with `temp_*` prefix for write operations
3. Test each tool with realistic inputs based on the schema above
4. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads
5. Do not mention what already works well or issues well documented in help resources and runtime hints which are already optimal
6. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) a domain error (nonexistent table, invalid column, missing required parameter) and (b) a **Zod validation error** (call the tool with `{}` empty params if it has required parameters, or pass the wrong type). Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame. See the "Structured Error Response Pattern" section below for how to distinguish the two.
7. **Output schema testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error.
8. **Deterministic checklist first**: Complete ALL items in the group-specific checklist before moving to freeform exploration.
9. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

All tools should return errors as structured objects instead of throwing. A thrown error propagates as a raw MCP error, which is unhelpful to clients. The expected pattern:

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

**Zod refinement leak pattern:** `DatabaseAdapter.registerTool()` uses `.partial()` on input schemas so the SDK accepts `{}`. But `.partial()` only makes keys **optional** — it does NOT strip refinements like `.min(1)`, `.max(90)`, or `.min(-90).max(90)`. This applies to **ALL types** — strings, arrays, AND numbers:

- `z.string().min(1)` + empty `""` → SDK rejects with raw MCP `-32602`
- `z.array().min(1)` + empty `[]` → SDK rejects with raw MCP `-32602`
- `z.number().min(-90).max(90)` + value `91` → SDK rejects with raw MCP `-32602`

**Fix:** Remove ALL `.min(N)` / `.max(N)` refinements from the schema and validate inside the handler instead.

**Required enum coercion pattern:** For **optional** enum params with defaults, `z.preprocess(coercer, z.enum([...]).optional().default(...))` works. For **required** enum params (no `.optional().default(...)`), this pattern **fails**: the SDK's `.partial()` wraps the preprocess in `.optional()`, but the inner `z.enum()` still rejects `undefined` → raw MCP `-32602`. **Fix:** Use `z.string()` in the schema and validate the enum inside the handler's `try/catch`.

**What to report:**

- If a tool call returns a raw MCP error (no JSON body with `success` field), report it as ❌ with the tool name and the raw error message
- If a tool returns `{success: false, error: "..."}`, that is the correct behavior — do not report it as a failure
- If a tool returns a successful response for an obviously invalid input (e.g., nonexistent table returns `{success: true}`), report it as ⚠️

### Wrong-Type Numeric Parameter Coercion

For every tool with optional numeric parameters (e.g., `limit`, `sampleSize`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.

### Output Schema Validation Errors

The MCP SDK enforces `additionalProperties: false` on **output** schemas. If a handler returns fields not declared in its output schema, the SDK rejects the response with a raw `-32602` error — even though the handler logic succeeded.

**How to detect:** If a tool call with **correct, valid inputs** returns a raw MCP `-32602` mentioning "does not match the tool's output schema" or "additional properties", report as ❌ with both the tool name and the missing field(s).

### Error Consistency Audit

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌.
2. **Error field name**: All `{success: false}` responses should use `error` as the field name.
3. **Zod validation leaks**: If calling a tool with an invalid enum value or missing required field produces a raw MCP `-32602` error instead of a structured response, report as ❌.
4. **Output schema leaks**: If calling a tool with valid inputs produces a raw MCP `-32602` mentioning "output schema", report as ❌.
5. **Centralized error formatting**: db-mcp uses `DbMcpError`. Inconsistent formatting → report as ⚠️.
6. **Orphaned output schemas**: If a schema is exported from `src/adapters/sqlite/output-schemas/` but not wired to the tool definition, report as ⚠️.
7. **Inline output schemas**: If any tool defines `outputSchema: z.object({...})` inline instead of importing from `output-schemas/`, report as ⚠️.

## Error Path Testing Checklist

| Error Scenario | Example Input |
|----------------|---------------|
| Nonexistent table | `table: "nonexistent_xyz"` |
| Invalid column name | `column: "nonexistent_col"` |
| Missing required field | Omit `table`, `column`, etc. |
| **Zod validation (empty params)** | `{}` (must return handler error, not MCP `-32602`) |
| **Zod validation (wrong type)** | Pass string where number expected |

### Split Schema Pattern Verification

All tools use the Split Schema pattern. Verify:

1. **Parameter visibility**: For tools with optional parameters, make a direct MCP call using those parameters. If the tool ignores or rejects documented parameters, report as a Split Schema violation.
2. **Alias acceptance**: For tools with documented parameter aliases, verify that direct MCP tool calls correctly accept the aliases.

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_` (e.g., `temp_json_test`)
- After testing, clean up. If DROP fails due to a database lock, move on.

---

## Group Focus: json

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### json Group Tools (24)

4. sqlite_json_valid
5. sqlite_json_extract
6. sqlite_json_set
7. sqlite_json_remove
8. sqlite_json_type
9. sqlite_json_array_length
10. sqlite_json_array_append
11. sqlite_json_keys
12. sqlite_json_each
13. sqlite_json_group_array
14. sqlite_json_group_object
15. sqlite_json_pretty
16. sqlite_jsonb_convert
17. sqlite_json_storage_info
18. sqlite_json_normalize_column
19. sqlite_json_insert
20. sqlite_json_update
21. sqlite_json_select
22. sqlite_json_query
23. sqlite_json_validate_path
24. sqlite_json_merge
25. sqlite_json_analyze_schema
26. sqlite_create_json_collection
27. sqlite_json_security_scan
28. sqlite_execute_code

**Test data reference (test_jsonb_docs):**

| id  | doc.type | doc.author | doc.views | metadata.source | tags                                 |
| --- | -------- | ---------- | --------- | --------------- | ------------------------------------ |
| 1   | article  | Alice      | 1250      | blog            | ["database","tutorial","beginner"]   |
| 2   | article  | Bob        | 890       | docs            | ["json","advanced","sqlite"]         |
| 3   | video    | Carol      | 5400      | youtube         | ["mcp","protocol","ai"]              |
| 4   | article  | David      | 670       | wiki            | ["fts5","search","indexing"]         |
| 5   | podcast  | Eve        | —         | spotify         | ["performance","tips","podcast"]     |
| 6   | article  | Frank      | 2100      | medium          | ["vector","embeddings","similarity"] |

Row 4 has nested path: `doc → nested → level1 → level2 = "deep value"`

**Checklist:**

1. `sqlite_json_extract({table: "test_jsonb_docs", column: "doc", path: "$.author", whereClause: "id = 1"})` → result contains `"Alice"`
2. `sqlite_json_extract({table: "test_jsonb_docs", column: "doc", path: "$.nested.level1.level2", whereClause: "id = 4"})` → result contains `"deep value"`
3. `sqlite_json_keys({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → keys include `type`, `title`, `author`, `views`, `rating`
4. `sqlite_json_type({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → `"array"`
5. `sqlite_json_type({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → `"object"`
6. `sqlite_json_array_length({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → `3`
7. `sqlite_json_valid({json: "{\"type\":\"article\",\"title\":\"Getting Started with SQLite\",\"author\":\"Alice\",\"views\":1250,\"rating\":4.5}"})` → `{valid: true}`
8. `sqlite_json_validate_path({path: "$.author"})` → valid
9. `sqlite_json_pretty({json: "{\"type\":\"article\",\"author\":\"Alice\",\"views\":1250}"})` → formatted JSON with indentation
10. `sqlite_json_each({table: "test_jsonb_docs", column: "tags", whereClause: "id = 1"})` → 3 expanded rows: `database`, `tutorial`, `beginner`
11. `sqlite_json_analyze_schema({table: "test_jsonb_docs", column: "doc"})` → inferred schema with `type`, `author`, etc.
12. `sqlite_json_merge({table: "test_jsonb_docs", column: "doc", mergeData: {"featured": true}, whereClause: "id = 999"})` → `{rowsAffected: 0}` (no matching rows, non-destructive test)
13. `sqlite_json_select({table: "test_jsonb_docs", column: "doc", paths: ["$.author", "$.views"]})` → rows with author and views columns
14. `sqlite_json_query({table: "test_jsonb_docs", column: "doc", filterPaths: {"$.type": "article"}})` → 4 rows (rows 1,2,4,6)
15. `sqlite_json_storage_info({table: "test_jsonb_docs", column: "doc"})` → storage analysis
16. `sqlite_json_group_array({table: "test_jsonb_docs", valueColumn: "json_extract(doc, '$.author')", allowExpressions: true})` → array of all authors `["Alice","Bob","Carol","David","Eve","Frank"]`
17. `sqlite_json_group_object({table: "test_jsonb_docs", keyColumn: "json_extract(doc, '$.author')", valueColumn: "json_extract(doc, '$.views')", allowExpressions: true})` → object mapping authors to view counts
18. `sqlite_jsonb_convert({table: "test_jsonb_docs", column: "doc", whereClause: "id = 1"})` → JSONB binary conversion result
19. `sqlite_json_normalize_column({table: "test_jsonb_docs", column: "doc"})` → normalization report for the doc column

**Write operations (use temp tables):**

20. `sqlite_create_json_collection({tableName: "temp_json_test"})` → creates table with JSON columns
21. `sqlite_json_set` on `temp_json_test` → modify a JSON value
22. `sqlite_json_update` on `temp_json_test` → update an existing key's value (distinct from json_set: update requires key to exist)
23. `sqlite_json_insert` on `temp_json_test` → insert new key
24. `sqlite_json_remove` on `temp_json_test` → remove a key
25. `sqlite_json_array_append` on `temp_json_test` → add to array
26. Cleanup: drop `temp_json_test`

**Code mode testing:**

27. `sqlite_execute_code({code: "const result = await sqlite.json.extract({table: 'test_jsonb_docs', column: 'doc', path: '$.author', whereClause: 'id = 1'}); return result;"})` → result contains `"Alice"`
28. `sqlite_execute_code({code: "const keys = await sqlite.json.keys({table: 'test_jsonb_docs', column: 'doc', whereClause: 'id = 1'}); return keys;"})` → keys include `type`, `title`, `author`

**Error path testing:**

🔴 29. `sqlite_json_extract({table: "nonexistent_table_xyz", column: "doc", path: "$.x"})` → structured error
🔴 30. `sqlite_json_extract({table: "test_jsonb_docs", column: "nonexistent_col", path: "$.x"})` → report behavior
🔴 31. `sqlite_json_validate_path({path: "invalid path !@#"})` → report behavior

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 32. `sqlite_json_valid({})` → handler error
🔴 33. `sqlite_json_extract({})` → handler error
🔴 34. `sqlite_json_set({})` → handler error
🔴 35. `sqlite_json_remove({})` → handler error
🔴 36. `sqlite_json_type({})` → handler error
🔴 37. `sqlite_json_array_length({})` → handler error
🔴 38. `sqlite_json_array_append({})` → handler error
🔴 39. `sqlite_json_keys({})` → handler error
🔴 40. `sqlite_json_each({})` → handler error
🔴 41. `sqlite_json_group_array({})` → handler error
🔴 42. `sqlite_json_group_object({})` → handler error
🔴 43. `sqlite_json_pretty({})` → handler error
🔴 44. `sqlite_jsonb_convert({})` → handler error
🔴 45. `sqlite_json_storage_info({})` → handler error
🔴 46. `sqlite_json_normalize_column({})` → handler error
🔴 47. `sqlite_json_insert({})` → handler error
🔴 48. `sqlite_json_update({})` → handler error
🔴 49. `sqlite_json_select({})` → handler error
🔴 50. `sqlite_json_query({})` → handler error
🔴 51. `sqlite_json_validate_path({})` → handler error
🔴 52. `sqlite_json_merge({})` → handler error
🔴 53. `sqlite_json_analyze_schema({})` → handler error
🔴 54. `sqlite_create_json_collection({})` → handler error
🔴 55. `sqlite_json_security_scan({})` → handler error

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

---

## Troubleshooting

### Database is locked / file in use

1. Check for Node.js processes using the database: `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"`
2. If an MCP server is running, the database will be locked. The reset script handles this by overwriting in-place
3. WAL/journal files (`test.db-wal`, `test.db-shm`) are normal — they are cleaned up on database close

### Reset script fails

1. Run with `-Verbose`: `.\reset-database.ps1 -Verbose`
2. If `sqlite3` is not in PATH, the script falls back to Node.js with `better-sqlite3`
3. Backup `.db` files left by `sqlite_backup` tests are cleaned up automatically
