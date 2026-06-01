# db-mcp Help — Schema Introspection (10 tools)

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
sqlite_cascade_simulator({ table: "users", operation: "DELETE" });
sqlite_cascade_simulator({ table: "users", operation: "DROP", compact: true }); // compact omits path arrays
```

## Schema Analysis (4 tools)

```javascript
// Full schema in one call — compact: true omits column details, sections limits scope
sqlite_schema_snapshot({
  sections: ["tables", "indexes"],
  excludeSystemTables: true,
});
sqlite_schema_snapshot({ compact: true }); // lighter payload

// Compare a saved snapshot against the current live schema — structured drift analysis
sqlite_schema_diff({
  baseline: previousSnapshot, // from an earlier sqlite_schema_snapshot call
  target: "current",
});
// Compare specific sections only
sqlite_schema_diff({
  baseline: "current",
  target: modifiedSnapshot,
  sections: ["tables", "indexes"],
});
// Both sides inline (offline diff, no DB queries)
sqlite_schema_diff({ baseline: snapshotA, target: snapshotB });

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
// Run EXPLAIN QUERY PLAN on target queries to recommend composite/partial indexes
sqlite_index_audit({ recommendComposite: true, queriesToAnalyze: ["SELECT * FROM orders WHERE user_id = 1 AND status = 'active'"] });

// EXPLAIN QUERY PLAN with scan-type classification and optimization suggestions (SELECT/WITH only)
sqlite_query_plan({ sql: "SELECT * FROM orders WHERE status = 'active'" });
```

## ⚠️ Gotchas

- `excludeSystemTables` defaults to `true` — SpatiaLite system tables are hidden for cleaner output. Pass `false` to include them
- `sqlite_migration_risks` analyzes DDL text statically — it does NOT execute the statements
