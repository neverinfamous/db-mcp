# db-mcp Tool Group Testing: [core-schema]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md` with any/all changes/fixes.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
> *No specific table schema required for this test group.*

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
5. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
6. **Token Tracking**: Monitor `metrics.tokenEstimate` to detect payload issues.
7. **Coverage Matrix**: Maintain a coverage matrix: `| Tool | Happy Path | Domain Error | Zod Error |`

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

## Group Focus: core-schema

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### core-schema Group Tools (13)

8. sqlite_list_tables
9. sqlite_describe_table
10. sqlite_create_table
11. sqlite_drop_table
12. sqlite_get_indexes
13. sqlite_create_index
14. sqlite_drop_index
15. sqlite_list_triggers
16. sqlite_list_constraints
17. sqlite_alter_table
18. sqlite_create_trigger
19. sqlite_drop_trigger
20. sqlite_execute_code

## Phase 1: Read & Introspection (batched)

21. `sqlite_list_tables({excludeSystemTables: true})` → verify `test_products`, `test_orders`, etc. all present, but `sqlite_master` or `sqlite_sequence` absent
22. `sqlite_describe_table({table: "test_products"})` → verify columns include `id` (INTEGER), `name` (TEXT), `price` (REAL), `category` (TEXT)
23. `sqlite_get_indexes({table: "test_orders", excludeSystemIndexes: true})` → verify `idx_orders_status` and `idx_orders_date` present

## Phase 2: Table & Index Lifecycle (batched)

24. `sqlite_create_table({table: "temp_core_test", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "name", type: "TEXT"}, {name: "value", type: "REAL"}], ifNotExists: true})` → success
25. `sqlite_create_table({table: "temp_core_test", columns: [{name: "id", type: "INTEGER", primaryKey: true}], ifNotExists: true})` → success (should not fail if table already exists due to ifNotExists)
26. `sqlite_create_index({table: "temp_core_test", columns: ["name"], indexName: "idx_temp_core_name", unique: false, ifNotExists: true})` → success
27. `sqlite_drop_index({indexName: "idx_temp_core_name", ifExists: true})` → success
28. `sqlite_drop_table({table: "temp_core_test", ifExists: true})` → success

## Phase 3: Triggers & Constraints (batched)

29. `sqlite_list_triggers({})` → list of triggers (may be empty in test DB), verify `{triggers: [], count: 0}` structure
30. `sqlite_list_triggers({table: "test_orders"})` → filtered results
31. `sqlite_list_constraints({table: "test_orders"})` → verify `primaryKey`, `foreignKeys` (FK to test_products), `uniqueIndexes`
32. `sqlite_list_constraints({table: "test_products"})` → verify PK on `id`

## Phase 4: ALTER TABLE Lifecycle (batched)

33. `sqlite_create_table({table: "temp_core_alter", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "name", type: "TEXT"}], ifNotExists: true})` → success (setup)
34. `sqlite_alter_table({table: "temp_core_alter", operation: "add_column", column: "status", type: "TEXT", nullable: true})` → success, message confirms column added
35. `sqlite_alter_table({table: "temp_core_alter", operation: "add_column", column: "score", type: "INTEGER", nullable: false, defaultValue: 0})` → success (NOT NULL with default)
36. `sqlite_describe_table({table: "temp_core_alter"})` → verify `status` (TEXT) and `score` (INTEGER) columns present
37. `sqlite_alter_table({table: "temp_core_alter", operation: "rename_column", column: "status", newName: "state"})` → success
38. `sqlite_alter_table({table: "temp_core_alter", operation: "drop_column", column: "state"})` → success
39. `sqlite_alter_table({table: "temp_core_alter", operation: "rename_table", newName: "temp_core_renamed"})` → success
40. `sqlite_alter_table({table: "temp_core_renamed", operation: "rename_table", newName: "temp_core_alter"})` → rename back
41. `sqlite_drop_table({table: "temp_core_alter", ifExists: true})` → cleanup

## Phase 5: Trigger Lifecycle (batched)

42. `sqlite_create_table({table: "temp_core_triggers", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "val", type: "TEXT"}], ifNotExists: true})` → setup
43. `sqlite_create_trigger({name: "temp_trg_audit", table: "temp_core_triggers", event: "INSERT", timing: "AFTER", body: "SELECT 1;"})` → success, `sql` returned
44. `sqlite_list_triggers({table: "temp_core_triggers"})` → 1 trigger with `name: "temp_trg_audit"`, `event: "INSERT"`, `timing: "AFTER"`
45. `sqlite_create_trigger({name: "temp_trg_del", table: "temp_core_triggers", event: "DELETE", timing: "BEFORE", body: "SELECT 1;"})` → success
46. `sqlite_list_triggers({table: "temp_core_triggers"})` → 2 triggers
47. `sqlite_drop_trigger({name: "temp_trg_audit"})` → success
48. `sqlite_drop_trigger({name: "temp_trg_del", ifExists: true})` → success
49. `sqlite_list_triggers({table: "temp_core_triggers"})` → 0 triggers
50. `sqlite_drop_table({table: "temp_core_triggers", ifExists: true})` → cleanup

## Phase 6: STRICT Table & Generated Column Enhancements (batched)

51. `sqlite_create_table({table: "temp_strict_test", columns: [{name: "id", type: "INTEGER", primaryKey: true}, {name: "name", type: "TEXT"}], strict: true})` → success
52. `sqlite_describe_table({table: "temp_strict_test"})` → verify structure (STRICT enforcement is at insert-time, schema looks normal)
53. `sqlite_drop_table({table: "temp_strict_test", ifExists: true})` → cleanup

**Code mode testing:**

54. `sqlite_execute_code({code: "const tables = await sqlite.core.listTables(); return tables;"})` → returns list of tables including `test_products`, `test_orders`, etc.
55. `sqlite_execute_code({code: "const result = await sqlite.core.writeQuery('INSERT INTO test_products VALUES (999, \"x\", \"x\", 0, \"x\", \"x\")'); return result;", readonly: true})` → `result` contains `{success: false, code: "CODEMODE_READONLY_VIOLATION"}` (code mode returns errors as values, not thrown exceptions)
56. `sqlite_execute_code({code: "const r = await sqlite.core.listConstraints({table: 'test_orders'}); return r;"})` → structured constraint data

**Error path testing:**

🔴 57. `sqlite_describe_table({table: "nonexistent_table_xyz"})` → structured error response, NOT a raw MCP exception
🔴 58. `sqlite_drop_table({table: "nonexistent_table_xyz"})` → structured error or `{existed: false}` style response
🔴 59. `sqlite_list_constraints({table: "nonexistent_xyz"})` → structured error
🔴 60. `sqlite_alter_table({table: "nonexistent_xyz", operation: "add_column", column: "x", type: "TEXT", nullable: true})` → `{success: false}` (TABLE_NOT_FOUND)
🔴 61. `sqlite_alter_table({table: "test_products", operation: "add_column", column: "name", type: "TEXT", nullable: true})` → `{success: false}` (COLUMN_EXISTS)
🔴 62. `sqlite_alter_table({table: "test_products", operation: "add_column", column: "x", type: "TEXT"})` → `{success: false}` (NOT NULL without default — `nullable` defaults to false)
🔴 63. `sqlite_alter_table({table: "test_products", operation: "rename_column", column: "nonexistent_col", newName: "x"})` → `{success: false}` (COLUMN_NOT_FOUND)
🔴 64. `sqlite_alter_table({table: "test_products", operation: "rename_table", newName: "test_orders"})` → `{success: false}` (TABLE_EXISTS)
🔴 65. `sqlite_create_trigger({name: "bad_trg", table: "nonexistent_xyz", event: "INSERT", timing: "AFTER", body: "SELECT 1;"})` → `{success: false}` (TABLE_NOT_FOUND)
🔴 66. `sqlite_create_trigger({name: "bad_trg", table: "test_products", event: "INSERT", timing: "INSTEAD OF", body: "SELECT 1;"})` → `{success: false}` (INSTEAD OF only on views)
🔴 67. `sqlite_drop_trigger({name: "nonexistent_trigger_xyz"})` → `{success: false}` (TRIGGER_NOT_FOUND)
🔴 68. `sqlite_drop_trigger({name: "nonexistent_trigger_xyz", ifExists: true})` → `{success: true}` (no-op, no error)

## Phase 7: Zod Validation Sweep

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error (`{success: false, error: "Validation error: ..."}`), NOT raw MCP error:

🔴 69. `sqlite_create_table({})` → handler error
🔴 70. `sqlite_describe_table({})` → handler error
🔴 71. `sqlite_drop_table({})` → handler error
🔴 72. `sqlite_get_indexes({})` → success (returns all indexes, table is optional)
🔴 73. `sqlite_create_index({})` → handler error
🔴 74. `sqlite_drop_index({})` → handler error
🔴 75. `sqlite_execute_code({})` → handler error (has required `code` param)
🔴 76. `sqlite_list_triggers({})` → success (table is optional)
🔴 77. `sqlite_list_constraints({})` → handler error (table is required)
🔴 78. `sqlite_alter_table({})` → handler error
🔴 79. `sqlite_create_trigger({})` → handler error
🔴 80. `sqlite_drop_trigger({})` → handler error


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
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit all changes — do NOT push
5. **Live re-test**: Test fixes with direct MCP tool calls. I will have already rebuilt and restarted the server.
6. **Final summary**: If no issues found, provide the final summary after testing. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working.
