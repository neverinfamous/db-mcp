# db-mcp Help — Statistical Analysis (13 core + 6 window)

## Core Statistics (always available)

```javascript
sqlite_stats_basic({ table: "employees", column: "salary" }); // count, sum, avg, min, max
sqlite_stats_count({ table: "orders", column: "status", distinct: true }); // count rows, optionally distinct
sqlite_stats_group_by({ table: "orders", column: "total", groupBy: "status" }); // aggregate by group
sqlite_stats_percentile({
  table: "sales",
  column: "revenue",
  percentiles: [25, 50, 75, 90],
});
sqlite_stats_histogram({ table: "products", column: "price", buckets: 10 });
sqlite_stats_correlation({ table: "data", column1: "x", column2: "y" }); // Pearson coefficient
sqlite_stats_distinct({ table: "orders", column: "status" }); // distinct values
sqlite_stats_summary({
  table: "data",
  columns: ["price", "quantity", "discount"],
}); // multi-column summary
sqlite_stats_frequency({ table: "orders", column: "status" }); // frequency distribution
sqlite_stats_regression({ table: "data", xColumn: "year", yColumn: "revenue" }); // linear
sqlite_stats_regression({
  table: "data",
  xColumn: "year",
  yColumn: "revenue",
  degree: 2,
}); // quadratic
sqlite_stats_outliers({ table: "sales", column: "amount", method: "iqr" }); // or "zscore". Use maxOutliers to limit payload
sqlite_stats_hypothesis({
  table: "samples",
  column: "value",
  testType: "ttest_one",
  expectedMean: 100,
});
```

⚠️ `sqlite_stats_top_n` — always use `selectColumns` to avoid returning all columns (large payloads with text fields):

```javascript
sqlite_stats_top_n({
  table: "products",
  column: "price",
  n: 10,
  selectColumns: ["id", "name", "price"],
});
```

## Window Functions (6 tools, Native only)

```javascript
sqlite_window_row_number({
  table: "employees",
  orderBy: "hire_date",
  partitionBy: "department",
});
sqlite_window_rank({
  table: "sales",
  orderBy: "revenue DESC",
  partitionBy: "region",
  rankType: "dense_rank",
});
sqlite_window_lag_lead({
  table: "sales",
  orderBy: "date",
  column: "revenue",
  partitionBy: "region",
}); // access previous/next row values
sqlite_window_running_total({
  table: "transactions",
  column: "amount",
  orderBy: "date",
});
sqlite_window_moving_avg({
  table: "stock_prices",
  column: "close_price",
  orderBy: "date",
  windowSize: 7,
});
sqlite_window_ntile({
  table: "employees",
  orderBy: "salary DESC",
  buckets: 4,
  partitionBy: "department",
}); // quartiles
```
