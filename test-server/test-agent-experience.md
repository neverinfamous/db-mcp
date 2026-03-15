# Agent Experience Test — db-mcp (SQLite)

> **Purpose:** Validate that the slim `instructions` field + `sqlite://help` resources are sufficient for an agent to operate the server cold — with **zero** schema info, tool hints, or checklists in the prompt.

## How to Run

Run **each pass** as a separate conversation with the corresponding `--tool-filter`. Each pass tests whether the agent can complete realistic tasks using only the tools + help resources available under that filter.

| Pass | `--tool-filter` | Tools | Scenarios |
|------|-----------------|-------|-----------|
| Pass 1 | `starter` | Core, JSON, Text (~50) | 1–12 |
| Pass 2 | `analytics` | Core, JSON, Stats (~52) | 13–16 |
| Pass 3 | `search` | Core, Text, Vector (~38) | 17–18 |
| Pass 4 | `codemode` | Code Mode only (1+3) | 19–20 |
| Pass 5 | `core,geo` | Core, Geo (~22) | 21–23 |
| Pass 6 | `core,admin` | Core, Admin (~44) | 24–26 |
| Pass 7 | `core,introspection,migration` | Core, Introspection, Migration (~27) | 27–29 |

> **Important:** Do NOT combine passes. Each pass is a fresh conversation with a clean context. The agent has never seen this database before.

## Rules

1. **Do NOT read** `test-tools.md`, `test-group-tools.md`, or any other test documentation before running these scenarios
2. **Do NOT read** source code files (`src/`) — you are a user, not a developer
3. **DO** use the MCP instructions you received during initialization + `sqlite://help` resources
4. **DO** discover the database schema via `sqlite://schema` or `sqlite://tables` resources
5. **DO** read group-specific help (`sqlite://help/{group}`) when you need reference for unfamiliar tools
6. Use the test database (`test-server/test.db`) which is already connected

## Success Criteria

| Symbol | Meaning |
|--------|---------|
| ✅ | Agent completed the task correctly without external help |
| ⚠️ | Agent completed but needed multiple retries or used wrong tools first |
| ❌ | Agent failed or produced incorrect results |
| 📖 | Agent had to read help resources — note which ones |

Track **every** help resource read and whether it provided what was needed. Gaps are the actionable finding.

## Reporting Format

For each scenario, report:

```
### Scenario N: [title]
**Result:** ✅/⚠️/❌
**Resources read:** sqlite://help, sqlite://help/json (or "none beyond instructions")
**Tools used:** sqlite_read_query, sqlite_json_query, ...
**Issues:** (any gaps in help content, confusing tool names, missing examples)
```

---

## Pass 1: `starter` (Core, JSON, Text)

### Phase 1 — Discovery

#### Scenario 1 — What's in this database?
List all tables and briefly describe what each one contains.

#### Scenario 2 — Table deep dive
Pick the most interesting table and fully characterize it: row count, column types, sample data, indexes, and any foreign key relationships.

#### Scenario 3 — Health check
Is the database healthy? What backend and mode is it running in? What are the key PRAGMA settings?

### Phase 2 — Core Operations

#### Scenario 4 — Filtered read
Find all products in the "electronics" category priced above $50, sorted by price descending.

#### Scenario 5 — Aggregation
What is the total revenue (sum of total_price) per order status? Which status has the highest revenue?

#### Scenario 6 — Write and verify
Create a new product called "Test Widget" in the "gadgets" category priced at $29.99, then verify it was inserted. Clean up after.

### Phase 3 — JSON Operations

#### Scenario 7 — JSON extraction
Extract the `name` and `version` fields from the JSON documents in `test_jsonb_docs`. Which documents have a version above 2?

#### Scenario 8 — Nested JSON
Find the deeply nested value at `$.nested.level1.level2` in `test_jsonb_docs`. Which row has it?

#### Scenario 9 — JSON analysis
Analyze the JSON schema of the `doc` column in `test_jsonb_docs`. What field types and nesting patterns exist?

### Phase 4 — Text & Search

#### Scenario 10 — Full-text search
Search the articles for content about "database" and "search". Rank results by relevance.

> **Note:** FTS5 tables may need to be created/rebuilt before searching. The agent should figure this out from help resources.

#### Scenario 11 — Fuzzy matching
Find users whose names are similar to "Jon" (fuzzy match). What did you find?

#### Scenario 12 — Text processing
Normalize and validate the email addresses in `test_users`. Are any malformed?

---

## Pass 2: `analytics` (Core, JSON, Stats)

### Phase 5 — Statistics

#### Scenario 13 — Descriptive stats
Compute descriptive statistics (mean, median, std dev, min, max) for the `temperature` column in `test_measurements`. Break it down by `sensor_id`.

#### Scenario 14 — Outlier detection
Are there any outlier temperature readings in `test_measurements`? What method did you use?

#### Scenario 15 — Correlation
Is there a correlation between temperature and humidity in `test_measurements`? How strong?

#### Scenario 16 — Cross-table analysis
Which products have the most orders? Join the data and present a ranked summary with product name, order count, and total revenue.

---

## Pass 3: `search` (Core, Text, Vector)

### Phase 6 — Vector & Semantic Search

#### Scenario 17 — Similarity search
Find the 3 embeddings most similar to the first embedding in `test_embeddings`. What categories are they?

#### Scenario 18 — Hybrid search
Search articles for "database" using full-text search, then find semantically similar embeddings. Can the agent combine both approaches?

---

## Pass 4: `codemode` (Code Mode only)

### Phase 7 — Code Mode Discovery & Efficiency

#### Scenario 19 — Cold-start Code Mode
Using only `sqlite_execute_code`, list all tables, pick one, and run a query against it. Can the agent discover the `sqlite.*` API without external help?

#### Scenario 20 — Multi-step workflow
Using only `sqlite_execute_code`, find the top 5 products by order count with total revenue — in a single code execution. Compare the token efficiency vs what Pass 1/2 would require.

---

## Pass 5: `core,geo` (Core, Geo — ~22 tools)

### Phase 8 — Geospatial

#### Scenario 21 — Distance between cities
What is the distance between New York and Paris based on the coordinates in `test_locations`?

#### Scenario 22 — Nearby locations
Find all locations within 100km of London. How many are there?

#### Scenario 23 — Bounding box
Find all locations within the bounding box covering Western Europe (lat 40–55, lon -5 to 15).

---

## Pass 6: `core,admin` (Core, Admin — ~44 tools)

### Phase 9 — Admin & Data Quality

#### Scenario 24 — Data quality audit
Audit the database for data quality issues: NULL values, duplicate entries, orphaned foreign keys, unused indexes. Summarize findings.

#### Scenario 25 — Database health & optimization
Run an integrity check, analyze the database, then suggest and apply optimizations.

#### Scenario 26 — Backup and restore
Create a backup of the database. Verify the backup exists and is valid.

---

## Pass 7: `core,introspection,migration` (Core, Introspection, Migration — ~27 tools)

### Phase 10 — Schema Analysis & Migration

#### Scenario 27 — Dependency graph
Map out the foreign key dependency graph. Which tables have the most dependencies? What's the topological sort order?

#### Scenario 28 — Cascade simulation
What would happen if `test_products` row 1 were deleted? Simulate the cascade impact on related tables.

#### Scenario 29 — Migration workflow
Initialize migration tracking, then create and apply a migration that adds a `description` column to `test_products`. Roll it back after verifying.

---

## Post-Test Summary

Compile findings across all passes into:

1. **Help resource gaps** — scenarios where help content was missing, incomplete, or misleading
2. **Discovery friction** — cases where the agent struggled to find the right tool or resource
3. **Suggested improvements** — specific additions to `src/constants/server-instructions/*.md`

> **Key metric:** How many of the 29 scenarios did the agent complete on the first try with ≤1 help resource read? This measures whether the instructions + tool descriptions are self-sufficient.

