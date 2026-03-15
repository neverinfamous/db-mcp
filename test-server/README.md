# db-mcp Test Database — Agent Testing Instructions

> **This README is optimized for AI agent consumption.** It serves as the primary orchestration document for running manual MCP functionality tests against the local SQLite database.

## Files

| File | Size | Purpose | When to Read |
|------|------|---------|--------------|
| `test-tools.md` | ~12KB | **Entry-point protocol** — schema reference, error pattern docs, reporting format, cleanup rules. Paste a group checklist from `test-group-tools.md` at the bottom. | Always read first (Step 1 says read help resources, Step 2 is the testing) |
| `test-group-tools.md` | ~54KB | Per-group **deterministic checklists** (core, json, text, stats, vector, admin, geo, introspection, migration). Copy the relevant section into `test-tools.md`. | When running a specific tool group |
| `test-tools-advanced-1.md` | ~28KB | **Second-pass stress tests (Part 1)** — boundary values, state pollution, error message quality, WASM parity. | After basic checklist passes |
| `test-tools-advanced-2.md` | ~32KB | **Second-pass stress tests (Part 2)** — cross-group integration. Self-contained. | After basic checklist passes |
| `test-resources.md` | ~6KB | Resource testing plan (8 data + 7 help resources via `read_resource`) | When testing resources |
| `test-preflight.md` | ~2KB | **Pre-flight check** — validates slim instructions, help resources, data resources, and tool-filter alignment in 5 steps | Before any test pass |
| `test-agent-experience.md` | ~9KB | **Agent experience test** — 29 open-ended scenarios across 7 passes validating help resource sufficiency | After help resource changes |
| `test-prompts.md` | ~10KB | Prompt testing plan (10 prompts, tested manually since agents typically don't invoke prompts) | When testing prompts |
| `tool-groups-list.md` | — | **Canonical tool inventory** — all 9 groups + codemode, 139 Native / 115 WASM tools. Source of truth for tool counts. | Reference / auditing |
| `tool-reference.md` | ~18KB | **Complete Tool Reference** — Detailed list of all 139 Native / 115 WASM tools organized by group. | Reference |
| [`code-map.md`](code-map.md) | ~12KB | **Source Code Map** — Directory tree, handler→tool mapping, type/schema locations, error hierarchy, constants, architecture patterns. | When debugging source code or making changes |
| `reset-database.ps1` | ~11KB | PowerShell script to delete + re-seed `test.db` from `test-database.sql`. Verifies row counts. | After migration group testing or if data is polluted |
| `test-database.sql` | ~21KB | Seed SQL (DDL + DML) for all `test_*` tables | Reference only — reset script consumes this |
| `sample.csv` | <1KB | CSV fixture for `sqlite_create_csv_table` / `sqlite_analyze_csv_schema` testing | Used by admin group checklist |

## Test Database Schema

| Table | Rows | Notable Columns |
|-------|------|-----------------|
| `test_products` | 16 | price (REAL), category (TEXT, lowercase). Row 16: `Café Décor Light` (accented) |
| `test_orders` | 20 | product_id FK → test_products, status (TEXT) |
| `test_jsonb_docs` | 6 | **doc** (JSON), **metadata** (nested JSON), **tags** (JSON array). Row 4: `$.nested.level1.level2 = "deep value"` |
| `test_articles` | 8 | FTS5 searchable: SQLite, database, JSON, FTS, vector, API, search, MCP |
| `test_users` | 9 | email, phone (`+1-555-...` format), bio. 1 NULL phone. |
| `test_measurements` | 200 | sensor_id (INTEGER 1-5), temperature, humidity, pressure |
| `test_embeddings` | 20 | 8-dim float vectors. Categories: tech, database, food, fitness, travel |
| `test_locations` | 15 | latitude/longitude. Cities: NYC(3), Paris(3), London(3), Tokyo(2), Sydney(2), SF(2) |
| `test_categories` | 17 | Hierarchical: name, path, level |
| `test_events` | 100 | **payload** (JSON), event_type, user_id (INT, 8 values) |

**Key FK:** `test_orders.product_id → test_products.id`
**Redundant index (intentional):** `idx_orders_status` is a prefix of `idx_orders_status_date` — used to test index audit tools.

## Conventions

| Convention | Rule |
|------------|------|
| **Temp tables (basic tests)** | `temp_*` prefix → drop after testing |
| **Temp tables (stress tests)** | `stress_*` prefix → drop after testing |
| **String values** | Lowercase (`'electronics'`, not `'Electronics'`) |
| **sensor_id** | INTEGER (use `= 1`, not `= 'S001'`) |
| **Reporting** | ❌ Fail, ⚠️ Issue, 📦 Payload concern. ✅ inline only, omit from final summary. |
| **Error testing** | Every tool: test (a) domain error + (b) Zod error (`{}`). Must return `{success: false, error: "..."}`, NOT raw MCP error. |
| **Error item prefix** | All error-path checklist items use 🔴 prefix to distinguish from happy-path items |
| **Code mode** | Don't pass `readonly: true` unless specifically testing read-only filtering |
| **Post-test** | Clean up temps → plan fixes → implement → lint+typecheck → changelog → commit (no push) → re-test fixes |
| **Database reset** | Run `.\reset-database.ps1` after migration testing or data pollution |

## WASM Parity Protocol

To validate WASM mode produces identical results for shared tools:

1. **Configure for WASM**: Set `--sqlite` (not `--sqlite-native`) in your MCP client config
2. **Expected tool count**: 115 WASM vs 139 Native (24 fewer: 4 FTS5, 6 window, 7 transaction, 7 SpatiaLite)
3. **Run the same checklists**: Use `test-group-tools.md` but skip items marked `[NATIVE ONLY]`
4. **Verify shared tools**: All non-`[NATIVE ONLY]` items should produce identical output in both backends
5. **Verify absent tools**: Calling a Native-only tool in WASM mode should return a structured error (not crash)
6. **Key groups to verify**: text (FTS5 absent), stats (window functions absent), admin (transactions absent), geo (SpatiaLite absent)

## Integration Test Scripts

These scripts test features that require separate server processes — they **cannot** be run via MCP tool calls. All scripts are Node.js (`.mjs`), require no dependencies beyond Node.js, and exit with code 0 on success.

> [!IMPORTANT]
> Always `npm run build` before running these scripts — they execute `dist/cli.js` directly.

### Script Reference

| Script                        | Tests                                                          | Transport | Duration |
| ----------------------------- | -------------------------------------------------------------- | --------- | -------- |
| `test-help-resources.mjs`     | Slim instructions + `sqlite://help` resource filtering by group | stdio     | ~15s     |
| `test-tool-annotations.mjs`   | `tools/list` openWorldHint annotation presence and consistency  | stdio     | ~5s      |

### Quick Run

```powershell
cd C:\Users\chris\Desktop\db-mcp
npm run build

# Help resources
node test-server/test-help-resources.mjs

# Tool annotations
node test-server/test-tool-annotations.mjs
```

### Success Criteria

#### Help Resources
- [ ] Instructions under 1000 chars (~680)
- [ ] `sqlite://help` always registered
- [ ] Group-specific help only for enabled groups
- [ ] No old content leaked into slim instructions

#### Tool Annotations
- [ ] All tools have `annotations` object with `openWorldHint` set
- [ ] All `openWorldHint` values are `false` (db-mcp tools are local-only)
- [ ] 0 missing annotations

## Agent Workflow

1. Read `sqlite://help` resource (or `view_file` on `src/constants/server-instructions/gotchas.md`).
2. Read `test-tools.md` for protocol and schema details.
3. Access `test-group-tools.md` and copy the target group checklist.
4. Execute via direct MCP tool calls to test logic. Run both happy-path and error-path tests.
5. Clean up any temporary tables generated during execution.
6. Report findings using the designated reporting convention.
7. (Optional) Run stress tests from `test-tools-advanced-1.md` or `test-tools-advanced-2.md`.

