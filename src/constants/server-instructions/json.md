# db-mcp Help — JSON Operations (23 tools)

- `sqlite_create_json_collection({ tableName, indexes: [{ path: "$.key" }] })` — creates table with JSON indexes
- `sqlite_json_insert({ table, column, data: {...} })` — insert JSON document
- `sqlite_json_query({ table, column, filterPaths: { "$.key": value }, selectPaths: ["$.path"] })` — query with filters
- `sqlite_json_extract({ table, column, path })` — extract value at path. Returns null if path doesn't exist
- `sqlite_json_set({ table, column, path, value, whereClause })` — set value at path
- `sqlite_json_merge({ table, column, mergeData: {...}, whereClause })` — merge object into existing
- `sqlite_json_remove` — remove key at path
- `sqlite_json_array_append({ table, column, path, value, whereClause })` — append to array
- `sqlite_json_each({ table, column, path, limit })` — expand array to rows (⚠️ multiplies output)
- `sqlite_json_group_array({ table, valueColumn, groupByColumn, allowExpressions? })` — group values into arrays. For JSON collections: use `allowExpressions: true` with `json_extract(col, '$.path')` for both value and group columns
- `sqlite_json_group_object({ table, keyColumn, aggregateFunction? })` — group into key-value object. For aggregate values (COUNT, SUM, AVG), use `aggregateFunction` param
- `sqlite_json_analyze_schema({ table, column })` — infer schema types
- `sqlite_json_storage_info({ table, column })` — check text vs JSONB format
- `sqlite_jsonb_convert({ table, column })` — convert to JSONB for faster queries (SQLite 3.45+)
