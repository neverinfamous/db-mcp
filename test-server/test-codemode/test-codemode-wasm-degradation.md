# db-mcp Code Mode Testing: [wasm-degradation]

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

> [!NOTE]
> **Tool Availability & Code Mode**: The `sqlite_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a *different* group (e.g., `sqlite_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `sqlite_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, or a raw text string wrapped in `isError: true` with no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.
> 
> ⚠️ **AGENT TRAP WARNING**: If a tool returns a valid, parseable JSON object with `{ success: false, error: "..." }`, but Antigravity UI displays it wrapped in an `error executing cascade step: CORTEX_STEP_TYPE_MCP_TOOL:` frame, **DO NOT REMOVE `isError: true` from the source code!** The presence of `isError: true` alongside the structured JSON is *required* to safely bypass the MCP SDK's `outputSchema` validator. Removing it will trigger raw `-32602 Output validation error` bugs.

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
> **Note**: This is a **meta-test suite** — it validates WASM graceful degradation behavior across multiple tool groups, not a specific tool group. The coverage matrix requirement does not apply; instead, each phase targets a specific WASM degradation scenario.

### Code Mode Methods

- `sqlite.transactions.help`
- `sqlite.stats.help`
- `sqlite.geo.help`
- `sqlite.text.help`
- `sqlite.admin.backup`
- `sqlite.admin.restore`
- `sqlite.admin.verifyBackup`
- `sqlite.admin.dump`
- `sqlite.admin.createCsvTable`
- `sqlite.admin.analyzeCsvSchema`
- `sqlite.admin.createRtreeTable`
- `sqlite.core.readQuery`
- `sqlite.admin.dbstat`
- `sqlite.admin.pragmaCompileOptions`
- `sqlite.core.count`

## Phase 1: API Surface Verification (5 tests)

> Verify the Code Mode bridge correctly reflects the reduced WASM tool surface.

### 1.1 — Total method count

```javascript
const help = await sqlite.help();
return { groups: help.groups, totalMethods: help.totalMethods };
```

Expected: `totalMethods` should be significantly less than 167 (the Native count). The exact WASM count depends on adapter registration but should be approximately 140.

### 1.2 — Transactions group is empty

```javascript
const txHelp = await sqlite.transactions.help();
return {
  group: txHelp.group,
  methodCount: txHelp.methods.length,
  methods: txHelp.methods,
};
```

Expected: `methodCount: 0` (or only `help` itself). No transaction methods should be available.

### 1.3 — Window functions absent from stats

```javascript
const statsHelp = await sqlite.stats.help();
const windowMethods = statsHelp.methods.filter((m) => m.startsWith("window"));
return { totalStatsMethods: statsHelp.methods.length, windowMethods };
```

Expected: `windowMethods` is empty (`[]`). The 6 window tools should not appear.

### 1.4 — SpatiaLite absent from geo

```javascript
const geoHelp = await sqlite.geo.help();
const spatialMethods = geoHelp.methods.filter((m) =>
  m.startsWith("spatialite"),
);
return {
  totalGeoMethods: geoHelp.methods.length,
  spatialMethods,
  haversineMethods: geoHelp.methods,
};
```

Expected: `spatialMethods` is empty. Only 4 Haversine methods remain: `distance`, `nearby`, `boundingBox`, `cluster`.

### 1.5 — FTS5 absent from text

```javascript
const textHelp = await sqlite.text.help();
const ftsMethods = textHelp.methods.filter((m) => m.startsWith("fts"));
return { totalTextMethods: textHelp.methods.length, ftsMethods };
```

Expected: `ftsMethods` is empty. The 5 FTS5 tools should not appear.


## Phase 2: Backup/Restore/Verify/Dump — Graceful Errors (batched)

> These 4 tools are registered in WASM but return structured errors because file system access is unavailable.

```javascript
const failures = [];

// 2.1 — Backup
const backup = await sqlite.admin.backup({
  targetPath:
    "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-wasm-backup.db",
});
if (backup.success !== false)
  failures.push("backup: expected {success: false}");
if (!backup.error || !backup.error.toLowerCase().includes("wasm")) {
  failures.push(
    "backup: error message should mention WASM — got: " + backup.error,
  );
}

// 2.2 — Restore
const restore = await sqlite.admin.restore({
  sourcePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test.db",
});
if (restore.success !== false)
  failures.push("restore: expected {success: false}");
if (!restore.error || !restore.error.toLowerCase().includes("wasm")) {
  failures.push(
    "restore: error message should mention WASM — got: " + restore.error,
  );
}

// 2.3 — Verify Backup
const verify = await sqlite.admin.verifyBackup({
  backupPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test.db",
});
if (verify.success !== false)
  failures.push("verifyBackup: expected {success: false}");
if (!verify.error || !verify.error.toLowerCase().includes("wasm")) {
  failures.push(
    "verifyBackup: error message should mention WASM — got: " + verify.error,
  );
}

// 2.4 — Dump
const dump = await sqlite.admin.dump({
  outputPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-wasm-dump.sql",
});
if (dump.success !== false)
  failures.push("dump: expected {success: false}");
if (!dump.error || !dump.error.toLowerCase().includes("wasm")) {
  failures.push(
    "dump: error message should mention WASM — got: " + dump.error,
  );
}

return { failures, success: failures.length === 0 };
```


## Phase 3: CSV Tools — Graceful Errors (batched)

> CSV virtual tables require the `csv` extension which is not available in WASM.

```javascript
const failures = [];

// 3.1 — Create CSV Table
const csvCreate = await sqlite.admin.createCsvTable({
  tableName: "temp_wasm_csv",
  filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv",
});
if (csvCreate.success !== false)
  failures.push("createCsvTable: expected {success: false}");

// 3.2 — Analyze CSV Schema
const csvAnalyze = await sqlite.admin.analyzeCsvSchema({
  filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv",
});
if (csvAnalyze.success !== false)
  failures.push("analyzeCsvSchema: expected {success: false}");

return { failures, success: failures.length === 0 };
```


## Phase 4: R-Tree — Graceful Error

> R-Tree spatial indexing requires a module not available in WASM's sql.js.

```javascript
const failures = [];

const rtree = await sqlite.admin.createRtreeTable({
  tableName: "temp_wasm_rtree",
  dimensions: 2,
});
if (rtree.success !== false)
  failures.push("createRtreeTable: expected {success: false}");

return { failures, success: failures.length === 0 };
```


## Phase 5: FTS5 — Phantom Table Behavior (batched)

> `test_articles_fts` exists in sqlite_master (created by native seed) but FTS5 queries will fail in WASM.

```javascript
const failures = [];

// 5.1 — Verify phantom table appears in sqlite_master
const tables = await sqlite.core.readQuery(
  "SELECT name, type FROM sqlite_master WHERE name = 'test_articles_fts'",
);
if (!tables.rows || tables.rows.length === 0) {
  failures.push(
    "test_articles_fts not found in sqlite_master — seed may not include FTS5",
  );
}

// 5.2 — Attempting FTS5 query should fail gracefully
const ftsQuery = await sqlite.core.readQuery({
  query:
    "SELECT * FROM test_articles_fts WHERE test_articles_fts MATCH 'SQLite' LIMIT 1",
});
// This should either return {success: false} or empty results — it should NOT crash
if (ftsQuery.success === false) {
  // Expected: structured error
} else if (ftsQuery.rows && ftsQuery.rows.length > 0) {
  failures.push(
    "FTS5 query succeeded in WASM — unexpected (sql.js should not support FTS5)",
  );
}

return { failures, success: failures.length === 0 };
```


## Phase 6: dbstat WASM Fallback

> In WASM, `dbstat` returns counts-only (JS fallback) rather than per-table storage breakdown.

```javascript
const failures = [];

const dbstat = await sqlite.admin.dbstat({ summarize: true });
// Should succeed but with limited data
if (dbstat.success === false) {
  failures.push("dbstat failed entirely in WASM — expected JS fallback");
}

return {
  failures,
  success: failures.length === 0,
  dbstatResult: dbstat,
};
```


## Phase 7: PRAGMA Compile Options — FTS3 vs FTS5

> WASM (sql.js) is compiled with FTS3, not FTS5.

```javascript
const failures = [];

const options = await sqlite.admin.pragmaCompileOptions({});
const optionList = options.compileOptions || options.options || [];

const hasFTS5 = optionList.some((o) => o.toUpperCase().includes("FTS5"));
const hasFTS3 = optionList.some((o) => o.toUpperCase().includes("FTS3"));

if (hasFTS5) {
  failures.push("WASM should NOT have FTS5 compile option");
}

return {
  failures,
  success: failures.length === 0,
  hasFTS3,
  hasFTS5,
  optionCount: optionList.length,
};
```


## Phase 8: Multi-Step WASM Workflow

### 8.1 — WASM capability audit pipeline

```javascript
const failures = [];

// Step 1: Get full API surface
const help = await sqlite.help();
const groups = help.groups;
const totalMethods = help.totalMethods;

// Step 2: Check each group's method count
const groupSizes = {};
for (const g of groups) {
  const gHelp = await sqlite[g].help();
  groupSizes[g] = gHelp.methods.length;
}

// Step 3: Verify transactions is empty
if (groupSizes.transactions > 0) {
  failures.push(
    `transactions should have 0 methods, got ${groupSizes.transactions}`,
  );
}

// Step 4: Verify no window methods in stats
const statsHelp = await sqlite.stats.help();
const windowMethods = statsHelp.methods.filter((m) => m.startsWith("window"));
if (windowMethods.length > 0) {
  failures.push(
    `stats should have 0 window methods, got ${windowMethods.length}`,
  );
}

// Step 5: Test a WASM-compatible tool works
const count = await sqlite.core.count({ table: "test_products" });
if (count.count !== 16)
  failures.push(`expected 16 products, got ${count.count}`);

// Step 6: Test a degraded tool fails gracefully
const backup = await sqlite.admin.backup({ targetPath: "wasm-test.db" });
if (backup.success !== false) failures.push("backup should fail in WASM");

return {
  failures,
  success: failures.length === 0,
  summary: {
    totalGroups: groups.length,
    totalMethods,
    groupSizes,
    wasmCompatible: true,
  },
};
```


## Phase 9: Zod Validation Sweep

> Even though these tools degrade gracefully for domain reasons, their Zod validation must also work. Passing `{}` should return a structured error, not a raw MCP exception.

```javascript
const failures = [];

const zodTests = [
  { name: "backup", fn: () => sqlite.admin.backup({}) },
  { name: "restore", fn: () => sqlite.admin.restore({}) },
  { name: "verifyBackup", fn: () => sqlite.admin.verifyBackup({}) },
  { name: "dump", fn: () => sqlite.admin.dump({}) },
  { name: "createCsvTable", fn: () => sqlite.admin.createCsvTable({}) },
  { name: "analyzeCsvSchema", fn: () => sqlite.admin.analyzeCsvSchema({}) },
  { name: "createRtreeTable", fn: () => sqlite.admin.createRtreeTable({}) },
];

for (const test of zodTests) {
  const result = await test.fn();
  if (result.success !== false) {
    failures.push(`${test.name}({}): expected {success: false}`);
  }
}

return { failures, success: failures.length === 0 };
```

---

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
