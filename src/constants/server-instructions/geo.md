# db-mcp Help — Geospatial Operations (4 basic + 7 SpatiaLite)

Basic geo (always available — Haversine formula):
- `sqlite_geo_distance({ lat1, lon1, lat2, lon2 })` — returns km
- `sqlite_geo_bounding_box({ table, latColumn, lonColumn, minLat, maxLat, minLon, maxLon })`
- `sqlite_geo_nearby({ table, latColumn, lonColumn, centerLat, centerLon, radius, unit: "km" })`
- `sqlite_geo_cluster({ table, latColumn, lonColumn, gridSize })`

SpatiaLite (Native only):
- `sqlite_spatialite_create_table({ tableName, geometryColumn, geometryType: "POINT", srid: 4326 })`
- `sqlite_spatialite_import({ tableName, format: "wkt"|"geojson", data, additionalData? })`
- `sqlite_spatialite_query({ query: "SELECT name, AsText(geom) FROM places WHERE..." })`
- `sqlite_spatialite_analyze({ analysisType, sourceTable, geometryColumn })` — types: `spatial_extent`, `point_in_polygon`, `nearest_neighbor`, `distance_matrix`. ⚠️ nearest_neighbor/distance_matrix return CARTESIAN distance. Use `excludeSelf: true` for same source/target table
- `sqlite_spatialite_transform({ operation, geometry1, distance })` — operations: `buffer`, `simplify`. Buffer `distance` = radius; simplify `distance` = tolerance (0.0001 for lat/lon). Buffer auto-simplifies (use `simplifyTolerance: 0` to disable)
- `sqlite_spatialite_index({ tableName, geometryColumn, action: "create" })`
- `sqlite_spatialite_status` — check SpatiaLite availability
