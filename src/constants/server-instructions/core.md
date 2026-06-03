# db-mcp Help — Core Operations (25 tools)

## Basic Queries

- `sqlite_read_query({ query: "SELECT * FROM users LIMIT 10", cursor: "...", stream: true, chunkSize: 10 })` — execute SELECT, PRAGMA, EXPLAIN, or WITH statements. Supports `cursor` for offset-based pagination (returns `nextCursor`). Set `stream: true` to return row-by-row chunks via progress notifications instead of full response buffering (requires client progressToken support; gracefully falls back if unavailable). **Agent Tip:** Avoid `SELECT *` on wide tables with large text/JSON columns to conserve token context; use `sqlite_describe_table` first and select specific columns.
- `sqlite_write_query({ query: "INSERT INTO users (name) VALUES ('Alice')" })` — execute INSERT, UPDATE, DELETE, REPLACE, or trigger DDL (CREATE/DROP TRIGGER). Supports `expectedVersion` for OCC.

## Tables & Schema

- `sqlite_list_tables({ excludeSystemTables?: boolean })` — list all tables in the database (system tables excluded by default)
- `sqlite_describe_table({ table: "users" })` — get detailed schema, columns, and foreign keys for a specific table. Detects generated columns (VIRTUAL/STORED) with expression.
- `sqlite_create_table({ table: "users", columns: [{ name: "id", type: "INTEGER PRIMARY KEY" }, { name: "email", type: "TEXT UNIQUE" }], foreignKeys: [{ column: "role_id", targetTable: "roles" }], checkConstraints: ["price > 0"] })` — create a new table with optional table-level constraints. Use `strict: true` for STRICT mode (SQLite 3.37+) to enforce column type checking.
- `sqlite_drop_table({ table: "users", ifExists?: true })` — drop an existing table
- `sqlite_alter_table({ table: "users", operation: "add_column", column: "age", type: "INTEGER", nullable: true })` — add, rename, or drop columns, or rename a table. Operations: `add_column`, `rename_column`, `drop_column`, `rename_table`.
- `sqlite_list_triggers({ table?: "users" })` — list database triggers, optionally filtered by table
- `sqlite_create_trigger({ name: "trg_updated", table: "users", timing: "AFTER", event: "UPDATE", body: "UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id" })` — create a trigger with BEFORE/AFTER/INSTEAD OF timing, optional column-specific UPDATE triggers and WHEN conditions
- `sqlite_drop_trigger({ name: "trg_updated" })` — drop a database trigger
- `sqlite_list_constraints({ table: "users" })` — list primary key, foreign key, unique, and check constraints for a table

## Indexes

- `sqlite_get_indexes({ table?: "users", excludeSystemIndexes?: true })` — list indexes (optionally filtered by table)
- `sqlite_create_index({ indexName: "idx_users_email", table: "users", columns: ["email"], unique?: true })` — create a new index
- `sqlite_drop_index({ indexName: "idx_users_email", ifExists?: true })` — drop an existing index

## Versioning & Concurrency (OCC)

- `sqlite_enable_versioning({ table: "users" })` — add a `_version` column and a BEFORE UPDATE trigger to enforce optimistic concurrency control on a table
- `sqlite_disable_versioning({ table: "users" })` — remove the `_version` column and concurrency trigger
- `sqlite_check_version({ table: "users", rowId: 1 })` — get the current `_version` of a row
- `sqlite_conditional_update({ table: "users", conditions: [{ column: "id", operator: "=", value: 1 }], expectedVersion: 2, data: { name: "Bob" } })` — safely update a row, incrementing `_version` atomically. Will fail if `expectedVersion` does not match

## Convenience Tools (High-Level Data Operations)

- `sqlite_upsert({ table: "users", data: { id: 1, name: "Alice" }, conflictColumns: ["id"], updateColumns: ["name"], returning: true })` — insert or update a row using `ON CONFLICT` (or `REPLACE` fallback). Supports `returning: true` or array of columns, and `expectedVersion` for OCC.
- `sqlite_batch_insert({ table: "users", rows: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }], returning: true })` — insert multiple rows in a single batch. Supports `returning: true` or array of columns.
- `sqlite_count({ table: "users", where?: "status = 'active'" })` — count rows in a table (faster than a full query)
- `sqlite_exists({ table: "users", where: "email = 'test@example.com'" })` — check if a row exists (stops at first match)
- `sqlite_truncate({ table: "users" })` — quickly delete all rows from a table (executes `DELETE FROM table`)
- `sqlite_date_add({ table: "users", column: "created_at", amount: 7, unit: "days", whereClause: "id = 1" })` — add or subtract time intervals from a date column. By default returns only the computed column; use `selectColumns` to return additional context.
- `sqlite_date_diff({ table: "users", column1: "ended_at", column2: "started_at", unit: "days", whereClause: "id = 1" })` — calculate the difference between two date columns. By default returns only the computed column; use `selectColumns` to return additional context.
