# Advanced Stress Test: Vector Group

## Progress
- [x] Read gotchas.md
- [x] Category 1: Boundary Values
- [x] Category 2: Distance Metric Verification
- [x] Category 3: Dimension Mismatch
- [x] Category 4: Batch Operations
- [x] Category 5: Category Filtering
- [x] Category 6: Error Message Quality
- [x] Final Cleanup

## Coverage Matrix

| Tool | Status | Findings / Token Payload |
|---|---|---|
| `sqlite_vector_create_table` | ✅ | |
| `sqlite_vector_store` | ✅ | |
| `sqlite_vector_batch_store` | ✅ | |
| `sqlite_vector_search` | ✅ | |
| `sqlite_vector_get` | ✅ | |
| `sqlite_vector_delete` | ✅ | |
| `sqlite_vector_count` | ✅ | |
| `sqlite_vector_stats` | ✅ | |
| `sqlite_vector_dimensions` | ✅ | |
| `sqlite_vector_normalize` | ✅ | |
| `sqlite_vector_distance` | ✅ | |

## Detailed Findings

### Category 1: Boundary Values
- **1.1 Empty Vector Table**
  - createTable: ✅ Confirmed `{"success":true,"message":"Vector table 'stress_vec_empty' created with 4 dimensions","sql":"..."}`
  - count: ✅ Confirmed `{"success":true,"count":0}`
  - search: ✅ Confirmed `{"success":true,"metric":"cosine","count":0,"rows":[]}`
  - stats: ✅ Confirmed `{"success":true,"count":0,"message":"No valid vectors found"}`
  - dimensions: ✅ Confirmed `{"success":true,"dimensions":null,"message":"No vectors found"}`
- **1.2 Single-Vector Table**
  - store: ✅ Confirmed `{"success":true,"id":1,"dimensions":4}`
  - searchAfterStore: ✅ Confirmed `{"success":true,"metric":"cosine","count":1,"rows":[{"id":1,"vector":"[1,0,0,0]","dimensions":4,"_similarity":1}]}`

### Category 2: Distance Metric Verification
- dist1: ✅ Confirmed `{"success":true,"metric":"cosine","distance":1}`
- dist2: ✅ Confirmed `{"success":true,"metric":"cosine","distance":0}`
- dist3: ✅ Confirmed `{"success":true,"metric":"cosine","distance":2}`
- dist4: ✅ Confirmed `{"success":true,"metric":"euclidean","distance":5}`
- dist5: ✅ Confirmed `{"success":true,"metric":"euclidean","distance":0}`
- norm1: ✅ Confirmed `{"success":true,"original":[3,4],"normalized":[0.6,0.8],"originalMagnitude":5}`
- norm2: ✅ Confirmed `{"success":true,"original":[0,0,0],"normalized":[0,0,0],"originalMagnitude":0}`

### Category 3: Dimension Mismatch
- storeMismatch: ✅ Confirmed `{"success":false,"error":"Dimension mismatch: vector has 2 dimensions but table expects 4","code":"DIMENSION_MISMATCH"}`
- searchMismatch: ✅ Confirmed `{"success":true,"metric":"cosine","count":0,"rows":[],"skipped":1,"warning":"1 vector(s) skipped due to dimension mismatch or parse errors"}`
- distanceMismatch: ✅ Confirmed `{"success":false,"error":"Vector dimensions must match","code":"DIMENSION_MISMATCH"}`

### Category 4: Batch Operations
- batchStoreEmpty: ✅ Confirmed `{"success":true,"stored":0,"message":"No items provided"}`
- batchStore50: ✅ Confirmed `{"success":true,"stored":50,"dimensions":4}`
- countAfterBatch: ✅ Confirmed `{"success":true,"count":51}`

### Category 5: Category Filtering
- searchTech: ✅ Confirmed count: 4
- searchNonexistent: ✅ Confirmed count: 0

### Category 6: Error Message Quality
- searchNonexistentTable: ✅ Confirmed `{"success":false,"error":"Query execution failed: no such table: nonexistent_table_xyz","code":"TABLE_NOT_FOUND","category":"query","suggestion":"Table not found. Run sqlite_list_tables to see available tables.","recoverable":false,"details":{"sql":"SELECT *, \"v\" FROM \"nonexistent_table_xyz\""}}`
- getMissing: ✅ Confirmed `{"success":false,"error":"Vector not found","code":"VECTOR_NOT_FOUND"}`
- deleteMissing: ✅ Confirmed `{"success":true,"deleted":0}`

### Final Cleanup
- Dropped `stress_vec_empty`.
- Confirmed `test_embeddings` count is still 20.
