# DB-MCP Test Database Reset Guide

This directory contains scripts and documentation for testing the db-mcp SQLite MCP server.

## Quick Start

```powershell
# From db-mcp root directory
.\test-database\reset-database.ps1

# Or from test-database directory
.\reset-database.ps1

# Reset with verbose output
.\reset-database.ps1 -Verbose

# Reset without verification
.\reset-database.ps1 -SkipVerify
```

## Files

| File                 | Description                             |
| -------------------- | --------------------------------------- |
| `test-database.sql`  | SQLite seed data for all 7 tool groups  |
| `reset-database.ps1` | PowerShell script to reset the database |
| `reset-database.md`  | This documentation file                 |
| `test-groups/`       | Test guides organized by tool group     |

## Test Tables

The seed data creates 10 test tables with 409 total rows:

| Table               | Rows | Columns                                                                  | Tool Groups  |
| ------------------- | ---- | ------------------------------------------------------------------------ | ------------ |
| `test_products`     | 15   | id, name, description, price, category                                   | Core, Stats  |
| `test_orders`       | 20   | id, product_id (FK), customer_name, quantity, total_price, status        | Core, Stats  |
| `test_jsonb_docs`   | 6    | id, title, content, **metadata** (JSON), **tags** (JSON array)           | JSON         |
| `test_articles`     | 8    | id, title, content, author, published_at                                 | Text, FTS    |
| `test_articles_fts` | 8    | FTS5 virtual table indexing test_articles (title, body)                  | FTS, Text    |
| `test_users`        | 8    | id, username, email, phone, bio                                          | Text, Core   |
| `test_measurements` | 200  | id, sensor_id, temperature, humidity, pressure, recorded_at              | Stats        |
| `test_embeddings`   | 20   | id, label, category, **embedding** (8-dim vector as JSON array)          | Vector       |
| `test_locations`    | 15   | id, name, latitude, longitude, country                                   | Geo          |
| `test_categories`   | 17   | id, name, **path** (dot-separated hierarchy, e.g., "electronics.phones") | Text         |
| `test_events`       | 100  | id, type, user_id, **payload** (JSON), created_at                        | Stats, Admin |

**JSON columns for JSON tool testing:**

- `test_jsonb_docs.metadata` — Nested object with keys: source, language, version, quality, subscribers
- `test_jsonb_docs.tags` — Array of strings
- `test_embeddings.embedding` — Array of 8 floats
- `test_events.payload` — Event-specific JSON object

## Starting the Server for Testing

After resetting the database, start the server:

```powershell
# From db-mcp root directory
node dist/cli.js --transport stdio --sqlite-native "test-database/test.db"
```

For HTTP/MCP Inspector testing:

```powershell
node dist/cli.js --transport http --port 3000 --sqlite-native "test-database/test.db"
```

## Tool Group Testing

See the `test-groups/` subdirectory for detailed test cases per tool group:

- **Core** (8 tools): Basic CRUD, schema, indexes
- **JSON** (23 tools): JSON/JSONB operations, schema analysis
- **Text** (17 tools): FTS5, regex, fuzzy matching
- **Stats** (13-19 tools): Statistical analysis, window functions
- **Vector** (11 tools): Embeddings, similarity search
- **Admin** (26-33 tools): Backup, PRAGMA, virtual tables
- **Geo** (4-11 tools): Geospatial queries, distance calculations

## Cleanup Conventions

During testing, use these naming conventions:

- **Temporary tables**: Prefix with `temp_` (e.g., `temp_analysis_results`)
- **Test views**: Prefix with `test_view_` (e.g., `test_view_order_summary`)
- **FTS tables**: Prefix with `fts_test_` (e.g., `fts_test_articles`)

After testing, clean up by dropping any `temp_*` tables:

```sql
-- List temp tables
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'temp_%';

-- Drop individual temp table
DROP TABLE IF EXISTS temp_my_test_table;
```

## Database Reset Script Details

The `reset-database.ps1` script performs:

1. **Delete existing database files**
   - `test.db`
   - `test.db-shm`
   - `test.db-wal`
   - `test.db-journal`

2. **Create fresh database**
   - Uses sqlite3 CLI if available
   - Falls back to Node.js with better-sqlite3

3. **Verify tables** (unless `-SkipVerify`)
   - Confirms all 10 tables exist
   - Validates expected row counts

## Troubleshooting

### Database is locked

If you get a "database is locked" error:

1. Stop any running db-mcp server instances
2. Close any SQLite browser tools
3. Run the reset script again

### sqlite3 not found

The script will automatically fall back to Node.js with better-sqlite3. Ensure you've run `npm install` in the db-mcp root directory.

### Verification fails

If verification shows unexpected row counts:

1. Check that `test-database.sql` is intact
2. Run with `-Verbose` flag to see details
3. Try manual reset: `sqlite3 test.db < test-database.sql`

---

## JSON Tool Group Testing Prompt

Copy and paste this prompt to test the JSON tool group:

Please conduct a comprehensive test of the db-mcp SQLite MCP server "json" tool group (23 + 3 built-in tools) using the live MCP server tool calls. Use the MCP tools directly for testing, not scripts/terminal.

### Test Database Schema

The test database (test-database/test.db) contains these tables with JSON-relevant columns:

| Table             | Rows | Columns                                                           | JSON Columns                                          |
| ----------------- | ---- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| test_products     | 15   | id, name, description, price, category                            | —                                                     |
| test_orders       | 20   | id, product_id (FK), customer_name, quantity, total_price, status | —                                                     |
| test_jsonb_docs   | 6    | id, title, content, metadata, tags                                | **metadata** (nested object), **tags** (string array) |
| test_articles     | 8    | id, title, content, author, published_at                          | —                                                     |
| test_users        | 8    | id, username, email, phone, bio                                   | —                                                     |
| test_measurements | 200  | id, sensor_id, temperature, humidity, pressure, recorded_at       | —                                                     |
| test_embeddings   | 20   | id, label, category, embedding                                    | **embedding** (8-dim float array)                     |
| test_locations    | 15   | id, name, latitude, longitude, country                            | —                                                     |
| test_categories   | 17   | id, name, path                                                    | —                                                     |
| test_events       | 100  | id, type, user_id, payload, created_at                            | **payload** (event-specific JSON)                     |

**Primary JSON test tables:**

- `test_jsonb_docs.metadata` — Object with keys: source, language, version, quality, subscribers
- `test_jsonb_docs.tags` — Array of strings like ["tech", "tutorial"]
- `test_events.payload` — Varies by event type

### Testing Requirements

1. Use existing `test_*` tables for read operations (SELECT, COUNT, queries)
2. Create temporary tables with `temp_*` prefix for write operations
3. Clean up any `temp_*` tables after testing
4. Test each tool with realistic inputs based on the schema above
5. Report all: failures, unexpected behaviors, improvement opportunities, or overly large payloads

### Reporting Format

- ✅ Pass: Tool works as expected
- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that could be optimized

### Final Summary

At the end, provide:

- Total tools tested / passed / failed
- List of any issues found
- Recommended fixes or improvements
