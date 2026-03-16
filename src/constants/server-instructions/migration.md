# db-mcp Help — Migration Tracking (6 tools)

⚠️ Must call `sqlite_migration_init()` before using any other migration tool — it creates the tracking table.

```javascript
// Initialize tracking table (idempotent — safe to call multiple times)
sqlite_migration_init();

// Apply migration: executes SQL and records atomically. If SQL fails, no record is created
// SHA-256 dedup — submitting the same SQL twice is rejected as a duplicate
sqlite_migration_apply({
  version: "2024-01-15-add-users",
  description: "Create users table",
  migrationSql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE)",
  rollbackSql: "DROP TABLE users",
  sourceSystem: "agent",
  appliedBy: "claude",
});

// Record externally-applied migration (does NOT execute the SQL)
sqlite_migration_record({
  version: "2024-01-10-initial",
  description: "Initial schema (pre-existing)",
  migrationSql: "CREATE TABLE orders (...)",
  sourceSystem: "manual",
});

// Rollback by ID or version — requires rollbackSql to have been recorded
sqlite_migration_rollback({ version: "2024-01-15-add-users" });
sqlite_migration_rollback({ id: 3, dryRun: true }); // preview SQL without executing

// Query history with filters and pagination
sqlite_migration_history({ status: "applied", limit: 10 });
sqlite_migration_history({ sourceSystem: "agent", compact: true }); // compact omits hash and source system

// Summary: latest version, counts by status, unique source systems
sqlite_migration_status();
```

## ⚠️ Gotchas

- Rollback requires `rollbackSql` to have been provided when the migration was recorded/applied
- Migration group is **opt-in** — not included in any shortcut except `dev-schema` and `full`
