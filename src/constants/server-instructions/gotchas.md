# db-mcp Help — Gotchas & Code Mode

## ⚠️ Critical Gotchas

1. **sqlite_write_query**: DML only (INSERT/UPDATE/DELETE/REPLACE) — use `sqlite_read_query` for SELECT, and dedicated DDL tools like `sqlite_create_table`, `sqlite_create_trigger`, and `sqlite_drop_trigger` for schema modifications.
2. **Regex patterns**: Double-escape backslashes (`\\\\`) when passing through JSON/MCP
3. **FTS5 virtual tables**: `*_fts` and shadow tables `*_fts_*` are hidden from `sqlite_list_tables` for cleaner output
4. **FTS5 boolean logic**: Uses AND by default — `"machine learning"` = rows with BOTH words. Use OR explicitly: `"machine OR learning"`
5. **json_each row multiplication**: Expands arrays to rows — use `limit` param for large arrays
6. **json_group_object without groupByColumn**: Each row creates a key-value pair; duplicate keys result if key values aren't unique
7. **allowExpressions**: For column extraction ONLY (e.g., `json_extract`), NOT aggregate functions — use `aggregateFunction` param instead
8. **sqlite_json_normalize_column**: Defaults to `preserve` (maintains original format); use `outputFormat: 'text'` to force text
9. **Fuzzy matching tokenization**: Matches WORD TOKENS by default — `"laptop"` matches `"Laptop Pro 15"` (distance 0 on first token). Use `tokenize: false` for full-string matching
10. **SpatiaLite distances**: `nearest_neighbor`/`distance_matrix` return CARTESIAN distance (degrees), not geodetic (km/miles)
11. **SpatiaLite buffer**: Auto-simplifies output by default (tolerance=0.0001). Use `simplifyTolerance: 0` to disable
12. **sqlite_stats_top_n**: Returns all columns by default which creates large payloads for wide tables — always pass `selectColumns` to control output size
13. **CSV virtual tables & Backups**: Require ABSOLUTE file paths. Operations will be strictly blocked if paths do not fall within the explicitly authorized `ALLOWED_IO_ROOTS` directory list. Unconfigured stdio transports default to no filesystem access.
14. **sqlite_create_series_table**: Creates a REGULAR table (not virtual) — use `sqlite_drop_table` to remove
15. **sqlite_dbstat**: `summarize` only works in native; WASM returns counts only
16. **PRAGMA compile options**: WASM may show FTS3, not FTS5
17. **Vector tool schemas**: Vector tools use distinct schemas for specific operations. E.g., `sqlite.vector.dimensions` requires `vectorColumn`. Additionally, `sqlite.vector.get` wraps metadata inside a `metadata` object (e.g., `metadata.content`), and `sqlite.vector.stats` returns `sampleSize` and `magnitudeStats` (not `count` and `stats`).
18. **FTS5 trigger cleanup**: Dropping an FTS5 table with `sqlite_drop_table` automatically finds and removes the associated `_ai`, `_ad`, and `_au` sync triggers from the source table.
19. **sqlite_batch_insert**: All rows must have the same keys — inconsistent column sets across rows will cause errors or unexpected NULLs
20. **sqlite_schema_diff**: `baseline` and `target` accept either the string `"current"` (queries live DB) or an inline snapshot object from a prior `sqlite_schema_snapshot` call. At least one side must be `"current"` unless doing an offline comparison
21. **sqlite_upsert**: Always specify `conflictColumns` — without it, falls back to `REPLACE` which deletes and re-inserts the row, potentially losing columns not included in `data`
22. **Resource Subscriptions**: The `sqlite://schema` and `sqlite://health` resources support MCP subscriptions, allowing the client to receive real-time push notifications when DDL changes occur or health metrics update without needing to poll.
23. **HTTP Session Timeouts**: Stateful HTTP sessions automatically expire after 30 minutes of inactivity, or 24 hours total. Sessions are swept automatically; ensure client workflows re-authenticate or handle broken sessions gracefully.
24. **Structured Errors**: Execution timeouts surface as recoverable `TimeoutError` (category: `timeout`). Rate limit violations surface as `RateLimitError` (category: `rate_limit`). Use this metadata to programmatically retry or backoff.
## WASM vs Native

| Feature                                           | Native                | WASM        | Fallback         |
| ------------------------------------------------- | --------------------- | ----------- | ---------------- |
| FTS5 full-text search                             | ✅                    | ❌          | None             |
| Transactions (8 tools)                            | ✅                    | ❌          | None             |
| Window functions (6 tools in stats group)         | ✅                    | ❌          | None             |
| SpatiaLite GIS (7 tools; 4 basic geo always work) | ✅                    | ❌          | None             |
| Backup/Restore/Dump/VacuumInto/Verify (5 tools)   | ✅                    | ❌          | Graceful error   |
| R-Tree spatial indexing                           | ✅                    | ❌          | Graceful error   |
| CSV virtual tables                                | ✅                    | ❌          | Graceful error   |
| SQLCipher Encryption at Rest                      | ✅                    | ❌          | Graceful error   |
| generate_series                                   | JS fallback           | JS fallback | —                |
| dbstat                                            | ✅ native (per-table) | ❌          | JS (counts only) |
| soundex()                                         | ✅ native             | ❌          | JS               |

## Code Mode (Built-in)

| Tool                  | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `sqlite_execute_code` | Execute JavaScript in a sandboxed environment with `sqlite.*` API |

**Usage**: `sqlite_execute_code({ code: "const tables = await sqlite.core.listTables(); return tables;" })`
**Discover**: `sqlite.help()` for all groups, `sqlite.<group>.help()` for methods.
**Progress**: Use `await sqlite.reportProgress(current, total, "Message")` for custom long-running tasks.
**Groups**: `sqlite.core`, `sqlite.json`, `sqlite.text`, `sqlite.stats`, `sqlite.vector`, `sqlite.admin`, `sqlite.transactions` (Native-only), `sqlite.geo`, `sqlite.introspection`, `sqlite.migration`

> **Note**: Code Mode dynamically filters capabilities. In WASM environments, `sqlite.help()` will omit unsupported groups (e.g., `transactions`) and tools (e.g., FTS5) to accurately reflect the active runtime.

## Code Mode API Mapping

`sqlite_group_action` → `sqlite.group.action()` (group prefixes dropped: `sqlite_json_insert` → `sqlite.json.insert()`)
**Exception**: `stats` and `migration` keep their prefix: `sqlite_stats_basic` → `sqlite.stats.statsBasic()`, `sqlite_migration_apply` → `sqlite.migration.migrationApply()`

**Positional args work**: `sqlite.core.readQuery("SELECT...")`, `sqlite.json.insert("docs", "data", {...})`

**Discovery**: `sqlite.help()` returns all groups and methods. `sqlite.core.help()`, `sqlite.json.help()` for group-specific methods.
