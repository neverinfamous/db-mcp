/**
 * db-mcp - Tool Filtering & Registration Performance Benchmarks
 *
 * Measures filter parsing, tool registration, and definition caching.
 *
 * Run: npm run bench
 */

import { describe, bench, vi } from "vitest";
import {
  parseToolFilter,
  getAllToolNames,
  getToolGroup,
  getFilterSummary,
  TOOL_GROUPS,
  META_GROUPS,
  getMetaGroupInfo,
} from "../../src/filtering/tool-filter.js";
import type { ToolGroup, MetaGroup } from "../../src/types/index.js";

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
// 1. Filter Parsing
// ---------------------------------------------------------------------------
describe("parseToolFilter()", () => {
  bench(
    "no filter (all tools)",
    () => {
      parseToolFilter(undefined);
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    'simple shortcut ("starter")',
    () => {
      parseToolFilter("starter");
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    "complex filter expression",
    () => {
      parseToolFilter(
        "starter,+text,+vector,-sqlite_drop_table,-sqlite_truncate",
      );
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    'codemode-only filter ("codemode")',
    () => {
      parseToolFilter("codemode");
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    "exclusion-mode filter (-vector,-geo,...)",
    () => {
      parseToolFilter("-vector,-geo,-fts5,-virtual");
    },
    { iterations: 2000, warmupIterations: 20 },
  );
});

// ---------------------------------------------------------------------------
// 2. Lookup Operations
// ---------------------------------------------------------------------------
describe("Lookup Operations", () => {
  // Prime caches before benchmarks
  getAllToolNames();

  bench(
    "getAllToolNames() (cached)",
    () => {
      getAllToolNames();
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "getAllToolNames() (cold, fresh parse)",
    () => {
      // Parse from scratch to simulate cold path
      parseToolFilter(undefined);
    },
    { iterations: 500, warmupIterations: 10 },
  );

  // Prime the cache
  getToolGroup("sqlite_read_query");

  bench(
    "getToolGroup() x4 lookups",
    () => {
      getToolGroup("sqlite_read_query");
      getToolGroup("sqlite_json_extract");
      getToolGroup("sqlite_vec_search");
      getToolGroup("sqlite_execute_code");
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 3. Filter Summary & Catalog
// ---------------------------------------------------------------------------
describe("Filter Summary", () => {
  const config = parseToolFilter("starter");

  bench(
    "getFilterSummary() for starter",
    () => {
      getFilterSummary(config);
    },
    { iterations: 1000, warmupIterations: 10 },
  );

  bench(
    "getToolGroupInfo() catalog (inline)",
    () => {
      Object.entries(TOOL_GROUPS).map(([group, tools]) => ({
        group: group as ToolGroup,
        count: tools.length,
        tools,
      }));
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    "getMetaGroupInfo() catalog",
    () => {
      getMetaGroupInfo();
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    "META_GROUPS catalog (inline)",
    () => {
      Object.entries(META_GROUPS).map(([metaGroup, groups]) => ({
        metaGroup: metaGroup as MetaGroup,
        groups,
      }));
    },
    { iterations: 2000, warmupIterations: 20 },
  );
});
