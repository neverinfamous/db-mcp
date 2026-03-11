/**
 * db-mcp - Resource & Prompt Generation Performance Benchmarks
 *
 * Measures resource URI matching, prompt generation, and the
 * overhead of compact tool index / discovery prompt assembly.
 *
 * Run: npm run bench
 */

import { describe, bench, vi } from "vitest";

// Suppress logger output
vi.mock("../../src/utils/logger/index.js", () => ({
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

// Resource URI templates (same pattern as db-mcp)
const resourceTemplates = [
  { uriTemplate: "sqlite://schema", name: "Database Schema" },
  { uriTemplate: "sqlite://tables", name: "Table List" },
  { uriTemplate: "sqlite://capabilities", name: "Server Capabilities" },
  { uriTemplate: "sqlite://database-info", name: "Database Info" },
  { uriTemplate: "sqlite://pragma-settings", name: "PRAGMA Settings" },
  { uriTemplate: "sqlite://extensions", name: "Extensions" },
  { uriTemplate: "sqlite://indexes", name: "Indexes" },
  { uriTemplate: "sqlite://fts-tables", name: "FTS Tables" },
  { uriTemplate: "sqlite://virtual-tables", name: "Virtual Tables" },
  { uriTemplate: "sqlite://triggers", name: "Triggers" },
];

// ---------------------------------------------------------------------------
// 1. Resource URI Matching
// ---------------------------------------------------------------------------
describe("Resource URI Matching", () => {
  const resourceMap = new Map<string, (typeof resourceTemplates)[0]>();
  for (const template of resourceTemplates) {
    resourceMap.set(template.uriTemplate, template);
  }

  bench(
    "Map.get() single URI match",
    () => {
      resourceMap.get("sqlite://schema");
    },
    { iterations: 50000, warmupIterations: 500 },
  );

  bench(
    "Map.get() miss (unknown URI)",
    () => {
      resourceMap.get("sqlite://nonexistent");
    },
    { iterations: 50000, warmupIterations: 500 },
  );

  bench(
    "scan all resource templates (Array.find())",
    () => {
      const targetUri = "sqlite://triggers";
      resourceTemplates.find((t) => t.uriTemplate === targetUri);
    },
    { iterations: 30000, warmupIterations: 300 },
  );

  bench(
    "list all resources (Array.map → URIs)",
    () => {
      const uris = resourceTemplates.map((t) => t.uriTemplate);
      void uris.length;
    },
    { iterations: 10000, warmupIterations: 100 },
  );
});

// ---------------------------------------------------------------------------
// 2. Resource Content Assembly
// ---------------------------------------------------------------------------
describe("Resource Content Assembly", () => {
  bench(
    "build schema resource content (simulated)",
    () => {
      const tables = [
        "users",
        "orders",
        "products",
        "categories",
        "reviews",
        "tags",
        "product_tags",
        "order_items",
      ];
      const schema = tables.map((t) => ({
        table: t,
        columns: [
          { name: "id", type: "INTEGER", pk: true },
          { name: "name", type: "TEXT" },
          { name: "created_at", type: "TEXT" },
        ],
      }));
      void JSON.stringify(schema);
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "build capabilities resource content",
    () => {
      const capabilities = {
        serverName: "db-mcp",
        version: "1.0.2",
        transport: "stdio",
        toolGroups: ["core", "json", "text", "stats", "admin", "vector", "geo"],
        toolCount: 139,
        resourceCount: 10,
        promptCount: 8,
        features: ["codemode", "tool-filtering", "oauth"],
      };
      void JSON.stringify(capabilities);
    },
    { iterations: 10000, warmupIterations: 100 },
  );
});

// ---------------------------------------------------------------------------
// 3. Prompt Message Assembly
// ---------------------------------------------------------------------------
describe("Prompt Message Assembly", () => {
  bench(
    "build prompt messages array (3 messages)",
    () => {
      const messages = [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "How do I set up full-text search in SQLite?",
          },
        },
        {
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: "To set up FTS5 in SQLite, first create a virtual table...",
          },
        },
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "What about ranking results?",
          },
        },
      ];
      void JSON.stringify(messages);
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "prompt argument schema parse (simple)",
    () => {
      // Simulate what prompt handlers do: validate arguments
      const args: Record<string, string | undefined> = {
        topic: "full-text search",
        table: "documents",
      };
      const validated: Record<string, string> = {};
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === "string" && value.length > 0) {
          validated[key] = value;
        }
      }
      void validated;
    },
    { iterations: 10000, warmupIterations: 100 },
  );
});

// ---------------------------------------------------------------------------
// 4. Tool Index Generation (Lazy Hydration)
// ---------------------------------------------------------------------------
describe("Tool Index Generation", () => {
  const toolIndex = [
    { name: "sqlite_read_query", group: "core", desc: "Execute read-only SQL" },
    { name: "sqlite_write_query", group: "core", desc: "Execute write SQL" },
    { name: "sqlite_list_tables", group: "core", desc: "List all tables" },
    { name: "sqlite_describe_table", group: "core", desc: "Describe table" },
    { name: "sqlite_json_extract", group: "json", desc: "Extract JSON value" },
    { name: "sqlite_json_set", group: "json", desc: "Set JSON value" },
    { name: "sqlite_fts_search", group: "text", desc: "Full-text search" },
    { name: "sqlite_vec_search", group: "vector", desc: "Vector search" },
    { name: "sqlite_execute_code", group: "codemode", desc: "Execute code" },
  ];

  bench(
    "compact tool index (9 tools → JSON)",
    () => {
      void JSON.stringify(
        toolIndex.map((t) => `${t.name} (${t.group}): ${t.desc}`),
      );
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "tool index grouped by group",
    () => {
      const grouped = new Map<string, typeof toolIndex>();
      for (const tool of toolIndex) {
        const group = grouped.get(tool.group) ?? [];
        group.push(tool);
        grouped.set(tool.group, group);
      }
      void grouped.size;
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});
