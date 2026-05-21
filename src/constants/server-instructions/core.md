# db-mcp Help — Core Operations (14 tools)

## Basic Queries

- `sqlite_read_query({ query: "SELECT * FROM users LIMIT 10" })` — execute SELECT, PRAGMA, EXPLAIN, or WITH statements
- `sqlite_write_query({ query: "INSERT INTO users (name) VALUES ('Alice')" })` — execute INSERT, UPDATE, DELETE, or DDL statements

## Tables & Schema

- `sqlite_list_tables({ excludeSystemTables?: boolean })` — list all tables in the database (system tables excluded by default)
- `sqlite_describe_table({ table: "users" })` — get detailed schema, columns, and foreign keys for a specific table
- `sqlite_create_table({ table: "users", columns: [{ name: "id", type: "INTEGER PRIMARY KEY" }, { name: "email", type: "TEXT UNIQUE" }] })` — create a new table
- `sqlite_drop_table({ table: "users", ifExists?: true })` — drop an existing table

## Indexes

- `sqlite_get_indexes({ table?: "users", excludeSystemIndexes?: true })` — list indexes (optionally filtered by table)
- `sqlite_create_index({ indexName: "idx_users_email", table: "users", columns: ["email"], unique?: true })` — create a new index
- `sqlite_drop_index({ indexName: "idx_users_email", ifExists?: true })` — drop an existing index

## Convenience Tools (High-Level Data Operations)

- `sqlite_upsert({ table: "users", data: [{ id: 1, name: "Alice" }], conflictColumns: ["id"], updateColumns: ["name"], returning: true })` — insert or update rows using `ON CONFLICT` (or `REPLACE` fallback). Supports `returning: true` or array of columns.
- `sqlite_batch_insert({ table: "users", data: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }], returning: true })` — insert multiple rows in a single batch. Supports `returning: true` or array of columns.
- `sqlite_count({ table: "users", whereClause?: "status = 'active'" })` — count rows in a table (faster than a full query)
- `sqlite_exists({ table: "users", whereClause: "email = 'test@example.com'" })` — check if a row exists (stops at first match)
- `sqlite_truncate({ table: "users" })` — quickly delete all rows from a table (executes `DELETE FROM table`)
