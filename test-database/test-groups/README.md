# DB-MCP Tool Group Testing Guide

This directory contains comprehensive test cases for each of the 7 tool groups in db-mcp.

## Testing Methodology

### 1. Start the Server

```powershell
# Reset the test database first
cd C:\Users\chris\Desktop\db-mcp\test-database
.\reset-database.ps1

# Start server with test database
cd C:\Users\chris\Desktop\db-mcp
node dist/cli.js --transport http --port 3000 --sqlite-native "test-database/test.db"
```

### 2. Use MCP Inspector

Open MCP Inspector at `http://localhost:3000` to interactively test tools.

### 3. Tool Filtering

Test each group in isolation using `--tool-filter`:

```powershell
# Test core tools only
node dist/cli.js --transport http --port 3000 --sqlite-native "test-database/test.db" --tool-filter core

# Test JSON tools only
node dist/cli.js --transport http --port 3000 --sqlite-native "test-database/test.db" --tool-filter json

# Test multiple groups
node dist/cli.js --transport http --port 3000 --sqlite-native "test-database/test.db" --tool-filter "core,json,text"
```

## Tool Groups Overview

| Group  | WASM | Native | Description                    | Test File                                      |
| ------ | ---- | ------ | ------------------------------ | ---------------------------------------------- |
| Core   | 8    | 8      | CRUD, schema, indexes          | [core-group-tests.md](core-group-tests.md)     |
| JSON   | 23   | 23     | JSON/JSONB operations          | [json-group-tests.md](json-group-tests.md)     |
| Text   | 17   | 17     | FTS5, regex, fuzzy             | [text-group-tests.md](text-group-tests.md)     |
| Stats  | 13   | 19     | Statistical analysis           | [stats-group-tests.md](stats-group-tests.md)   |
| Vector | 11   | 11     | Embeddings, similarity         | [vector-group-tests.md](vector-group-tests.md) |
| Admin  | 26   | 33     | Backup, PRAGMA, virtual tables | [admin-group-tests.md](admin-group-tests.md)   |
| Geo    | 4    | 11     | Geospatial queries             | [geo-group-tests.md](geo-group-tests.md)       |

**Note:** Native backend includes additional tools for transactions (7) and window functions (6).

## Test Data Summary

The test database contains the following tables:

```
test_products (15 rows)     → Core, Stats
test_orders (20 rows)       → Core, Stats
test_jsonb_docs (6 rows)    → JSON
test_articles (8 rows)      → Text, FTS
test_users (8 rows)         → Text, Core
test_measurements (200 rows) → Stats
test_embeddings (20 rows)   → Vector
test_locations (15 rows)    → Geo
test_categories (17 rows)   → Text
test_events (100 rows)      → Stats, Admin
```

## Naming Conventions

When creating temporary artifacts during testing:

| Artifact Type    | Prefix       | Example                   |
| ---------------- | ------------ | ------------------------- |
| Temporary tables | `temp_`      | `temp_analysis_output`    |
| FTS tables       | `fts_test_`  | `fts_test_articles`       |
| Views            | `test_view_` | `test_view_order_summary` |
| Indexes          | `idx_test_`  | `idx_test_products_price` |
| Virtual tables   | `vt_test_`   | `vt_test_series`          |

## Test Flow per Group

For each tool group:

1. **Reset database** before testing
2. **List tools** using `list_adapters` to confirm available tools
3. **Read operations** first (SELECT, COUNT, etc.)
4. **Write operations** using `temp_*` tables
5. **Cleanup** by dropping any `temp_*` tables created
6. **Document** any issues or unexpected behaviors

## Reporting Issues

When reporting issues found during testing, include:

- Tool name
- Input parameters (sanitized)
- Expected result
- Actual result
- Error message (if any)
- Steps to reproduce
