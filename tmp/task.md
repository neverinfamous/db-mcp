# WASM JSON Tools Advanced Stress Testing (stats)

**Task:** Execute the `test-tools-advanced-stats.md` certification pass in WASM mode.

## Results & Findings

### Category 1: Boundary Values & Empty States
- **1.1 Empty Table Statistics:** ✅ Graceful handling of empty state (`count: 0`, `min/max: 0/null` or empty `buckets: []`). No crashes.
- **1.2 Single-Row Statistics:** ✅ All tools correctly process $n=1$, including `statsRegression` gracefully failing with `Insufficient data ... (need at least 2 points, got 1)`.
- **1.3 NULL-Heavy Data:** ✅ Correctly excludes NULL values and counts `count: 2`.
- **1.4 Extreme Numeric Values:** ✅ Safely calculates aggregates over `+/-99999999.99`.

### Category 2: Statistical Edge Cases
- **2.1 Self-Correlation:** ✅ Computed self-correlation (id vs id) = `1.0`.
- **2.2 Hypothesis:** ✅ Executed `ttest_one` on measurements returning extremely low `pValue` with `significant: true` for expected mean of 999.
- **2.3 Outliers (IQR & Z-score):** ✅ Successfully computed bounds and found 0 outliers in `test_measurements`.
- **2.4 Regression (Degree 2):** ✅ Calculated polynomial regression coefficients (`quadratic`, `linear`, `intercept`) safely.

### Category 3: Anomaly Detection Stress
- **3.1 detectAnomalies (mixed data):** ✅ Graceful output `riskLevel: low`, correctly handled.
- **3.2 detectBloat:** ✅ Completed with summary: `No high-risk bloat detected across 0 tables` (WASM fallback correctly runs without crashing but only reads available generic counts).
- **3.3 detectSchemaRisks:** ✅ Executed successfully.

### Category 4: Window Functions
- **Skipped** as per `[NATIVE ONLY]` directives.

### Category 5: Error Message Quality
- **5.1 Invalid Table:** ✅ `Table 'nonexistent_table_xyz' does not exist`
- **5.2 Invalid Column:** ✅ `Column 'nonexistent_col' not found in table 'test_products'`
- **5.3 Non-numeric column correlation:** ✅ `Column 'name' in table 'test_products' is not numeric (type: text). Correlation requires numeric columns.`
- **5.4 Invalid Buckets (< 1):** ✅ `'buckets' must be at least 1 for table 'test_products'`

### Category 6: WASM Boundary Verification
- **6.1 Tool Exposure:** ✅ Confirmed via `sqlite.stats.help()` that all window function tools (`windowRowNumber`, `windowRank`, `windowLagLead`, `windowRunningTotal`, `windowMovingAvg`, `windowNtile`) are strictly omitted in WASM environments.
- **6.2 Parity:** ✅ 16 generic stats tools are fully functionally aligned with the established output schemas.

## Remediation & Actions Taken
- Created test table using Code Mode with the `sqlite.migration.migrationApply` tool because `CREATE TABLE` and other DML statements are restricted from `sqlite.core.writeQuery` for safety.
- Tracked metrics and cleaned up the `stress_stats_table`.
- Zero factual errors or syntax bugs discovered in the prompt documentation!

**Token Audit:** 
- The most expensive payload block was Category 1 (Boundary tests) at **~727** token estimate.

## Next Steps
All test procedures successfully completed. Awaiting user verification/Vitest execution.
