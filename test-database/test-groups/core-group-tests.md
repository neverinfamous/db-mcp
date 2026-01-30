# Core Tool Group Tests

## Overview

The **Core** group provides fundamental database operations for CRUD, schema inspection, and index management.

| Environment | Tool Count |
| ----------- | ---------- |
| WASM        | 8          |
| Native      | 8          |

## Tools in Group

| Tool                    | Description                  | Scope |
| ----------------------- | ---------------------------- | ----- |
| `sqlite_read_query`     | Execute read-only SQL query  | read  |
| `sqlite_write_query`    | Execute INSERT/UPDATE/DELETE | write |
| `sqlite_create_table`   | Create a new table           | write |
| `sqlite_list_tables`    | List all tables              | read  |
| `sqlite_describe_table` | Describe table structure     | read  |
| `sqlite_drop_table`     | Drop a table                 | admin |
| `sqlite_get_indexes`    | Get indexes for a table      | read  |
| `sqlite_create_index`   | Create an index              | write |

## Test Tables

- `test_products` (15 rows)
- `test_orders` (20 rows)
- `test_users` (8 rows)

---

## Test Cases

### 1. sqlite_read_query

**Description:** Execute a read-only SQL query.

**Test 1.1: Simple SELECT**

```json
{
  "query": "SELECT id, name, price FROM test_products LIMIT 5"
}
```

Expected: Returns 5 product rows with id, name, price columns.

**Test 1.2: SELECT with WHERE**

```json
{
  "query": "SELECT * FROM test_products WHERE category = 'electronics'"
}
```

Expected: Returns products in electronics category.

**Test 1.3: Aggregate query**

```json
{
  "query": "SELECT category, COUNT(*) as count, AVG(price) as avg_price FROM test_products GROUP BY category"
}
```

Expected: Returns grouped statistics by category.

**Test 1.4: JOIN query**

```json
{
  "query": "SELECT o.id, p.name, o.quantity, o.total_price FROM test_orders o JOIN test_products p ON o.product_id = p.id LIMIT 10"
}
```

Expected: Returns order details with product names.

---

### 2. sqlite_write_query

**Description:** Execute INSERT, UPDATE, or DELETE queries.

**Test 2.1: INSERT single row**

```json
{
  "query": "INSERT INTO test_products (name, description, price, category) VALUES ('Test Widget', 'A test product', 19.99, 'test')"
}
```

Expected: Returns `{ "rowsAffected": 1 }`.

**Test 2.2: UPDATE rows**

```json
{
  "query": "UPDATE test_products SET price = price * 1.1 WHERE category = 'test'"
}
```

Expected: Returns number of rows affected.

**Test 2.3: DELETE rows**

```json
{
  "query": "DELETE FROM test_products WHERE category = 'test'"
}
```

Expected: Cleans up test data, returns rows affected.

---

### 3. sqlite_create_table

**Description:** Create a new table with columns and constraints.

**Test 3.1: Basic table creation**

```json
{
  "tableName": "temp_customers",
  "columns": [
    { "name": "id", "type": "INTEGER", "primaryKey": true },
    { "name": "name", "type": "TEXT", "notNull": true },
    { "name": "email", "type": "TEXT" }
  ]
}
```

Expected: Table created successfully.

**Test 3.2: Table with default values**

```json
{
  "tableName": "temp_logs",
  "columns": [
    { "name": "id", "type": "INTEGER", "primaryKey": true },
    { "name": "message", "type": "TEXT" },
    { "name": "created_at", "type": "TEXT", "default": "(datetime('now'))" }
  ]
}
```

Expected: Table created with default timestamp.

---

### 4. sqlite_list_tables

**Description:** List all tables in the database.

**Test 4.1: List all tables**

```json
{}
```

Expected: Returns list including all 10 `test_*` tables.

**Test 4.2: List with pattern (if supported)**

```json
{
  "pattern": "test_p%"
}
```

Expected: Returns `test_products` only.

---

### 5. sqlite_describe_table

**Description:** Describe a table's structure and columns.

**Test 5.1: Describe products table**

```json
{
  "table": "test_products"
}
```

Expected: Returns columns: id, name, description, price, category, created_at with types.

**Test 5.2: Describe orders table**

```json
{
  "table": "test_orders"
}
```

Expected: Returns columns including foreign key reference.

---

### 6. sqlite_drop_table

**Description:** Drop (delete) a table.

**Test 6.1: Drop temp table**

```json
{
  "table": "temp_customers",
  "ifExists": true
}
```

Expected: Table dropped successfully.

**Test 6.2: Drop non-existent table with IF EXISTS**

```json
{
  "table": "nonexistent_table",
  "ifExists": true
}
```

Expected: No error (IF EXISTS protects).

---

### 7. sqlite_get_indexes

**Description:** Get indexes for a table.

**Test 7.1: Get indexes on orders table**

```json
{
  "table": "test_orders"
}
```

Expected: Returns `idx_orders_status` and `idx_orders_date`.

**Test 7.2: Get all indexes**

```json
{}
```

Expected: Returns all indexes in the database.

---

### 8. sqlite_create_index

**Description:** Create an index on a table.

**Test 8.1: Create single-column index**

```json
{
  "indexName": "idx_test_products_price",
  "table": "test_products",
  "columns": ["price"]
}
```

Expected: Index created successfully.

**Test 8.2: Create composite index**

```json
{
  "indexName": "idx_test_orders_product_status",
  "table": "test_orders",
  "columns": ["product_id", "status"]
}
```

Expected: Composite index created.

**Test 8.3: Create unique index**

```json
{
  "indexName": "idx_test_users_email_unique",
  "table": "test_users",
  "columns": ["email"],
  "unique": true
}
```

Expected: Unique index created.

---

## Cleanup

After testing, clean up any created artifacts:

```sql
DROP TABLE IF EXISTS temp_customers;
DROP TABLE IF EXISTS temp_logs;
DROP INDEX IF EXISTS idx_test_products_price;
DROP INDEX IF EXISTS idx_test_orders_product_status;
DROP INDEX IF EXISTS idx_test_users_email_unique;
```

## Known Issues / Notes

- Write operations require `write` scope
- Drop operations require `admin` scope
- Validate that identifier sanitization is working correctly
