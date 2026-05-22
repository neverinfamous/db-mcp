# db-mcp Tool Group Testing: [geo-haversine]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **geo-haversine** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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

----------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
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

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
4. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                | Verdict            |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields     | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, `isError: true` — no `success` field | Bug — report as ❌ |

### Zod Validation Errors

**Zod refinement leak pattern:** `.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. This is **especially important for geo tools** with coordinate params like `.min(-90).max(90)`. **Fix:** Remove refinements from schema, validate inside handler (see `validateCoordinates()` in `geo.ts`).

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

---

## Group Focus: geo-haversine

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### geo-haversine Group Tools (5)

1. sqlite_geo_distance
2. sqlite_geo_nearby
3. sqlite_geo_bounding_box
4. sqlite_geo_cluster
5. sqlite_execute_code

**Test data:** `test_locations` (15 rows). Key coordinates:

| Name               | City          | Lat      | Lng       |
| ------------------ | ------------- | -------- | --------- |
| Central Park       | New York      | 40.7829  | -73.9654  |
| Eiffel Tower       | Paris         | 48.8584  | 2.2945    |
| Big Ben            | London        | 51.5007  | -0.1246   |
| Tokyo Tower        | Tokyo         | 35.6586  | 139.7454  |
| Sydney Opera House | Sydney        | -33.8568 | 151.2153  |
| Golden Gate Bridge | San Francisco | 37.8199  | -122.4783 |

**Checklist:**

1. `sqlite_geo_distance({lat1: 40.7829, lon1: -73.9654, lat2: 48.8584, lon2: 2.2945})` → NYC to Paris ≈ 5,837 km (verify within ±50 km)
2. `sqlite_geo_distance({lat1: 40.7829, lon1: -73.9654, lat2: 37.8199, lon2: -122.4783})` → NYC to SF ≈ 4,130 km
3. `sqlite_geo_nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.7580, centerLon: -73.9855, radius: 10})` → should find NYC locations (Central Park, Empire State Building, Times Square) — 3 results
4. `sqlite_geo_nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 48.8584, centerLon: 2.2945, radius: 10})` → should find Paris locations (Eiffel Tower, Louvre, Notre-Dame) — 3 results
5. `sqlite_geo_bounding_box({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 35, maxLat: 55, minLon: -130, maxLon: -70})` → US locations (NYC 3 + SF 1 = 4)
6. `sqlite_geo_cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 5})` → ~5 clusters grouping by city proximity

**Code mode testing:**

7. `sqlite_execute_code({code: "const result = await sqlite.geo.distance({lat1: 40.7829, lon1: -73.9654, lat2: 48.8584, lon2: 2.2945}); return result;"})` → NYC to Paris ≈ 5,837 km
8. `sqlite_execute_code({code: "const result = await sqlite.geo.nearby({table: 'test_locations', latColumn: 'latitude', lonColumn: 'longitude', centerLat: 40.758, centerLon: -73.9855, radius: 10}); return result;"})` → NYC locations

**Error path testing:**

🔴 9. `sqlite_geo_nearby({table: "nonexistent_table_xyz", latColumn: "lat", lonColumn: "lng", centerLat: 0, centerLon: 0, radius: 100})` → structured error
🔴 10. `sqlite_geo_distance({lat1: 91, lon1: 0, lat2: 0, lon2: 0})` → must return `{success: false, error: "Invalid lat1: 91. Must be between -90 and 90."}` — structured handler error, NOT a raw MCP error. If this returns a raw MCP `-32602`, it is a Zod `.min()/.max()` refinement leak bug (see Zod refinement leak pattern above).

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 11. `sqlite_geo_distance({})` → handler error
🔴 12. `sqlite_geo_nearby({})` → handler error
🔴 13. `sqlite_geo_bounding_box({})` → handler error
🔴 14. `sqlite_geo_cluster({})` → handler error

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
