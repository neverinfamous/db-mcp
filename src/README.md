# Source Code (`src/`)

This directory contains the primary TypeScript source code for the `db-mcp` server.

## Architecture Overview

- **`adapters/`**: Database-specific adapters (e.g., SQLite, PostgreSQL) that handle connection logic and query execution.
- **`auth/`**: Authentication and authorization logic, including token validation and access control.
- **`server/`**: The core MCP Server implementation, protocol definitions, and request handling.
- **`cli/` / `cli.ts`**: Command-line interface entrypoints for running or managing the server.
- **`codemode/`**: Logic for the Code Mode Sandbox Proxy, optimizing developer workflows and code evaluation.
- **`filtering/`**: Advanced query filtering and parsing logic.
- **`audit/`**: Audit logging and security compliance trails.
- **`observability/`**: Telemetry, logging, and metrics integrations.
- **`transports/`**: Communication transports (e.g., stdio, SSE) bridging the MCP protocol.
- **`types/`**: Global TypeScript interfaces and type definitions.
- **`utils/`**: Shared helper functions and utility libraries.

*Note: Unit tests for specific modules are typically co-located alongside the source files (e.g., `module.test.ts`).*
