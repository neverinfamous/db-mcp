# db-mcp Standard Testing Suite

**Directory Purpose**: This folder contains 10 self-contained, modular test prompts covering every tool group in `db-mcp`. Each file is a **complete, standalone prompt** — paste it directly into a conversation to test that tool group without needing any other files.

## File Inventory

| File | Group | Tools | Notes |
|------|-------|-------|-------|
| `test-tool-group-core.md` | core | 14 + Code Mode | Identical Native/WASM |
| `test-tool-group-json.md` | json | 24 + Code Mode | Identical Native/WASM |
| `test-tool-group-text.md` | text | 19N/14W + Code Mode | FTS5 tools `[NATIVE ONLY]` |
| `test-tool-group-stats.md` | stats | 22N/16W + Code Mode | Window functions `[NATIVE ONLY]` |
| `test-tool-group-vector.md` | vector | 11 + Code Mode | Identical Native/WASM |
| `test-tool-group-admin.md` | admin | 26 + Code Mode | CSV, backup, views, pragma |
| `test-tool-group-transactions.md` | transactions | 8 + Code Mode | `[NATIVE ONLY]` |
| `test-tool-group-geo.md` | geo | 11N/4W + Code Mode | SpatiaLite `[NATIVE ONLY]` |
| `test-tool-group-introspection.md` | introspection | 9 + Code Mode | Identical Native/WASM |
| `test-tool-group-migration.md` | migration | 6 + Code Mode | Identical Native/WASM |

**Total**: 151 Native / 125 WASM tools across 10 groups + Code Mode.

## Agent Instructions

When tasked with running tests from this folder, adhere to the following protocol:

### 1. Execution Strictness

- **Direct Calls Exclusive**: Test tools ONLY using direct MCP tool calls (e.g., calling `mcp_sqlite_sqlite_read_query`). Do not use Code Mode (`sqlite_execute_code`) or scripts to batch the tests, except for checklist items explicitly testing Code Mode.
- **No Scripted Loops**: Each happy and error path must be tested individually with a distinct tool call. This simulates exact client interaction behavior.

### 2. Validation Targets

- **Happy Path Consistency**: Validate that each tool outputs exactly what is expected from the explicit checklist items given in the prompt.
- **Structured Error Path**: Ensure domain errors (e.g., nonexistent table) return an object `{"success": false, "error": "..."}`. A raw MCP error indicates a missing try/catch in the handler.
- **Zod Exceptions**: Pass `{}` with missing required parameters or invalid types. The response must be a handler error, not a raw MCP `-32602` error.
- **Payload Limits**: Watch for payload bloat and explicitly log it as a 📦 warning if it risks overflowing context window token limits.
- **Code Over Docs (When Standards Violated)**: If the code deviates from established standards (e.g., throwing raw MCP errors instead of Structured Errors, or failing Zod validation), **fix the handler code**. Do not modify documentation, prompts, or `gotchas.md` to accommodate buggy code.
- **Documentation Parity & Test Prompt Integrity**: Only update files in `src/constants/server-instructions` (or test prompts) if the code's behavior is mathematically/logically correct and intended, but the documentation is inaccurate, outdated, or lacking specificity. You SHOULD directly edit the markdown test files in this directory to fix factual errors, broken code blocks, or incorrect test assertions.

### 2.5 Testing Limits

- **No Automated Execution**: Do not run build or tests automatically (`npm run lint`, `npm run typecheck`, `npm run test:e2e`, `vitest`, or `playwright`). The user will execute them manually. When you reach the validate step, explicitly instruct the user to run the validations.

### 2.6 WASM Mode Execution

When testing against a **WASM backend** (`sqlite-wasm` server entry, sql.js adapter), follow these additional rules:

#### Skip Rules

- **`[NATIVE ONLY]` items**: Skip all checklist items and Zod sweep items for tools annotated with `[NATIVE ONLY]`.
- **Transactions prompt**: Skip entirely — all 8 transaction tools are `[NATIVE ONLY]`.
- **Window function tools** (stats items 20-25): Skip — 6 window tools are Native-only.
- **SpatiaLite tools** (geo items 8-14): Skip — 7 SpatiaLite tools are Native-only.
- **FTS5 tools** (text items 18-22): Skip — 5 FTS5 tools are Native-only.
- **Unregistered tools**: In WASM mode, `[NATIVE ONLY]` tools are not registered at all. Direct MCP calls to them will fail with an "unknown tool" error — this is expected, not a bug.

#### Graceful Degradation (Don't Skip — Validate Errors)

Several admin tools are **registered in WASM mode but return structured errors**. Test these as **negative validation**:

| Tool | Expected WASM Behavior |
|------|----------------------|
| `sqlite_backup` | `{success: false, error: "...WASM mode"}` |
| `sqlite_restore` | `{success: false, error: "...WASM mode"}` |
| `sqlite_verify_backup` | `{success: false, error: "...WASM mode"}` |
| `sqlite_create_csv_table` | `{success: false}` — CSV extension unavailable |
| `sqlite_analyze_csv_schema` | `{success: false}` — CSV extension unavailable |
| `sqlite_create_rtree_table` | `{success: false}` — R-Tree module unavailable |

#### Adjusted Expectations

| Item | Native Behavior | WASM Behavior |
|------|----------------|---------------|
| `sqlite_dbstat({summarize: true})` | Per-table storage breakdown | Counts-only (JS fallback) |
| `sqlite_pragma_compile_options({filter: "FTS"})` | Matches FTS5 | Matches FTS3 |
| `test_articles_fts` in `sqlite_list_virtual_tables` | Present and queryable | May appear but FTS5 queries fail |

### 3. Tracking Metrics & Progress

- **Strict Coverage Matrix**: Maintain a table tracking your progress in `tmp/task.md` logging completion for:
  `| Tool | Direct Call (Happy Path) | Domain Error | Zod Empty Param | Alias Acceptance |`
  Never proceed to the final step until every tool in a given group is fully checked off.

### 4. Cleanup & Scope

- Direct write tests should operate on temporary tables or objects prefixed with `temp_`.
- When completed, explicitly drop all `temp_` artifacts.
- Update `code-map.md`, handlers, and instructions if bugs are uncovered, then update the Changelog with fixes before summarizing your work.

## Execution

Begin with any requested group prompt from this folder (e.g., `test-tool-group-admin.md`), and execute the deterministic checklist line-by-line using direct tool calls only.
