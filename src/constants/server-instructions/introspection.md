# db-mcp Help — Schema Introspection (9 tools)

All introspection tools are **read-only** — they query PRAGMAs and sqlite_master, never modify data.

## Graph Analysis (3 tools)

```javascript
// Build FK dependency graph — nodesOnly: true for lightweight response (nodes without edges)
sqlite_dependency_graph({ includeRowCounts: true, excludeSystemTables: true });
sqlite_dependency_graph({ nodesOnly: true }); // lighter payload

// Safe DDL execution order — "create" = parents first (default), "drop" = children first
sqlite_topological_sort({ direction: "create", excludeSystemTables: true });
sqlite_topological_sort({ direction: "drop" }); // safe DROP order

// Simulate DELETE/DROP/TRUNCATE impact — shows affected tables, cascade paths, severity scoring
sqlite_cascade_simulator({ table: "users", operation: "delete" });
sqlite_cascade_simulator({ table: "users", operation: "drop", compact: true }); // compact omits path arrays
```

## Schema Analysis (3 tools)

```javascript
// Full schema in one call — compact: true omits column details, sections limits scope
sqlite_schema_snapshot({
  sections: ["tables", "indexes"],
  excludeSystemTables: true,
});
sqlite_schema_snapshot({ compact: true }); // lighter payload

// Find constraint health issues — missing PKs, nullable FKs, unindexed FKs
sqlite_constraint_analysis({ excludeSystemTables: true });
sqlite_constraint_analysis({
  table: "orders",
  checks: ["missing_pk", "unindexed_fk"],
}); // limit scope

// Analyze DDL for SQLite-specific risks — does NOT execute the statements
sqlite_migration_risks({
  statements: [
    "ALTER TABLE users ADD COLUMN email TEXT",
    "DROP TABLE old_logs",
  ],
});
```

## Diagnostics (3 tools)

```javascript
// Fragmentation, per-table size breakdown, optimization recommendations
sqlite_storage_analysis({
  includeTableDetails: true,
  excludeSystemTables: true,
});
sqlite_storage_analysis({ limit: 10 }); // top 10 tables only

// Audit index effectiveness — find redundant, missing FK, unindexed large tables
sqlite_index_audit({ excludeSystemTables: true });
sqlite_index_audit({ table: "orders", minSeverity: "warning" }); // reduce payload

// EXPLAIN QUERY PLAN with scan-type classification and optimization suggestions (SELECT/WITH only)
sqlite_query_plan({ sql: "SELECT * FROM orders WHERE status = 'active'" });
```

## ⚠️ Gotchas

- `excludeSystemTables` defaults to `true` — SpatiaLite system tables are hidden for cleaner output. Pass `false` to include them
- `sqlite_migration_risks` analyzes DDL text statically — it does NOT execute the statements
