# db-mcp Help — Vector/Semantic Search (11 tools)

- `sqlite_vector_create_table({ tableName, dimensions, additionalColumns: [{ name, type }] })` — create vector table
- `sqlite_vector_store({ table, idColumn, vectorColumn, id, vector: [...] })` — store single vector
- `sqlite_vector_batch_store({ table, idColumn, vectorColumn, items: [{ id, vector }] })` — batch store
- `sqlite_vector_search({ table, vectorColumn, queryVector: [...], limit, returnColumns: ["id", "title"] })` — search vectors. `returnColumns` omits vector data for smaller payloads
- `sqlite_vector_get({ table, idColumn, vectorColumn, id })` — returns parsed `vector` array + raw JSON string in `metadata`
- `sqlite_vector_delete({ table, idColumn, ids: [1, 2, 3] })` — delete vectors
- `sqlite_vector_count({ table, dimensions? })` — count vectors
- `sqlite_vector_dimensions({ table, vectorColumn })` — get dimensions
- `sqlite_vector_stats({ table, vectorColumn })` — magnitude min/max/avg
- `sqlite_vector_normalize({ vector: [...] })` — returns unit vector
- `sqlite_vector_distance({ vector1, vector2, metric: "cosine" })` — or `"euclidean"`, `"dot"`
