# db-mcp Code Mode Testing: [geo]

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

> [!NOTE]
> **Tool Availability & Code Mode**: The `sqlite_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a *different* group (e.g., `sqlite_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `sqlite_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

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

## Phase 1: Haversine Tools — Happy Paths (batched)

> These 4 tools work in both Native and WASM modes.

1. `sqlite.geo.distance({lat1: 40.7829, lon1: -73.9654, lat2: 48.8584, lon2: 2.2945})` → NYC to Paris ≈ 5,837 km (±50 km)
2. `sqlite.geo.distance({lat1: 40.7829, lon1: -73.9654, lat2: 37.8199, lon2: -122.4783})` → NYC to SF ≈ 4,130 km
3. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.758, centerLon: -73.9855, radius: 10})` → 3 NYC locations
4. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 48.8584, centerLon: 2.2945, radius: 10})` → 3 Paris locations
5. `sqlite.geo.boundingBox({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 35, maxLat: 55, minLon: -130, maxLon: -70})` → US locations (4 results)
6. `sqlite.geo.cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 5})` → ~5 clusters


## Phase 2: SpatiaLite Tools `[NATIVE ONLY]` — Happy Paths (sequential)

7. `sqlite.geo.spatialiteLoad()` → load extension, verify version
8. `sqlite.geo.spatialiteCreateTable({tableName: "temp_cm_spatial", geometryColumn: "geom", geometryType: "POINT", srid: 4326, additionalColumns: [{name: "name", type: "TEXT"}]})` → success
9. `sqlite.geo.spatialiteImport({tableName: "temp_cm_spatial", format: "wkt", data: "POINT(-73.9654 40.7829)", additionalData: {name: "Test Point"}})` → success
10. `sqlite.geo.spatialiteQuery({query: "SELECT name, AsText(geom) as geom_text FROM temp_cm_spatial"})` → WKT geometry
11. `sqlite.geo.spatialiteTransform({operation: "buffer", geometry1: "POINT(-73.9654 40.7829)", distance: 0.01, srid: 4326})` → buffered polygon
12. `sqlite.geo.spatialiteIndex({tableName: "temp_cm_spatial", geometryColumn: "geom", action: "create"})` → R-Tree index
13. `sqlite.geo.spatialiteAnalyze({analysisType: "spatial_extent", sourceTable: "temp_cm_spatial", geometryColumn: "geom"})` → spatial extent
14. Cleanup: drop `temp_cm_spatial`


## Phase 3: Geo Domain Errors (batched)

🔴 15. `sqlite.geo.nearby({table: "nonexistent_xyz", latColumn: "lat", lonColumn: "lng", centerLat: 0, centerLon: 0, radius: 100})` → `{success: false}`
🔴 16. `sqlite.geo.distance({lat1: 91, lon1: 0, lat2: 0, lon2: 0})` → `{success: false, error: "Invalid lat1: 91..."}` — handler error, NOT raw MCP `-32602` (Zod refinement leak test)
🔴 17. `sqlite.geo.distance({lat1: 0, lon1: 181, lat2: 0, lon2: 0})` → `{success: false}` — invalid longitude


## Phase 4: Wrong-Type Numeric Coercion

🔴 18. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.758, centerLon: -73.9855, radius: "abc"})` → handler error, NOT raw MCP


## Phase 5: Multi-Step Workflow

### 5.1 — Proximity analysis pipeline

```javascript
const failures = [];
// NYC to major cities
const pairs = [
  { name: "Paris", lat: 48.8584, lon: 2.2945 },
  { name: "London", lat: 51.5007, lon: -0.1246 },
  { name: "Tokyo", lat: 35.6586, lon: 139.7454 },
];
const distances = {};
for (const p of pairs) {
  const d = await sqlite.geo.distance({
    lat1: 40.7829,
    lon1: -73.9654,
    lat2: p.lat,
    lon2: p.lon,
  });
  distances[p.name] = d.distance;
}

// Nearby search
const nearby = await sqlite.geo.nearby({
  table: "test_locations",
  latColumn: "latitude",
  lonColumn: "longitude",
  centerLat: 40.758,
  centerLon: -73.9855,
  radius: 50,
});

return {
  failures,
  success: failures.length === 0,
  distances,
  nearbyCount: nearby?.rowCount || nearby?.results?.length,
};
```


## Phase 6: Zod Validation Sweep

🔴 19. `sqlite.geo.distance({})` → `{success: false}`
🔴 20. `sqlite.geo.nearby({})` → `{success: false}`
🔴 21. `sqlite.geo.boundingBox({})` → `{success: false}`
🔴 22. `sqlite.geo.cluster({})` → `{success: false}`
🔴 23. `sqlite.geo.spatialiteCreateTable({})` `[NATIVE ONLY]` → `{success: false}`
🔴 24. `sqlite.geo.spatialiteQuery({})` `[NATIVE ONLY]` → `{success: false}`
🔴 25. `sqlite.geo.spatialiteAnalyze({})` `[NATIVE ONLY]` → `{success: false}`
🔴 26. `sqlite.geo.spatialiteIndex({})` `[NATIVE ONLY]` → `{success: false}`
🔴 27. `sqlite.geo.spatialiteTransform({})` `[NATIVE ONLY]` → `{success: false}`
🔴 28. `sqlite.geo.spatialiteImport({})` `[NATIVE ONLY]` → `{success: false}`

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
