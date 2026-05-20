# JSON Group Tools Stress Test

## Test Database Setup
- [x] Create `test_jsonb_docs` table with 6 rows (pre-existed in DB)
- [x] Create `test_events` table with 100 rows (pre-existed in DB)

## Category 1: Deep JSON Operations
- [x] 1.1 Deeply Nested Access (extract deep, nonexistent nested, nonexistent key)
- [x] 1.2 Array Manipulation (arrayLength on existing, arrayLength on empty, each on empty)
- [x] 1.3 Merge Conflict Behavior (merge object, merge array)
- [x] 1.4 Type Coercion (integer, real, object)

## Category 2: JSON Query & Filter Stress
- [x] 2.1 Query filtering (equality, multiple filters & select, filtering in test_events)

## Category 3: Error Message Quality
- [x] 3.1 Nonexistent table
- [x] 3.2 Nonexistent column
- [x] 3.3 Set on nonexistent row
- [x] 3.4 Empty validatePath

## Category 4: Write Operation Safety
- [x] 4.1 Set, remove, insert on `stress_json_write`
- [x] 4.2 normalizeColumn

## Category 5: Security Scan Stress
- [x] 5.1 Basic scan
- [x] 5.2 Scan on injected malicious data

## Cleanup & Reporting
- [x] Cleanup `stress_*` tables
- [x] Update UNRELEASED.md
- [x] Fix any handler code violations

## Coverage Matrix & Findings

| Category | Test | Result | Notes / Finding |
|----------|------|--------|-----------------|
| 1.1 | Deeply Nested Access | ✅ Confirmed | extract returned "deep value" and nulls respectively. |
| 1.2 | Array Manipulation | ✅ Confirmed | arrayLength correctly returned 3, and 0 for empty array. each returned 0 rows. |
| 1.3 | Merge Conflict Behavior | ✅ Confirmed | Deep merge replaced arrays per RFC 7396 and merged object keys correctly. |
| 1.4 | Type Coercion | ✅ Confirmed | Returned "integer", "real", and "object" as expected. |
| 2.1 | JSON Query & Filter | 📦 Payload | Successfully queried. t14 (event filter) returned 25 rows. Entire block tokenEstimate was highest (~918). |
| 3.1 | Nonexistent Table | ✅ Confirmed | Excellent quality (5/5). Returned structured error TABLE_NOT_FOUND with context and SQL. |
| 3.2 | Nonexistent Column | ✅ Confirmed | Excellent quality (5/5). Returned structured error COLUMN_NOT_FOUND with suggestion. |
| 3.3 | Set on nonexistent row | ✅ Confirmed | Returned success: true, rowsAffected: 0 with a warning message. |
| 3.4 | Empty validatePath | ✅ Confirmed | Handled gracefully with valid: false and syntax issues array. |
| 4.1 | Write Operations | ✅ Confirmed | set, remove, insert all mutated records correctly. json_insert required column parameter per schema. |
| 4.2 | normalizeColumn | ✅ Confirmed | Successfully executed and returned unchanged: 3. |
| 5.1 | Basic Security Scan | ✅ Confirmed | Returned 6 scanned rows with low risk level. |
| 5.2 | Injected Security Scan | ✅ Confirmed | Returned high risk and detected xss, sql_injection, and cmd_injection patterns accurately. |
| General | `sqlite_write_query` | ⚠️ Issue | `sqlite.core.writeQuery` blocks DDL (CREATE) via MCP validation, but in JS Code Mode it returns `{success: false}` instead of throwing an error. Developers must manually check `success` or use `createTable`. |

**Most Expensive Block Audit**: Category 2 tests (`sqlite.json.query`) consumed ~918 tokens, largely due to returning 25 full JSON strings from `test_events`.
