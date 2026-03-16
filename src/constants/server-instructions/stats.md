# db-mcp Help — Statistical Analysis (13 core + 6 window)

Core (always available):
- `sqlite_stats_basic({ table, column })` — count, sum, avg, min, max
- `sqlite_stats_count({ table, column?, distinct? })` — count rows, optionally distinct values
- `sqlite_stats_group_by({ table, column, groupBy })` — aggregate statistics grouped by column
- `sqlite_stats_percentile({ table, column, percentiles: [25, 50, 75, 90] })`
- `sqlite_stats_histogram({ table, column, buckets: 10 })`
- `sqlite_stats_correlation({ table, column1, column2 })` — Pearson correlation coefficient
- `sqlite_stats_top_n({ table, column, n, selectColumns: ["id", "name", "price"] })` — ⚠️ always use `selectColumns`
- `sqlite_stats_distinct({ table, column })` — distinct values
- `sqlite_stats_summary({ table, columns })` — summary stats for multiple columns at once
- `sqlite_stats_frequency({ table, column })` — frequency distribution
- `sqlite_stats_outliers({ table, column, method: "iqr" })` — or `"zscore"`. Use `maxOutliers` to limit payload
- `sqlite_stats_regression({ table, xColumn, yColumn, degree? })` — linear (default) or quadratic (`degree: 2`)
- `sqlite_stats_hypothesis({ table, column, testType: "ttest_one", expectedMean })` — hypothesis testing

Window functions (Native only):
- `sqlite_window_row_number({ table, orderBy, partitionBy? })`
- `sqlite_window_rank({ table, orderBy, partitionBy?, rankType: "dense_rank" })`
- `sqlite_window_lag_lead({ table, orderBy, column, partitionBy? })` — access previous/next row values
- `sqlite_window_running_total({ table, valueColumn, orderBy })`
- `sqlite_window_moving_avg({ table, valueColumn, orderBy, windowSize: 7 })`
- `sqlite_window_ntile({ table, orderBy, buckets, partitionBy? })` — divide rows into N buckets
