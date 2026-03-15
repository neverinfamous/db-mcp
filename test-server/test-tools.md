# db-mcp (SQLite) Tool Testing (Native Mode)

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group listed below in using the live MCP server tool calls directly for testing, not scripts/terminal.

**FTS Testing Notes (Text Group Only):**

- After `sqlite_fts_create`, always call `sqlite_fts_rebuild` before searching
- `test_articles` searchable terms: `SQLite`, `database`, `JSON`, `FTS`, `vector`, `API`, `search`, `MCP`

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

1. Use existing `test_*` tables for read operations (SELECT, COUNT, queries)
2. Create temporary tables with `temp_*` prefix for write operations
3. Test each tool with realistic inputs based on the schema above
4. Use `test-server/sample.csv` for CSV tool testing (columns: id, name, category, price, quantity, created_at)
5. Attempt to clean up `temp_*` tables after testing with `sqlite_drop_table` or `sqlite_write_query`. If cleanup fails due to a database lock (the MCP server or IDE may hold the `.db` file open), leftover `temp_*` tables are harmless — they have no foreign keys or triggers and are cleaned up when the test database is regenerated. Do not restart the IDE to force cleanup.
6. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads
7. Do not mention what already works well or issues well documented in help resources and runtime hints which are already optimal
8. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) a domain error (nonexistent table, invalid column, missing required parameter) and (b) a **Zod validation error** (call the tool with `{}` empty params if it has required parameters, or pass the wrong type). Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame. See the "Structured Error Response Pattern" section below for how to distinguish the two. This is the most common deficiency found across tool groups.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

9. **Deterministic checklist first**: Complete ALL items in the group-specific checklist below before moving to freeform exploration. The checklist uses exact inputs and expected outputs to ensure reproducible coverage every run.
10. **Tool annotation verification — DO NOT SKIP!** This is the one test that requires terminal, not MCP tool calls. Run `node test-server/test-tool-annotations.mjs` (requires `npm run build` first) to verify all tools have `openWorldHint: false`. db-mcp tools are local database operations and must not hint at external access.

## Structured Error Response Pattern

All tools should return errors as structured objects instead of throwing. A thrown error propagates as a raw MCP error, which is unhelpful to clients. The expected pattern:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error — How to Distinguish

There are two kinds of error responses. Only one is correct:

| Type                 | Source                                                             | What you see                                                                                                          | Verdict            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields                                                               | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field | Bug — report as ❌ |

**Concrete examples:**

```
✅ Handler error (correct):
{"success": false, "error": "Table 'nonexistent_xyz' does not exist"}

❌ MCP error (bug — handler threw instead of catching):
content: [{type: "text", text: "Error: SQLITE_ERROR: no such table: nonexistent_xyz"}]
isError: true
```

The MCP error case means the handler is missing a `try/catch` block. When testing, if you see a raw error string (especially one containing `SQLITE_ERROR` without a `success` field), report it as ❌.

### Zod Validation Errors

Calling a tool with wrong parameter types or missing required fields triggers a Zod validation error. If the handler has no outer `try/catch`, this surfaces as a raw MCP error (often `-32602`). Test every tool with `{}` (empty params) if it has required parameters — the response must be a handler error, not an MCP error.

**Zod refinement leak pattern:** `DatabaseAdapter.registerTool()` uses `.partial()` on input schemas so the SDK accepts `{}`. But `.partial()` only makes keys **optional** — it does NOT strip refinements like `.min(1)`, `.max(90)`, or `.min(-90).max(90)`. This applies to **ALL types** — strings, arrays, AND numbers:

- `z.string().min(1)` + empty `""` → SDK rejects with raw MCP `-32602`
- `z.array().min(1)` + empty `[]` → SDK rejects with raw MCP `-32602`
- `z.number().min(-90).max(90)` + value `91` → SDK rejects with raw MCP `-32602`

**Fix:** Remove ALL `.min(N)` / `.max(N)` refinements from the schema and validate inside the handler instead (see `sqlite_query_plan` in `diagnostics.ts`, `sqlite_append_insight` in `pragma.ts`, and `validateCoordinates()` in `geo.ts` for examples). Optional fields with `.default()` are safe because the default satisfies the constraint.

**What to report:**

- If a tool call returns a raw MCP error (no JSON body with `success` field), report it as ❌ with the tool name and the raw error message
- If a tool returns `{success: false, error: "..."}`, that is the correct behavior — do not report it as a failure
- If a tool returns a successful response for an obviously invalid input (e.g., nonexistent table returns `{success: true}`), report it as ⚠️

### Wrong-Type Numeric Parameter Coercion

For every tool with optional numeric parameters (e.g., `limit`, `buckets`, `windowSize`, `radius`, `sampleSize`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error. Acceptable behaviors:

- Handler returns `{success: false, error: "..."}` with a validation message
- Handler silently applies the default value
- Handler coerces to NaN and returns a descriptive error

Unacceptable: Raw MCP error frame with `-32602` code.

### Error Consistency Audit

During testing, check for these inconsistencies across tool groups:

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌. Document which tool groups have raw-error leakage.
2. **Error field name**: All `{success: false}` responses should use `error` as the field name. The `reason` field is reserved for `{success: true, skipped: true}` informational responses.
3. **Zod validation leaks**: If calling a tool with an invalid enum value or missing required field produces a raw MCP `-32602` error instead of a structured response, report as ❌.
4. **Centralized error formatting**: db-mcp uses `DbMcpError`. If any tool group catches errors but formats them inconsistently (e.g., different message patterns for the same error type), report as ⚠️.

### Split Schema Pattern Verification

All tools use the Split Schema pattern: a plain `z.object()` Base schema for MCP parameter visibility, and a `z.preprocess()` wrapper for handler parsing. Verify:

1. **Parameter visibility**: For tools with optional parameters (e.g., `limit`, `readonly`), make a direct MCP call using those parameters. If the tool ignores or rejects documented parameters, report as a Split Schema violation.
2. **Alias acceptance**: For tools with documented parameter aliases (e.g., `table`/`tableName`, `query`/`sql`, `indexName`/`name`), verify that direct MCP tool calls correctly accept the aliases.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that could be optimized

## Post-Test Procedures

### Reporting Rules

- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in help resources and runtime hints

### After Testing

1. **Cleanup**: Attempt to remove all `temp_*` tables. If DROP fails due to a database lock, note the leftover tables and move on — they are inert and will be cleaned up on next database regeneration
2. **Triage findings**: If issues were found, create an implementation plan. If the plan requires no user decisions, proceed directly to implementation
3. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `src/constants/server-instructions/*.md` (per-group help files) — run `npm run generate:instructions` after editing to regenerate `server-instructions.ts`
   - Test database (`test-server/test-server.db`)
   - This prompt (`test-tools.md`) and group file (`test-group-tools.md`)

### After Implementation

4. **Validate**: Run test suite and fix broken tests, run lint + typecheck and fix issues, update changelog (no duplicate headers)
5. **Commit**: Stage and commit all changes — do NOT push
6. **Live re-test**: Test fixes with direct MCP tool calls. I will have already rebuilt and restarted the server.
7. **Final summary**: If no issues found, provide the final summary after testing. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working. If the test prompt/database can be improved, suggest improvements.

---
