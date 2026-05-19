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
- **Code Over Docs (When Standards Violated)**: If the code deviates from established standards (e.g., throwing raw MCP errors instead of Structured Errors, or failing Zod validation), **fix the handler code**. Do not modify documentation, prompts, or `gotchas.md` to accommodate buggy code.
- **Documentation Parity & Test Prompt Integrity**: Only update files in `src/constants/server-instructions` (or test prompts) if the code's behavior is mathematically/logically correct and intended, but the documentation is inaccurate, outdated, or lacking specificity. You SHOULD directly edit the markdown test files in this directory to fix factual errors, broken code blocks, or incorrect test assertions.

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

### 6. Testing Limits

- **No Automated Execution**: Do not run build or tests automatically (`npm run lint`, `npm run typecheck`, `npm run test:e2e`, `vitest`, or `playwright`). The user will execute them manually. When you reach the validate step, explicitly instruct the user to run the validations.

### 7. WASM Mode Execution

When testing against a **WASM backend** (`--sqlite` flag, sql.js adapter), follow these additional rules:

#### Skip Rules

- **`[NATIVE ONLY]` items**: Skip all phases and individual test items annotated with `[NATIVE ONLY]`. This annotation already exists in each prompt.
- **Transactions prompt**: Skip entirely — the transactions group has 0 WASM tools. `sqlite.transactions.help()` returns an empty methods list.
- **Window function items** (stats prompt Phases 3, 6): Skip — 6 window tools are Native-only.
- **SpatiaLite items** (geo prompt Phase 2): Skip — 7 SpatiaLite tools are Native-only.
- **FTS5 items** (text prompt Phase 2): Skip — 5 FTS5 tools are Native-only.

#### Graceful Degradation (Don't Skip — Validate Errors)

Several admin tools are **registered in WASM mode but return structured errors** instead of succeeding. Test these as **negative validation** — verify the structured error response, don't skip them:

| Tool | Expected WASM Behavior |
|------|----------------------|
| `sqlite.admin.backup(...)` | `{success: false, error: "...WASM mode"}` |
| `sqlite.admin.restore(...)` | `{success: false, error: "...WASM mode"}` |
| `sqlite.admin.verifyBackup(...)` | `{success: false, error: "...WASM mode"}` |
| `sqlite.admin.createCsvTable(...)` | `{success: false}` — CSV extension unavailable |
| `sqlite.admin.analyzeCsvSchema(...)` | `{success: false}` — CSV extension unavailable |
| `sqlite.admin.createRtreeTable(...)` | `{success: false}` — R-Tree module unavailable |

#### Adjusted Expectations

| Item | Native Behavior | WASM Behavior |
|------|----------------|---------------|
| `sqlite.admin.dbstat({summarize: true})` | Per-table storage breakdown | Counts-only (JS fallback) |
| `sqlite.admin.pragmaCompileOptions()` | Includes `ENABLE_FTS5` | Shows `ENABLE_FTS3` instead |
| `sqlite.admin.pragmaCompileOptions({filter: "FTS"})` | Matches FTS5 | Matches FTS3 |
| `sqlite.core.listTables()` / `sqlite.admin.listVirtualTables()` | `test_articles_fts` present and queryable | `test_articles_fts` may appear in sqlite_master but FTS5 queries fail |
| `sqlite.help()` | `totalMethods` reflects 151 tools | `totalMethods` reflects 125 tools |
| Phase 2.1 (core prompt) top-level help | 10 groups listed | `transactions` group shows 0 methods |

#### WASM-Specific Degradation Prompt

After completing the applicable prompts above, run `test-tool-group-codemode-wasm-degradation.md` — a dedicated prompt that validates graceful degradation patterns unique to WASM mode. This prompt should **only** be run against a WASM backend.

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
| `test-tool-group-codemode-wasm-degradation.md` | cross-group | WASM-only graceful degradation |

**Total**: 151 Native / 125 WASM tools across 10 groups + 1 WASM degradation prompt.

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
