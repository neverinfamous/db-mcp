# db-mcp Code Mode Testing: [wasm-degradation]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in C:\Users\chris\Desktop\db-mcp\tmp\task.md. However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.

> [!CAUTION]
> **WASM ONLY** — This prompt must be run against a WASM backend (`--sqlite` flag). Running it against Native will produce false results since the tools being tested are expected to *fail* in WASM but *succeed* in Native.

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Validate that WASM-unavailable features degrade gracefully with structured errors, not crashes or raw MCP exceptions.

## Purpose

This prompt validates the **graceful degradation contract**: tools that are registered in WASM mode but rely on unavailable Native extensions must return structured `{success: false, error: "..."}` responses. It also validates that the Code Mode API bridge correctly reflects the reduced WASM tool surface.

## Reporting Format

- ❌ Fail: Tool crashes, returns raw MCP error, or doesn't return `{success: false}`
- ⚠️ Issue: Error message is unclear or missing `wasmLimitation` hint
- ✅ Pass: Returns `{success: false, error: "..."}` with helpful message

## Test Database Schema

Same seed database as all other prompts. Key difference: `test_articles_fts` (FTS5 virtual table) exists in `sqlite_master` because the seed was created with native SQLite, but FTS5 queries will fail in WASM.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** Every tool in this prompt is expected to return a structured error — not crash.

1. **Batched scripting**: Bundle checks into `sqlite_execute_code` calls with `failures` array.
2. **Structured error validation**: Every response must have `success: false` and a human-readable `error` string.
3. **Token tracking**: Monitor `metrics.tokenEstimate`.
4. **Coverage Matrix**: `| Category | Test | Result | Error Message Quality |`
5. **Code Over Docs**: Fix the handler code if a tool returns a raw MCP error instead of a structured error.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | What you see                                          | Verdict    |
| -------------------- | ----------------------------------------------------- | ---------- |
| **Handler error** ✅ | JSON object with `success` and `error` fields         | Correct    |
| **MCP error** ❌     | Raw text, `isError: true`, no `success` field         | Bug        |

---

## Phase 1: API Surface Verification (3 tests)

> Verify the Code Mode bridge correctly reflects the reduced WASM tool surface.

### 1.1 — Total method count

```javascript
const help = await sqlite.help();
return { groups: help.groups, totalMethods: help.totalMethods };
```

Expected: `totalMethods` should be significantly less than 151 (the Native count). The exact WASM count depends on adapter registration but should be approximately 125.

### 1.2 — Transactions group is empty

```javascript
const txHelp = await sqlite.transactions.help();
return { group: txHelp.group, methodCount: txHelp.methods.length, methods: txHelp.methods };
```

Expected: `methodCount: 0` (or only `help` itself). No transaction methods should be available.

### 1.3 — Window functions absent from stats

```javascript
const statsHelp = await sqlite.stats.help();
const windowMethods = statsHelp.methods.filter(m => m.startsWith("window"));
return { totalStatsMethods: statsHelp.methods.length, windowMethods };
```

Expected: `windowMethods` is empty (`[]`). The 6 window tools should not appear.

### 1.4 — SpatiaLite absent from geo

```javascript
const geoHelp = await sqlite.geo.help();
const spatialMethods = geoHelp.methods.filter(m => m.startsWith("spatialite"));
return { totalGeoMethods: geoHelp.methods.length, spatialMethods, haversineMethods: geoHelp.methods };
```

Expected: `spatialMethods` is empty. Only 4 Haversine methods remain: `distance`, `nearby`, `boundingBox`, `cluster`.

### 1.5 — FTS5 absent from text

```javascript
const textHelp = await sqlite.text.help();
const ftsMethods = textHelp.methods.filter(m => m.startsWith("fts"));
return { totalTextMethods: textHelp.methods.length, ftsMethods };
```

Expected: `ftsMethods` is empty. The 5 FTS5 tools should not appear.

---

## Phase 2: Backup/Restore/Verify — Graceful Errors (batched)

> These 3 tools are registered in WASM but return structured errors because file system access is unavailable.

```javascript
const failures = [];

// 2.1 — Backup
const backup = await sqlite.admin.backup({
  targetPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test-wasm-backup.db"
});
if (backup.success !== false) failures.push("backup: expected {success: false}");
if (!backup.error || !backup.error.toLowerCase().includes("wasm")) {
  failures.push("backup: error message should mention WASM — got: " + backup.error);
}

// 2.2 — Restore
const restore = await sqlite.admin.restore({
  sourcePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test.db"
});
if (restore.success !== false) failures.push("restore: expected {success: false}");
if (!restore.error || !restore.error.toLowerCase().includes("wasm")) {
  failures.push("restore: error message should mention WASM — got: " + restore.error);
}

// 2.3 — Verify Backup
const verify = await sqlite.admin.verifyBackup({
  backupPath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\test.db"
});
if (verify.success !== false) failures.push("verifyBackup: expected {success: false}");
if (!verify.error || !verify.error.toLowerCase().includes("wasm")) {
  failures.push("verifyBackup: error message should mention WASM — got: " + verify.error);
}

return { failures, success: failures.length === 0 };
```

---

## Phase 3: CSV Tools — Graceful Errors (batched)

> CSV virtual tables require the `csv` extension which is not available in WASM.

```javascript
const failures = [];

// 3.1 — Create CSV Table
const csvCreate = await sqlite.admin.createCsvTable({
  tableName: "temp_wasm_csv",
  filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"
});
if (csvCreate.success !== false) failures.push("createCsvTable: expected {success: false}");

// 3.2 — Analyze CSV Schema
const csvAnalyze = await sqlite.admin.analyzeCsvSchema({
  filePath: "C:\\Users\\chris\\Desktop\\db-mcp\\test-server\\sample.csv"
});
if (csvAnalyze.success !== false) failures.push("analyzeCsvSchema: expected {success: false}");

return { failures, success: failures.length === 0 };
```

---

## Phase 4: R-Tree — Graceful Error

> R-Tree spatial indexing requires a module not available in WASM's sql.js.

```javascript
const failures = [];

const rtree = await sqlite.admin.createRtreeTable({
  tableName: "temp_wasm_rtree",
  dimensions: 2
});
if (rtree.success !== false) failures.push("createRtreeTable: expected {success: false}");

return { failures, success: failures.length === 0 };
```

---

## Phase 5: FTS5 — Phantom Table Behavior (batched)

> `test_articles_fts` exists in sqlite_master (created by native seed) but FTS5 queries will fail in WASM.

```javascript
const failures = [];

// 5.1 — Verify phantom table appears in sqlite_master
const tables = await sqlite.core.readQuery(
  "SELECT name, type FROM sqlite_master WHERE name = 'test_articles_fts'"
);
if (!tables.rows || tables.rows.length === 0) {
  failures.push("test_articles_fts not found in sqlite_master — seed may not include FTS5");
}

// 5.2 — Attempting FTS5 query should fail gracefully
const ftsQuery = await sqlite.core.readQuery({
  query: "SELECT * FROM test_articles_fts WHERE test_articles_fts MATCH 'SQLite' LIMIT 1"
});
// This should either return {success: false} or empty results — it should NOT crash
if (ftsQuery.success === false) {
  // Expected: structured error
} else if (ftsQuery.rows && ftsQuery.rows.length > 0) {
  failures.push("FTS5 query succeeded in WASM — unexpected (sql.js should not support FTS5)");
}

return { failures, success: failures.length === 0 };
```

---

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
  dbstatResult: dbstat
};
```

---

## Phase 7: PRAGMA Compile Options — FTS3 vs FTS5

> WASM (sql.js) is compiled with FTS3, not FTS5.

```javascript
const failures = [];

const options = await sqlite.admin.pragmaCompileOptions({});
const optionList = options.compileOptions || options.options || [];

const hasFTS5 = optionList.some(o => o.toUpperCase().includes("FTS5"));
const hasFTS3 = optionList.some(o => o.toUpperCase().includes("FTS3"));

if (hasFTS5) {
  failures.push("WASM should NOT have FTS5 compile option");
}

return {
  failures,
  success: failures.length === 0,
  hasFTS3,
  hasFTS5,
  optionCount: optionList.length
};
```

---

## Phase 8: Zod Validation — WASM-Degraded Tools (batched)

> Even though these tools degrade gracefully for domain reasons, their Zod validation must also work. Passing `{}` should return a structured error, not a raw MCP exception.

```javascript
const failures = [];

const zodTests = [
  { name: "backup", fn: () => sqlite.admin.backup({}) },
  { name: "restore", fn: () => sqlite.admin.restore({}) },
  { name: "verifyBackup", fn: () => sqlite.admin.verifyBackup({}) },
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

## Phase 9: Multi-Step WASM Workflow

### 9.1 — WASM capability audit pipeline

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
  failures.push(`transactions should have 0 methods, got ${groupSizes.transactions}`);
}

// Step 4: Verify no window methods in stats
const statsHelp = await sqlite.stats.help();
const windowMethods = statsHelp.methods.filter(m => m.startsWith("window"));
if (windowMethods.length > 0) {
  failures.push(`stats should have 0 window methods, got ${windowMethods.length}`);
}

// Step 5: Test a WASM-compatible tool works
const count = await sqlite.core.count({ table: "test_products" });
if (count.count !== 16) failures.push(`expected 16 products, got ${count.count}`);

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
    wasmCompatible: true
  }
};
```

---

## Post-Test Procedures

1. **No cleanup needed**: This prompt does not create any tables (all write operations are expected to fail)
2. **Triage findings**: Create implementation plan if any tool returns raw MCP error instead of structured error
3. **Scope of fixes**: Handler code only — fix WASM error handling paths
4. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
5. **Commit**: Stage and commit — do NOT push
6. **Token audit**: Report most expensive block
7. **Final summary**: After testing/re-testing
