# JSON Tool Group Tests

## Overview

The **JSON** group provides comprehensive JSON document operations including helpers for common patterns and low-level JSON1 extension functions.

| Environment | Tool Count |
| ----------- | ---------- |
| WASM        | 23         |
| Native      | 23         |

## Tools in Group

### JSON Helpers (8 tools)

| Tool                            | Description                                  |
| ------------------------------- | -------------------------------------------- |
| `sqlite_json_insert`            | Insert JSON document with auto-normalization |
| `sqlite_json_update`            | Update JSON value at specific path           |
| `sqlite_json_select`            | Select and extract JSON data                 |
| `sqlite_json_query`             | Query JSON with path-based filtering         |
| `sqlite_json_validate_path`     | Validate JSON path syntax                    |
| `sqlite_json_merge`             | Merge JSON objects                           |
| `sqlite_analyze_json_schema`    | Analyze JSON schema from column data         |
| `sqlite_json_collection_create` | Create JSON document collection table        |

### JSON Operations (15 tools)

| Tool                           | Description                                |
| ------------------------------ | ------------------------------------------ |
| `sqlite_json_validate`         | Validate JSON string                       |
| `sqlite_json_extract`          | Extract value from JSON                    |
| `sqlite_json_set`              | Set value in JSON                          |
| `sqlite_json_remove`           | Remove value from JSON                     |
| `sqlite_json_type`             | Get JSON value type                        |
| `sqlite_json_array_length`     | Get JSON array length                      |
| `sqlite_json_array_append`     | Append to JSON array                       |
| `sqlite_json_keys`             | Get JSON object keys                       |
| `sqlite_json_each`             | Expand JSON to rows                        |
| `sqlite_json_group_array`      | Aggregate values into JSON array           |
| `sqlite_json_group_object`     | Aggregate key-value pairs into JSON object |
| `sqlite_json_pretty`           | Pretty print JSON                          |
| `sqlite_jsonb_convert`         | Convert text JSON to JSONB                 |
| `sqlite_json_normalize_column` | Normalize JSON column data                 |
| `sqlite_json_patch`            | Apply JSON patch                           |

## Test Table

- `test_jsonb_docs` (6 rows) - JSON documents with metadata and tags

---

## Test Cases

### JSON Helpers

#### 1. sqlite_json_insert

**Test 1.1: Insert JSON document**

```json
{
  "table": "test_jsonb_docs",
  "columns": {
    "doc": { "type": "note", "title": "Test Note", "priority": 1 },
    "metadata": { "author": "tester" },
    "tags": ["test", "demo"]
  }
}
```

Expected: Document inserted with auto-serialization.

---

#### 2. sqlite_json_update

**Test 2.1: Update JSON path**

```json
{
  "table": "test_jsonb_docs",
  "column": "doc",
  "path": "$.views",
  "value": 9999,
  "whereClause": "id = 1"
}
```

Expected: Views updated to 9999 for document 1.

---

#### 3. sqlite_json_select

**Test 3.1: Select with JSON extraction**

```json
{
  "table": "test_jsonb_docs",
  "paths": {
    "title": "$.title",
    "author": "$.author",
    "docType": "$.type"
  }
}
```

Expected: Returns extracted values as columns.

---

#### 4. sqlite_json_query

**Test 4.1: Query by JSON path value**

```json
{
  "table": "test_jsonb_docs",
  "column": "doc",
  "path": "$.type",
  "operator": "=",
  "value": "article"
}
```

Expected: Returns documents where type = 'article'.

**Test 4.2: Query nested path**

```json
{
  "table": "test_jsonb_docs",
  "column": "doc",
  "path": "$.nested.level1.level2",
  "operator": "IS NOT NULL"
}
```

Expected: Returns document with nested structure.

---

#### 5. sqlite_json_validate_path

**Test 5.1: Valid path**

```json
{
  "path": "$.metadata.author"
}
```

Expected: `{ "valid": true }`.

**Test 5.2: Invalid path**

```json
{
  "path": "$..invalid[[path"
}
```

Expected: `{ "valid": false, "error": "..." }`.

---

#### 6. sqlite_json_merge

**Test 6.1: Merge JSON objects**

```json
{
  "table": "test_jsonb_docs",
  "column": "doc",
  "mergeData": { "status": "active", "priority": "high" },
  "whereClause": "id = 1"
}
```

Expected: Document merged with new keys.

---

#### 7. sqlite_analyze_json_schema

**Test 7.1: Analyze doc column schema**

```json
{
  "table": "test_jsonb_docs",
  "column": "doc"
}
```

Expected: Returns schema analysis with types, paths, and frequencies.

---

#### 8. sqlite_json_collection_create

**Test 8.1: Create JSON collection**

```json
{
  "tableName": "temp_documents",
  "additionalColumns": [{ "name": "category", "type": "TEXT" }]
}
```

Expected: Creates table with id, doc, created_at, updated_at, category columns.

---

### JSON Operations

#### 9. sqlite_json_validate

**Test 9.1: Validate valid JSON**

```json
{
  "json": "{\"name\": \"test\", \"value\": 123}"
}
```

Expected: `{ "valid": true }`.

**Test 9.2: Validate invalid JSON**

```json
{
  "json": "{invalid json}"
}
```

Expected: `{ "valid": false, "error": "..." }`.

---

#### 10. sqlite_json_extract

**Test 10.1: Extract from column**

```json
{
  "table": "test_jsonb_docs",
  "column": "doc",
  "path": "$.author"
}
```

Expected: Returns list of author values.

**Test 10.2: Extract nested value**

```json
{
  "table": "test_jsonb_docs",
  "column": "metadata",
  "path": "$.source"
}
```

Expected: Returns source values from metadata.

---

#### 11. sqlite_json_set

**Test 11.1: Set new value**

```json
{
  "table": "test_jsonb_docs",
  "column": "doc",
  "path": "$.lastUpdated",
  "value": "2026-01-30",
  "whereClause": "id = 1"
}
```

Expected: Adds lastUpdated field.

---

#### 12. sqlite_json_remove

**Test 12.1: Remove path**

```json
{
  "table": "test_jsonb_docs",
  "column": "doc",
  "path": "$.lastUpdated",
  "whereClause": "id = 1"
}
```

Expected: Removes the lastUpdated field.

---

#### 13. sqlite_json_type

**Test 13.1: Get type of value**

```json
{
  "table": "test_jsonb_docs",
  "column": "doc",
  "path": "$.views"
}
```

Expected: Returns "integer" for views.

**Test 13.2: Get type of tags array**

```json
{
  "table": "test_jsonb_docs",
  "column": "tags",
  "path": "$"
}
```

Expected: Returns "array".

---

#### 14. sqlite_json_array_length

**Test 14.1: Get tags array length**

```json
{
  "table": "test_jsonb_docs",
  "column": "tags",
  "path": "$"
}
```

Expected: Returns array lengths (2-3 per row).

---

#### 15. sqlite_json_array_append

**Test 15.1: Append to tags**

```json
{
  "table": "test_jsonb_docs",
  "column": "tags",
  "value": "new-tag",
  "whereClause": "id = 1"
}
```

Expected: Tags array now includes "new-tag".

---

#### 16. sqlite_json_keys

**Test 16.1: Get object keys**

```json
{
  "table": "test_jsonb_docs",
  "column": "metadata"
}
```

Expected: Returns keys like ["source", "language", "version"].

---

#### 17. sqlite_json_each

**Test 17.1: Expand array to rows**

```json
{
  "table": "test_jsonb_docs",
  "column": "tags",
  "whereClause": "id = 1"
}
```

Expected: Returns one row per tag element.

---

#### 18. sqlite_json_group_array

**Test 18.1: Aggregate names into array**

```json
{
  "table": "test_products",
  "valueColumn": "name",
  "groupByColumn": "category"
}
```

Expected: Returns JSON array of product names per category.

---

#### 19. sqlite_json_group_object

**Test 19.1: Create object from key-value pairs**

```json
{
  "table": "test_products",
  "keyColumn": "name",
  "valueColumn": "price"
}
```

Expected: Returns JSON object with product names as keys, prices as values.

---

#### 20. sqlite_json_pretty

**Test 20.1: Pretty print JSON**

```json
{
  "json": "{\"compact\":true,\"nested\":{\"a\":1,\"b\":2}}"
}
```

Expected: Returns formatted JSON with indentation.

---

## Cleanup

```sql
DROP TABLE IF EXISTS temp_documents;
-- Reset modified test data
UPDATE test_jsonb_docs SET doc = json(doc) WHERE id = 1;
```

## Known Issues / Notes

- JSON path syntax uses `$` for root
- Array indices are 0-based: `$[0]`, `$[1]`
- JSONB conversion requires native backend for best performance
