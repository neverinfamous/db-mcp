# db-mcp Code Mode Test Plan

**Step 1:** Read `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file`.

**Step 2:** Conduct an exhaustive test of **Code Mode** (`sqlite_execute_code`) using live MCP tool calls. All tests use the `sqlite_execute_code` tool — never direct tool calls — unless validating a comparison.

## Test Database Schema

See [test-tools.md](./test-tools.md#test-server-schema) for full table details (10 tables, ~400 rows).

> **Note:** When testing `sqlite_execute_code`, do **not** pass `readonly: true` unless specifically testing read-only filtering. The `readonly` flag makes write methods return `{success: false, code: "CODEMODE_READONLY_VIOLATION"}`.

## Structured Error Response Pattern

See [test-tools.md](./test-tools.md#structured-error-response-pattern) — same rules apply. Code Mode errors must return `{success: false, error: "..."}`, never raw MCP errors.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that could be optimized

---

## Phase 1: Sandbox Basics (6 tests)

Verify the sandbox executes code, returns results, and handles errors correctly.

### 1.1 — Simple return value

```javascript
// Expected: {success: true, result: 42}
return 42;
```

### 1.2 — String return

```javascript
return "hello from sandbox";
```

### 1.3 — Object return

```javascript
return { name: "test", values: [1, 2, 3] };
```

### 1.4 — Async/await support

```javascript
const result = await Promise.resolve("async works");
return result;
```

### 1.5 — Runtime error handling

```javascript
// Expected: {success: false, error containing "not defined" or "not a function"}
const x = undefinedVariable;
return x;
```

### 1.6 — Empty code

Call `sqlite_execute_code` with `code: ""`.
Expected: `{success: false}` with validation error, not raw MCP error.

---

## Phase 2: API Discoverability (6 tests)

Verify `help()` and group-level introspection work correctly.

### 2.1 — Top-level help

```javascript
return await sqlite.help();
```

Expected: `{groups: [...], totalMethods: <number>, usage: "..."}` with 9 groups listed.

### 2.2 — Group help (core)

```javascript
return await sqlite.core.help();
```

Expected: `{group: "core", methods: [...], examples: [...]}` with methods including `readQuery`, `writeQuery`, `listTables`, `describeTable`, etc.

### 2.3 — Group help (json)

```javascript
return await sqlite.json.help();
```

Expected: methods include `extract`, `set`, `insert`, `query`, `analyzeSchema`, etc.

### 2.4 — All groups exist

```javascript
const groups = [
  "core",
  "json",
  "text",
  "stats",
  "vector",
  "admin",
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

Expected: All 9 groups return >0 methods.

### 2.5 — Method aliases resolve

```javascript
// Alias "query" should resolve to "readQuery"
const r1 = await sqlite.core.query("SELECT 1 AS num");
const r2 = await sqlite.core.readQuery("SELECT 1 AS num");
return { aliasResult: r1, canonicalResult: r2 };
```

Expected: Both return identical results.

### 2.6 — Top-level convenience aliases

```javascript
// Top-level readQuery, writeQuery, listTables, describeTable should exist
const tables = await sqlite.listTables();
return { success: true, tableCount: tables.tables?.length };
```

---

## Phase 3: Core Group via Code Mode (6 tests)

### 3.1 — Read query

```javascript
return await sqlite.core.readQuery({
  query: "SELECT COUNT(*) as cnt FROM test_products",
});
```

Expected: `{success: true, rows: [{cnt: 16}]}`

### 3.2 — Positional args

```javascript
// Positional: readQuery("SELECT ...") should work
return await sqlite.core.readQuery("SELECT name FROM test_products LIMIT 2");
```

### 3.3 — List tables

```javascript
return await sqlite.core.listTables();
```

### 3.4 — Describe table

```javascript
return await sqlite.core.describeTable("test_products");
```

### 3.5 — Write query (temp table)

```javascript
await sqlite.core.writeQuery(
  "CREATE TABLE temp_cm_test (id INTEGER PRIMARY KEY, value TEXT)",
);
await sqlite.core.writeQuery(
  "INSERT INTO temp_cm_test (value) VALUES ('hello')",
);
const result = await sqlite.core.readQuery("SELECT * FROM temp_cm_test");
return result;
```

### 3.6 — Get indexes

```javascript
return await sqlite.core.getIndexes();
```

---

## Phase 4: JSON Group via Code Mode (5 tests)

### 4.1 — JSON extract

```javascript
return await sqlite.json.extract({
  table: "test_jsonb_docs",
  column: "doc",
  path: "$.title",
});
```

### 4.2 — JSON query with filter

```javascript
return await sqlite.json.query({
  table: "test_jsonb_docs",
  column: "doc",
  filterPaths: { "$.type": "article" },
});
```

### 4.3 — JSON analyze schema

```javascript
return await sqlite.json.analyzeSchema({
  table: "test_jsonb_docs",
  column: "doc",
});
```

### 4.4 — JSON valid

```javascript
return await sqlite.json.valid({ json: '{"key": "value"}' });
```

### 4.5 — JSON pretty

```javascript
return await sqlite.json.pretty({ json: '{"a":1,"b":2}' });
```

---

## Phase 5: Stats Group via Code Mode (4 tests)

### 5.1 — Basic stats

```javascript
return await sqlite.stats.statsBasic({
  table: "test_measurements",
  column: "temperature",
});
```

### 5.2 — Histogram

```javascript
return await sqlite.stats.statsHistogram({
  table: "test_measurements",
  column: "temperature",
  buckets: 5,
});
```

### 5.3 — Correlation

```javascript
return await sqlite.stats.statsCorrelation({
  table: "test_measurements",
  column1: "temperature",
  column2: "humidity",
});
```

### 5.4 — Top N

```javascript
return await sqlite.stats.statsTopN({
  table: "test_products",
  column: "price",
  n: 5,
});
```

---

## Phase 6: Text Group via Code Mode (3 tests)

### 6.1 — Regex match

```javascript
return await sqlite.text.regexMatch({
  table: "test_users",
  column: "email",
  pattern: "@example\\.com$",
});
```

### 6.2 — Fuzzy match

```javascript
return await sqlite.text.fuzzyMatch({
  table: "test_products",
  column: "name",
  search: "laptop",
  maxDistance: 2,
});
```

### 6.3 — Text case

```javascript
return await sqlite.text.case({
  table: "test_products",
  column: "name",
  mode: "upper",
  limit: 3,
});
```

---

## Phase 7: Vector Group via Code Mode (4 tests)

### 7.1 — Vector search

```javascript
// Use first embedding from test_embeddings as query vector
const first = await sqlite.core.readQuery(
  "SELECT embedding FROM test_embeddings LIMIT 1",
);
const vec = JSON.parse(first.rows[0].embedding);
return await sqlite.vector.search({
  table: "test_embeddings",
  vectorColumn: "embedding",
  queryVector: vec,
  limit: 3,
});
```

### 7.2 — Vector stats

```javascript
return await sqlite.vector.stats({
  table: "test_embeddings",
  vectorColumn: "embedding",
});
```

### 7.3 — Vector count

```javascript
return await sqlite.vector.count({ table: "test_embeddings" });
```

### 7.4 — Vector dimensions

```javascript
return await sqlite.vector.dimensions({
  table: "test_embeddings",
  vectorColumn: "embedding",
});
```

---

## Phase 8: Geo, Introspection, Migration via Code Mode (5 tests)

### 8.1 — Geo distance

```javascript
return await sqlite.geo.distance({
  lat1: 40.7128,
  lon1: -74.006,
  lat2: 34.0522,
  lon2: -118.2437,
});
```

### 8.2 — Geo nearby

```javascript
return await sqlite.geo.nearby({
  table: "test_locations",
  latColumn: "latitude",
  lonColumn: "longitude",
  centerLat: 40.7,
  centerLon: -74.0,
  radius: 1000,
});
```

### 8.3 — Introspection — dependency graph

```javascript
return await sqlite.introspection.dependencyGraph();
```

### 8.4 — Introspection — schema snapshot

```javascript
return await sqlite.introspection.schemaSnapshot({ sections: ["tables"] });
```

### 8.5 — Migration — init + status

```javascript
await sqlite.migration.migrationInit();
return await sqlite.migration.migrationStatus();
```

---

## Phase 9: Admin Group via Code Mode (4 tests)

### 9.1 — Integrity check

```javascript
return await sqlite.admin.integrityCheck({ maxErrors: 5 });
```

### 9.2 — Pragma settings

```javascript
return await sqlite.admin.pragmaSettings({ pragma: "journal_mode" });
```

### 9.3 — List views

```javascript
return await sqlite.admin.listViews();
```

### 9.4 — DBSTAT

```javascript
return await sqlite.admin.dbstat({ table: "test_products" });
```

---

## Phase 10: Readonly Mode (5 tests)

All tests use `readonly: true`.

### 10.1 — Read operations work in readonly

```javascript
// readonly: true
return await sqlite.core.readQuery("SELECT COUNT(*) as cnt FROM test_products");
```

Expected: `{success: true, rows: [{cnt: 16}]}`

### 10.2 — Write operations blocked in readonly

```javascript
// readonly: true
return await sqlite.core.writeQuery(
  "INSERT INTO test_products (name) VALUES ('blocked')",
);
```

Expected: `{success: false, code: "CODEMODE_READONLY_VIOLATION"}`

### 10.3 — Read methods still discoverable

```javascript
// readonly: true
const help = await sqlite.core.help();
return {
  hasWriteQuery: help.methods.includes("writeQuery"),
  methods: help.methods,
};
```

Expected: `writeQuery` still appears in help (for discoverability) but is guarded.

### 10.4 — Create table blocked

```javascript
// readonly: true
return await sqlite.core.writeQuery(
  "CREATE TABLE temp_readonly_test (id INTEGER)",
);
```

Expected: `{success: false, code: "CODEMODE_READONLY_VIOLATION"}`

### 10.5 — Stats read-only works

```javascript
// readonly: true
return await sqlite.stats.statsBasic({
  table: "test_products",
  column: "price",
});
```

Expected: succeeds — stats tools are read-only.

---

## Phase 11: Security & Error Handling (6 tests)

### 11.1 — Blocked pattern (require)

```javascript
const fs = require("fs");
return fs.readFileSync("/etc/passwd");
```

Expected: `{success: false, code: "CODEMODE_VALIDATION_FAILED"}` with suggestion about blocked patterns.

### 11.2 — Blocked pattern (process)

```javascript
return process.env;
```

Expected: `{success: false}` — blocked pattern or runtime error.

### 11.3 — Blocked pattern (eval)

```javascript
return eval("1+1");
```

Expected: `{success: false, code: "CODEMODE_VALIDATION_FAILED"}`

### 11.4 — Timeout enforcement

```javascript
// timeout: 2000
while (true) {}
```

Call with `timeout: 2000`. Expected: `{success: false}` with timeout error within ~2s.

### 11.5 — Invalid tool call via API

```javascript
return await sqlite.core.readQuery({ query: "SELECT * FROM nonexistent_xyz" });
```

Expected: Tool returns `{success: false, error: "..."}` — the sandbox must not crash.

### 11.6 — Empty params to execute_code

Call `sqlite_execute_code` with `{}` (no `code` param). Expected: structured handler error, not raw MCP `-32602`.

---

## Phase 12: Multi-Step Workflows (4 tests)

### 12.1 — ETL pipeline

```javascript
// Create, populate, transform, read
await sqlite.core.writeQuery(
  "CREATE TABLE temp_cm_etl (id INTEGER PRIMARY KEY, raw TEXT, processed TEXT)",
);
for (let i = 1; i <= 5; i++) {
  await sqlite.core.writeQuery({
    query: `INSERT INTO temp_cm_etl (raw) VALUES ('item_${i}')`,
  });
}
// Transform
await sqlite.core.writeQuery("UPDATE temp_cm_etl SET processed = UPPER(raw)");
return await sqlite.core.readQuery("SELECT * FROM temp_cm_etl");
```

### 12.2 — Cross-group analysis

```javascript
// Use stats + json together
const stats = await sqlite.stats.statsBasic({
  table: "test_products",
  column: "price",
});
const top = await sqlite.stats.statsTopN({
  table: "test_products",
  column: "price",
  n: 3,
});
return { priceStats: stats, topProducts: top };
```

### 12.3 — Schema introspection + query

```javascript
// Discover tables, pick first, describe it, query it
const tables = await sqlite.core.listTables();
const first = tables.tables[0].name;
const schema = await sqlite.core.describeTable(first);
const sample = await sqlite.core.readQuery({
  query: `SELECT * FROM ${first} LIMIT 3`,
});
return {
  table: first,
  columnCount: schema.columns?.length,
  sampleRows: sample.rows?.length,
};
```

### 12.4 — Loop with accumulator

```javascript
const tables = await sqlite.core.listTables();
const counts = {};
for (const t of tables.tables.slice(0, 5)) {
  const r = await sqlite.stats.statsCount({ table: t.name });
  counts[t.name] = r.count;
}
return counts;
```

---

## Cleanup

After all phases:

```javascript
await sqlite.core.writeQuery("DROP TABLE IF EXISTS temp_cm_test");
await sqlite.core.writeQuery("DROP TABLE IF EXISTS temp_cm_etl");
```

---

## Post-Test Procedures

See [test-tools.md](./test-tools.md#post-test-procedures) — same workflow: Attempt to remove all `temp_*` tables. If DROP fails due to a database lock, note the leftover tables and move on — they are inert and will be cleaned up on next database regeneration, triage findings, create implementation plan if needed, validate with lint + typecheck, commit without push, live re-test and provide final summary.
