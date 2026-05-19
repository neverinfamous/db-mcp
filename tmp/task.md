# db-mcp — [geo] WASM Stress Test Log

## Progress Tracking

### Core WASM Geo
- [x] 1. distance (same point)
- [x] 2. distance (antipodal)
- [x] 3. distance (same point, opposite notation)
- [x] 4. distance (out of bounds lat)
- [x] 5. distance (out of bounds lon)
- [x] 6. nearby (small radius)
- [x] 7. nearby (large radius)
- [x] 8. nearby (zero results)
- [x] 9. boundingBox (global)
- [x] 10. boundingBox (point)
- [x] 11. boundingBox (London)
- [x] 12. cluster (huge grid)
- [x] 13. cluster (tiny grid)
- [x] 14. cluster (one per city)

### Native-Only Tests (Skip in WASM)
- [x] 15. spatialiteLoad
- [x] 16. spatialiteCreateTable
- [x] 17. spatialiteImport
- [x] 18. spatialiteQuery
- [x] 19. spatialiteTransform (buffer)
- [x] 20. spatialiteTransform (centroid)
- [x] 21. spatialiteIndex (create)
- [x] 22. spatialiteIndex (check)
- [x] 23. spatialiteAnalyze
- [x] 26. spatialiteQuery (nonexistent table)

### Error Message Quality
- [x] 24. nearby (nonexistent table)
- [x] 25. nearby (nonexistent col)

### WASM Boundary Verification
- [x] 27. Tools list inspection (spatialite omitted)
- [x] 28. Haversine identical outputs

## Findings

- ⚠️ **Test 12 Issue**: `gridSize: 180` resulted in 3 clusters instead of 1 single cluster. This is mathematically correct depending on how the grid is aligned (splitting the Prime Meridian and Equator), but deviates strictly from the "single cluster" expectation in the test plan. No code changes needed as it correctly evaluates the math.
- ✅ All other boundary conditions and structural error handlers passed perfectly (tests 1-11, 13-14, 24-25).
- ✅ SpatiaLite tools are gracefully omitted in WASM mode (`sqlite.geo.help()` confirms only Haversine tools exist).
- ✅ All generated errors conform strictly to the `{ success: false, error: "...", category: "...", code: "..." }` pattern (no raw exceptions).

## Token Audit
- **Most Expensive Block**: Categories 2 & 3 Pipeline (`nearby` and `boundingBox` combinations).
- **Token Estimate**: `1086` tokens (`metrics.tokenEstimate: 1052`).
- **Optimization Context**: Returning 15 points from `nearby` with a 50,000 km radius and `boundingBox` across the globe returns the full set multiple times, contributing to the larger payload. Still well within safe limits.
