# db-mcp Tool Group Testing: [README]

**Directory Purpose**: This folder contains 19 self-contained, modular test prompts covering every tool group in `db-mcp`. Each file is a **complete, standalone prompt** — paste it directly into a conversation to test that tool group without needing any other files.

## File Inventory

| File                                | Group                     | Group Tools         | Notes                                                |
| ----------------------------------- | ------------------------- | ------------------- | ---------------------------------------------------- |
| `test-core-data.md`                 | core-data                 | 13                  | Identical Native/WASM                                |
| `test-core-schema.md`               | core-schema               | 12 + Code Mode      | Identical Native/WASM                                |
| `test-json-read.md`                 | json-read                 | 18 + Code Mode      | Identical Native/WASM                                |
| `test-json-write.md`                | json-write                | 7                   | Identical Native/WASM                                |
| `test-text-basic.md`                | text-basic                | 10 + Code Mode      | Identical Native/WASM                                |
| `test-text-advanced.md`             | text-advanced             | 10N/5W              | FTS5 tools `[NATIVE ONLY]`                           |
| `test-stats-basic.md`               | stats-basic               | 17 + Code Mode      | Identical Native/WASM                                |
| `test-stats-advanced.md`            | stats-advanced            | 6N/0W               | Window functions `[NATIVE ONLY]`                     |
| `test-vector-read.md`               | vector-read               | 7 + Code Mode       | Identical Native/WASM                                |
| `test-vector-write.md`              | vector-write              | 4                   | Identical Native/WASM                                |
| `test-admin-core.md`                | admin-core                | 23N/22W + Code Mode | `dump` is `[NATIVE ONLY]`                            |
| `test-admin-extensions.md`          | admin-extensions          | 8                   | CSV, series, rtree                                   |
| `test-admin-audit.md`               | admin-audit               | 7                   | Audit snapshot management, search, and server config |
| `test-transactions.md`              | transactions              | 8 + Code Mode       | `[NATIVE ONLY]`                                      |
| `test-geo-haversine.md`             | geo-haversine             | 4 + Code Mode       | Identical Native/WASM                                |
| `test-geo-spatialite.md`            | geo-spatialite            | 7N/0W               | SpatiaLite `[NATIVE ONLY]`                           |
| `test-introspection-schema.md`      | introspection-schema      | 7                   | Identical Native/WASM                                |
| `test-introspection-diagnostics.md` | introspection-diagnostics | 3 + Code Mode       | Identical Native/WASM                                |
| `test-migration.md`                 | migration                 | 6 + Code Mode       | Identical Native/WASM                                |

**Inventory total**: 177 Native / 150 WASM tools across 11 groups + Code Mode. See [Tool Count Taxonomy](../tool-reference.md#tool-count-taxonomy) for scope definitions.

## Pre-requisites

1. The testing database MUST be freshly seeded via `node C:\Users\chris\Desktop\db-mcp\test-server\reset-database.mjs` to ensure deterministic results.
2. The MCP server MUST be started with the `ALLOWED_IO_ROOTS` environment variable configured (e.g., set to the db-mcp repository root), otherwise it will hard-fail to start and block file-based tool tests (like CSV generation or database dumps).
3. **Session Timeouts**: If using the HTTP transport, note that sessions will strictly expire after 30 minutes of inactivity and have an absolute TTL of 24 hours. Ensure your manual testing flows account for these timeouts.
4. **Streaming Validation**: When testing `sqlite_read_query`, setting `stream: true` triggers Progress Notification streaming instead of buffering all rows. This requires a client that sends `_meta.progressToken`. If the testing client does not support it, verify that the server gracefully degrades to full buffering without errors.

## Agent Instructions

When tasked with running tests from this folder, adhere to the following protocol:

### 1. Execution Strictness

- **Direct Calls Exclusive**: Test tools ONLY using direct MCP tool calls (e.g., calling `mcp_sqlite_sqlite_read_query`). Do not use Code Mode (`sqlite_execute_code`) or scripts to batch the tests, except for checklist items explicitly testing Code Mode.
- **No Scripted Loops**: Each happy and error path must be tested individually with a distinct tool call. This simulates exact client interaction behavior.

### 2. Validation Targets

- **Happy Path Consistency**: Validate that each tool outputs exactly what is expected from the explicit checklist items given in the prompt.
- **Structured Error Path**: Ensure domain errors (e.g., nonexistent table) return an object `{"success": false, "error": "..."}`. A raw MCP error indicates a missing try/catch in the handler. Rate limits (if triggered) must return a `RateLimitError`.
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

| Tool                        | Expected WASM Behavior                         |
| --------------------------- | ---------------------------------------------- |
| `sqlite_backup`             | `{success: false, error: "...WASM mode"}`      |
| `sqlite_restore`            | `{success: false, error: "...WASM mode"}`      |
| `sqlite_verify_backup`      | `{success: false, error: "...WASM mode"}`      |
| `sqlite_vacuum_into`        | `{success: false, error: "...WASM mode"}`      |
| `sqlite_create_csv_table`   | `{success: false}` — CSV extension unavailable |
| `sqlite_analyze_csv_schema` | `{success: false}` — CSV extension unavailable |
| `sqlite_create_rtree_table` | `{success: false}` — R-Tree module unavailable |

#### Adjusted Expectations

| Item                                                | Native Behavior             | WASM Behavior                    |
| --------------------------------------------------- | --------------------------- | -------------------------------- |
| `sqlite_dbstat({summarize: true})`                  | Per-table storage breakdown | Counts-only (JS fallback)        |
| `sqlite_pragma_compile_options({filter: "FTS"})`    | Matches FTS5                | Matches FTS3                     |
| `test_articles_fts` in `sqlite_list_virtual_tables` | Present and queryable       | May appear but FTS5 queries fail |

### 3. Tracking Metrics & Progress

- **Strict Coverage Matrix**: Maintain a table tracking your progress in `tmp/task.md` logging completion for:
  `| Tool | Direct Call (Happy Path) | Domain Error | Zod Empty Param | Alias Acceptance |`
  Never proceed to the final step until every tool in a given group is fully checked off.

### 4. Cleanup & Scope

- Direct write tests should operate on temporary tables or objects prefixed with `temp_`.
- When completed, explicitly drop all `temp_` artifacts.
- Update `code-map.md`, handlers, and instructions if bugs are uncovered, then update the Changelog with fixes before summarizing your work.

## Execution

Begin with any requested group prompt from this folder (e.g., `test-admin.md`), and execute the deterministic checklist line-by-line using direct tool calls only.

---

## Post-Test Procedures

### Reporting Rules

- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in help resources and runtime hints

### After Testing

1. **Triage findings**: If issues were found, create an implementation plan, making sure they are consistent with working patterns in other tools/tool groups. If the plan requires no user decisions, proceed directly to implementation.
2. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `src/constants/server-instructions/*.md` (per-group help files) — run `npm run generate:instructions` after editing to regenerate `server-instructions.ts`
   - Test database (`test-server/test.db`)
   - This prompt

### After Implementation

3. **Document**: Update `UNRELEASED.md`, `code-map.md` (if appropriate), and create a `memory-journal-mcp` entry detailing the changes and improvements made.
4. **Commit**: Stage and commit all changes — do NOT push.
5. **Validate**: Halt your work and instruct the user to validate the changes by running the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself. Also instruct the user to rebuild and restart the server.
6. **Live re-test**: Once the user confirms the server is restarted, test the fixes with direct MCP tool calls to confirm they are working.
7. **Final summary**: If no issues found, provide the final summary. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working.
