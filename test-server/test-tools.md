# db-mcp (SQLite) Tool Testing

**Ignore WASM content. Test Native Mode Only**

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the group-specific checklist (pasted after this document) using live MCP server tool calls directly — not scripts/terminal.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

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
6. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) a domain error (nonexistent table, invalid column, missing required parameter) and (b) a **Zod validation error** (call the tool with `{}` empty params if it has required parameters, or pass the wrong type). Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame. See the "Structured Error Response Pattern" section below for how to distinguish the two. This is the most common deficiency found across tool groups.
7. **Output schema testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches (handler returns fields not declared in the schema) produce the same `-32602` code as input errors but are only caught with valid inputs. See "Output Schema Validation Errors" below. Also check for the inverse: if a schema is **defined** in `src/adapters/sqlite/output-schemas/` but **not wired** to the tool definition, report as ⚠️ — the schema exists but provides no enforcement.
8. **Deterministic checklist first**: Complete ALL items in the group-specific checklist before moving to freeform exploration. The checklist uses exact inputs and expected outputs to ensure reproducible coverage every run.

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

**Required enum coercion pattern:** For **optional** enum params with defaults, `z.preprocess(coercer, z.enum([...]).optional().default(...))` works — the coercer returns `undefined` for invalid values → the `.default()` kicks in. For **required** enum params (no `.optional().default(...)`), this pattern **fails**: the SDK's `.partial()` wraps the preprocess in `.optional()`, but the inner `z.enum()` still rejects `undefined` → raw MCP `-32602`. **Fix:** Use `z.string()` in the schema and validate the enum inside the handler's `try/catch`, returning a structured error (see `VALID_ANALYSIS_TYPES` / `VALID_OPERATIONS` / `VALID_FORMATS` in SpatiaLite `analysis.ts` for examples).

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

### Output Schema Validation Errors

The MCP SDK enforces `additionalProperties: false` on **output** schemas. If a handler returns fields not declared in its output schema, the SDK rejects the response with a raw `-32602` error — even though the handler logic succeeded. This is a different failure mode from input validation:

- **Input `-32602`**: Triggered by sending unrecognized/invalid parameters → caught by the Zod sweep (call with `{}` or `extraParam`)
- **Output `-32602`**: Triggered by the handler **returning** undeclared fields → caught by a valid happy-path call that still produces a raw MCP error

**How to detect:** If a tool call with **correct, valid inputs** returns a raw MCP `-32602` mentioning "does not match the tool's output schema" or "additional properties", the output schema in `src/adapters/sqlite/output-schemas/` is missing fields that the handler returns. Report as ❌ with both the tool name and the missing field(s).

**Fix pattern:** Add the missing fields to the output schema (e.g., `durationMs: z.number().optional()`, `message: z.string().optional()`). Do NOT remove fields from the handler response — the schema must match reality.

**Systematic check:** For every tool that has an `outputSchema`, make at least one valid happy-path call and confirm it returns a parseable JSON object with a `success` field — not a raw MCP error. This is separate from (and complementary to) the Zod validation sweep, which tests invalid inputs.

### Error Consistency Audit

During testing, check for these inconsistencies across tool groups:

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌. Document which tool groups have raw-error leakage.
2. **Error field name**: All `{success: false}` responses should use `error` as the field name. The `reason` field is reserved for `{success: true, skipped: true}` informational responses.
3. **Zod validation leaks**: If calling a tool with an invalid enum value or missing required field produces a raw MCP `-32602` error instead of a structured response, report as ❌.
4. **Output schema leaks**: If calling a tool with valid inputs produces a raw MCP `-32602` mentioning "output schema" or "additional properties", report as ❌ (see "Output Schema Validation Errors" above).
5. **Centralized error formatting**: db-mcp uses `DbMcpError`. If any tool group catches errors but formats them inconsistently (e.g., different message patterns for the same error type), report as ⚠️.
6. **Orphaned output schemas**: If a schema is exported from `src/adapters/sqlite/output-schemas/` (e.g., `TransactionBeginOutputSchema`) but the corresponding tool definition does not reference it via `outputSchema`, report as ⚠️. Use `grep_search` to check whether the schema name appears in any tool file under `src/adapters/`. Defined-but-unwired schemas provide zero enforcement.
7. **Inline output schemas**: If any tool defines `outputSchema: z.object({...})` inline in the handler file instead of importing a named schema from `output-schemas/`, report as ⚠️. All output schemas must live in `src/adapters/sqlite/output-schemas/` with named exports. Use `grep_search` with pattern `outputSchema: z.object` across `src/adapters/` to detect violations.

### Split Schema Pattern Verification

All tools use the Split Schema pattern: a plain `z.object()` Base schema for MCP parameter visibility, and a `z.preprocess()` wrapper for handler parsing. Verify:

1. **Parameter visibility**: For tools with optional parameters (e.g., `limit`, `readonly`), make a direct MCP call using those parameters. If the tool ignores or rejects documented parameters, report as a Split Schema violation.
2. **Alias acceptance**: For tools with documented parameter aliases (e.g., `table`/`tableName`, `query`/`sql`, `indexName`/`name`), verify that direct MCP tool calls correctly accept the aliases.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB and suggest a concrete optimization (e.g., filter system tables, add `compact` option, omit empty arrays).

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
   - This prompt (`test-tools.md`) and group file (`test-group-tools.md`)

### After Implementation

3. **Validate**: Run test suite and fix broken tests, run lint + typecheck and fix issues, update changelog (no duplicate headers)
4. **Commit**: Stage and commit all changes — do NOT push
5. **Live re-test**: Test fixes with direct MCP tool calls. I will have already rebuilt and restarted the server.
6. **Final summary**: If no issues found, provide the final summary after testing. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working. If the test prompt/database can be improved, make the improvements.

---
