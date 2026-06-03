# db-mcp Help — Gotchas & Code Mode

## Server-Level Rules

1. **CSV virtual tables & Backups**: Require ABSOLUTE file paths. Operations will be strictly blocked if paths do not fall within the explicitly authorized `ALLOWED_IO_ROOTS` directory list. Unconfigured stdio transports default to no filesystem access.
2. **Resource Subscriptions**: The `sqlite://schema` and `sqlite://health` resources support MCP subscriptions, allowing the client to receive real-time push notifications when DDL changes occur or health metrics update without needing to poll.
3. **HTTP Session Timeouts**: Stateful HTTP sessions automatically expire after 30 minutes of inactivity, or 24 hours total. Sessions are swept automatically; ensure client workflows re-authenticate or handle broken sessions gracefully.
4. **Structured Errors**: Execution timeouts surface as recoverable `TimeoutError` (category: `timeout`). Rate limit violations surface as `RateLimitError` (category: `rate_limit`). Use this metadata to programmatically retry or backoff.

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

Code Mode maps standard tools to an object-oriented sandbox API (`sqlite_group_action` → `sqlite.group.action()`).

- **Flexible Parameters**: Parameters are forgiven for casing discrepancies (e.g. `conflict_columns` vs `conflictColumns`).
- **Flexible Methods**: Methods mapped into the Code Mode proxy forgive casing discrepancies (e.g. `sqlite.core.read_query` executes `sqlite.core.readQuery()`).
- Methods support both an options object and **positional arguments** (e.g. `sqlite.core.readQuery("SELECT...")`, `sqlite.json.insert("docs", "data", {...})`).
- **Discovery**: Call `sqlite.help()` or `sqlite.core.help()` to see available methods directly within the sandbox.
