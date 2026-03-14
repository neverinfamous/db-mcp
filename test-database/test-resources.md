# db-mcp Resource Testing Plan

Please test all 8 db-mcp resources using the test database (test-database/test.db) and concisely report any issues.

## Resources to Test

| # | Resource Name | URI | Type | Expected Data Source |
|---|---------------|-----|------|----------------------|
| 1 | sqlite_schema | sqlite://schema | Static | Full schema via adapter.getSchema() |
| 2 | sqlite_tables | sqlite://tables | Static | Table list via adapter.listTables() |
| 3 | sqlite_table_schema | sqlite://table/{name}/schema | Templated | Specific table via adapter.describeTable() |
| 4 | sqlite_indexes | sqlite://indexes | Static | All indexes via adapter.getAllIndexes() |
| 5 | sqlite_views | sqlite://views | Static | Views from sqlite_master |
| 6 | sqlite_health | sqlite://health | Static | Connection health via adapter.getHealth() |
| 7 | sqlite_meta | sqlite://meta | Static | PRAGMA values + adapter info |
| 8 | sqlite_insights | memo://insights | Static | In-memory insights memo |

---

## Test Procedures

### 1. sqlite_schema — Full Database Schema

**URI:** `sqlite://schema`  
**Test:** Read the schema resource and verify it contains all 11 test tables.

**Expected Output:**

- JSON with table definitions including columns, types, and constraints
- Should include: test_products, test_orders, test_jsonb_docs, test_articles, test_users, test_measurements, test_embeddings, test_locations, test_categories, test_events, temp_text_test
- **Note:** FTS5 virtual tables (test_articles_fts and shadow tables) are intentionally filtered out

---

### 2. sqlite_tables — List All Tables

**URI:** `sqlite://tables`  
**Test:** Read the tables resource and count entries.

**Expected Output:**

- JSON array of table objects
- Should list **11 tables** (FTS5 virtual tables are intentionally filtered for cleaner output)
- Each entry should have: name, type, columns (array with full column definitions)

---

### 3. sqlite_table_schema — Table-Specific Schema (Templated)

**URI Template:** `sqlite://table/{tableName}/schema`  
**Tests:** Multiple table names to verify URI parsing.

**Test Cases:**

| URI | Expected Result |
|-----|----------------|
| `sqlite://table/test_products/schema` | ✅ Returns 6 columns |
| `sqlite://table/test_orders/schema` | ✅ Returns 7 columns |
| `sqlite://table/test_embeddings/schema` | ✅ Returns 4 columns |
| `sqlite://table/nonexistent_table/schema` | ✅ Graceful error: "Table does not exist" |

**Expected Output per table:**

- Column definitions with names, types, nullability, default values
- Primary key information

---

### 4. sqlite_indexes — All Database Indexes

**URI:** `sqlite://indexes`  
**Test:** Read indexes resource.

**Expected Output:**

- JSON grouped by table name
- Should include at minimum:
  - idx_orders_status on test_orders(status)
  - idx_orders_date on test_orders(order_date)
  - idx_products_category on test_products(category)
- Each index should have: name, tableName, columns, unique flag

---

### 5. sqlite_views — All Views

**URI:** `sqlite://views`  
**Test:** Read views resource.

**Expected Output:**

- JSON array of view objects
- Test database has no views by default, so expect empty array `[]`
- Optionally: Create a test view, verify it appears, then clean up

**Optional Setup/Cleanup:**

```sql
-- Setup (if testing view detection)
CREATE VIEW test_view_order_summary AS 
SELECT product_id, SUM(total_price) as total FROM test_orders GROUP BY product_id;
-- Cleanup
DROP VIEW IF EXISTS test_view_order_summary;
```

---

### 6. sqlite_health — Database Health

**URI:** `sqlite://health`  
**Test:** Read health resource.

**Expected Output:**

- JSON with connection status information
- Should indicate: connected/healthy status
- May include: database path, backend type (sql.js for WASM, better-sqlite3 for native), version info

---

### 7. sqlite_meta — Database Metadata

**URI:** `sqlite://meta`  
**Test:** Read meta resource.

**Expected Output:**

- JSON with PRAGMA values for:
  - database_list — Attached databases
  - page_count — Total database pages
  - page_size — Page size in bytes
  - journal_mode — Should be wal or delete
  - synchronous — Sync mode setting
  - foreign_keys — FK enforcement status
  - wal_autocheckpoint — WAL checkpoint threshold
- Adapter info with backend type and capabilities

---

### 8. sqlite_insights — Business Insights Memo

**URI:** `memo://insights`  
**Test:** Read insights resource (may be empty initially), then add an insight and verify.

> **Prerequisite:** The `sqlite_append_insight` tool requires the `admin` tool group to be enabled.

**Test Sequence:**

1. Read memo://insights — May be empty or have default content ("No business insights have been discovered yet.")
2. Call sqlite_append_insight tool with a test insight (requires admin tools)
3. Read memo://insights again — Should contain the new insight
4. Verify timestamp, category, and finding text are present

**Expected Output:**

- Plain text (mimeType: text/plain)
- Synthesized memo format from insightsManager

---

### 9. Protocol Validation — Instruction Level & Tool Annotations

**Test A — Instruction Level:**

Start the server with different `--instruction-level` values and read the server instructions resource to verify length varies:

| `--instruction-level` | Expected Behavior |
|---|---|
| `essential` | Shortest instructions (~200 tokens) |
| `standard` (default) | Medium instructions (~400 tokens) |
| `full` | Longest instructions (~600 tokens) |

> **Note:** The `INSTRUCTION_LEVEL` environment variable also controls this; CLI flag takes precedence.

**Test B — Tool Annotations (`openWorldHint`):**

Call `tools/list` and verify that **all** tools have `openWorldHint: false` in their annotations. db-mcp tools are local database operations — none require external network access.

| Check | Expected |
|---|---|
| All tools have `annotations` object | ✅ Present on every tool |
| All `openWorldHint` values | `false` |

---

## Verification Plan

### Execution Method

Use live MCP resource reads via the `read_resource` tool against the running sqlite MCP server.

### Test Commands

```
# Resources being tested use the read_resource tool with:
# ServerName: "sqlite"
# Uri: "<resource-uri>"
```

### Pass/Fail Criteria

| Symbol | Meaning |
|--------|---------|
| ✅ | Resource returns expected data structure |
| ❌ | Resource errors or returns unexpected format |
| ⚠️ | Unexpected behavior or improvement opportunity |
| 📦 | Response payload is larger than necessary |

---

## Summary

| Metric | Value |
|--------|-------|
| Total resources to test | 8 |
| Static resources | 7 |
| Templated resources | 1 (sqlite_table_schema with URI parameter) |
| Protocol validation tests | 2 (instruction level tiers + tool annotations) |
| Error cases to test | 1 (nonexistent table in template) |

---

## Design Notes

- **FTS5 Table Filtering:** FTS5 virtual tables (`*_fts`) and shadow tables (`*_fts_*`) are intentionally hidden from `sqlite_schema` and `sqlite_tables` resources. This keeps table listings clean since shadow tables are internal implementation details. FTS5 tables are still fully accessible via `sqlite_fts_*` tools.
