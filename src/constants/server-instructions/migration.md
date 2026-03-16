# db-mcp Help — Migration Tracking (6 tools)

- `sqlite_migration_init()` — create `_mcp_migrations` tracking table. Idempotent — safe to call multiple times
- `sqlite_migration_apply({ version, migrationSql, description?, rollbackSql?, sourceSystem?, appliedBy? })` — execute SQL and record atomically. If SQL fails, no record is created. SHA-256 dedup rejects duplicate SQL blocks
- `sqlite_migration_record({ version, migrationSql, description?, rollbackSql?, sourceSystem?, appliedBy? })` — record a migration applied externally (does NOT execute the SQL). Same SHA-256 dedup
- `sqlite_migration_rollback({ id?, version?, dryRun? })` — roll back by ID or version. Requires `rollbackSql` to have been recorded. `dryRun: true` previews the SQL without executing
- `sqlite_migration_history({ status?, sourceSystem?, limit?, offset?, compact? })` — query migration records. `status: "applied"` or `"rolled_back"` or `"failed"`. `compact: true` omits hash and source system
- `sqlite_migration_status()` — summary: latest version, counts by status, unique source systems

## ⚠️ Gotchas

- Must call `sqlite_migration_init()` before using any other migration tool — it creates the tracking table
- `sqlite_migration_apply` and `sqlite_migration_record` use SHA-256 hashing — submitting the same SQL twice is rejected as a duplicate
- Rollback requires `rollbackSql` to have been provided when the migration was recorded/applied
- Migration group is **opt-in** — not included in any shortcut except `dev-schema` and `full`
