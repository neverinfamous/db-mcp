# db-mcp Help — Statistical Analysis (13 core + 6 window)

Core (always available):
- `sqlite_stats_basic({ table, column })` — count, sum, avg, min, max
- `sqlite_stats_percentile({ table, column, percentiles: [25, 50, 75, 90] })`
- `sqlite_stats_histogram({ table, column, buckets: 10 })`
- `sqlite_stats_regression({ table, xColumn, yColumn, degree? })` — linear (default) or quadratic (`degree: 2`)
- `sqlite_stats_outliers({ table, column, method: "iqr" })` — or `"zscore"`
- `sqlite_stats_top_n({ table, column, n, selectColumns: ["id", "name", "price"] })` — ⚠️ always use `selectColumns`
- `sqlite_stats_hypothesis({ table, column, testType: "ttest_one", expectedMean })` — hypothesis testing
- `sqlite_stats_correlation`, `sqlite_stats_covariance`, `sqlite_stats_frequency`, `sqlite_stats_summary`, `sqlite_stats_z_score`, `sqlite_stats_moving_average`

Window functions (Native only):
- `sqlite_window_row_number({ table, orderBy, partitionBy? })`
- `sqlite_window_rank({ table, orderBy, partitionBy?, rankType: "dense_rank" })`
- `sqlite_window_running_total({ table, valueColumn, orderBy })`
- `sqlite_window_moving_avg({ table, valueColumn, orderBy, windowSize: 7 })`
- `sqlite_window_lead_lag`, `sqlite_window_ntile`
