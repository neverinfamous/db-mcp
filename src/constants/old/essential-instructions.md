# db-mcp (SQLite MCP Server)

## Quick Access

| Purpose         | Action                     |
| --------------- | -------------------------- |
| Health check    | `server_health` tool       |
| Server info     | `server_info` tool         |
| List adapters   | `list_adapters` tool       |
| Database schema | `sqlite://schema` resource |
| List tables     | `sqlite://tables` resource |

## Built-in Tools (always available)

| Tool            | Description                                            |
| --------------- | ------------------------------------------------------ |
| `server_info`   | Get server name, version, adapters, tool filter config |
| `server_health` | Check adapter connections, latency, SQLite version     |
| `list_adapters` | List registered database adapters                      |

## Core Tools (9)

| Tool                    | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| `sqlite_read_query`     | Execute SELECT queries                                                       |
| `sqlite_write_query`    | Execute INSERT/UPDATE/DELETE                                                 |
| `sqlite_list_tables`    | List tables with column counts (excludeSystemTables hides SpatiaLite tables) |
| `sqlite_describe_table` | Get table schema                                                             |
| `sqlite_create_table`   | Create new table                                                             |
| `sqlite_drop_table`     | Drop (delete) a table                                                        |
| `sqlite_get_indexes`    | List indexes (use excludeSystemIndexes to hide SpatiaLite indexes)           |
| `sqlite_create_index`   | Create index                                                                 |
| `sqlite_drop_index`     | Drop (delete) an index                                                       |

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
**Groups**: `sqlite.core`, `sqlite.json`, `sqlite.text`, `sqlite.stats`, `sqlite.vector`, `sqlite.admin`, `sqlite.geo`
