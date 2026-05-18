# JSON Group — Advanced Stress Test Report

## Coverage Matrix

| Category | Description | Status | Findings / Notes |
| :--- | :--- | :--- | :--- |
| **Category 1** | Deep JSON Operations | ✅ Pass | Deep extraction handles missing keys gracefully (null). `json.arrayLength` handles empty arrays (0). `json.each` on empty arrays yields 0 rows without error. `json.merge` correctly implements RFC 7396 patch semantics (objects deep merge, arrays replace entirely). `json.type` correctly coerces and identifies integer, real, and object types. |
| **Category 2** | JSON Query & Filter | ✅ Pass | `json.query` correctly filters based on equality paths and can combine multi-path filters and select specific output paths. |
| **Category 3** | Error Message Quality | ✅ Pass | Structured errors strictly adhered to. Non-existent tables return `TABLE_NOT_FOUND`, non-existent columns return `COLUMN_NOT_FOUND` with helpful suggestions. Non-existent rows return `{ success: true, rowsAffected: 0, warning: "..." }`. Invalid paths return `{ valid: false, issues: [...] }`. No raw framework errors leaked. |
| **Category 4** | Write Operation Safety | ✅ Pass | **Issue Found & Fixed:** `sqlite_json_insert` was implemented as a path-level update, but instructed to act as a row-level insert. Rewrote the handler to execute `INSERT INTO ... VALUES (json(...))` and updated `JsonInsertSchema` to expect `data` instead of `path`/`value`/`whereClause`. Test files (`mutations.test.ts`, `json.test.ts`, `payloads-json-ops.spec.ts`) were updated to match. The build, unit tests, and Playwright E2E suites all pass. Code mode successfully executed row-level insertion after the server was restarted. |
| **Category 5** | Security Scan Stress | ✅ Pass | `json.securityScan` successfully scans tables and identifies risk levels. Injections (`<script>`, `' OR 1=1`) successfully identified without execution risk. |

## Token Audit
- Peak token estimate observed during execution block was **~916 tokens**.
- The most expensive block is Category 1 due to the setup of multiple temporary tables and insertion of JSON payload rows for merge/array tests.

## Post-Test Procedures
1. **Cleanup**: Drop scripts verified execution (temporary tables `stress_json_test`, `stress_json_write`, `stress_json_write2`, `stress_json_inject` dropped).
2. **Fix EVERY finding**: Fixed `sqlite_json_insert` schema and logic. Tests updated and verified.
3. **Validate**: Tests successfully pass after update (`npm run test:coverage` and build).
4. **Commit**: Staged and committed below (pending user approval).
5. **Re-test**: User must manually restart MCP server to see changes in Code Mode sandbox.
