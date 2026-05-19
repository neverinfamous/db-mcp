# db-mcp (SQLite) Tool Group Testing: [stats]

## Test Progress

### Built-in Tools
- [x] 1. server_info
- [x] 2. server_health
- [x] 3. list_adapters

### stats Group Tools (Native)
- [x] 4. sqlite_stats_basic
- [x] 5. sqlite_stats_count
- [x] 6. sqlite_stats_group_by
- [x] 7. sqlite_stats_histogram
- [x] 8. sqlite_stats_percentile
- [x] 9. sqlite_stats_correlation
- [x] 10. sqlite_stats_top_n
- [x] 11. sqlite_stats_distinct
- [x] 12. sqlite_stats_summary
- [x] 13. sqlite_stats_frequency
- [x] 14. sqlite_stats_outliers
- [x] 15. sqlite_stats_regression
- [x] 16. sqlite_stats_hypothesis
- [x] 17. sqlite_stats_detect_anomalies
- [x] 18. sqlite_stats_detect_bloat
- [x] 19. sqlite_stats_detect_schema_risks
- [x] 20. sqlite_window_row_number
- [x] 21. sqlite_window_rank
- [x] 22. sqlite_window_lag_lead
- [x] 23. sqlite_window_running_total
- [x] 24. sqlite_window_moving_avg
- [x] 25. sqlite_window_ntile
- [x] 26. sqlite_execute_code

### Checklist Execution
- [x] 1. sqlite_stats_basic
- [x] 2. sqlite_stats_count
- [x] 3. sqlite_stats_count distinct
- [x] 4. sqlite_stats_group_by
- [x] 5. sqlite_stats_histogram
- [x] 6. sqlite_stats_percentile
- [x] 7. sqlite_stats_correlation
- [x] 8. sqlite_stats_top_n
- [x] 9. sqlite_stats_distinct
- [x] 10. sqlite_stats_summary
- [x] 11. sqlite_stats_frequency
- [x] 12. sqlite_stats_outliers
- [x] 13. sqlite_stats_regression
- [x] 14. sqlite_stats_hypothesis
- [x] 15. sqlite_window_row_number
- [x] 16. sqlite_window_rank
- [x] 17. sqlite_window_running_total
- [x] 18. sqlite_window_moving_avg
- [x] 19. sqlite_window_lag_lead
- [x] 20. sqlite_window_ntile
- [x] 21. sqlite_execute_code basic
- [x] 22. sqlite_execute_code percentile
- [x] 23. Error path: nonexistent table
- [x] 24. Error path: nonexistent col
- [x] 25. Error path: non-numeric cols correlation
- [x] 26-47. Zod validation sweeps

## Findings

### ❌ Failures
- None! All 22 tools (and execute_code) successfully performed their reads and window calculations. The error boundary test correctly blocked bad requests with structured handler errors instead of raw MCP exceptions.

### ⚠️ Issues
- **Documentation/Prompt Parity**: In the test checklist, `sqlite_window_running_total` is listed with the parameter `valueColumn: "total_price"`, but the actual tool schema dictates the parameter `column: "total_price"`. (Same for `sqlite_window_moving_avg`). The tests were executed with `column` to comply with the MCP tool schemas.

### 📦 Payloads
- **Window Functions**: `sqlite_window_moving_avg` returns a relatively large payload (1587 tokens for 50 rows) since it retrieves all unselected columns by default unless `selectColumns` is specified. It handles standard limits well (defaults to 50) so it is not problematic, but user agents should be advised to pass `selectColumns` to reduce payload.
