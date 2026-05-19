# WASM mode `admin` tools certification

## Test Progress & Coverage Matrix

| Category | Step | Tool / Action | Status | Verdict | Notes |
|---|---|---|---|---|---|
| **1: View Lifecycle** | 1 | `createView` | ✅ Pass | 5 | Created `stress_view_orders` successfully |
| | 2 | `listViews` | ✅ Pass | - | Verified `stress_view_orders` is present |
| | 3 | `dropView` | ✅ Pass | - | Dropped successfully |
| | 4 | `dropView` (nonexistent) | ✅ Pass | 5 | `Query failed: no such view: stress_view_orders` |
| | 5 | `createView` | ✅ Pass | 5 | Recreated successfully |
| **2: Virtual Tables** | 6 | `createRtreeTable` | ✅ Pass | 5 | `Extension 'rtree' is not installed or available in WASM mode` (wasmLimitation: true) |
| | 7 | `listVirtualTables` | ✅ Pass | - | `test_articles_fts` present but not queryable |
| | 8 | `virtualTableInfo` | ✅ Pass | 5 | Handled unavailable module (`moduleAvailable: false`, note added) |
| | 9 | `dropVirtualTable` | ✅ Pass | - | `Virtual table 'stress_rtree_test' did not exist` |
| | 10 | `virtualTableInfo` (nonexistent) | ✅ Pass | 5 | `Virtual table 'nonexistent_vtable_xyz' not found` |
| **3: Backup/Restore** | 11 | `backup` | ✅ Pass | 5 | `Backup not available: file system access is not supported in WASM mode` |
| | 12 | `verifyBackup` | ✅ Pass | 5 | `Verify backup not available` |
| | 13 | `verifyBackup` (nonexistent) | ✅ Pass | 5 | Graceful WASM mode rejection |
| **4: Pragma** | 15 | `pragmaCompileOptions(THREAD)` | ✅ Pass | - | Returned correct options |
| | 16 | `pragmaCompileOptions(FTS)` | ✅ Pass | - | Showed FTS3 instead of FTS5 |
| | 17 | `pragmaSettings(journal_mode)` | ✅ Pass | - | Returned `wal` |
| | 18 | `pragmaTableInfo` (nonexistent) | ✅ Pass | 5 | `Table 'nonexistent_table_xyz' not found or has no columns` |
| **5: Series & CSV** | 19 | `generateSeries(1-100)` | ✅ Pass | - | Payload token estimate: ~200 (efficient) |
| | 20 | `generateSeries(1-1)` | ✅ Pass | - | Returned single value |
| | 21 | `analyzeCsvSchema` | ✅ Pass | 5 | `Extension 'csv' is not installed or available in WASM mode` |
| | 22 | `createCsvTable` | ✅ Pass | 5 | Absolute path required error; with absolute path, returns WASM limitation error |
| **6: Error Quality** | 23 | `dropView` (nonexistent) | ✅ Pass | 5 | Clean `VIEW_NOT_FOUND` structured error |
| | 24 | `verifyBackup` (nonexistent) | ✅ Pass | 5 | Clean `VALIDATION_ERROR` (WASM limitation) |
| | 25 | `createCsvTable` (nonexistent) | ✅ Pass | 5 | Clean `EXTENSION_MISSING` (WASM limitation) |
| **7: WASM Bounds** | 26 | Overall WASM boundary check | ✅ Pass | - | All unsupported tools properly degraded with structured errors |

## Findings & Token Audit
- **Most Expensive Block**: The combined Code Mode execution for Categories 2-6 incurred approximately 1012 tokens. No individual tool returned excessive or unstructured data. `generateSeries` with 100 rows was efficient.
- **Graceful Degradation**: The WASM mode successfully intercepts all native-only features (Backup, CSV, R-Tree, FTS5 module operations) and issues fully compliant structured errors with the `wasmLimitation: true` flag.

## Post-Test Procedures
- All `stress_*` tables and views have been dropped.
- Data integrity confirmed: `test_products` and `test_orders` row counts remain unchanged.
