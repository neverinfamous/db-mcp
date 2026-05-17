# db-mcp Code Mode Testing Suite

**Directory Purpose**: This folder contains 10 self-contained, modular test prompts covering every tool group in `db-mcp`. These prompts are strictly designed for **Code Mode (`sqlite_execute_code`) validation only**.

## Agent Instructions

When tasked with running tests from this folder, adhere to the following optimized protocol:

### 1. Execution Strictness

- **Code Mode Exclusive**: Test tools ONLY using `sqlite_execute_code`. Do not use direct tool calls or the terminal unless specifically comparing behavior.
- **Batching**: Group multiple method calls into a single JavaScript code execution script to save context window tokens and improve speed.
- **Failures Array Format**: Design your JS script to capture both expected outputs and caught errors, appending assertions to a `failures` array, and returning `{ failures, success: failures.length === 0 }`.

### 2. Validation Targets

- **Happy Path Parity**: Validate that Code Mode handler execution matches expected database behavior.
- **Structured Error Path**: Ensure domain errors (e.g., nonexistent table) return an object `{"success": false, "error": "..."}` instead of crashing or leaking raw MCP errors.
- **Zod Resilience**: Pass `{}` with missing required parameters or invalid types. Verify that Zod errors are properly caught and formatted.
- **Payload Limits**: If a response payload is excessively large, report it as a 📦 Payload issue.

### 3. Tracking Progress

You must maintain a **Strict Coverage Matrix** in `tmp/task.md` logging completion for:
`| Tool | Code Mode (Happy Path) | Code Mode (Domain Error/Zod Error) |`
Never proceed to the final step until every tool in a given group has both columns marked as ✅.

### 4. Token Tracking

Monitor `metrics.tokenEstimate` on every Code Mode response. Report the single most expensive execution block in your final summary.

### 5. Cleanup

- Any write tests should operate on temporary tables or objects prefixed with `temp_`.
- **Active Connection Lock**: The MCP server holds a lock on the SQLite database, preventing the reset script from replacing the file outright. The reset script only seeds default tables, it does not drop unknown `temp_` tables.
- **Mandatory Code Mode Cleanup**: Your final step MUST be a Code Mode script that explicitly drops ALL `temp_*` tables (e.g., `sqlite.core.dropTable({tableName: '...', force: true})`) BEFORE you run the reset script.

## File Inventory

| File | Group | Tools |
|------|-------|-------|
| `test-tool-group-codemode-core.md` | core | 14 + sandbox/security/discoverability |
| `test-tool-group-codemode-json.md` | json | 24 |
| `test-tool-group-codemode-text.md` | text | 19N/14W |
| `test-tool-group-codemode-stats.md` | stats | 22N/16W |
| `test-tool-group-codemode-vector.md` | vector | 11 |
| `test-tool-group-codemode-admin.md` | admin | 26 |
| `test-tool-group-codemode-transactions.md` | transactions | 8 `[NATIVE ONLY]` |
| `test-tool-group-codemode-geo.md` | geo | 11N/4W |
| `test-tool-group-codemode-introspection.md` | introspection | 9 |
| `test-tool-group-codemode-migration.md` | migration | 6 |

**Total**: 151 Native / 125 WASM tools across 10 groups.

## Tool Groups Available

1. `core`
2. `json`
3. `text`
4. `stats`
5. `vector`
6. `admin`
7. `transactions`
8. `geo`
9. `introspection`
10. `migration`
