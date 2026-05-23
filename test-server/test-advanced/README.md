# db-mcp Advanced Stress Testing: [README]

> **This document is optimized for AI agent consumption.** It provides context and execution rules for the advanced stress testing suite located in this directory.

This directory contains the "Second-Pass" advanced tests for the `db-mcp` tool groups. These tests simulate complex, edge-case, and boundary interactions using exclusively **Code Mode** (`sqlite_execute_code`).

## Pre-requisites

1. Basic deterministic tool group checklists (located in `../test-tool-groups/*.md`) MUST be successfully passed before running these advanced tests.
2. Code Mode basic tests (located in `../test-codemode/*.md`) MUST be successfully passed.
3. The testing database MUST be freshly seeded via `Set-Location C:\Users\chris\Desktop\db-mcp\test-server; .\reset-database.ps1` to ensure deterministic results.

## File Inventory

| File                                      | Primary Focus | Key Validations                                                                           |
| ----------------------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `test-codemode-advanced-core.md`          | Core          | Boundary values, empty states, state pollution, idempotency, error quality, payload sizes |
| `test-codemode-advanced-json.md`          | JSON          | Deep nesting, merge conflicts (RFC 7396), type coercion, write safety                     |
| `test-codemode-advanced-text.md`          | Text          | Regex edge cases, fuzzy/phonetic stress, FTS5 state integrity `[NATIVE ONLY]`             |
| `test-codemode-advanced-stats.md`         | Stats         | Empty/single-row/NULL-heavy stats, extreme values, window functions `[NATIVE ONLY]`       |
| `test-codemode-advanced-vector.md`        | Vector        | Empty tables, distance metrics, dimension mismatch, batch operations                      |
| `test-codemode-advanced-admin.md`         | Admin         | View lifecycle, virtual tables, backup/restore, pragma edge cases, database attachment, VACUUM INTO, path traversal security |
| `test-codemode-advanced-transactions.md`  | Transactions  | Abort recovery, savepoint stress, execute rollback `[NATIVE ONLY]`                        |
| `test-codemode-advanced-geo.md`           | Geo           | Haversine boundary conditions, nearby edge cases, SpatiaLite `[NATIVE ONLY]`              |
| `test-codemode-advanced-introspection.md` | Introspection | Graph analysis, schema snapshot, schema diff, storage/index audit, query plan depth    |
| `test-codemode-advanced-migration.md`     | Migration     | Lifecycle, state pollution, SHA-256 dedup, error paths                                    |

## Agent Execution Protocol

4. **Strict Code Mode Only:** All advanced stress tests must be executed entirely via `sqlite_execute_code`. Direct tool calls are forbidden unless specifically instructed for baseline comparison.
5. **Sequential Grouping:** Execute only **one markdown file at a time**. Report findings, fix errors, apply updates to the changelog, and commit before advancing to the next file.
6. **Payload Optimization (Token Monitoring):** Monitor `metrics.tokenEstimate` on every response. If extremely large unbounded responses are produced, flag as 📦 **Payload Issue**.
7. **Structured Error Adherence:** When testing boundary failure parameters, assert that the handler outputs a proper structured error (`{success: false, error: "..."}`) rather than leaking raw SQLite errors.
8. **No Persistent Pollution:** After finishing a file, verify all `stress_*` tables/views/indexes are dropped. No test state should bleed into the next run.
9. **Code Over Docs (When Standards Violated)**: If the code deviates from established standards (e.g., throwing raw MCP errors instead of Structured Errors, or failing Zod validation), **fix the handler code**. Do not modify documentation, prompts, or `gotchas.md` to accommodate buggy code.
10. **Documentation Parity & Test Prompt Integrity**: Only update files in `src/constants/server-instructions` (or test prompts) if the code's behavior is mathematically/logically correct and intended, but the documentation is inaccurate, outdated, or lacking specificity. You SHOULD directly edit the markdown test files in this directory to fix factual errors, broken code blocks, or incorrect test assertions.
11. **Testing Limits**: Do not run build or tests automatically (`npm run lint`, `npm run typecheck`, `npm run test:e2e`, `vitest`, or `playwright`). The user will execute them manually. When you reach the validate step, explicitly instruct the user to run the validations.

### 9. WASM Mode Execution

When testing against a **WASM backend** (`--sqlite` flag, sql.js adapter), follow these additional rules:

#### Skip Rules

- **`[NATIVE ONLY]` items**: Skip all categories and individual test items annotated with `[NATIVE ONLY]`.
- **Transactions prompt**: Skip entirely — all 8 transaction tools are `[NATIVE ONLY]`.
- **Window function items** (stats Category 4): Skip — 6 window tools are Native-only.
- **SpatiaLite items** (geo Category 5): Skip — 7 SpatiaLite tools are Native-only.
- **FTS5 items** (text Category 6): Skip — 5 FTS5 tools are Native-only.

#### Graceful Degradation (Don't Skip — Validate Errors)

Several admin tools are **registered in WASM mode but return structured errors**. Test these as **negative validation**:

| Tool                                 | Expected WASM Behavior                         |
| ------------------------------------ | ---------------------------------------------- |
| `sqlite.admin.backup(...)`           | `{success: false, error: "...WASM mode"}`      |
| `sqlite.admin.restore(...)`          | `{success: false, error: "...WASM mode"}`      |
| `sqlite.admin.verifyBackup(...)`     | `{success: false, error: "...WASM mode"}`      |
| `sqlite.admin.vacuumInto(...)`       | `{success: false, error: "...WASM mode"}`      |
| `sqlite.admin.createCsvTable(...)`   | `{success: false}` — CSV extension unavailable |
| `sqlite.admin.analyzeCsvSchema(...)` | `{success: false}` — CSV extension unavailable |
| `sqlite.admin.createRtreeTable(...)` | `{success: false}` — R-Tree module unavailable |

#### Adjusted Expectations

| Item                                                 | Native Behavior             | WASM Behavior                    |
| ---------------------------------------------------- | --------------------------- | -------------------------------- |
| `sqlite.admin.dbstat({summarize: true})`             | Per-table storage breakdown | Counts-only (JS fallback)        |
| `sqlite.admin.pragmaCompileOptions({filter: "FTS"})` | Matches FTS5                | Matches FTS3                     |
| `test_articles_fts` in `listVirtualTables`           | Present and queryable       | May appear but FTS5 queries fail |

---

## Post-Test Procedures

### Reporting Rules
- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in help resources and runtime hints

### After Testing
1. **Triage findings**: If issues were found, create an implementation plan, making sure they are consistent with working patterns in other tools/tool groups. If the plan requires no user decisions, proceed directly to implementation
2. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `src/constants/server-instructions/*.md` (per-group help files) — run `npm run generate:instructions` after editing to regenerate `server-instructions.ts`
   - Test database (`test-server/test.db`)
   - This prompt

### After Implementation
3. **Document**: Update `UNRELEASED.md`, `code-map.md` (if appropriate), and create a `memory-journal-mcp` entry detailing the changes and improvements made.
4. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
5. **Commit**: Stage and commit all changes — do NOT push
6. **Live re-test**: Test fixes with direct MCP tool calls. I will have already rebuilt and restarted the server.
7. **Final summary**: If no issues found, provide the final summary after testing. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working.
