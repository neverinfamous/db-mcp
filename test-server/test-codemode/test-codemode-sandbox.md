# db-mcp Code Mode Testing: [sandbox]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.
> **Adapter mode**: Call `list_adapters` at the start of testing to determine whether you are running against `native` or `wasm`. Apply the WASM Mode rules below if the adapter is `wasm`.

## WASM Mode
> When testing against a **WASM backend** (`sqlite-wasm` / sql.js): All tools are fully WASM-compatible.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update `C:\Users\chris\Desktop\db-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\db-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.

### Test Schema Reference
> See `code-map.md` in the `test-server/` directory for the complete test database schema (`test_*` tables).

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

> [!NOTE]
> **Tool Availability & Code Mode**: The `sqlite_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a *different* group (e.g., `sqlite_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `sqlite_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, or a raw text string wrapped in `isError: true` with no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.
> 
> ⚠️ **ARCHITECTURAL NOTE — `isError: true` rules for tools with `outputSchema`**: The MCP SDK uses `isError` to decide whether to validate `structuredContent` against the `outputSchema`. Getting this wrong causes either raw `-32602` crashes or valid responses wrapped in error frames. **This is now handled automatically by the server framework in `tools.ts`**, but as a tester, you must verify the SDK output matches this rule:
>
> | Response | `isError: true` | SDK behavior | Verdict |
> |---|---|---|---|
> | `success: true` | **Absent** | Validates `structuredContent` → passes | ✅ Correct |
> | `success: true` | **Present** | Skips validation, wraps in error frame | ❌ Bug — valid response shown as error |
> | `success: false` | **Present** | Skips validation (error shape won't match success schema) | ✅ Correct |
> | `success: false` | **Absent** | Validates error against success schema → fails | ❌ Bug — raw `-32602` |
>
> **TL;DR**: `isError: true` on errors, absent on successes. The framework handles this automatically when your handler returns `success: false`.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) An **empty parameters test** (call the tool with `{}`).
   Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
   > **Note on Aliases & Zod**: Tools that support legacy parameter aliases (e.g. `tableName` instead of `table`) often use `.default("")` in their Zod schema so the SDK validation lets the payload reach the handler's alias-resolution logic. For these tools, calling with `{}` will pass Zod validation and correctly trigger a handler-level domain error (e.g. `TABLE_NOT_FOUND`) instead of a strict Zod `invalid_type` error. **This is expected behavior.** Do NOT remove `.default("")` from schemas to force a Zod error, as this will break alias compatibility.
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

## Group Focus: sandbox

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.
>
> **Note**: This is a **meta-test suite** — it validates the Code Mode sandbox infrastructure itself, not a specific tool group. The coverage matrix requirement does not apply; instead, each phase targets a specific sandbox capability.

### Code Mode Methods

- `sqlite.core.help`
- `sqlite.core.query`
- `sqlite.core.readQuery`
- `sqlite.nonexistent.help`
- `sqlite.core.writeQuery`
- `sqlite.stats.statsBasic`
- `sqlite.core.createTable`
- `sqlite.core.dropTable`

## Phase 1: Sandbox Basics (9 tests)

> These tests validate the Code Mode sandbox itself — run them first.

### 1.1 — Simple return value

```javascript
return 42;
```

Expected: `{success: true, result: 42}`

### 1.2 — Object return

```javascript
return { name: "test", values: [1, 2, 3] };
```

### 1.3 — Async/await support

```javascript
const result = await Promise.resolve("async works");
return result;
```

### 1.4 — Runtime error handling

```javascript
const x = undefinedVariable;
return x;
```

Expected: `{success: false, error: "...not defined..."}` — structured, not crash.

### 1.5 — Empty code

Call `sqlite_execute_code` with `code: ""`.
Expected: `{success: false}` with validation error, not raw MCP error.

### 1.6 — Empty params

Call `sqlite_execute_code` with `{}` (no `code` param).
Expected: structured handler error, NOT raw MCP `-32602`.

### 1.7 — Return null

```javascript
return null;
```

Expected: `{success: true, result: null}` — sandbox must handle null return values.

### 1.8 — Return undefined

```javascript
return undefined;
```

Expected: `{success: true}` — sandbox must handle undefined without crashing. `result` may be absent or null.

### 1.9 — Return large nested object

```javascript
const nested = {};
let current = nested;
for (let i = 0; i < 10; i++) {
  current.level = i;
  current.child = {};
  current = current.child;
}
current.leaf = "deep value";
return nested;
```

Expected: `{success: true}` — sandbox must serialize deeply nested objects.


## Phase 2: API Discoverability (8 tests)

### 2.1 — Top-level help

```javascript
return await sqlite.help();
```

Expected: `{groups: [...], totalMethods: <number>, usage: "..."}` with 10 groups listed (including transactions). **WASM**: Fewer groups — `transactions` is absent; `totalMethods` ≈ 140.

### 2.2 — Group help (core)

```javascript
return await sqlite.core.help();
```

Expected: `{group: "core", methods: [...]}` with methods including `readQuery`, `writeQuery`, `listTables`, `describeTable`, `upsert`, `batchInsert`, `count`, `exists`, `truncate`.

### 2.3 — All groups exist

```javascript
const groups = [
  "core",
  "json",
  "text",
  "stats",
  "vector",
  "admin",
  "transactions",
  "geo",
  "introspection",
  "migration",
];
const results = {};
for (const g of groups) {
  const h = await sqlite[g].help();
  results[g] = h.methods.length;
}
return results;
```

Expected: All 10 groups return >0 methods. **WASM**: `transactions` returns 0 methods — adjust assertion to allow this.

### 2.4 — Method aliases resolve

```javascript
const r1 = await sqlite.core.query("SELECT 1 AS num");
const r2 = await sqlite.core.readQuery("SELECT 1 AS num");
return { aliasResult: r1, canonicalResult: r2 };
```

Expected: Both return identical results.

### 2.5 — Top-level convenience aliases

```javascript
const tables = await sqlite.listTables();
return { success: true, tableCount: tables.tables?.length };
```

### 2.6 — Positional args

```javascript
return await sqlite.core.readQuery("SELECT name FROM test_products LIMIT 2");
```

Expected: Works with string positional arg (not just object).

### 2.7 — Built-in tools not in sandbox

```javascript
return {
  serverInfo: typeof sqlite.serverInfo,
  serverHealth: typeof sqlite.serverHealth,
  listAdapters: typeof sqlite.listAdapters,
  server_info: typeof sqlite.server_info,
  server_health: typeof sqlite.server_health,
  list_adapters: typeof sqlite.list_adapters,
};
```

Expected: All values are `"undefined"`. The 3 built-in tools (`server_info`, `server_health`, `list_adapters`) are always-on MCP tools available outside Code Mode but must NOT be accessible in the `sqlite.*` sandbox namespace — they are server-level tools not scoped to a specific database adapter.

### 2.8 — reportProgress utility

```javascript
const type = typeof sqlite.reportProgress;
if (type !== "function") return { success: false, error: "reportProgress not a function, got: " + type };
sqlite.reportProgress(1, 3, "Testing progress reporting");
sqlite.reportProgress(2, 3, "Still working");
sqlite.reportProgress(3, 3, "Done");
return { success: true, type };
```

Expected: `{success: true, type: "function"}`. The `sqlite.reportProgress(current, total, message)` utility must be accessible and callable without errors. Progress notifications are sent to the client but do not affect the return value.


## Phase 3: Security & Error Handling (7 tests)

### 3.1 — Blocked pattern (require)

```javascript
const fs = require("fs");
return fs.readFileSync("/etc/passwd");
```

Expected: `{success: false, code: "CODEMODE_VALIDATION_FAILED"}`

### 3.2 — Blocked pattern (process)

```javascript
return process.env;
```

Expected: `{success: false}` — blocked pattern or runtime error.

### 3.3 — Blocked pattern (eval)

```javascript
return eval("1+1");
```

Expected: `{success: false, code: "CODEMODE_VALIDATION_FAILED"}`

### 3.4 — Timeout enforcement

```javascript
while (true) {}
```

Call with `timeout: 2000`. Expected: `{success: false}` with timeout error within ~2s.

### 3.5 — Timeout enforcement (tight tolerance)

```javascript
const start = Date.now();
while (Date.now() - start < 1000) {} // busy-wait 1s
return "completed";
```

Call with `timeout: 500`. Expected: `{success: false}` with timeout error — the 500ms timeout must fire before the 1s loop completes.

### 3.6 — Invalid tool call via API

```javascript
return await sqlite.core.readQuery({ query: "SELECT * FROM nonexistent_xyz" });
```

Expected: Returns `{success: false, error: "..."}` — sandbox must not crash.

### 3.7 — Undefined API group

```javascript
return await sqlite.nonexistent.help();
```

Expected: runtime error, not crash.


## Phase 4: Readonly Mode (5 tests)

All tests use `readonly: true` on the `sqlite_execute_code` call.

### 4.1 — Read operations work

```javascript
// readonly: true
return await sqlite.core.readQuery("SELECT COUNT(*) AS cnt FROM test_products");
```

Expected: `{success: true, rows: [{cnt: 16}]}`

### 4.2 — Write operations blocked

```javascript
// readonly: true
return await sqlite.core.writeQuery(
  "INSERT INTO test_products (name) VALUES ('blocked')",
);
```

Expected: `{success: false, code: "CODEMODE_READONLY_VIOLATION"}`

### 4.3 — Read methods still discoverable

```javascript
// readonly: true
const help = await sqlite.core.help();
return {
  hasWriteQuery: help.methods.includes("writeQuery"),
  methods: help.methods,
};
```

Expected: `writeQuery` still appears in help (for discoverability) but is guarded.

### 4.4 — Create table blocked

```javascript
// readonly: true
return await sqlite.core.writeQuery(
  "CREATE TABLE temp_readonly_test (id INTEGER)",
);
```

Expected: `{success: false, code: "CODEMODE_READONLY_VIOLATION"}`

### 4.5 — Stats read-only works

```javascript
// readonly: true
return await sqlite.stats.statsBasic({
  table: "test_products",
  column: "price",
});
```

Expected: succeeds — stats tools are read-only.


## Phase 5: State Isolation (2 tests)

### 5.1 — Variables don't persist between calls

Run two separate `sqlite_execute_code` calls:

**Call 1:**

```javascript
var persistTest = "should not persist";
return persistTest;
```

**Call 2:**

```javascript
try {
  return { persisted: typeof persistTest !== "undefined", value: persistTest };
} catch (e) {
  return { persisted: false, error: e.message };
}
```

Expected: Call 2 returns `{persisted: false}` — variables from Call 1 must not leak.

### 5.2 — Database state persists between calls

Run two separate `sqlite_execute_code` calls:

**Call 1:**

```javascript
await sqlite.core.createTable({
  table: "temp_cm_iso_test",
  columns: [
    { name: "id", type: "INTEGER", primaryKey: true },
    { name: "val", type: "TEXT" },
  ],
});
await sqlite.core.writeQuery(
  "INSERT INTO temp_cm_iso_test VALUES (1, 'persisted')",
);
return "created";
```

**Call 2:**

```javascript
const result = await sqlite.core.readQuery("SELECT * FROM temp_cm_iso_test");
await sqlite.core.dropTable({ table: "temp_cm_iso_test", ifExists: true });
return result;
```

Expected: Call 2 reads the row inserted in Call 1 — database state persists across sandbox invocations (sandbox is stateless, database is not).

---

> **Note**: No Wrong-Type Numeric Coercion phase is included for this meta-test suite — it validates the sandbox infrastructure, not a specific tool group with optional numeric parameters.

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
