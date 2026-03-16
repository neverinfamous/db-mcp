# db-mcp Help — JSON Operations (23 tools)

## Collection & CRUD

- `sqlite_create_json_collection({ tableName, indexes: [{ path: "$.type" }, { path: "$.author" }] })` — creates table with JSON indexes
- `sqlite_json_insert({ table, column, data: { type: "article", title: "Hello", tags: ["news"] } })` — insert JSON document
- `sqlite_json_select({ table, column, extractPaths? })` — select rows, optionally extract specific JSON paths
- `sqlite_json_update({ table, column, path, value, whereClause })` — update value at JSON path
- `sqlite_json_query({ table, column, filterPaths: { "$.type": "article" }, selectPaths: ["$.title"] })` — query with path-based filters and projections

## Path Operations

- `sqlite_json_extract({ table, column, path: "$.title" })` — extract value at path. Returns null if path doesn't exist
- `sqlite_json_set({ table, column, path: "$.views", value: 100, whereClause: "id = 1" })` — set value at path (creates if missing)
- `sqlite_json_merge({ table, column, mergeData: { featured: true }, whereClause: "id = 1" })` — merge object into existing JSON
- `sqlite_json_remove({ table, column, path, whereClause })` — remove key at path
- `sqlite_json_validate_path({ path: "$.store.books[0].title" })` — validate JSON path syntax without executing a query
- `sqlite_json_type({ table, column, path })` — get JSON type (null, true, false, integer, real, text, array, object)

## Array Operations

⚠️ `json_each` multiplies output rows — use `limit` param for large arrays

- `sqlite_json_array_append({ table, column, path: "$.tags", value: "featured", whereClause: "id = 1" })` — append to array
- `sqlite_json_array_length({ table, column, path })` — get array length
- `sqlite_json_each({ table, column, path: "$.tags", limit: 50 })` — expand array to rows

## Aggregation & Analysis

```javascript
// Regular tables: use column names directly
sqlite_json_group_array({ table: "events", valueColumn: "user_id", groupByColumn: "event_type" });

// JSON collections: use allowExpressions with json_extract for both columns
// ⚠️ allowExpressions is for column extraction ONLY, NOT aggregate functions
// ⚠️ Without groupByColumn, each row creates a key-value pair; duplicate keys if values aren't unique
sqlite_json_group_array({
  table: "docs",
  valueColumn: "json_extract(data, '$.author')",
  groupByColumn: "json_extract(data, '$.type')",
  allowExpressions: true,
});

// For aggregate values (COUNT, SUM, AVG), use aggregateFunction parameter instead
sqlite_json_group_object({ table: "events", keyColumn: "event_type", aggregateFunction: "COUNT(*)" });
sqlite_json_group_object({ table: "orders", keyColumn: "status", aggregateFunction: "SUM(total)" });
```

- `sqlite_json_keys({ table, column, path? })` — get distinct keys of JSON objects
- `sqlite_json_pretty({ table, column, whereClause? })` — format JSON with indentation
- `sqlite_json_valid({ table, column })` — check if values are valid JSON
- `sqlite_json_analyze_schema({ table, column })` — infer schema types

## JSONB Optimization (SQLite 3.45+)

- `sqlite_json_storage_info({ table, column })` — check text vs JSONB format
- `sqlite_jsonb_convert({ table, column })` — convert to JSONB for faster queries
- `sqlite_json_normalize_column({ table, column, outputFormat? })` — normalize JSON (sort keys, compact). ⚠️ Defaults to `"preserve"` (maintains original format); use `outputFormat: "text"` to force text output
