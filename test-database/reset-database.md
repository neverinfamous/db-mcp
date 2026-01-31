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

The seed data creates 11 test tables with 414 total rows:

| Table               | Rows | Columns                                                                  | Tool Groups   |
| ------------------- | ---- | ------------------------------------------------------------------------ | ------------- |
| `test_products`     | 15   | id, name, description, price, category                                   | Core, Stats   |
| `test_orders`       | 20   | id, product_id (FK), customer_name, quantity, total_price, status        | Core, Stats   |
| `test_jsonb_docs`   | 6    | id, title, content, **metadata** (JSON), **tags** (JSON array)           | JSON          |
| `test_articles`     | 8    | id, title, content, author, published_at                                 | Text, FTS     |
| `test_articles_fts` | 8    | FTS5 virtual table indexing test_articles (title, body)                  | FTS, Text     |
| `test_users`        | 8    | id, username, email, phone, bio                                          | Text, Core    |
| `test_measurements` | 200  | id, sensor_id, temperature, humidity, pressure, recorded_at              | Stats         |
| `test_embeddings`   | 20   | id, label, category, **embedding** (8-dim vector as JSON array)          | Vector        |
| `test_locations`    | 15   | id, name, latitude, longitude, country                                   | Geo           |
| `test_categories`   | 17   | id, name, **path** (dot-separated hierarchy, e.g., "electronics.phones") | Text          |
| `test_events`       | 100  | id, type, user_id, **payload** (JSON), created_at                        | Stats, Admin  |
| `temp_text_test`    | 5    | id, name, description                                                    | Text (writes) |

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

Please conduct a comprehensive test of the db-mcp SQLite MCP server "text" tool group (17 + 3 built-in tools) using the live MCP server tool calls. Use the MCP tools directly for testing, not scripts/terminal.

## Text Tool Group's Tools

1. server_info
   Get information about the db-mcp server and registered adapters
2. server_health
   Check health status of all database connections
3. list_adapters
   List all registered database adapters
4. sqlite_regex_extract
   Extract text matching a regex pattern. Processed in JavaScript after fetching data.
5. sqlite_regex_match
   Find rows where column matches a regex pattern. Processed in JavaScript.
6. sqlite_text_split
   Split a text column by delimiter into array results.
7. sqlite_text_concat
   Concatenate multiple columns with optional separator.
8. sqlite_text_replace
   Replace text in a column using SQLite replace() function.
9. sqlite_text_trim
   Trim whitespace from text column values.
10. sqlite_text_case
    Convert text to uppercase or lowercase.
11. sqlite_text_substring
    Extract a substring from text column using substr().
12. sqlite_fuzzy_match
    Find fuzzy matches using Levenshtein distance. Returns values within max edit distance.
13. sqlite_phonetic_match
    Find phonetically similar values using Soundex (SQLite native) or Metaphone algorithm.
14. sqlite_text_normalize
    Normalize text using Unicode normalization (NFC, NFD, NFKC, NFKD) or strip accents.
15. sqlite_text_validate
    Validate text values against patterns: email, phone, URL, UUID, IPv4, or custom regex.
16. sqlite_advanced_search
    Advanced search combining exact, fuzzy (Levenshtein), and phonetic (Soundex) matching
17. sqlite_fts_create
    Create an FTS5 full-text search virtual table.
18. sqlite_fts_search
    Search an FTS5 table using full-text query syntax.
19. sqlite_fts_rebuild
    Rebuild an FTS5 index to optimize search performance.
20. sqlite_fts_match_info
    Get FTS5 match ranking information using bm25.

### Test Database Schema

The test database (test-database/test.db) contains these tables with JSON-relevant columns:

| Table             | Rows | Columns                                                           | JSON Columns                                                            |
| ----------------- | ---- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| test_products     | 15   | id, name, description, price, category                            | —                                                                       |
| test_orders       | 20   | id, product_id (FK), customer_name, quantity, total_price, status | —                                                                       |
| test_jsonb_docs   | 6    | id, doc, metadata, tags                                           | **doc** (JSON document), **metadata** (nested object), **tags** (array) |
| test_articles     | 8    | id, title, body, author, category                                 | —                                                                       |
| test_articles_fts | FTS5 | title, body                                                       | — (FTS5 virtual table)                                                  |
| test_users        | 8    | id, username, email, phone, bio                                   | —                                                                       |
| test_measurements | 200  | id, sensor_id, temperature, humidity, pressure, measured_at       | —                                                                       |
| test_embeddings   | 20   | id, content, category, embedding                                  | **embedding** (8-dim float array)                                       |
| test_locations    | 15   | id, name, city, latitude, longitude, type                         | —                                                                       |
| test_categories   | 17   | id, name, path, level                                             | —                                                                       |
| test_events       | 100  | id, event_type, user_id, payload, event_date                      | **payload** (JSON)                                                      |
| temp_text_test    | 5    | id, name, description                                             | — (for write operations)                                                |

**Primary JSON test tables:**

- `test_jsonb_docs.metadata` — Object with keys: source, language, version, quality, subscribers
- `test_jsonb_docs.tags` — Array of strings like ["tech", "tutorial"]
- `test_events.payload` — Varies by event type

### Testing Requirements

1. Use existing `test_*` tables for read operations (SELECT, COUNT, queries)
2. Create temporary tables with `temp_*` prefix for write operations
3. Test each tool with realistic inputs based on the schema above
4. Clean up any `temp_*` tables after testing with 'sqlite3 test-database/test.db "DROP TABLE IF EXISTS temp_json_test;"'
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
