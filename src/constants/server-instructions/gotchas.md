# db-mcp Help — Gotchas & Code Mode

## ⚠️ Critical Gotchas

1. **sqlite_write_query**: ⛔ Only INSERT/UPDATE/DELETE — use `sqlite_read_query` for SELECT
2. **Regex patterns**: Double-escape backslashes (`\\\\`) when passing through JSON/MCP
3. **FTS5 virtual tables**: `*_fts` and shadow tables `*_fts_*` are hidden from `sqlite_list_tables` for cleaner output
4. **FTS5 boolean logic**: Uses AND by default — `"machine learning"` = rows with BOTH words. Use OR explicitly: `"machine OR learning"`
5. **FTS5 rebuild**: After `sqlite_fts_create`, must call `sqlite_fts_rebuild` to populate index with existing data
6. **json_each row multiplication**: Expands arrays to rows — use `limit` param for large arrays
7. **json_group_object without groupByColumn**: Each row creates a key-value pair; duplicate keys result if key values aren't unique
8. **allowExpressions**: For column extraction ONLY (e.g., `json_extract`), NOT aggregate functions — use `aggregateFunction` param instead
9. **sqlite_json_normalize_column**: Defaults to `preserve` (maintains original format); use `outputFormat: 'text'` to force text
10. **Fuzzy matching tokenization**: Matches WORD TOKENS by default — `"laptop"` matches `"Laptop Pro 15"` (distance 0 on first token). Use `tokenize: false` for full-string matching
11. **SpatiaLite distances**: `nearest_neighbor`/`distance_matrix` return CARTESIAN distance (degrees), not geodetic (km/miles)
12. **SpatiaLite buffer**: Auto-simplifies output by default (tolerance=0.0001). Use `simplifyTolerance: 0` to disable
13. **sqlite_stats_top_n**: Auto-excludes long-content columns (description, body, notes, etc.) when `selectColumns` is omitted. Use `selectColumns` to override
14. **CSV virtual tables**: Require ABSOLUTE file paths
15. **sqlite_create_series_table**: Creates a REGULAR table (not virtual) — use `sqlite_drop_table` to remove
16. **sqlite_dbstat**: `summarize` only works in native; WASM returns counts only
17. **PRAGMA compile options**: WASM may show FTS3, not FTS5

## WASM vs Native

| Feature                                           | Native                | WASM        | Fallback         |
| ------------------------------------------------- | --------------------- | ----------- | ---------------- |
| FTS5 full-text search                             | ✅                    | ❌          | None             |
| Transactions (7 tools)                            | ✅                    | ❌          | None             |
| Window functions (6 tools in stats group)         | ✅                    | ❌          | None             |
| SpatiaLite GIS (7 tools; 4 basic geo always work) | ✅                    | ❌          | None             |
| Backup/Restore (3 tools)                          | ✅                    | ❌          | Graceful error   |
| R-Tree spatial indexing                           | ✅                    | ❌          | Graceful error   |
| CSV virtual tables                                | ✅                    | ❌          | Graceful error   |
| generate_series                                   | JS fallback           | JS fallback | —                |
| dbstat                                            | ✅ native (per-table) | ❌          | JS (counts only) |
| soundex()                                         | ✅ native             | ❌          | JS               |

## Code Mode (1 tool)

| Tool                  | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `sqlite_execute_code` | Execute JavaScript in a sandboxed environment with `sqlite.*` API |

**Usage**: `sqlite_execute_code({ code: "const tables = await sqlite.core.listTables(); return tables;" })`
**Discover**: `sqlite.help()` for all groups, `sqlite.<group>.help()` for methods.
**Groups**: `sqlite.core`, `sqlite.json`, `sqlite.text`, `sqlite.stats`, `sqlite.vector`, `sqlite.admin`, `sqlite.geo`, `sqlite.introspection`, `sqlite.migration`

## Code Mode API Mapping

`sqlite_group_action` → `sqlite.group.action()` (group prefixes dropped: `sqlite_json_insert` → `sqlite.json.insert()`)

**Positional args work**: `sqlite.core.readQuery("SELECT...")`, `sqlite.json.insert("docs", "data", {...})`

**Discovery**: `sqlite.help()` returns all groups and methods. `sqlite.core.help()`, `sqlite.json.help()` for group-specific methods.
