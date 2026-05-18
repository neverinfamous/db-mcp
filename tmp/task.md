# DB-MCP (SQLite) Tool Group Testing: [core]

## Coverage Matrix

| Tool | Happy Path | Domain Error | Zod Error | Output Schema |
|---|---|---|---|---|
| `server_info` | ✅ | N/A | N/A | ✅ |
| `server_health` | ✅ | N/A | N/A | ✅ |
| `list_adapters` | ✅ | N/A | N/A | ✅ |
| `sqlite_read_query` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_write_query` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_upsert` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_batch_insert` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_count` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_exists` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_truncate` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_list_tables` | ✅ | N/A | N/A | ✅ |
| `sqlite_describe_table` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_create_table` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_drop_table` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_get_indexes` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_create_index` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_drop_index` | ✅ | ✅ | ✅ | ✅ |
| `sqlite_execute_code` | ✅ | ✅ | ✅ | ⚠️ Inline schema |

## Findings

1. ⚠️ **Inline Output Schema (`sqlite_execute_code`)**: The `ExecuteCodeOutputSchema` is defined inline inside `src/adapters/sqlite/tools/codemode.ts`. According to project standards, all output schemas must live in `src/adapters/sqlite/output-schemas/` with named exports.

*Note: All core tools perfectly passed the Zod validation sweep (returning structured `{success: false, error: ...}` rather than raw MCP `-32602` exceptions). All error shapes utilize the DbMcpError format correctly.*

## Implementation Plan

1. **Extract `ExecuteCodeOutputSchema`**: 
   - Create `src/adapters/sqlite/output-schemas/codemode.ts`.
   - Move the `ExecuteCodeOutputSchema` definition (and any necessary imports) from `tools/codemode.ts` to this new file.
   - Update `src/adapters/sqlite/output-schemas/index.ts` to export from `./codemode.js`.
2. **Update `codemode.ts`**:
   - Import `ExecuteCodeOutputSchema` from `../../../output-schemas/index.js` (or relative path appropriately).
   - Verify typing matches and TypeScript compilation will succeed.

Once these steps are implemented, I will ask the user to run the test suite, lint, and typecheck before proceeding.
