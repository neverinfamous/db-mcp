# db-mcp Code Mode Testing: [geo]

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of the **geo** tool group using ONLY `sqlite_execute_code`. Do not use direct tool calls or terminal.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response — monitor `metrics.tokenEstimate`.

## Test Database Schema

| Table          | Rows | Key Columns                                       |
| -------------- | ---- | ------------------------------------------------- |
| test_locations | 15   | id, name, city, latitude, longitude, type         |

**Key coordinates:**

| Name               | City          | Lat      | Lng       |
| ------------------ | ------------- | -------- | --------- |
| Central Park       | New York      | 40.7829  | -73.9654  |
| Eiffel Tower       | Paris         | 48.8584  | 2.2945    |
| Big Ben            | London        | 51.5007  | -0.1246   |
| Tokyo Tower        | Tokyo         | 35.6586  | 139.7454  |
| Sydney Opera House | Sydney        | -33.8568 | 151.2153  |
| Golden Gate Bridge | San Francisco | 37.8199  | -122.4783 |

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** Report as ❌.

1. **Batched scripting**: Bundle checks with `failures` array.
2. **Error path testing**: Every tool with `{}` (Zod) and domain error.
3. **Token tracking**: Monitor `metrics.tokenEstimate`.
4. **Coverage Matrix**: `| Tool | Happy Path | Domain Error | Zod Error |`
5. **Deterministic checklist first**.

## Structured Error Response Pattern

Handler error ✅ = JSON with `success` + `error`. MCP error ❌ = raw text, `isError: true`.

### Zod Refinement Leak — Coordinate Params

Geo tools have coordinate params with `.min(-90).max(90)` / `.min(-180).max(180)` refinements. These leak as raw MCP `-32602` if not removed from the schema. Test `lat1: 91` to verify the handler catches the error.

## Cleanup

- Temporary tables: `temp_*` prefix. Drop at end of script.

---

## Phase 1: Haversine Tools — Happy Paths (batched)

> These 4 tools work in both Native and WASM modes.

1. `sqlite.geo.distance({lat1: 40.7829, lon1: -73.9654, lat2: 48.8584, lon2: 2.2945})` → NYC to Paris ≈ 5,837 km (±50 km)
2. `sqlite.geo.distance({lat1: 40.7829, lon1: -73.9654, lat2: 37.8199, lon2: -122.4783})` → NYC to SF ≈ 4,130 km
3. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.758, centerLon: -73.9855, radius: 10})` → 3 NYC locations
4. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 48.8584, centerLon: 2.2945, radius: 10})` → 3 Paris locations
5. `sqlite.geo.boundingBox({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 35, maxLat: 55, minLon: -130, maxLon: -70})` → US locations (4 results)
6. `sqlite.geo.cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 5})` → ~5 clusters

---

## Phase 2: SpatiaLite Tools `[NATIVE ONLY]` — Happy Paths (sequential)

7. `sqlite.geo.spatialiteLoad()` → load extension, verify version
8. `sqlite.geo.spatialiteCreateTable({tableName: "temp_cm_spatial", geometryColumn: "geom", geometryType: "POINT", srid: 4326, additionalColumns: [{name: "name", type: "TEXT"}]})` → success
9. `sqlite.geo.spatialiteImport({tableName: "temp_cm_spatial", format: "wkt", data: "POINT(-73.9654 40.7829)", additionalData: {name: "Test Point"}})` → success
10. `sqlite.geo.spatialiteQuery({query: "SELECT name, AsText(geom) as geom_text FROM temp_cm_spatial"})` → WKT geometry
11. `sqlite.geo.spatialiteTransform({operation: "buffer", geometry1: "POINT(-73.9654 40.7829)", distance: 0.01, srid: 4326})` → buffered polygon
12. `sqlite.geo.spatialiteIndex({tableName: "temp_cm_spatial", geometryColumn: "geom", action: "create"})` → R-Tree index
13. `sqlite.geo.spatialiteAnalyze({analysisType: "spatial_extent", sourceTable: "temp_cm_spatial", geometryColumn: "geom"})` → spatial extent
14. Cleanup: drop `temp_cm_spatial`

---

## Phase 3: Geo Domain Errors (batched)

🔴 15. `sqlite.geo.nearby({table: "nonexistent_xyz", latColumn: "lat", lonColumn: "lng", centerLat: 0, centerLon: 0, radius: 100})` → `{success: false}`
🔴 16. `sqlite.geo.distance({lat1: 91, lon1: 0, lat2: 0, lon2: 0})` → `{success: false, error: "Invalid lat1: 91..."}` — handler error, NOT raw MCP `-32602` (Zod refinement leak test)
🔴 17. `sqlite.geo.distance({lat1: 0, lon1: 181, lat2: 0, lon2: 0})` → `{success: false}` — invalid longitude

---

## Phase 4: Geo Zod Validation (batched)

🔴 18. `sqlite.geo.distance({})` → `{success: false}`
🔴 19. `sqlite.geo.nearby({})` → `{success: false}`
🔴 20. `sqlite.geo.boundingBox({})` → `{success: false}`
🔴 21. `sqlite.geo.cluster({})` → `{success: false}`
🔴 22. `sqlite.geo.spatialiteCreateTable({})` `[NATIVE ONLY]` → `{success: false}`
🔴 23. `sqlite.geo.spatialiteQuery({})` `[NATIVE ONLY]` → `{success: false}`
🔴 24. `sqlite.geo.spatialiteAnalyze({})` `[NATIVE ONLY]` → `{success: false}`
🔴 25. `sqlite.geo.spatialiteIndex({})` `[NATIVE ONLY]` → `{success: false}`
🔴 26. `sqlite.geo.spatialiteTransform({})` `[NATIVE ONLY]` → `{success: false}`
🔴 27. `sqlite.geo.spatialiteImport({})` `[NATIVE ONLY]` → `{success: false}`

---

## Phase 5: Wrong-Type Numeric Coercion

🔴 28. `sqlite.geo.nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.758, centerLon: -73.9855, radius: "abc"})` → handler error, NOT raw MCP

---

## Phase 6: Multi-Step Workflow

### 6.1 — Proximity analysis pipeline

```javascript
const failures = [];
// NYC to major cities
const pairs = [
  {name: "Paris", lat: 48.8584, lon: 2.2945},
  {name: "London", lat: 51.5007, lon: -0.1246},
  {name: "Tokyo", lat: 35.6586, lon: 139.7454},
];
const distances = {};
for (const p of pairs) {
  const d = await sqlite.geo.distance({lat1: 40.7829, lon1: -73.9654, lat2: p.lat, lon2: p.lon});
  distances[p.name] = d;
}

// Nearby search
const nearby = await sqlite.geo.nearby({
  table: "test_locations", latColumn: "latitude", lonColumn: "longitude",
  centerLat: 40.758, centerLon: -73.9855, radius: 50
});

return { failures, success: failures.length === 0, distances, nearbyCount: nearby?.rows?.length };
```

---

## Post-Test Procedures

1. **Cleanup**: Drop `temp_*` spatial tables
2. **Triage findings**: Create implementation plan if issues found
3. **Scope of fixes**: Handler code, server-instructions, this prompt
4. **Validate**: Test suite, lint + typecheck, changelog
5. **Commit**: Stage and commit — do NOT push
6. **Token audit**: Report most expensive block
7. **Final summary**: After testing/re-testing
