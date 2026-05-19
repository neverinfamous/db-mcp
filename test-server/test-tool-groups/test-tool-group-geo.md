# db-mcp (SQLite) Tool Group Testing: [geo]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js), apply these adjustments:

- **Skip SpatiaLite tools** (items 8-14: `sqlite_spatialite_load`, `sqlite_spatialite_create_table`, `sqlite_spatialite_query`, `sqlite_spatialite_analyze`, `sqlite_spatialite_index`, `sqlite_spatialite_transform`, `sqlite_spatialite_import`) — `[NATIVE ONLY]`. These tools are not registered in WASM.
- **Skip SpatiaLite checklist items** 7-14 — all require SpatiaLite.
- **Skip Zod items** 23-28 (SpatiaLite tools) — `[NATIVE ONLY]`.
- All other items (1-6, 15-22) are fully WASM-compatible — 4 Haversine tools work identically.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **geo** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Report the response size in KB and suggest a concrete optimization.

## Test Database Schema

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

> **Note:** When testing `sqlite_execute_code`, do **not** pass `readonly: true` unless specifically testing read-only filtering.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Report all failures, unexpected behaviors, or unnecessarily large payloads
4. Do not mention what already works well or issues documented in help resources
5. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
6. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.
7. **Deterministic checklist first**: Complete ALL items before freeform exploration.
8. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                      | Verdict            |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields           | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, `isError: true` — no `success` field      | Bug — report as ❌ |

### Zod Validation Errors

**Zod refinement leak pattern:** `.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. This is **especially important for geo tools** with coordinate params like `.min(-90).max(90)`. **Fix:** Remove refinements from schema, validate inside handler (see `validateCoordinates()` in `geo.ts`).

- Raw MCP error (no `success` field) → report as ❌
- `{success: false, error: "..."}` → correct
- Successful response for invalid input → report as ⚠️

### Wrong-Type Numeric Parameter Coercion

For tools with numeric parameters (`radius`, `gridSize`), call with `param: "abc"`. Must NOT return raw MCP `-32602`.

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

### Error Consistency Audit

1. Raw error instead of `{success: false}` → ❌
2. Must use `error` field name
3. Orphaned/inline output schemas → ⚠️

### Split Schema Pattern Verification

Verify parameter visibility and alias acceptance.

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_`
- If DROP fails due to database lock, move on.

---

## Group Focus: geo

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### Built-in Tools (3)

1. server_info
2. server_health
3. list_adapters

### geo Group Tools (Native — 11 Tools)

4. sqlite_geo_distance
5. sqlite_geo_nearby
6. sqlite_geo_bounding_box
7. sqlite_geo_cluster
8. sqlite_spatialite_load `[NATIVE ONLY]`
9. sqlite_spatialite_create_table `[NATIVE ONLY]`
10. sqlite_spatialite_query `[NATIVE ONLY]`
11. sqlite_spatialite_analyze `[NATIVE ONLY]`
12. sqlite_spatialite_index `[NATIVE ONLY]`
13. sqlite_spatialite_transform `[NATIVE ONLY]`
14. sqlite_spatialite_import `[NATIVE ONLY]`
15. sqlite_execute_code

### geo Group Tools (WASM — 4 Tools)

Only the Haversine-based tools: items 4-7 and code mode. SpatiaLite tools (items 8-14) are Native only.

**Test data:** `test_locations` (15 rows). Key coordinates:

| Name               | City          | Lat      | Lng       |
| ------------------ | ------------- | -------- | --------- |
| Central Park       | New York      | 40.7829  | -73.9654  |
| Eiffel Tower       | Paris         | 48.8584  | 2.2945    |
| Big Ben            | London        | 51.5007  | -0.1246   |
| Tokyo Tower        | Tokyo         | 35.6586  | 139.7454  |
| Sydney Opera House | Sydney        | -33.8568 | 151.2153  |
| Golden Gate Bridge | San Francisco | 37.8199  | -122.4783 |

**Checklist (Haversine tools — Native & WASM):**

1. `sqlite_geo_distance({lat1: 40.7829, lon1: -73.9654, lat2: 48.8584, lon2: 2.2945})` → NYC to Paris ≈ 5,837 km (verify within ±50 km)
2. `sqlite_geo_distance({lat1: 40.7829, lon1: -73.9654, lat2: 37.8199, lon2: -122.4783})` → NYC to SF ≈ 4,130 km
3. `sqlite_geo_nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 40.7580, centerLon: -73.9855, radius: 10})` → should find NYC locations (Central Park, Empire State Building, Times Square) — 3 results
4. `sqlite_geo_nearby({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", centerLat: 48.8584, centerLon: 2.2945, radius: 10})` → should find Paris locations (Eiffel Tower, Louvre, Notre-Dame) — 3 results
5. `sqlite_geo_bounding_box({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", minLat: 35, maxLat: 55, minLon: -130, maxLon: -70})` → US locations (NYC 3 + SF 1 = 4)
6. `sqlite_geo_cluster({table: "test_locations", latColumn: "latitude", lonColumn: "longitude", gridSize: 5})` → ~5 clusters grouping by city proximity

**SpatiaLite tools `[NATIVE ONLY]`:**

7. `sqlite_spatialite_load` → load SpatiaLite extension, verify version
8. `sqlite_spatialite_create_table({tableName: "temp_spatial_test", geometryColumn: "geom", geometryType: "POINT", srid: 4326, additionalColumns: [{name: "name", type: "TEXT"}]})` → success
9. `sqlite_spatialite_import({tableName: "temp_spatial_test", format: "wkt", data: "POINT(-73.9654 40.7829)", additionalData: {name: "Test Point"}})` → success
10. `sqlite_spatialite_query({query: "SELECT name, AsText(geom) as geom_text FROM temp_spatial_test"})` → WKT geometry returned
11. `sqlite_spatialite_transform({operation: "buffer", geometry1: "POINT(-73.9654 40.7829)", distance: 0.01, srid: 4326})` → buffered polygon
12. `sqlite_spatialite_index({tableName: "temp_spatial_test", geometryColumn: "geom", action: "create"})` → R-Tree index created
13. `sqlite_spatialite_analyze({analysisType: "spatial_extent", sourceTable: "temp_spatial_test", geometryColumn: "geom"})` → spatial extent
14. Cleanup: drop `temp_spatial_test`

**Code mode testing:**

15. `sqlite_execute_code({code: "const result = await sqlite.geo.distance({lat1: 40.7829, lon1: -73.9654, lat2: 48.8584, lon2: 2.2945}); return result;"})` → NYC to Paris ≈ 5,837 km
16. `sqlite_execute_code({code: "const result = await sqlite.geo.nearby({table: 'test_locations', latColumn: 'latitude', lonColumn: 'longitude', centerLat: 40.758, centerLon: -73.9855, radius: 10}); return result;"})` → NYC locations

**Error path testing:**

🔴 17. `sqlite_geo_nearby({table: "nonexistent_table_xyz", latColumn: "lat", lonColumn: "lng", centerLat: 0, centerLon: 0, radius: 100})` → structured error
🔴 18. `sqlite_geo_distance({lat1: 91, lon1: 0, lat2: 0, lon2: 0})` → must return `{success: false, error: "Invalid lat1: 91. Must be between -90 and 90."}` — structured handler error, NOT a raw MCP error. If this returns a raw MCP `-32602`, it is a Zod `.min()/.max()` refinement leak bug (see Zod refinement leak pattern above).

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 19. `sqlite_geo_distance({})` → handler error
🔴 20. `sqlite_geo_nearby({})` → handler error
🔴 21. `sqlite_geo_bounding_box({})` → handler error
🔴 22. `sqlite_geo_cluster({})` → handler error
🔴 23. `sqlite_spatialite_create_table({})` `[NATIVE ONLY]` → handler error
🔴 24. `sqlite_spatialite_query({})` `[NATIVE ONLY]` → handler error
🔴 25. `sqlite_spatialite_analyze({})` `[NATIVE ONLY]` → handler error
🔴 26. `sqlite_spatialite_index({})` `[NATIVE ONLY]` → handler error
🔴 27. `sqlite_spatialite_transform({})` `[NATIVE ONLY]` → handler error
🔴 28. `sqlite_spatialite_import({})` `[NATIVE ONLY]` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing

---

## Troubleshooting

### Database is locked / file in use

1. Check for Node.js processes: `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"`
2. WAL/journal files are normal

### SpatiaLite tools fail [NATIVE ONLY]

1. SpatiaLite must be installed and loadable by the SQLite engine
2. Verify with `sqlite_spatialite_load` — should return a version string
3. SpatiaLite tools are excluded from WASM mode entirely

### Reset script fails

1. Run with `-Verbose`: `.\reset-database.ps1 -Verbose`
