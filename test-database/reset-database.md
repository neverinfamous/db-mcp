# DB-MCP Test Database Reset Guide

This directory contains scripts and documentation for testing the db-mcp SQLite MCP server.

## Quick Start

```powershell
# Reset database to clean state
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

| Table               | Rows | Purpose               | Tool Groups  |
| ------------------- | ---- | --------------------- | ------------ |
| `test_products`     | 15   | Product catalog       | Core, Stats  |
| `test_orders`       | 20   | Order transactions    | Core, Stats  |
| `test_jsonb_docs`   | 6    | JSON documents        | JSON         |
| `test_articles`     | 8    | Article content       | Text, FTS    |
| `test_users`        | 8    | User profiles         | Text, Core   |
| `test_measurements` | 200  | Sensor data           | Stats        |
| `test_embeddings`   | 20   | Vector embeddings     | Vector       |
| `test_locations`    | 15   | Geographic points     | Geo          |
| `test_categories`   | 17   | Hierarchical taxonomy | Text         |
| `test_events`       | 100  | Event logs            | Stats, Admin |

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
