# db-mcp Tool Group Testing: [geo-spatialite]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there is nothing to fix, don't update UNRELEASED.md.
> We're currently testing Native mode.

## WASM Mode

> When testing against a **WASM backend** (`sqlite-wasm` / sql.js), apply these adjustments:
>
> - **Skip SpatiaLite tools** (items 1-7: `sqlite_spatialite_load`, `sqlite_spatialite_create_table`, `sqlite_spatialite_query`, `sqlite_spatialite_analyze`, `sqlite_spatialite_index`, `sqlite_spatialite_transform`, `sqlite_spatialite_import`) — `[NATIVE ONLY]`. These tools are not registered in WASM.
> - **Skip all checklist items** — all require SpatiaLite.
> - **Skip all Zod items** (SpatiaLite tools) — `[NATIVE ONLY]`.

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\db-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Please conduct an exhaustive test of the **geo-spatialite** tool group specified in the group-specific checklist below using live MCP server tool calls directly — not scripts/terminal.

**Step 3:** The agent should update C:\Users\chris\Desktop\db-mcp\UNRELEASED.md with any/all changes/fixes.

**Note** If temp tables are present from a previous test pass, it's because the database is locked. Ignore them.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

## Testing Requirements

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, `isError: true`, no `success` field) is a **bug that must be reported and fixed**.

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
4. **Output schema testing**: For tools with `outputSchema`, confirm valid calls return structured JSON.

## Structured Error Response Pattern

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type                 | Source                                                             | What you see                                                | Verdict            |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields     | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, `isError: true` — no `success` field | Bug — report as ❌ |

### Zod Validation Errors

**Zod refinement leak pattern:** `.partial()` does NOT strip `.min(N)` / `.max(N)` refinements. **Fix:** Remove refinements from schema, validate inside handler.

### Output Schema Validation Errors

If valid inputs return raw MCP `-32602` mentioning "output schema", report as ❌.

---

## Group Focus: geo-spatialite

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

### geo-spatialite Group Tools (7)

1. sqlite_spatialite_load `[NATIVE ONLY]`
2. sqlite_spatialite_create_table `[NATIVE ONLY]`
3. sqlite_spatialite_query `[NATIVE ONLY]`
4. sqlite_spatialite_analyze `[NATIVE ONLY]`
5. sqlite_spatialite_index `[NATIVE ONLY]`
6. sqlite_spatialite_transform `[NATIVE ONLY]`
7. sqlite_spatialite_import `[NATIVE ONLY]`

**Checklist:**

**SpatiaLite tools `[NATIVE ONLY]`:**

1. `sqlite_spatialite_load` → load SpatiaLite extension, verify version
2. `sqlite_spatialite_create_table({tableName: "temp_spatial_test", geometryColumn: "geom", geometryType: "POINT", srid: 4326, additionalColumns: [{name: "name", type: "TEXT"}]})` → success
3. `sqlite_spatialite_import({tableName: "temp_spatial_test", format: "wkt", data: "POINT(-73.9654 40.7829)", additionalData: {name: "Test Point"}})` → success
4. `sqlite_spatialite_query({query: "SELECT name, AsText(geom) as geom_text FROM temp_spatial_test"})` → WKT geometry returned
5. `sqlite_spatialite_transform({operation: "buffer", geometry1: "POINT(-73.9654 40.7829)", distance: 0.01, srid: 4326})` → buffered polygon
6. `sqlite_spatialite_index({tableName: "temp_spatial_test", geometryColumn: "geom", action: "create"})` → R-Tree index created
7. `sqlite_spatialite_analyze({analysisType: "spatial_extent", sourceTable: "temp_spatial_test", geometryColumn: "geom"})` → spatial extent
8. Cleanup: drop R-Tree index (`sqlite_spatialite_index` with `action: "drop"`), then drop `temp_spatial_test`

**Error path testing:**

🔴 9. `sqlite_spatialite_query({query: "SELECT name FROM nonexistent_table_xyz"})` `[NATIVE ONLY]` → structured error

**Zod validation sweep** — call each tool with `{}` (empty params). Must return handler error, NOT raw MCP error:

🔴 10. `sqlite_spatialite_create_table({})` `[NATIVE ONLY]` → handler error
🔴 11. `sqlite_spatialite_query({})` `[NATIVE ONLY]` → handler error
🔴 12. `sqlite_spatialite_analyze({})` `[NATIVE ONLY]` → handler error
🔴 13. `sqlite_spatialite_index({})` `[NATIVE ONLY]` → handler error
🔴 14. `sqlite_spatialite_transform({})` `[NATIVE ONLY]` → handler error
🔴 15. `sqlite_spatialite_import({})` `[NATIVE ONLY]` → handler error

---

## Post-Test Procedures

1. **Triage findings**: Create implementation plan if issues found
2. **Scope of fixes**: Handler code, server-instructions, test database, this prompt
3. **Validate**: Instruct the user to run the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself.
4. **Commit**: Stage and commit — do NOT push
5. **Live re-test**: After server rebuild
6. **Final summary**: After testing/re-testing
