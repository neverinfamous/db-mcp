# Agent Experience Test — db-mcp (SQLite)

> **Purpose:** Validate that the slim `instructions` field + `sqlite://help` resources are sufficient for an agent to operate the server cold — with **zero** schema info, tool hints, or checklists in the prompt.

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

## Phase 1: Discovery (Can the agent orient itself?)

### Scenario 1 — What's in this database?
List all tables and briefly describe what each one contains.

### Scenario 2 — Table deep dive
Pick the most interesting table and fully characterize it: row count, column types, sample data, indexes, and any foreign key relationships.

### Scenario 3 — Health check
Is the database healthy? What backend and mode is it running in? What are the key PRAGMA settings?

---

## Phase 2: Core Operations (Can the agent do basic CRUD?)

### Scenario 4 — Filtered read
Find all products in the "electronics" category priced above $50, sorted by price descending.

### Scenario 5 — Aggregation
What is the total revenue (sum of total_price) per order status? Which status has the highest revenue?

### Scenario 6 — Write and verify
Create a new product called "Test Widget" in the "gadgets" category priced at $29.99, then verify it was inserted. Clean up after.

---

## Phase 3: JSON Operations (Can the agent handle JSON columns?)

### Scenario 7 — JSON extraction
Extract the `name` and `version` fields from the JSON documents in `test_jsonb_docs`. Which documents have a version above 2?

### Scenario 8 — Nested JSON
Find the deeply nested value at `$.nested.level1.level2` in `test_jsonb_docs`. Which row has it?

### Scenario 9 — JSON analysis
Analyze the JSON schema of the `doc` column in `test_jsonb_docs`. What field types and nesting patterns exist?

---

## Phase 4: Text & Search (Can the agent search effectively?)

### Scenario 10 — Full-text search
Search the articles for content about "database" and "search". Rank results by relevance.

> **Note:** FTS5 tables may need to be created/rebuilt before searching. The agent should figure this out from help resources.

### Scenario 11 — Fuzzy matching
Find users whose names are similar to "Jon" (fuzzy match). What did you find?

### Scenario 12 — Text processing
Normalize and validate the email addresses in `test_users`. Are any malformed?

---

## Phase 5: Statistics (Can the agent do analysis?)

### Scenario 13 — Descriptive stats
Compute descriptive statistics (mean, median, std dev, min, max) for the `temperature` column in `test_measurements`. Break it down by `sensor_id`.

### Scenario 14 — Outlier detection
Are there any outlier temperature readings in `test_measurements`? What method did you use?

### Scenario 15 — Correlation
Is there a correlation between temperature and humidity in `test_measurements`? How strong?

---

## Phase 6: Vector & Geo (Can the agent handle specialized tools?)

### Scenario 16 — Similarity search
Find the 3 embeddings most similar to the first embedding in `test_embeddings`. What categories are they?

### Scenario 17 — Distance calculation
What is the distance between New York and Paris based on the coordinates in `test_locations`?

---

## Phase 7: Multi-step Workflows (Can the agent compose operations?)

### Scenario 18 — Cross-table analysis
Which products have the most orders? Join the data and present a ranked summary with product name, order count, and total revenue.

### Scenario 19 — Data quality audit
Audit the database for data quality issues: NULL values, duplicate entries, orphaned foreign keys, unused indexes. Summarize findings.

### Scenario 20 — Code Mode efficiency
If Code Mode (`sqlite_execute_code`) is available, redo Scenario 18 using Code Mode and compare the token cost (number of tool calls) vs individual tool calls.

---

## Post-Test Summary

Compile findings into:

1. **Help resource gaps** — scenarios where help content was missing, incomplete, or misleading
2. **Discovery friction** — cases where the agent struggled to find the right tool or resource
3. **Suggested improvements** — specific additions to `src/constants/server-instructions/*.md`

> **Key metric:** How many scenarios did the agent complete on the first try with ≤1 help resource read? This measures whether the instructions + tool descriptions are self-sufficient.
