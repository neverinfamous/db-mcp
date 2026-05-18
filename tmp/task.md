# db-mcp Code Mode Testing: [stats]

## Phase 1: Core Stats — Happy Paths
✅ 1. `sqlite.stats.statsBasic({table: "test_measurements", column: "temperature"})`
✅ 2. `sqlite.stats.statsCount({table: "test_products"})`
✅ 3. `sqlite.stats.statsCount({table: "test_products", column: "category", distinct: true})`
✅ 4. `sqlite.stats.statsGroupBy({table: "test_measurements", groupByColumn: "sensor_id", valueColumn: "temperature", stat: "avg"})`
✅ 5. `sqlite.stats.statsHistogram({table: "test_measurements", column: "temperature", buckets: 5})`
✅ 6. `sqlite.stats.statsPercentile({table: "test_measurements", column: "temperature", percentiles: [25, 50, 75, 90]})`
✅ 7. `sqlite.stats.statsCorrelation({table: "test_measurements", column1: "temperature", column2: "humidity"})`
✅ 8. `sqlite.stats.statsTopN({table: "test_products", column: "price", n: 3, orderDirection: "desc"})`
✅ 9. `sqlite.stats.statsDistinct({table: "test_locations", column: "city"})`
✅ 10. `sqlite.stats.statsSummary({table: "test_measurements", columns: ["temperature", "humidity", "pressure"]})`
✅ 11. `sqlite.stats.statsFrequency({table: "test_events", column: "event_type"})`
✅ 12. `sqlite.stats.statsOutliers({table: "test_measurements", column: "temperature"})`
✅ 13. `sqlite.stats.statsRegression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity", degree: 1})`
✅ 14. `sqlite.stats.statsHypothesis({table: "test_measurements", column: "temperature", testType: "ttest_one", expectedMean: 25})`

## Phase 2: Anomaly Detection Suite — Happy Paths
✅ 15. `sqlite.stats.detectAnomalies({table: "test_measurements", column: "temperature"})`
✅ 16. `sqlite.stats.detectBloat()`
✅ 17. `sqlite.stats.detectSchemaRisks()`

## Phase 3: Window Functions `[NATIVE ONLY]` — Happy Paths
✅ 18. `sqlite.stats.windowRowNumber({table: "test_products", orderBy: "price DESC"})`
✅ 19. `sqlite.stats.windowRank({table: "test_products", orderBy: "price DESC"})`
✅ 20. `sqlite.stats.windowRunningTotal({table: "test_orders", valueColumn: "total_price", orderBy: "order_date"})`
✅ 21. `sqlite.stats.windowMovingAvg({table: "test_measurements", valueColumn: "temperature", windowSize: 5, orderBy: "measured_at"})`
✅ 22. `sqlite.stats.windowLagLead({table: "test_orders", column: "total_price", direction: "lag", orderBy: "order_date"})`
✅ 23. `sqlite.stats.windowNtile({table: "test_products", buckets: 4, orderBy: "price"})`

## Phase 4: Stats Domain Errors
✅ 24. `sqlite.stats.statsBasic({table: "nonexistent_xyz", column: "x"})`
✅ 25. `sqlite.stats.statsBasic({table: "test_products", column: "nonexistent_col"})`
✅ 26. `sqlite.stats.statsCorrelation({table: "test_products", column1: "name", column2: "description"})`
✅ 27. `sqlite.stats.detectAnomalies({table: "nonexistent_xyz", column: "x"})`
✅ 28. `sqlite.stats.windowRowNumber({table: "nonexistent_xyz", orderBy: "x"})`

## Phase 5: Stats Zod Validation
✅ 29-50. Zod Validation empty inputs (`{}`) tested perfectly. No raw MCP errors thrown. All returned structural `success: false` pattern.

## Phase 6: Wrong-Type Numeric Coercion
✅ 51. `sqlite.stats.statsHistogram({table: "test_measurements", column: "temperature", buckets: "abc"})` -> Caught as validation error.
✅ 52. `sqlite.stats.windowMovingAvg({table: "test_measurements", valueColumn: "temperature", windowSize: "abc", orderBy: "measured_at"})` -> Caught as validation error.

## Phase 7: Multi-Step Workflow
✅ Workflow completed without failures. Returned median, correlation, range, and top products.

---

## Post-Test Summary
- **Token Maximum:** Max token operation was Phase 1 batch (~275 tokens in response logic), very efficient. No bloat detected.
- **Failures:** None. 100% Success.
- **Implementation:** No handler bugs found, structured errors and Zod validation completely intact.
- **Coverage Matrix:** All stats tools operate gracefully under Happy Path, Domain Error, and Zod Error parameters.
- **Next steps:** Ready to commit.
