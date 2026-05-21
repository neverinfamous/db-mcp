# Advanced Stress Test — db-mcp — [geo]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> We're in Native mode. If there is nothing to fix, don't update UNRELEASED.md.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Execute each numbered stress test below using `sqlite_execute_code` (code mode).

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

## WASM Mode

> When testing against a **WASM backend** (`--sqlite` / sql.js), apply these adjustments:

- **Skip Category 5** entirely (SpatiaLite Integration — items 15-23) — `[NATIVE ONLY]`.
- **Category 6**: Skip item 26 (`spatialiteQuery`) — `[NATIVE ONLY]`.
- **Category 7** (WASM Boundary Verification) — execute only in WASM mode.
- Categories 1-4, 6 (items 24-25) are fully WASM-compatible (4 Haversine tools).

## Code Mode Execution

- **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

All tests via `sqlite_execute_code`. Use `sqlite.geo.*` for geo/SpatiaLite tools.
State persists across calls. Do NOT pass `readonly: true`. Group related tests into single calls.

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

1. **Cleanup**: Drop all `stress_*` objects
2. **Fix EVERY finding** — ❌, ⚠️, 📦
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Re-test**: After server rebuild
6. **Token audit**: Report most expensive block
