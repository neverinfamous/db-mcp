# Docs Drift Detector Workflow (db-mcp)

## Objective

Detect and remediate documentation drift in `db-mcp` against live schema and code capabilities.

## Context

`db-mcp` features a complex architecture:

- **Dual Backends**: WASM (`sql.js`) and Native (`better-sqlite3`).
- **Code Mode**: Exposes tools via a sandboxed execution environment.
- **SQLite Specifics**: Geotemporal, FTS5 (Native only), and JSON handling.

## Routine: `check-drift`

1. **Subscribe to Live Data**:
   - The agent should subscribe to `sqlite://schema` and `sqlite://tables` using the MCP resource subscription protocol to receive real-time updates.

2. **Cross-Reference**:
   - Compare the live database schema capabilities against the documentation in `docs/`.
   - Validate that `Code Mode` API reference matches the actual available tools returned by `tools/list` and Code Mode reflection.
   - Verify that Native vs. WASM limitations are correctly documented.

3. **Remediate**:
   - Update any outdated markdown files.
   - Log changes in `UNRELEASED.md`.
