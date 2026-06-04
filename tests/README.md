# Tests (`tests/`)

This directory contains comprehensive testing suites for the `db-mcp` project, separated logically by the type of testing performed.

## Structure

- **`e2e/`**: End-to-end tests validating the full lifecycle of the MCP server, from initialization to complex protocol requests and database teardowns.
- **`benchmarks/`**: Performance benchmarks tracking execution speed, memory footprint, and query throughput.
- **`security/`**: Security tests ensuring authorization boundaries, injection defenses, and proper audit trailing.
- **`adapters/`**: Integration tests specific to database adapters (e.g., SQLite, PostgreSQL).
- **`auth/`, `codemode/`, `cli/`, `filtering/`, `observability/`, `transports/`**: Integration tests for respective core systems.

## Running Tests
- **Unit & Integration**: `pnpm test` (Uses Vitest; unit tests are co-located in `src/`).
- **E2E**: Executed via Playwright or designated Vitest config (`pnpm run test:e2e`).
- **Benchmarks**: See the `benchmarks/` directory for specific execution commands.
