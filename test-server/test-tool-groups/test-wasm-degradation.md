# db-mcp Tool Group Testing: [wasm-degradation]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> We're currently testing Native mode.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): Tools marked `[NATIVE ONLY]` in the checklist are unavailable and should be skipped. All unmarked tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
> See [`code-map.md`](file:///C:/Users/chris/Desktop/db-mcp/test-server/code-map.md) for the complete test database schema (`test_*` tables).

## Reporting Format
- ❌ **Fail**: Tool errors or produces incorrect results (include error message)
- ⚠️ **Issue**: Unexpected behavior or improvement opportunity
- 📦 **Payload**: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB and suggest a concrete optimization.
- ✅ **Confirmed**: (Use inline only during testing; omit from Final Summary)

### Error Message Quality Rating
| Level                                  | Verdict |
| -------------------------------------- | ------- |
| 5 - Excellent (name + code + context)  | ✅      |
| 4 - Good (name)                        | ✅      |
| 3 - Adequate (raw SQLite, informative) | ⚠️      |
| 2 - Poor (no object name)              | ⚠️      |
| 1 - Useless (generic)                  | ❌      |

## Testing Requirements & Error Standards

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) A **Zod validation error** (call the tool with `{}` empty params).
   Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
3. **Output Schema Testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
4. **Wrong-Type Coercion**: For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.
5. **Proactive Improvements**: You are highly encouraged to proactively improve functionality, performance, security, agent experience, and token/payload efficiency whenever you see an opportunity during your testing and handler code review.
   > **CRITICAL**: Architectural consistency is paramount. Do not introduce undocumented architectural deviations. If you implement a structural or architectural improvement in one tool, you must apply it symmetrically to other applicable tools in the group or project.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
7. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
8. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

### Structured Error Response Pattern
All tools should return errors as structured objects instead of throwing. The expected pattern:
```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                                                                          | Verdict            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields                                                               | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field | Bug — report as ❌ |

## Naming & Cleanup
- **Temporary tables**: `temp_*` (or `stress_*`) prefix
- **Temporary views**: `temp_view_*` (or `stress_view_*`) prefix
- Drop at the end of the script. If DROP fails due to lock, note and move on.

---

## Group Focus: wasm-degradation

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.
>
> **Note**: This is a **meta-test suite** — it validates WASM graceful degradation behavior for `[NATIVE ONLY]` tools called via direct MCP tool calls (not Code Mode). Each phase targets a specific tool group's native-only tools. All calls MUST return `{success: false}` structured errors — never raw MCP errors.

### WASM vs Native Reference
> See `gotchas.md` WASM vs Native table for the complete feature matrix.

## Phase 1: FTS5 Tools — Graceful Degradation (batched)

> 5 tools: `sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`, `sqlite_fts_headline`

🔴 1. `sqlite_fts_create({sourceTable: "test_articles", columns: ["title", "body"], ftsTable: "temp_wasm_fts"})` → `{success: false}` — structured error about FTS5 not available in WASM
🔴 2. `sqlite_fts_search({table: "test_articles_fts", query: "SQLite"})` → `{success: false}`
🔴 3. `sqlite_fts_rebuild({table: "test_articles_fts"})` → `{success: false}`
🔴 4. `sqlite_fts_match_info({table: "test_articles_fts", query: "database"})` → `{success: false}`
🔴 5. `sqlite_fts_headline({table: "test_articles_fts", query: "SQLite"})` → `{success: false}`


## Phase 2: Transaction Tools — Graceful Degradation (batched)

> 8 tools: `sqlite_transaction_begin`, `sqlite_transaction_status`, `sqlite_transaction_commit`, `sqlite_transaction_rollback`, `sqlite_transaction_savepoint`, `sqlite_transaction_release`, `sqlite_transaction_rollback_to`, `sqlite_transaction_execute`

🔴 6. `sqlite_transaction_begin({mode: "deferred"})` → `{success: false}`
🔴 7. `sqlite_transaction_status` → `{success: false}`
🔴 8. `sqlite_transaction_commit` → `{success: false}`
🔴 9. `sqlite_transaction_rollback` → `{success: false}`
🔴 10. `sqlite_transaction_savepoint({name: "sp1"})` → `{success: false}`
🔴 11. `sqlite_transaction_release({name: "sp1"})` → `{success: false}`
🔴 12. `sqlite_transaction_rollback_to({name: "sp1"})` → `{success: false}`
🔴 13. `sqlite_transaction_execute({statements: ["SELECT 1"]})` → `{success: false}`


## Phase 3: Window Function Tools — Graceful Degradation (batched)

> 6 tools: `sqlite_window_row_number`, `sqlite_window_rank`, `sqlite_window_lag_lead`, `sqlite_window_running_total`, `sqlite_window_moving_avg`, `sqlite_window_ntile`

🔴 14. `sqlite_window_row_number({table: "test_products", orderBy: "price DESC"})` → `{success: false}`
🔴 15. `sqlite_window_rank({table: "test_products", orderBy: "price DESC"})` → `{success: false}`
🔴 16. `sqlite_window_lag_lead({table: "test_orders", column: "total_price", direction: "lag", orderBy: "order_date"})` → `{success: false}`
🔴 17. `sqlite_window_running_total({table: "test_orders", column: "total_price", orderBy: "order_date"})` → `{success: false}`
🔴 18. `sqlite_window_moving_avg({table: "test_measurements", column: "temperature", windowSize: 5, orderBy: "measured_at"})` → `{success: false}`
🔴 19. `sqlite_window_ntile({table: "test_products", buckets: 4, orderBy: "price"})` → `{success: false}`


## Phase 4: SpatiaLite Tools — Graceful Degradation (batched)

> 7 tools: `sqlite_spatialite_load`, `sqlite_spatialite_create_table`, `sqlite_spatialite_query`, `sqlite_spatialite_analyze`, `sqlite_spatialite_index`, `sqlite_spatialite_transform`, `sqlite_spatialite_import`

🔴 20. `sqlite_spatialite_load` → `{success: false}`
🔴 21. `sqlite_spatialite_create_table({tableName: "temp_wasm_spatial", geometryColumn: "geom", geometryType: "POINT", srid: 4326})` → `{success: false}`
🔴 22. `sqlite_spatialite_query({sql: "SELECT ST_Distance(MakePoint(0,0,4326), MakePoint(1,1,4326))"})` → `{success: false}`
🔴 23. `sqlite_spatialite_analyze({table: "test_locations", geometryColumn: "geom", operation: "nearest_neighbor", targetLat: 40.758, targetLon: -73.9855})` → `{success: false}`
🔴 24. `sqlite_spatialite_index({table: "test_locations", geometryColumn: "geom", action: "create"})` → `{success: false}`
🔴 25. `sqlite_spatialite_transform({table: "test_locations", geometryColumn: "geom", operation: "centroid"})` → `{success: false}`
🔴 26. `sqlite_spatialite_import({table: "test_locations", geometryColumn: "geom", format: "wkt", data: "POINT(0 0)"})` → `{success: false}`


## Phase 5: Admin Native-Only Tools — Graceful Degradation (batched)

> Tools that degrade gracefully or are unavailable in WASM.

🔴 27. `sqlite_backup({outputPath: "test_backup.db"})` → `{success: false}` or graceful degradation
🔴 28. `sqlite_restore({inputPath: "test_backup.db"})` → `{success: false}` or graceful degradation
🔴 29. `sqlite_dump({outputPath: "test_dump.sql"})` → `{success: false}`


## Phase 6: Tool Visibility Verification (batched)

> Verify that NATIVE ONLY tools are properly excluded from the tool list in WASM mode.

30. Call `server_info` or `list_adapters` → verify adapter type is `wasm` or `sql.js`
31. Confirm the following tool groups are NOT present in the available tool list:
    - Transaction tools (8 tools)
    - Window function tools (6 tools)
    - SpatiaLite tools (7 tools)
    - FTS5 tools (5 tools)

> **Note**: Some tools like `sqlite_backup` may still be listed but return graceful errors. The key is that they NEVER return raw MCP errors.


> **Note**: No Wrong-Type Numeric Coercion phase is included for this meta-test suite — it validates WASM graceful degradation behavior, not a specific tool group with optional numeric parameters.

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
