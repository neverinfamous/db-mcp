/**
 * db-mcp - Handler Dispatch Performance Benchmarks
 *
 * Measures the framework overhead between MCP request receipt and
 * handler function invocation: tool lookup, error construction,
 * and progress notification overhead.
 *
 * Run: npm run bench
 */

import { describe, bench, vi } from "vitest";
import type { ToolDefinition } from "../../src/types/index.js";

// Suppress logger output
vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    critical: vi.fn(),
    alert: vi.fn(),
    emergency: vi.fn(),
    setLevel: vi.fn(),
    setMcpServer: vi.fn(),
  },
  createModuleLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    critical: vi.fn(),
    alert: vi.fn(),
    emergency: vi.fn(),
    setLevel: vi.fn(),
    setMcpServer: vi.fn(),
  }),
  ERROR_CODES: {
    AUTH: {
      TOKEN_MISSING: { full: "AUTH_TOKEN_MISSING" },
      TOKEN_INVALID: { full: "AUTH_TOKEN_INVALID" },
      TOKEN_EXPIRED: { full: "AUTH_TOKEN_EXPIRED" },
      SIGNATURE_INVALID: { full: "AUTH_SIGNATURE_INVALID" },
      SCOPE_DENIED: { full: "AUTH_SCOPE_DENIED" },
      DISCOVERY_FAILED: { full: "AUTH_DISCOVERY_FAILED" },
      JWKS_FETCH_FAILED: { full: "AUTH_JWKS_FETCH_FAILED" },
      REGISTRATION_FAILED: { full: "AUTH_REGISTRATION_FAILED" },
    },
  },
}));

// ---------------------------------------------------------------------------
// Simulated Tool Registry (Map-based lookup, same pattern as DatabaseAdapter)
// ---------------------------------------------------------------------------
const toolRegistry = new Map<string, ToolDefinition>();
const toolNames = [
  "sqlite_read_query",
  "sqlite_write_query",
  "sqlite_list_tables",
  "sqlite_describe_table",
  "sqlite_create_table",
  "sqlite_drop_table",
  "sqlite_create_index",
  "sqlite_get_indexes",
  "sqlite_upsert",
  "sqlite_count",
  "sqlite_exists",
  "sqlite_batch_insert",
  "sqlite_truncate",
  "sqlite_json_extract",
  "sqlite_json_set",
  "sqlite_json_merge",
  "sqlite_json_array_append",
  "sqlite_vec_search",
  "sqlite_vec_upsert",
  "sqlite_fts_search",
  "sqlite_geo_distance",
  "sqlite_execute_code",
  "sqlite_explain_query",
  "sqlite_analyze_tables",
  "sqlite_vacuum_database",
];

for (const name of toolNames) {
  toolRegistry.set(name, {
    name,
    description: `Tool ${name}`,
    group: "core",
    inputSchema: { type: "object", properties: {} },
    handler: () =>
      Promise.resolve({ content: [{ type: "text" as const, text: "ok" }] }),
  });
}

// ---------------------------------------------------------------------------
// Simulated Handler Map (Map<string, Function>)
// ---------------------------------------------------------------------------
const handlerMap = new Map<string, () => unknown>();
for (const name of toolNames) {
  handlerMap.set(name, () => ({
    content: [{ type: "text", text: JSON.stringify({ success: true }) }],
  }));
}

// ---------------------------------------------------------------------------
// 1. Tool Lookup by Name
// ---------------------------------------------------------------------------
describe("Tool Lookup by Name", () => {
  bench(
    "Map.get() single — sqlite_read_query",
    () => {
      handlerMap.get("sqlite_read_query");
    },
    { iterations: 50000, warmupIterations: 500 },
  );

  bench(
    "Map.get() x25 tools (full registry scan)",
    () => {
      for (const name of toolNames) {
        handlerMap.get(name);
      }
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "Map.has() unknown tool",
    () => {
      handlerMap.has("sqlite_nonexistent_tool");
    },
    { iterations: 50000, warmupIterations: 500 },
  );

  bench(
    "toolRegistry.get() → definition access",
    () => {
      const def = toolRegistry.get("sqlite_read_query");
      if (def) {
        void def.name;
        void def.group;
        void def.inputSchema;
      }
    },
    { iterations: 30000, warmupIterations: 300 },
  );
});

// ---------------------------------------------------------------------------
// 2. Error Response Construction
// ---------------------------------------------------------------------------
describe("Error Response Construction", () => {
  bench(
    "Structured error (simple)",
    () => {
      const error = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Table not found: nonexistent_table",
              code: "OBJECT_NOT_FOUND",
            }),
          },
        ],
      };
      void error;
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "Structured error (with context)",
    () => {
      const error = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Failed to execute query",
              code: "QUERY_EXECUTION_FAILED",
              details: {
                sql: "SELECT * FROM missing_table",
                sqliteCode: "SQLITE_ERROR",
                message: "no such table: missing_table",
                hint: "Check the table name",
              },
            }),
          },
        ],
      };
      void error;
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "Error.message extraction + stack flattening",
    () => {
      try {
        throw new Error("Test error for benchmarking");
      } catch (e) {
        const err = e as Error;
        const flat = (err.stack ?? "").replace(/\n/g, " → ");
        void flat;
      }
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 3. Progress Notification Overhead
// ---------------------------------------------------------------------------
describe("Progress Notification Overhead", () => {
  bench(
    "construct progress payload",
    () => {
      const progress = {
        progressToken: "token-123",
        progress: 42,
        total: 100,
        message: "Processing row 42 of 100",
      };
      void JSON.stringify(progress);
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "10 incremental progress updates",
    () => {
      for (let i = 0; i < 10; i++) {
        void JSON.stringify({
          progressToken: "token-123",
          progress: i * 10,
          total: 100,
          message: `Step ${String(i + 1)} of 10`,
        });
      }
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 4. Full Handler Wrapper Pipeline (Simulated)
// ---------------------------------------------------------------------------
describe("Handler Wrapper Pipeline", () => {
  bench(
    "lookup → handler → serialize (sync simulation)",
    () => {
      const handler = handlerMap.get("sqlite_read_query");
      if (handler) {
        const result = handler();
        void JSON.stringify(result);
      }
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "tool definition list generation (Array.from registry)",
    () => {
      const definitions = Array.from(toolRegistry.values()).map((def) => ({
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema,
      }));
      void definitions.length;
    },
    { iterations: 3000, warmupIterations: 30 },
  );
});
