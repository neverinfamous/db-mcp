# Geo Tool Group Tests

## Overview

The **Geo** group provides geospatial operations using the Haversine formula for distance calculations. SpatiaLite extensions are available in native mode for advanced GIS operations.

| Environment | Tool Count                            |
| ----------- | ------------------------------------- |
| WASM        | 4                                     |
| Native      | 11 (includes SpatiaLite if available) |

## Tools in Group

### Core Geo Tools (4 tools)

| Tool                      | Description                       |
| ------------------------- | --------------------------------- |
| `sqlite_geo_distance`     | Calculate distance between points |
| `sqlite_geo_nearby`       | Find points within radius         |
| `sqlite_geo_bounding_box` | Find points in bounding box       |
| `sqlite_geo_cluster`      | Cluster points by grid            |

### SpatiaLite Tools (7 tools - Native w/ Extension)

| Tool                               | Description                   |
| ---------------------------------- | ----------------------------- |
| `sqlite_spatialite_create_point`   | Create point geometry         |
| `sqlite_spatialite_create_line`    | Create line geometry          |
| `sqlite_spatialite_create_polygon` | Create polygon geometry       |
| `sqlite_spatialite_buffer`         | Create buffer around geometry |
| `sqlite_spatialite_intersection`   | Geometry intersection         |
| `sqlite_spatialite_union`          | Geometry union                |
| `sqlite_spatialite_within`         | Test point within polygon     |

## Test Table

- `test_locations` (15 rows) - Named locations with latitude/longitude

### Test Data Cities

| City          | Latitude | Longitude |
| ------------- | -------- | --------- |
| New York      | 40.7829  | -73.9654  |
| Paris         | 48.8584  | 2.2945    |
| London        | 51.5007  | -0.1246   |
| Tokyo         | 35.6586  | 139.7454  |
| Sydney        | -33.8568 | 151.2153  |
| San Francisco | 37.8199  | -122.4783 |

---

## Core Geo Tests

### 1. sqlite_geo_distance

**Test 1.1: Distance between two points (km)**

```json
{
  "lat1": 40.7128,
  "lon1": -74.006,
  "lat2": 51.5074,
  "lon2": -0.1278,
  "unit": "km"
}
```

Expected: ~5,570 km (New York to London).

**Test 1.2: Distance in miles**

```json
{
  "lat1": 40.7128,
  "lon1": -74.006,
  "lat2": 34.0522,
  "lon2": -118.2437,
  "unit": "miles"
}
```

Expected: ~2,451 miles (New York to Los Angeles).

**Test 1.3: Short distance in meters**

```json
{
  "lat1": 40.758,
  "lon1": -73.9855,
  "lat2": 40.7484,
  "lon2": -73.9857,
  "unit": "meters"
}
```

Expected: ~1,067 meters (Times Square to Empire State Building).

---

### 2. sqlite_geo_nearby

**Test 2.1: Find locations near Times Square**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "centerLat": 40.758,
  "centerLon": -73.9855,
  "radius": 5,
  "unit": "km"
}
```

Expected: Returns Central Park, Empire State Building, Times Square (all within 5km).

**Test 2.2: Find locations near Paris**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "centerLat": 48.8566,
  "centerLon": 2.3522,
  "radius": 10,
  "unit": "km",
  "limit": 5
}
```

Expected: Returns Eiffel Tower, Louvre Museum, Notre-Dame.

**Test 2.3: Nearby with orderBy distance**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "centerLat": 51.5074,
  "centerLon": -0.1278,
  "radius": 20,
  "unit": "km"
}
```

Expected: Returns London locations ordered by distance from center.

**Test 2.4: Large radius search**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "centerLat": 0,
  "centerLon": 0,
  "radius": 10000,
  "unit": "km"
}
```

Expected: Returns many/all locations within 10,000km of origin.

---

### 3. sqlite_geo_bounding_box

**Test 3.1: NYC bounding box**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "minLat": 40.7,
  "maxLat": 40.8,
  "minLon": -74.1,
  "maxLon": -73.9
}
```

Expected: Returns all New York locations.

**Test 3.2: Europe bounding box**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "minLat": 35,
  "maxLat": 55,
  "minLon": -10,
  "maxLon": 25
}
```

Expected: Returns Paris and London locations.

**Test 3.3: Pacific region**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "minLat": -40,
  "maxLat": 40,
  "minLon": 100,
  "maxLon": 160
}
```

Expected: Returns Tokyo and Sydney locations.

---

### 4. sqlite_geo_cluster

**Test 4.1: Cluster by 10-degree grid**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "gridSize": 10
}
```

Expected: Returns clusters with city groupings.

**Test 4.2: Fine-grained clustering (1-degree)**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "gridSize": 1
}
```

Expected: Returns more granular clusters, NYC landmarks separate.

**Test 4.3: Cluster with counts**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "gridSize": 5
}
```

Expected: Returns clusters with point counts and center coordinates.

---

## Reference: Distance Calculations

### Known Distances for Validation

| Route               | Distance (km) | Distance (mi) |
| ------------------- | ------------- | ------------- |
| NYC → Los Angeles   | 3,944         | 2,451         |
| NYC → London        | 5,567         | 3,459         |
| London → Paris      | 344           | 214           |
| Tokyo → Sydney      | 7,823         | 4,861         |
| NYC → San Francisco | 4,130         | 2,566         |

### Haversine Formula

The geo tools use the Haversine formula:

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1-a))
d = R × c
```

Where R is Earth's radius:

- 6,371 km
- 3,959 miles
- 6,371,000 meters

---

## SpatiaLite Tests (Native with Extension)

> **Note:** These tests require the SpatiaLite extension to be loaded.

### 5. sqlite_spatialite_create_point

**Test 5.1: Create point geometry**

```json
{
  "table": "temp_geo_points",
  "lat": 40.7128,
  "lon": -74.006,
  "srid": 4326
}
```

Expected: Point geometry created with SRID 4326.

---

### 6. sqlite_spatialite_buffer

**Test 6.1: Create 1km buffer**

```json
{
  "table": "temp_geo_points",
  "id": 1,
  "distance": 0.01
}
```

Expected: Buffer polygon created around point (~1km radius in degrees).

---

### 7. sqlite_spatialite_within

**Test 7.1: Point in polygon test**

```json
{
  "pointLat": 40.758,
  "pointLon": -73.9855,
  "polygon": "POLYGON((-74 40, -74 41, -73 41, -73 40, -74 40))"
}
```

Expected: Returns true (point is within NYC bounds).

---

## Workflow Tests

### Find-Nearest Pattern

1. **Get all NYC landmarks nearby current location**

```json
{
  "table": "test_locations",
  "latColumn": "latitude",
  "lonColumn": "longitude",
  "centerLat": 40.758,
  "centerLon": -73.9855,
  "radius": 3,
  "unit": "km",
  "whereClause": "city = 'New York'"
}
```

2. **Calculate distance to each**
   Iterate results and use `sqlite_geo_distance` for precise distances.

### Regional Filtering Pattern

1. **Bounding box for rough filter**
2. **Radius search for precise circle**
3. **Cluster for aggregation**

---

## Cleanup

```sql
DROP TABLE IF EXISTS temp_geo_points;
```

## Known Issues / Notes

- Haversine formula assumes spherical Earth (slight error for ellipsoid)
- For sub-meter precision, consider specialized GIS extensions
- SpatiaLite availability depends on SQLite build configuration
- Bounding box queries are faster than radius (no trig calculations)
- Grid clustering resolution affects performance and result granularity
- SRID 4326 is WGS84 (GPS standard coordinate system)
