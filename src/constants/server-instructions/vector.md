# db-mcp Help — Vector/Semantic Search (11 tools)

```javascript
// Create vector table with metadata columns
sqlite_vector_create_table({ tableName: "docs", dimensions: 384, additionalColumns: [{ name: "content", type: "TEXT" }] });

// Store vectors (single and batch)
sqlite_vector_store({ table: "docs", idColumn: "id", vectorColumn: "emb", id: 1, vector: [...] });
sqlite_vector_batch_store({ table: "docs", idColumn: "id", vectorColumn: "emb", items: [{ id: 1, vector: [...] }, { id: 2, vector: [...] }] });

// Search vectors (returnColumns omits vector data from results for smaller payloads)
sqlite_vector_search({ table: "docs", vectorColumn: "emb", queryVector: [...], limit: 10, returnColumns: ["id", "title"] }); // returns { results: [...] } instead of rows

// Retrieve and delete vectors
// Note: sqlite_vector_get returns parsed 'vector' array + additional columns in a 'metadata' object for flexibility
sqlite_vector_get({ table: "docs", idColumn: "id", vectorColumn: "emb", id: 1 });
sqlite_vector_delete({ table: "docs", idColumn: "id", ids: [1, 2, 3] });

// Vector metadata
sqlite_vector_count({ table: "docs" }); // or with dimensions filter: { table: "docs", dimensions: 384 }
sqlite_vector_dimensions({ table: "docs", vectorColumn: "emb" });
sqlite_vector_stats({ table: "docs", vectorColumn: "emb" }); // returns sampleSize, magnitudeStats (min/max/avg)

// Utility tools for preprocessing
sqlite_vector_normalize({ vector: [3, 4, 0, 0] }); // returns unit vector [0.6, 0.8, 0, 0]
sqlite_vector_distance({ vector1: [...], vector2: [...], metric: "cosine" }); // returns { value: <number> }
```
