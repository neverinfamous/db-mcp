# db-mcp Help — Geospatial Operations (4 basic + 7 SpatiaLite)

## Basic Geo (always available — Haversine formula)

```javascript
sqlite_geo_distance({ lat1: 40.7128, lon1: -74.006, lat2: 34.0522, lon2: -118.2437 }); // returns km
sqlite_geo_bounding_box({
  table: "stores", latColumn: "lat", lonColumn: "lon",
  minLat: 40, maxLat: 41, minLon: -75, maxLon: -73,
});
sqlite_geo_nearby({
  table: "stores", latColumn: "lat", lonColumn: "lon",
  centerLat: 40.7, centerLon: -74, radius: 10, unit: "km",
});
sqlite_geo_cluster({ table: "customers", latColumn: "lat", lonColumn: "lon", gridSize: 0.1 });
```

## SpatiaLite (7 tools, Native only)

```javascript
// Load extension first
sqlite_spatialite_load(); // ⚠️ Required before using other spatial tools

// Create spatial table with geometry column
sqlite_spatialite_create_table({ tableName: "places", geometryColumn: "geom", geometryType: "POINT", srid: 4326 });

// Import data (WKT or GeoJSON)
sqlite_spatialite_import({ tableName: "places", format: "wkt", data: "POINT(-73.99 40.75)", additionalData: { name: "NYC" } });
sqlite_spatialite_import({ tableName: "places", format: "geojson", data: '{"type":"Point","coordinates":[-73.99,40.75]}' });

// Spatial queries (SELECT only)
sqlite_spatialite_query({ query: "SELECT name, AsText(geom) FROM places WHERE ST_Within(geom, ...)" });

// Spatial analysis
// analysisType: "spatial_extent" | "point_in_polygon" | "nearest_neighbor" | "distance_matrix"
// ⚠️ nearest_neighbor/distance_matrix return CARTESIAN distance (degrees), not geodetic (km/miles)
// For same source/target table, use excludeSelf: true to avoid self-matches
sqlite_spatialite_analyze({ analysisType: "spatial_extent", sourceTable: "places", geometryColumn: "geom" });
sqlite_spatialite_analyze({ analysisType: "nearest_neighbor", sourceTable: "pts", targetTable: "pts", excludeSelf: true });

// Geometry transforms
// buffer: 'distance' = radius; simplify: 'distance' = tolerance (0.0001 for lat/lon)
// ⚠️ Buffer auto-simplifies output by default (tolerance=0.0001). Use simplifyTolerance: 0 to disable
sqlite_spatialite_transform({ operation: "buffer", geometry1: "POINT(-73.99 40.75)", distance: 0.01 });
sqlite_spatialite_transform({ operation: "simplify", geometry1: "...", distance: 0.001 });

// Spatial index (R-Tree)
sqlite_spatialite_index({ tableName: "places", geometryColumn: "geom", action: "create" }); // create, drop, or check
```
