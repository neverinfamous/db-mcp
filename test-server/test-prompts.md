# db-mcp Prompt Testing Plan (Cursor)

This plan documents how to test all 10 MCP prompts in Cursor, since prompts aren't supported in AntiGravity.

## Prerequisites

1. Open Cursor and connect to the SQLite MCP server
2. Test database must be loaded: `test-server/test.db`
3. Server command: `node dist/cli.js --transport stdio --sqlite-native "test-server/test.db"`

---

## Prompt Categories

Prompts fall into two categories:

### Data-Fetching Prompts (Work Without Tools)

These prompts call adapter methods directly and provide real database information to the LLM. They work regardless of tool filter settings.

| Prompt | Data Source |
|--------|-------------|
| `sqlite_explain_schema` | `adapter.getSchema()`, `adapter.listTables()` |
| `sqlite_optimization` | `adapter.getSchema()`, `adapter.listTables()`, `adapter.getIndexes()` |
| `sqlite_documentation` | `adapter.getSchema()` |

### Template Prompts (Need Tools for Execution)

These prompts format a structured request but require database tools to execute queries. The LLM can provide SQL guidance without tools, but running queries requires tools.

| Prompt | Purpose |
|--------|---------|
| `sqlite_query_builder` | Helps construct SQL (running it needs tools) |
| `sqlite_data_analysis` | Guides analysis workflow (execution needs tools) |
| `sqlite_migration` | Helps write migration scripts |
| `sqlite_debug_query` | Helps fix SQL queries |
| `sqlite_summarize_table` | Guides table analysis (execution needs tools) |
| `sqlite_hybrid_search_workflow` | Provides hybrid search template |
| `sqlite_demo` | Interactive demo (full execution needs tools) |

---

## Prompts Summary

| # | Prompt | Arguments | Category |
|---|--------|-----------|----------|
| 1 | `sqlite_explain_schema` | None | Data-fetching |
| 2 | `sqlite_query_builder` | 3 required | Template |
| 3 | `sqlite_data_analysis` | 1 required, 1 optional | Template |
| 4 | `sqlite_optimization` | None | Data-fetching |
| 5 | `sqlite_migration` | 1 required, 1 optional | Template |
| 6 | `sqlite_debug_query` | 1 required, 2 optional | Template |
| 7 | `sqlite_documentation` | 1 optional | Data-fetching |
| 8 | `sqlite_summarize_table` | 1 required, 1 optional | Template |
| 9 | `sqlite_hybrid_search_workflow` | 1 required | Template |
| 10 | `sqlite_demo` | 1 required | Template |

---

## Detailed Test Procedures

### 1. sqlite_explain_schema

**Slash Command:** `/sqlite_explain_schema`

**Arguments:** None

**What to Enter:** Just invoke the slash command, no additional input needed.

**Expected Behavior:**
- LLM receives schema and table list from test database
- Should explain purpose of all 11 test tables
- Should identify relationships (e.g., `test_orders.product_id` → `test_products.id`)

---

### 2. sqlite_query_builder

**Slash Command:** `/sqlite_query_builder`

**Arguments (pop-up prompts):**

| Argument | Value to Enter |
|----------|----------------|
| `operation` | `aggregate` |
| `tables` | `test_orders, test_products` |
| `description` | `Calculate total sales by product category with order counts` |

**Expected Behavior:**
- LLM builds a JOIN query with GROUP BY aggregations
- Should provide SQL with explanation

**Alternative Test Case:**

| Argument | Value to Enter |
|----------|----------------|
| `operation` | `select` |
| `tables` | `test_users` |
| `description` | `Find all users with gmail.com email addresses` |

---

### 3. sqlite_data_analysis

**Slash Command:** `/sqlite_data_analysis`

**Arguments (pop-up prompts):**

| Argument | Value to Enter |
|----------|----------------|
| `table` | `test_measurements` |
| `focus` (optional) | `distribution` |

**Expected Behavior:**
- LLM uses SQLite tools to analyze the 200-row measurements table
- Should provide statistics for temperature, humidity, pressure columns
- Should detect patterns across 5 sensor_ids

**Alternative Test Case:**

| Argument | Value to Enter |
|----------|----------------|
| `table` | `test_orders` |
| `focus` (optional) | `trends` |

---

### 4. sqlite_optimization

**Slash Command:** `/sqlite_optimization`

**Arguments:** None

**What to Enter:** Just invoke the slash command, no additional input needed.

**Expected Behavior:**
- LLM receives full schema and index information
- Should identify existing indexes (`idx_orders_status`, `idx_orders_date`, `idx_products_category`)
- May suggest additional indexes or optimizations
- Should check for VACUUM recommendations

---

### 5. sqlite_migration

**Slash Command:** `/sqlite_migration`

**Arguments (pop-up prompts):**

| Argument | Value to Enter |
|----------|----------------|
| `change` | `Add a 'discount_percent' column to test_products table with default value 0` |
| `reversible` (optional) | `true` |

**Expected Behavior:**
- LLM provides UP migration: `ALTER TABLE test_products ADD COLUMN discount_percent REAL DEFAULT 0`
- LLM provides DOWN migration (if reversible=true)
- Should include data migration steps if needed
- Should include testing/verification steps

**Alternative Test Case:**

| Argument | Value to Enter |
|----------|----------------|
| `change` | `Create a new index on test_events(event_type, user_id) for dashboard queries` |
| `reversible` (optional) | `false` |

---

### 6. sqlite_debug_query

**Slash Command:** `/sqlite_debug_query`

**Arguments (pop-up prompts):**

| Argument | Value to Enter |
|----------|----------------|
| `query` | `SELECT * FROM test_orders WHERE status = completed` |
| `error` (optional) | `SQLITE_ERROR: no such column: completed` |
| `expected` (optional) | `All orders with completed status` |

**Expected Behavior:**
- LLM identifies the bug: `completed` should be `'completed'` (quoted string)
- Provides corrected query: `SELECT * FROM test_orders WHERE status = 'completed'`
- Explains that unquoted text is treated as column name

**Alternative Test Case:**

| Argument | Value to Enter |
|----------|----------------|
| `query` | `SELECT customer_name, SUM(total_price) FROM test_orders` |
| `error` (optional) | `Returns only one row instead of per-customer totals` |
| `expected` (optional) | `Sum of total_price grouped by each customer` |

---

### 7. sqlite_documentation

**Slash Command:** `/sqlite_documentation`

**Arguments (pop-up prompts):**

| Argument | Value to Enter |
|----------|----------------|
| `format` (optional) | `markdown` |

**What to Enter:** Optionally specify format, or leave blank for default `markdown`.

**Expected Behavior:**
- LLM generates comprehensive schema documentation
- Should include overview, ERD description, table docs
- Should provide common query examples

**Alternative Test Case:**

| Argument | Value to Enter |
|----------|----------------|
| `format` (optional) | `json` |

---

### 8. sqlite_summarize_table

**Slash Command:** `/sqlite_summarize_table`

**Arguments (pop-up prompts):**

| Argument | Value to Enter |
|----------|----------------|
| `table_name` | `test_products` |
| `analysis_depth` (optional) | `detailed` |

**Expected Behavior:**
- LLM uses `sqlite_describe_table` to get schema
- Runs statistics queries on 16 products
- Performs NULL analysis, unique value analysis
- Provides data quality assessment

**Alternative Test Case:**

| Argument | Value to Enter |
|----------|----------------|
| `table_name` | `test_embeddings` |
| `analysis_depth` (optional) | `comprehensive` |

---

### 9. sqlite_hybrid_search_workflow

**Slash Command:** `/sqlite_hybrid_search_workflow`

**Arguments (pop-up prompts):**

| Argument | Value to Enter |
|----------|----------------|
| `use_case` | `article_search` |

**Expected Behavior:**
- LLM provides template for FTS5 + vector hybrid search
- Should create `article_search_fts` virtual table example
- Should create `article_search_embeddings` table example
- Provides weighted scoring template (keyword + semantic)

**Alternative Test Case:**

| Argument | Value to Enter |
|----------|----------------|
| `use_case` | `product_catalog` |

---

### 10. sqlite_demo

**Slash Command:** `/sqlite_demo`

**Arguments (pop-up prompts):**

| Argument | Value to Enter |
|----------|----------------|
| `topic` | `retail sales` |

**Expected Behavior:**
- LLM creates interactive business narrative scenario
- May create demo tables with synthetic data
- Presents query options to user
- Uses `sqlite_append_insight` to capture findings in `memo://insights`
- Demonstrates prompts + tools + resources workflow

**Alternative Test Case:**

| Argument | Value to Enter |
|----------|----------------|
| `topic` | `IoT sensor monitoring` |

---

## Pass/Fail Criteria

| Symbol | Meaning |
|--------|---------|
| ✅ | Prompt invoked successfully, arguments collected, LLM response appropriate |
| ❌ | Prompt fails to invoke or arguments not collected properly |
| ⚠️ | Prompt works but unexpected behavior or improvement opportunity |
| 📝 | Documentation issue or unclear prompt description |

---

## Test Artifacts

| File | Description |
|------|-------------|
| `test-prompts-plan.md` | This testing plan |
| `test-prompts-results.md` | Summary report after testing (to create) |

---

## Test Database Reference

The test database contains 11 tables (417 total rows):

| Table | Rows | Best for Testing |
|-------|------|------------------|
| `test_products` | 16 | Query builder, documentation |
| `test_orders` | 20 | Query builder, data analysis |
| `test_jsonb_docs` | 6 | JSON-related prompts |
| `test_articles` | 8 | Text/FTS prompts |
| `test_users` | 9 | Debug query scenarios |
| `test_measurements` | 200 | Data analysis, stats |
| `test_embeddings` | 20 | Hybrid search workflow |
| `test_locations` | 15 | Geo-related analysis |
| `test_categories` | 17 | Hierarchical data |
| `test_events` | 100 | Time-series analysis |
| `temp_text_test` | 5 | Quick tests |

---

## Summary

| Metric | Value |
|--------|-------|
| Total prompts to test | 10 |
| Prompts with no arguments | 2 (`sqlite_explain_schema`, `sqlite_optimization`) |
| Prompts with required arguments | 8 |
| Prompts with optional-only arguments | 1 (`sqlite_documentation`) |
