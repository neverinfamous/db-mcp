# db-mcp Advanced Stress Testing: [geo]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> We're currently testing Native mode.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): Tools marked `[NATIVE ONLY]` in the checklist are unavailable and should be skipped. All unmarked tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
> See [`code-map.md`](file:///C:/Users/chris/Desktop/db-mcp/test-server/code-map.md) for the complete test database schema (`test_*` tables).

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
5. **Proactive Improvements**: You are highly encouraged to proactively improve functionality, performance, security, agent experience, and token/payload efficiency whenever you see an opportunity during your testing and handler code review.
   > **CRITICAL**: Architectural consistency is paramount. Do not introduce undocumented architectural deviations. If you implement a structural or architectural improvement in one tool, you must apply it symmetrically to other applicable tools in the group or project.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
7. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
8. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

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

## Group Focus: geo

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Code Mode Methods

- `sqlite.geo.distance`
- `sqlite.geo.nearby`
- `sqlite.geo.boundingBox`
- `sqlite.geo.cluster`
- `sqlite.geo.spatialiteLoad`
- `sqlite.geo.spatialiteCreateTable`
- `sqlite.geo.spatialiteImport`
- `sqlite.geo.spatialiteQuery`
- `sqlite.geo.spatialiteTransform`
- `sqlite.geo.spatialiteIndex`
- `sqlite.geo.spatialiteAnalyze`
- *(cross-group helpers used in test procedures)*
- `sqlite.core.dropTable`

## Phase 1: Haversine Boundary Conditions (batched)

1. `sqlite.geo.distance({lat1: 0, lon1: 0, lat2: 0, lon2: 0})` → distance = 0 (same point)
2. `sqlite.geo.distance({lat1: 90, lon1: 0, lat2: -90, lon2: 0})` → antipodal ≈ 20,015 km (half Earth circumference)
3. `sqlite.geo.distance({lat1: 0, lon1: -180, lat2: 0, lon2: 180})` → ≈ 0 (same point, opposite notation)
4. `sqlite.geo.distance({lat1: 91, lon1: 0, lat2: 0, lon2: 0})` → report behavior for out-of-bounds latitude (>90°)
5. `sqlite.geo.distance({lat1: 0, lon1: 181, lat2: 0, lon2: 0})` → report behavior for out-of-bounds longitude (>180°)


## Phase 2: Nearby Search Edge Cases (batched)

6. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.7829, centerLon: -73.9654, radius: 0.1})` → very small radius — only Central Park (within 100m)
7. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.7829, centerLon: -73.9654, radius: 50000})` → very large radius — ALL 15 locations
8. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 0, centerLon: 0, radius: 100})` → no locations near (0,0) — 0 results (not error)


## Phase 3: Bounding Box Edge Cases (batched)

9. `sqlite.geo.boundingBox({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: -90, maxLat: 90, minLon: -180, maxLon: 180})` → all 15 locations (global bounding box)
10. `sqlite.geo.boundingBox({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 0, maxLat: 0, minLon: 0, maxLon: 0})` → 0 results (point bounding box)
11. `sqlite.geo.boundingBox({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 50, maxLat: 52, minLon: -1, maxLon: 1})` → London locations (Big Ben, Tower Bridge, Buckingham Palace)


## Phase 4: Clustering Edge Cases (batched)

12. `sqlite.geo.cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 180})` → ~3 clusters (huge grid splits logically along Prime Meridian/Equator)
13. `sqlite.geo.cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 0.001})` → ~15 clusters (tiny grid, one per location)
14. `sqlite.geo.cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 0.1})` → approximately one cluster per city


## Phase 5: SpatiaLite Integration `[NATIVE ONLY]` (batched)

15. `sqlite.geo.spatialiteLoad()` → verify version string returned
16. `sqlite.geo.spatialiteCreateTable({tableName: "stress_geo_spatial", geometryColumn: "geom", geometryType: "POINT", srid: 4326, additionalColumns: [{name: "name", type: "TEXT"}, {name: "type", type: "TEXT"}]})` → success
17. Import 3 points (NYC, Paris, Tokyo) via `sqlite.geo.spatialiteImport`
18. `sqlite.geo.spatialiteQuery({query: "SELECT name, AsText(geom) FROM stress_geo_spatial"})` → 3 rows with WKT
19. `sqlite.geo.spatialiteTransform({operation: "buffer", geometry1: "POINT(-73.9654 40.7829)", distance: 0.01})` → buffered polygon
20. `sqlite.geo.spatialiteTransform({operation: "centroid", geometry1: "POLYGON((-74 40, -74 41, -73 41, -73 40, -74 40))"})` → centroid point
21. `sqlite.geo.spatialiteIndex({tableName: "stress_geo_spatial", geometryColumn: "geom", action: "create"})` → R-Tree index
22. `sqlite.geo.spatialiteIndex({tableName: "stress_geo_spatial", geometryColumn: "geom", action: "check"})` → index integrity
23. `sqlite.geo.spatialiteAnalyze({analysisType: "spatial_extent", sourceTable: "stress_geo_spatial", geometryColumn: "geom"})` → spatial extent


## Phase 6: Error Message Quality (batched)

24. `sqlite.geo.nearby({table: "nonexistent_table_xyz", latColumn: "lat", lonColumn: "lon", centerLat: 0, centerLon: 0, radius: 100})` → structured error
25. `sqlite.geo.nearby({table: "test_locations", latColumn: "nonexistent_col", lonColumn: "longitude", centerLat: 0, centerLon: 0, radius: 100})` → structured error about column
26. `sqlite.geo.spatialiteQuery({query: "SELECT * FROM nonexistent_table_xyz"})` `[NATIVE ONLY]` → structured error


## Phase 7: WASM Boundary Verification (batched)

For WASM testing only:

27. Confirm SpatiaLite tools (items 5-11) are NOT present in the tool list
28. All 4 Haversine tools should produce identical results in WASM and Native


### Final Cleanup

Drop `stress_*` tables (if created) using `sqlite.core.dropTable({table: "..."})`. (Note: SpatiaLite index shadow tables like `idx_stress_*` will be automatically cleaned up by `Set-Location C:\Users\chris\Desktop\db-mcp\test-server; .\reset-database.ps1`). Confirm `test_locations` count is still 15.

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
