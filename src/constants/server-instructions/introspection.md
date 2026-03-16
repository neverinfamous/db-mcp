# db-mcp Help — Schema Introspection (9 tools)

## Graph Analysis (3 tools)

- `sqlite_dependency_graph({ includeRowCounts?, nodesOnly?, excludeSystemTables? })` — build FK dependency graph. `nodesOnly: true` for lightweight response (nodes without edges)
- `sqlite_topological_sort({ direction?, excludeSystemTables? })` — safe DDL execution order. `direction: "create"` = parents first (default), `"drop"` = children first
- `sqlite_cascade_simulator({ table, operation?, compact? })` — simulate DELETE/DROP/TRUNCATE impact. Shows affected tables, cascade paths, severity scoring. `compact: true` omits path arrays

## Schema Analysis (3 tools)

- `sqlite_schema_snapshot({ sections?, compact?, excludeSystemTables? })` — full schema in one call (tables, views, indexes, triggers). `compact: true` omits column details. `sections: ["tables", "indexes"]` to limit scope
- `sqlite_constraint_analysis({ table?, checks?, excludeSystemTables? })` — find missing PKs, nullable reference columns, unindexed FKs, missing FK declarations. `checks: ["missing_pk", "unindexed_fk"]` to limit scope
- `sqlite_migration_risks({ statements: ["ALTER TABLE...", "DROP TABLE..."] })` — analyze DDL for SQLite-specific risks (ALTER limitations, destructive ops, FTS5 rebuild needs)

## Diagnostics (3 tools)

- `sqlite_storage_analysis({ includeTableDetails?, excludeSystemTables?, limit? })` — fragmentation, per-table size breakdown, optimization recommendations
- `sqlite_index_audit({ table?, excludeSystemTables?, minSeverity? })` — find redundant indexes (prefix duplicates), missing FK indexes, unindexed large tables. `minSeverity: "warning"` to reduce payload
- `sqlite_query_plan({ sql: "SELECT ..." })` — EXPLAIN QUERY PLAN with scan-type classification (full_scan, index_scan, covering_index) and optimization suggestions. SELECT/WITH only

## ⚠️ Gotchas

- All introspection tools are **read-only** — they query PRAGMAs and sqlite_master, never modify data
- `excludeSystemTables` defaults to `true` — SpatiaLite system tables are hidden for cleaner output. Pass `false` to include them
- `sqlite_migration_risks` analyzes DDL text statically — it does NOT execute the statements
