# Stats Tool Group Tests

## Overview

The **Stats** group provides statistical analysis and aggregation functions including descriptive statistics, percentiles, correlations, and window functions (native only).

| Environment | Tool Count                       |
| ----------- | -------------------------------- |
| WASM        | 13                               |
| Native      | 19 (includes 6 window functions) |

## Tools in Group

### Statistical Analysis (13 tools)

| Tool                       | Description                    |
| -------------------------- | ------------------------------ |
| `sqlite_basic_stats`       | Sum, avg, min, max, stdev      |
| `sqlite_count`             | Count rows                     |
| `sqlite_group_by_stats`    | Group by with aggregation      |
| `sqlite_histogram`         | Create histogram of values     |
| `sqlite_percentile`        | Calculate percentiles          |
| `sqlite_correlation`       | Correlation between columns    |
| `sqlite_top_n`             | Top N values                   |
| `sqlite_distinct_values`   | Distinct value counts          |
| `sqlite_summary_stats`     | Summary for numeric columns    |
| `sqlite_frequency`         | Value frequency distribution   |
| `sqlite_outlier_detection` | Detect outliers (IQR/Z-score)  |
| `sqlite_regression`        | Linear/polynomial regression   |
| `sqlite_hypothesis_test`   | Statistical hypothesis testing |

### Window Functions (6 tools - Native Only)

| Tool                          | Description               |
| ----------------------------- | ------------------------- |
| `sqlite_window_row_number`    | Assign row numbers        |
| `sqlite_window_rank`          | Calculate RANK/DENSE_RANK |
| `sqlite_window_lag_lead`      | Access previous/next row  |
| `sqlite_window_running_total` | Cumulative sums           |
| `sqlite_window_moving_avg`    | Rolling averages          |
| `sqlite_window_ntile`         | Divide into N buckets     |

## Test Tables

- `test_measurements` (200 rows) - Sensor data with temperature, humidity, pressure
- `test_products` (15 rows) - Products with prices
- `test_orders` (20 rows) - Orders with quantities and totals
- `test_events` (100 rows) - Event logs

---

## Statistical Analysis Tests

### 1. sqlite_basic_stats

**Test 1.1: Stats on temperature**

```json
{
  "table": "test_measurements",
  "column": "temperature"
}
```

Expected: Returns sum, avg, min, max, stdev for temperature column.

**Test 1.2: Stats with WHERE clause**

```json
{
  "table": "test_measurements",
  "column": "temperature",
  "whereClause": "sensor_id = 1"
}
```

Expected: Stats for sensor 1 only.

---

### 2. sqlite_count

**Test 2.1: Count all rows**

```json
{
  "table": "test_measurements"
}
```

Expected: Returns 200.

**Test 2.2: Count with condition**

```json
{
  "table": "test_orders",
  "whereClause": "status = 'completed'"
}
```

Expected: Returns count of completed orders.

**Test 2.3: Count distinct**

```json
{
  "table": "test_measurements",
  "column": "sensor_id",
  "distinct": true
}
```

Expected: Returns 5 (distinct sensor IDs).

---

### 3. sqlite_group_by_stats

**Test 3.1: Avg by category**

```json
{
  "table": "test_products",
  "valueColumn": "price",
  "groupByColumn": "category",
  "stat": "avg"
}
```

Expected: Returns average price per category.

**Test 3.2: Sum by status**

```json
{
  "table": "test_orders",
  "valueColumn": "total_price",
  "groupByColumn": "status",
  "stat": "sum"
}
```

Expected: Returns total revenue per order status.

---

### 4. sqlite_histogram

**Test 4.1: Temperature histogram**

```json
{
  "table": "test_measurements",
  "column": "temperature",
  "bins": 10
}
```

Expected: Returns 10 bins with counts for temperature distribution.

**Test 4.2: Price histogram**

```json
{
  "table": "test_products",
  "column": "price",
  "bins": 5
}
```

Expected: Returns 5 price range buckets.

---

### 5. sqlite_percentile

**Test 5.1: Quartiles**

```json
{
  "table": "test_measurements",
  "column": "humidity",
  "percentiles": [25, 50, 75]
}
```

Expected: Returns Q1, median, Q3 for humidity.

**Test 5.2: Temperature percentiles**

```json
{
  "table": "test_measurements",
  "column": "temperature",
  "percentiles": [10, 50, 90, 99]
}
```

Expected: Returns multiple percentile values.

---

### 6. sqlite_correlation

**Test 6.1: Temperature-humidity correlation**

```json
{
  "table": "test_measurements",
  "column1": "temperature",
  "column2": "humidity"
}
```

Expected: Returns Pearson correlation coefficient.

**Test 6.2: Price-quantity correlation**

```json
{
  "table": "test_orders",
  "column1": "total_price",
  "column2": "quantity"
}
```

Expected: Returns correlation for orders.

---

### 7. sqlite_top_n

**Test 7.1: Top 5 expensive products**

```json
{
  "table": "test_products",
  "column": "price",
  "n": 5,
  "order": "desc"
}
```

Expected: Returns 5 highest-priced products.

**Test 7.2: Top 10 orders by total**

```json
{
  "table": "test_orders",
  "column": "total_price",
  "n": 10,
  "order": "desc"
}
```

Expected: Returns 10 highest-value orders.

---

### 8. sqlite_distinct_values

**Test 8.1: Distinct categories**

```json
{
  "table": "test_products",
  "column": "category"
}
```

Expected: Returns unique categories with counts.

**Test 8.2: Distinct event types**

```json
{
  "table": "test_events",
  "column": "event_type"
}
```

Expected: Returns unique event types.

---

### 9. sqlite_summary_stats

**Test 9.1: Summary for measurements**

```json
{
  "table": "test_measurements"
}
```

Expected: Returns summary stats for all numeric columns.

---

### 10. sqlite_frequency

**Test 10.1: Order status frequency**

```json
{
  "table": "test_orders",
  "column": "status"
}
```

Expected: Returns count per status value (pending, completed, shipped, cancelled).

**Test 10.2: Sensor frequency**

```json
{
  "table": "test_measurements",
  "column": "sensor_id"
}
```

Expected: Returns reading count per sensor.

---

### 11. sqlite_outlier_detection

**Test 11.1: IQR method**

```json
{
  "table": "test_measurements",
  "column": "temperature",
  "method": "iqr",
  "threshold": 1.5
}
```

Expected: Returns temperature outliers beyond 1.5\*IQR.

**Test 11.2: Z-score method**

```json
{
  "table": "test_measurements",
  "column": "humidity",
  "method": "zscore",
  "threshold": 3
}
```

Expected: Returns humidity values with |Z| > 3.

---

### 12. sqlite_regression

**Test 12.1: Linear regression**

```json
{
  "table": "test_measurements",
  "xColumn": "temperature",
  "yColumn": "humidity",
  "degree": 1
}
```

Expected: Returns slope, intercept, R² for linear fit.

**Test 12.2: Quadratic regression**

```json
{
  "table": "test_measurements",
  "xColumn": "temperature",
  "yColumn": "pressure",
  "degree": 2
}
```

Expected: Returns polynomial coefficients.

---

### 13. sqlite_hypothesis_test

**Test 13.1: One-sample t-test**

```json
{
  "table": "test_measurements",
  "column": "temperature",
  "test": "t-test",
  "expectedMean": 25
}
```

Expected: Returns t-statistic, p-value, conclusion.

**Test 13.2: Chi-square test**

```json
{
  "table": "test_orders",
  "column": "status",
  "test": "chi-square"
}
```

Expected: Returns chi-square statistic for status distribution.

---

## Window Function Tests (Native Only)

### 14. sqlite_window_row_number

**Test 14.1: Row numbers by sensor**

```json
{
  "table": "test_measurements",
  "partitionBy": "sensor_id",
  "orderBy": "measured_at"
}
```

Expected: Returns row numbers partitioned by sensor.

---

### 15. sqlite_window_rank

**Test 15.1: Rank products by price**

```json
{
  "table": "test_products",
  "orderBy": "price",
  "rankType": "rank"
}
```

Expected: Returns rank (with gaps for ties).

**Test 15.2: Dense rank**

```json
{
  "table": "test_products",
  "orderBy": "price",
  "rankType": "dense_rank"
}
```

Expected: Returns dense rank (no gaps).

---

### 16. sqlite_window_lag_lead

**Test 16.1: Temperature lag**

```json
{
  "table": "test_measurements",
  "column": "temperature",
  "offset": 1,
  "direction": "lag",
  "partitionBy": "sensor_id",
  "orderBy": "measured_at"
}
```

Expected: Returns previous temperature per sensor.

**Test 16.2: Lead values**

```json
{
  "table": "test_measurements",
  "column": "temperature",
  "offset": 1,
  "direction": "lead",
  "orderBy": "measured_at"
}
```

Expected: Returns next temperature values.

---

### 17. sqlite_window_running_total

**Test 17.1: Cumulative order total**

```json
{
  "table": "test_orders",
  "column": "total_price",
  "orderBy": "order_date"
}
```

Expected: Returns running sum of order totals.

**Test 17.2: Running total by status**

```json
{
  "table": "test_orders",
  "column": "total_price",
  "partitionBy": "status",
  "orderBy": "order_date"
}
```

Expected: Returns running totals partitioned by status.

---

### 18. sqlite_window_moving_avg

**Test 18.1: 5-period moving average**

```json
{
  "table": "test_measurements",
  "column": "temperature",
  "windowSize": 5,
  "orderBy": "measured_at"
}
```

Expected: Returns 5-point rolling average of temperature.

---

### 19. sqlite_window_ntile

**Test 19.1: Quartile buckets**

```json
{
  "table": "test_products",
  "orderBy": "price",
  "n": 4
}
```

Expected: Returns products assigned to quartiles (1-4).

**Test 19.2: Deciles**

```json
{
  "table": "test_measurements",
  "orderBy": "temperature",
  "n": 10
}
```

Expected: Returns decile assignments (1-10).

---

## Known Issues / Notes

- Window functions require native backend (better-sqlite3)
- Regression supports degree 1-3 only
- Hypothesis tests use approximate p-values
- IQR method: outliers outside Q1 - threshold*IQR or Q3 + threshold*IQR
- Z-score method: outliers where |z| > threshold
