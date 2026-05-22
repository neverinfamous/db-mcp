# db-mcp Advanced Stress Test: [geo]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **geo** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

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

-------------- | ---- | ----------------------------------------- |
| test_locations | 15   | id, name, city, latitude, longitude, type |

**Key coordinates:**

| Name               | City          | Lat      | Lng       |
| ------------------ | ------------- | -------- | --------- |
| Central Park       | New York      | 40.7829  | -73.9654  |
| Eiffel Tower       | Paris         | 48.8584  | 2.2945    |
| Big Ben            | London        | 51.5007  | -0.1246   |
| Tokyo Tower        | Tokyo         | 35.6586  | 139.7454  |
| Sydney Opera House | Sydney        | -33.8568 | 151.2153  |
| Golden Gate Bridge | San Francisco | 37.8199  | -122.4783 |

## Naming & Cleanup

- **Temporary tables**: `stress_*` prefix. Drop at end using `sqlite.core.dropTable({table: "..."})`. Do NOT use `writeQuery` for `DROP TABLE` as DDL commands are blocked by the query executor.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`) | ✅ Confirmed (inline only)

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

---

## geo Group Tools — Native (11)

1. sqlite_geo_distance
2. sqlite_geo_nearby
3. sqlite_geo_bounding_box
4. sqlite_geo_cluster
5. sqlite_spatialite_load `[NATIVE ONLY]`
6. sqlite_spatialite_create_table `[NATIVE ONLY]`
7. sqlite_spatialite_query `[NATIVE ONLY]`
8. sqlite_spatialite_analyze `[NATIVE ONLY]`
9. sqlite_spatialite_index `[NATIVE ONLY]`
10. sqlite_spatialite_transform `[NATIVE ONLY]`
11. sqlite_spatialite_import `[NATIVE ONLY]`

### WASM (4)

Only the Haversine-based tools: items 1-4.

---

### Category 1: Haversine Boundary Conditions

1. `sqlite.geo.distance({lat1: 0, lon1: 0, lat2: 0, lon2: 0})` → distance = 0 (same point)
2. `sqlite.geo.distance({lat1: 90, lon1: 0, lat2: -90, lon2: 0})` → antipodal ≈ 20,015 km (half Earth circumference)
3. `sqlite.geo.distance({lat1: 0, lon1: -180, lat2: 0, lon2: 180})` → ≈ 0 (same point, opposite notation)
4. `sqlite.geo.distance({lat1: 91, lon1: 0, lat2: 0, lon2: 0})` → report behavior for out-of-bounds latitude (>90°)
5. `sqlite.geo.distance({lat1: 0, lon1: 181, lat2: 0, lon2: 0})` → report behavior for out-of-bounds longitude (>180°)

---

### Category 2: Nearby Search Edge Cases

6. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.7829, centerLon: -73.9654, radius: 0.1})` → very small radius — only Central Park (within 100m)
7. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.7829, centerLon: -73.9654, radius: 50000})` → very large radius — ALL 15 locations
8. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 0, centerLon: 0, radius: 100})` → no locations near (0,0) — 0 results (not error)

---

### Category 3: Bounding Box Edge Cases

9. `sqlite.geo.boundingBox({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: -90, maxLat: 90, minLon: -180, maxLon: 180})` → all 15 locations (global bounding box)
10. `sqlite.geo.boundingBox({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 0, maxLat: 0, minLon: 0, maxLon: 0})` → 0 results (point bounding box)
11. `sqlite.geo.boundingBox({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 50, maxLat: 52, minLon: -1, maxLon: 1})` → London locations (Big Ben, Tower Bridge, Buckingham Palace)

---

### Category 4: Clustering Edge Cases

12. `sqlite.geo.cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 180})` → ~3 clusters (huge grid splits logically along Prime Meridian/Equator)
13. `sqlite.geo.cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 0.001})` → ~15 clusters (tiny grid, one per location)
14. `sqlite.geo.cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 0.1})` → approximately one cluster per city

---

### Category 5: SpatiaLite Integration `[NATIVE ONLY]`

15. `sqlite.geo.spatialiteLoad()` → verify version string returned
16. `sqlite.geo.spatialiteCreateTable({tableName: "stress_geo_spatial", geometryColumn: "geom", geometryType: "POINT", srid: 4326, additionalColumns: [{name: "name", type: "TEXT"}, {name: "type", type: "TEXT"}]})` → success
17. Import 3 points (NYC, Paris, Tokyo) via `sqlite.geo.spatialiteImport`
18. `sqlite.geo.spatialiteQuery({query: "SELECT name, AsText(geom) FROM stress_geo_spatial"})` → 3 rows with WKT
19. `sqlite.geo.spatialiteTransform({operation: "buffer", geometry1: "POINT(-73.9654 40.7829)", distance: 0.01})` → buffered polygon
20. `sqlite.geo.spatialiteTransform({operation: "centroid", geometry1: "POLYGON((-74 40, -74 41, -73 41, -73 40, -74 40))"})` → centroid point
21. `sqlite.geo.spatialiteIndex({tableName: "stress_geo_spatial", geometryColumn: "geom", action: "create"})` → R-Tree index
22. `sqlite.geo.spatialiteIndex({tableName: "stress_geo_spatial", geometryColumn: "geom", action: "check"})` → index integrity
23. `sqlite.geo.spatialiteAnalyze({analysisType: "spatial_extent", sourceTable: "stress_geo_spatial", geometryColumn: "geom"})` → spatial extent

---

### Category 6: Error Message Quality

24. `sqlite.geo.nearby({table: "nonexistent_table_xyz", latColumn: "lat", lonColumn: "lon", centerLat: 0, centerLon: 0, radius: 100})` → structured error
25. `sqlite.geo.nearby({table: "test_locations", latColumn: "nonexistent_col", lonColumn: "longitude", centerLat: 0, centerLon: 0, radius: 100})` → structured error about column
26. `sqlite.geo.spatialiteQuery({query: "SELECT * FROM nonexistent_table_xyz"})` `[NATIVE ONLY]` → structured error

---

### Category 7: WASM Boundary Verification

For WASM testing only:

27. Confirm SpatiaLite tools (items 5-11) are NOT present in the tool list
28. All 4 Haversine tools should produce identical results in WASM and Native

---

### Final Cleanup

Drop `stress_*` tables (if created) using `sqlite.core.dropTable({table: "..."})`. (Note: SpatiaLite index shadow tables like `idx_stress_*` will be automatically cleaned up by `Set-Location C:\Users\chris\Desktop\db-mcp\test-server; .\reset-database.ps1`). Confirm `test_locations` count is still 15.

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
