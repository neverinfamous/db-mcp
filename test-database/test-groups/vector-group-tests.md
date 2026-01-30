# Vector Tool Group Tests

## Overview

The **Vector** group provides vector similarity search and embedding operations using JSON arrays for portable vector storage.

| Environment | Tool Count |
| ----------- | ---------- |
| WASM        | 11         |
| Native      | 11         |

## Tools in Group

| Tool                         | Description                        |
| ---------------------------- | ---------------------------------- |
| `sqlite_vector_create_table` | Create table for vector storage    |
| `sqlite_vector_store`        | Store a single vector              |
| `sqlite_vector_batch_store`  | Batch store multiple vectors       |
| `sqlite_vector_search`       | Similarity search                  |
| `sqlite_vector_get`          | Get vector by ID                   |
| `sqlite_vector_delete`       | Delete vectors by ID               |
| `sqlite_vector_count`        | Count vectors                      |
| `sqlite_vector_stats`        | Vector statistics                  |
| `sqlite_vector_dimensions`   | Get vector dimensions              |
| `sqlite_vector_normalize`    | Normalize a vector                 |
| `sqlite_vector_distance`     | Calculate distance between vectors |

## Test Table

- `test_embeddings` (20 rows) - 8-dimensional vectors with content and category

---

## Test Cases

### 1. sqlite_vector_create_table

**Test 1.1: Create vector table**

```json
{
  "tableName": "temp_document_vectors",
  "dimensions": 384,
  "additionalColumns": [
    { "name": "title", "type": "TEXT" },
    { "name": "source", "type": "TEXT" }
  ]
}
```

Expected: Table created with id, vector, title, source columns.

**Test 1.2: Simple vector table**

```json
{
  "tableName": "temp_simple_vectors",
  "dimensions": 128
}
```

Expected: Table created with id and vector columns.

---

### 2. sqlite_vector_store

**Test 2.1: Store single vector**

```json
{
  "table": "temp_simple_vectors",
  "idColumn": "id",
  "vectorColumn": "vector",
  "id": "doc_001",
  "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
}
```

Expected: Vector stored successfully.

**Test 2.2: Store with metadata**

```json
{
  "table": "temp_document_vectors",
  "idColumn": "id",
  "vectorColumn": "vector",
  "id": "article_1",
  "vector": [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85],
  "metadata": {
    "title": "Test Article",
    "source": "manual"
  }
}
```

Expected: Vector stored with additional column values.

---

### 3. sqlite_vector_batch_store

**Test 3.1: Batch store vectors**

```json
{
  "table": "temp_simple_vectors",
  "idColumn": "id",
  "vectorColumn": "vector",
  "items": [
    { "id": "batch_1", "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] },
    { "id": "batch_2", "vector": [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] },
    { "id": "batch_3", "vector": [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] }
  ]
}
```

Expected: 3 vectors stored in single operation.

---

### 4. sqlite_vector_search

**Test 4.1: Cosine similarity search**

```json
{
  "table": "test_embeddings",
  "vectorColumn": "embedding",
  "queryVector": [0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01],
  "metric": "cosine",
  "limit": 5
}
```

Expected: Returns 5 most similar vectors (highest cosine similarity).

**Test 4.2: Euclidean distance search**

```json
{
  "table": "test_embeddings",
  "vectorColumn": "embedding",
  "queryVector": [-0.34, 0.22, 0.67, -0.11, 0.55, 0.43, -0.28, 0.91],
  "metric": "euclidean",
  "limit": 5
}
```

Expected: Returns 5 nearest vectors (smallest Euclidean distance).

**Test 4.3: Search with category filter**

```json
{
  "table": "test_embeddings",
  "vectorColumn": "embedding",
  "queryVector": [0.15, 0.42, -0.21, 0.75, 0.38, -0.52, 0.85, 0.05],
  "metric": "cosine",
  "limit": 3,
  "whereClause": "category = 'tech'"
}
```

Expected: Returns 3 most similar vectors in 'tech' category only.

**Test 4.4: Dot product similarity**

```json
{
  "table": "test_embeddings",
  "vectorColumn": "embedding",
  "queryVector": [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  "metric": "dot",
  "limit": 5
}
```

Expected: Returns 5 vectors with highest dot product.

---

### 5. sqlite_vector_get

**Test 5.1: Get vector by ID**

```json
{
  "table": "test_embeddings",
  "idColumn": "id",
  "vectorColumn": "embedding",
  "id": 1
}
```

Expected: Returns vector for ID 1.

**Test 5.2: Get multiple vectors**

```json
{
  "table": "test_embeddings",
  "idColumn": "id",
  "vectorColumn": "embedding",
  "ids": [1, 2, 3]
}
```

Expected: Returns vectors for IDs 1, 2, 3.

---

### 6. sqlite_vector_delete

**Test 6.1: Delete by ID**

```json
{
  "table": "temp_simple_vectors",
  "idColumn": "id",
  "ids": ["batch_1", "batch_2"]
}
```

Expected: 2 vectors deleted.

---

### 7. sqlite_vector_count

**Test 7.1: Count all vectors**

```json
{
  "table": "test_embeddings",
  "vectorColumn": "embedding"
}
```

Expected: Returns 20.

**Test 7.2: Count by category**

```json
{
  "table": "test_embeddings",
  "vectorColumn": "embedding",
  "whereClause": "category = 'database'"
}
```

Expected: Returns count of database vectors.

---

### 8. sqlite_vector_stats

**Test 8.1: Vector statistics**

```json
{
  "table": "test_embeddings",
  "vectorColumn": "embedding",
  "sampleSize": 20
}
```

Expected: Returns stats like avg magnitude, dimension stats, etc.

---

### 9. sqlite_vector_dimensions

**Test 9.1: Get dimensions**

```json
{
  "table": "test_embeddings",
  "vectorColumn": "embedding"
}
```

Expected: Returns 8 (vector dimension count).

---

### 10. sqlite_vector_normalize

**Test 10.1: Normalize vector**

```json
{
  "vector": [3, 4, 0, 0, 0, 0, 0, 0]
}
```

Expected: Returns [0.6, 0.8, 0, 0, 0, 0, 0, 0] (unit vector).

**Test 10.2: Already normalized**

```json
{
  "vector": [1, 0, 0, 0, 0, 0, 0, 0]
}
```

Expected: Returns same vector (already unit length).

---

### 11. sqlite_vector_distance

**Test 11.1: Cosine distance**

```json
{
  "vector1": [1, 0, 0, 0, 0, 0, 0, 0],
  "vector2": [0, 1, 0, 0, 0, 0, 0, 0],
  "metric": "cosine"
}
```

Expected: Returns 0 (orthogonal vectors, cosine similarity = 0).

**Test 11.2: Euclidean distance**

```json
{
  "vector1": [0, 0, 0, 0, 0, 0, 0, 0],
  "vector2": [3, 4, 0, 0, 0, 0, 0, 0],
  "metric": "euclidean"
}
```

Expected: Returns 5 (3-4-5 triangle).

**Test 11.3: Dot product**

```json
{
  "vector1": [1, 2, 3, 4, 5, 6, 7, 8],
  "vector2": [1, 1, 1, 1, 1, 1, 1, 1],
  "metric": "dot"
}
```

Expected: Returns 36 (sum 1+2+3+4+5+6+7+8).

---

## Semantic Search Workflow

### Complete Workflow Test

1. **Create collection**

```json
{
  "tableName": "temp_semantic_docs",
  "dimensions": 8,
  "additionalColumns": [
    { "name": "title", "type": "TEXT" },
    { "name": "content", "type": "TEXT" }
  ]
}
```

2. **Store documents with embeddings**

```json
{
  "table": "temp_semantic_docs",
  "idColumn": "id",
  "vectorColumn": "vector",
  "items": [
    { "id": 1, "vector": [0.9, 0.1, 0.0, 0.2, 0.3, 0.1, 0.0, 0.1] },
    { "id": 2, "vector": [0.1, 0.9, 0.0, 0.1, 0.2, 0.1, 0.0, 0.2] },
    { "id": 3, "vector": [0.0, 0.1, 0.9, 0.1, 0.1, 0.2, 0.0, 0.1] }
  ]
}
```

3. **Search for similar**

```json
{
  "table": "temp_semantic_docs",
  "vectorColumn": "vector",
  "queryVector": [0.85, 0.15, 0.0, 0.2, 0.25, 0.1, 0.0, 0.1],
  "metric": "cosine",
  "limit": 2
}
```

Expected: Returns ID 1 as most similar.

---

## Cleanup

```sql
DROP TABLE IF EXISTS temp_document_vectors;
DROP TABLE IF EXISTS temp_simple_vectors;
DROP TABLE IF EXISTS temp_semantic_docs;
```

## Known Issues / Notes

- Vectors stored as JSON arrays for portability
- Cosine similarity range: -1 to 1 (1 = identical direction)
- Euclidean distance: 0 = identical (lower is more similar)
- Dot product: higher = more similar (sensitive to magnitude)
- For large-scale vector search, consider specialized vector databases
- No index optimization in current implementation (linear scan)
