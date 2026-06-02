# db-mcp Resource Testing Plan

Please test all db-mcp resources (10 data + up to 9 help) using the test database (test-server/test.db) and concisely report any issues.

## Resources to Test

| #   | Resource Name          | URI                          | Type      | Expected Data Source                       |
| --- | ---------------------- | ---------------------------- | --------- | ------------------------------------------ |
| 1   | sqlite_schema          | sqlite://schema              | Static    | Full schema via adapter.getSchema()        |
| 2   | sqlite_tables          | sqlite://tables              | Static    | Table list via adapter.listTables()        |
| 3   | sqlite_table_schema    | sqlite://table/{name}/schema | Templated | Specific table via adapter.describeTable() |
| 4   | sqlite_indexes         | sqlite://indexes             | Static    | All indexes via adapter.getAllIndexes()    |
| 5   | sqlite_views           | sqlite://views               | Static    | Views from sqlite_master                   |
| 6   | sqlite_health          | sqlite://health              | Static    | Connection health via adapter.getHealth()  |
| 7   | sqlite_meta            | sqlite://meta                | Static    | PRAGMA values + adapter info               |
| 8   | sqlite_compile_options | sqlite://compile_options     | Static    | SQLite compile-time build options          |
| 9   | sqlite_pragma          | sqlite://pragma              | Static    | Runtime PRAGMA config snapshot             |
| 10  | sqlite_audit           | sqlite://audit               | Static    | Audit log access (if enabled)              |

---

## Test Procedures

### 1. sqlite_schema — Full Database Schema

**URI:** `sqlite://schema`  
**Test:** Read the schema resource and verify it contains all 11 test tables.

**Expected Output:**

- JSON with table definitions including columns, types, and constraints
- Should include: test_products, test_orders, test_jsonb_docs, test_articles, test_users, test_measurements, test_embeddings, test_locations, test_categories, test_events
- **Note:** FTS5 virtual tables (test_articles_fts and shadow tables) are intentionally filtered out

---

### 2. sqlite_tables — List All Tables

**URI:** `sqlite://tables`  
**Test:** Read the tables resource and count entries.

**Expected Output:**

- JSON array of table objects
- Should list **10 tables** (FTS5 virtual tables are intentionally filtered for cleaner output)
- Each entry should have: name, type, columns (array with full column definitions)

---

### 3. sqlite_table_schema — Table-Specific Schema (Templated)

**URI Template:** `sqlite://table/{tableName}/schema`  
**Tests:** Multiple table names to verify URI parsing.

**Test Cases:**

| URI                                       | Expected Result                           |
| ----------------------------------------- | ----------------------------------------- |
| `sqlite://table/test_products/schema`     | ✅ Returns 6 columns                      |
| `sqlite://table/test_orders/schema`       | ✅ Returns 7 columns                      |
| `sqlite://table/test_embeddings/schema`   | ✅ Returns 4 columns                      |
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

### 8. sqlite_compile_options — Compile-Time Options

**URI:** `sqlite://compile_options`  
**Test:** Read the compile options resource.

**Expected Output:**

- JSON with an `options` array, `count`, and `highlights` array.
- Should contain fundamental build options (e.g., `THREADSAFE`).

---

### 9. sqlite_pragma — Runtime Configuration Snapshot

**URI:** `sqlite://pragma`  
**Test:** Read the pragma configuration resource.

**Expected Output:**

- JSON with a `settings` object grouping configuration into categories (storage, performance, safety, behavior).
- Each setting should include `value`, `category`, and `description`.

---

### 10. Help Resources — On-Demand Reference Documentation

**Test A — sqlite://help (always registered):**

Read `sqlite://help` and verify it contains critical reference content:

| Check                       | Expected                                       |
| --------------------------- | ---------------------------------------------- |
| Resource exists             | ✅ Always registered regardless of tool filter |
| Contains "Critical Gotchas" | ✅ Section header present                      |
| Contains "Code Mode API"    | ✅ Section header present                      |
| Contains "WASM vs Native"   | ✅ Comparison section present                  |
| Content is markdown         | ✅ mimeType: text/markdown                     |

**Test B — Group-specific help resources:**

Verify that group-specific help resources are only registered when the corresponding group is enabled. These tests depend on the `--tool-filter` configuration:

| Resource                    | URI                           | Registered When             |
| --------------------------- | ----------------------------- | --------------------------- |
| `sqlite_help_json`          | `sqlite://help/json`          | json group enabled          |
| `sqlite_help_text`          | `sqlite://help/text`          | text group enabled          |
| `sqlite_help_stats`         | `sqlite://help/stats`         | stats group enabled         |
| `sqlite_help_vector`        | `sqlite://help/vector`        | vector group enabled        |
| `sqlite_help_geo`           | `sqlite://help/geo`           | geo group enabled           |
| `sqlite_help_admin`         | `sqlite://help/admin`         | admin group enabled         |
| `sqlite_help_introspection` | `sqlite://help/introspection` | introspection group enabled |
| `sqlite_help_migration`     | `sqlite://help/migration`     | migration group enabled     |

If a group-specific help resource is available, read it and verify it contains relevant tool reference content (tool names, parameters, usage notes).

> **Note:** Help resources are tested more thoroughly by the `test-help-resources.mjs` integration script, which spins up separate server instances with different `--tool-filter` values.

**Test C — Tool Annotations (`openWorldHint`):**

Call `tools/list` and verify that tools accurately report their `openWorldHint` in their annotations. `openWorldHint` should be `true` for tools that interact with the external file system (e.g., `ADMIN_FS`, `WRITE_FS`) or execute arbitrary logic (`CODEMODE`), and `false` for all standard database operations.

| Check                               | Expected                 |
| ----------------------------------- | ------------------------ |
| All tools have `annotations` object | ✅ Present on every tool |
| `openWorldHint` values              | `true` for FS/CodeMode tools, `false` otherwise |

---

### 11. Resource Subscriptions & Live Updates

> **Note:** Resource subscriptions are fully supported over HTTP transport. The STDIO transport operates statelessly (no persistent `sessionId`), so subscriptions are silently dropped and live update notifications will not be emitted.

**Test A — Valid Subscriptions:**

Subscribe to the dynamic schema resources and verify the server accepts the subscription.

| Action                                     | Expected Result                       |
| ------------------------------------------ | ------------------------------------- |
| Subscribe to `sqlite://schema`             | ✅ Success (empty response)           |
| Subscribe to `sqlite://tables`             | ✅ Success (empty response)           |
| Subscribe to `sqlite://table/test_products/schema` | ✅ Success (empty response)   |
| Subscribe to `sqlite://health`             | ✅ Success (empty response)           |

**Test B — Live Update Notifications:**

Once subscribed, mutate the database schema and verify the server emits an `notifications/resources/updated` event.

| Action                                                                                              | Expected Notification Payload       |
| --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Create a new table: `CREATE TABLE test_live_sub (id INTEGER PRIMARY KEY);`                          | Event fired with `uri: sqlite://schema` and `sqlite://tables` |
| Add a column to an existing table: `ALTER TABLE test_products ADD COLUMN sub_test TEXT;`          | Event fired with `uri: sqlite://schema` and `sqlite://table/test_products/schema` |
| Cleanup: `DROP TABLE test_live_sub;` and ignore the column                                          | Event fired with `uri: sqlite://schema` and `sqlite://tables` |
| Wait up to 60 seconds (background health polling)                                                   | Event fired with `uri: sqlite://health` |

**Test C — Invalid Subscriptions:**

Attempt to subscribe to static or non-subscribable resources.

| Action                                     | Expected Result                       |
| ------------------------------------------ | ------------------------------------- |
| Subscribe to `sqlite://meta`               | ❌ Error: Resource not subscribable   |
| Subscribe to `sqlite://help`               | ❌ Error: Resource not subscribable   |
| Subscribe to `sqlite://invalid_uri`        | ❌ Error: Unknown resource            |

**Test D — Unsubscribe:**

| Action                                     | Expected Result                       |
| ------------------------------------------ | ------------------------------------- |
| Unsubscribe from `sqlite://schema`         | ✅ Success (empty response)           |
| Mutate database (e.g. `CREATE TABLE x...`) | ❌ No notification should be received |

---

## Verification Plan

### Execution Method

Use live MCP resource reads via the `read_resource` tool against the running sqlite MCP server.

### Test Commands

For manual data validation, use the `read_resource` tool:

```
# Resources being tested use the read_resource tool with:
# ServerName: "sqlite"
# Uri: "<resource-uri>"
```

For testing subscription mechanics, execute the automated Node scripts:

```bash
# From project root:
node test-server/scripts/test-subscriptions-raw.mjs
node test-server/scripts/test-subscriptions-sdk.mjs
```

### Pass/Fail Criteria

| Symbol | Meaning                                        |
| ------ | ---------------------------------------------- |
| ✅     | Resource returns expected data structure       |
| ❌     | Resource errors or returns unexpected format   |
| ⚠️     | Unexpected behavior or improvement opportunity |
| 📦     | Response payload is larger than necessary      |

---

## Summary

| Metric                    | Value                                        |
| ------------------------- | -------------------------------------------- |
| Data resources to test    | 10                                           |
| Help resources to test    | 1 (sqlite://help) + up to 8 group-specific   |
| Static resources          | 9                                            |
| Templated resources       | 1 (sqlite_table_schema with URI parameter)   |
| Protocol validation tests | 2 (help resource content + tool annotations) |
| Error cases to test       | 1 (nonexistent table in template)            |

---

## Design Notes

- **FTS5 Table Filtering:** FTS5 virtual tables (`*_fts`) and shadow tables (`*_fts_*`) are intentionally hidden from `sqlite_schema` and `sqlite_tables` resources. This keeps table listings clean since shadow tables are internal implementation details. FTS5 tables are still fully accessible via `sqlite_fts_*` tools.
