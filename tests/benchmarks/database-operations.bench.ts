/**
 * db-mcp - Database Operations Performance Benchmarks
 *
 * SQLite-specific benchmarks replacing postgres-mcp's connection-pool.bench.ts.
 * Measures SQLite adapter overhead, query framework cost, schema operations,
 * and JSON utility performance using mocked internals.
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

// ---------------------------------------------------------------------------
// Simulated SQLite Database Operations
// ---------------------------------------------------------------------------

// Simulated PRAGMA parsing (replicates adapter overhead without actual SQLite)
const PRAGMA_MAP = new Map<string, unknown>([
  ["journal_mode", "wal"],
  ["foreign_keys", 1],
  ["busy_timeout", 5000],
  ["cache_size", -2000],
  ["synchronous", 1],
  ["temp_store", 2],
  ["mmap_size", 268435456],
  ["wal_autocheckpoint", 1000],
  ["page_size", 4096],
  ["auto_vacuum", 0],
]);

// Simulated table metadata
const TABLE_METADATA = [
  { name: "users", type: "table", sql: "CREATE TABLE users ..." },
  { name: "orders", type: "table", sql: "CREATE TABLE orders ..." },
  { name: "products", type: "table", sql: "CREATE TABLE products ..." },
  { name: "categories", type: "table", sql: "CREATE TABLE categories ..." },
  { name: "reviews", type: "table", sql: "CREATE TABLE reviews ..." },
  { name: "tags", type: "table", sql: "CREATE TABLE tags ..." },
  { name: "product_tags", type: "table", sql: "CREATE TABLE product_tags ..." },
  { name: "order_items", type: "table", sql: "CREATE TABLE order_items ..." },
];

// Simulated column info (PRAGMA table_info result)
const COLUMN_INFO = [
  { cid: 0, name: "id", type: "INTEGER", notnull: 0, pk: 1 },
  { cid: 1, name: "name", type: "TEXT", notnull: 1, pk: 0 },
  { cid: 2, name: "email", type: "TEXT", notnull: 1, pk: 0 },
  { cid: 3, name: "created_at", type: "TEXT", notnull: 0, pk: 0 },
  { cid: 4, name: "status", type: "TEXT", notnull: 0, pk: 0 },
  { cid: 5, name: "bio", type: "TEXT", notnull: 0, pk: 0 },
];

// ---------------------------------------------------------------------------
// 1. PRAGMA Operations
// ---------------------------------------------------------------------------
describe("PRAGMA Operations", () => {
  bench(
    "PRAGMA lookup (Map.get)",
    () => {
      PRAGMA_MAP.get("journal_mode");
      PRAGMA_MAP.get("foreign_keys");
      PRAGMA_MAP.get("busy_timeout");
    },
    { iterations: 50000, warmupIterations: 500 },
  );

  bench(
    "PRAGMA full scan (10 settings)",
    () => {
      const settings: Record<string, unknown> = {};
      for (const [key, value] of PRAGMA_MAP) {
        settings[key] = value;
      }
      void settings;
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "PRAGMA result serialization",
    () => {
      const result = Object.fromEntries(PRAGMA_MAP);
      void JSON.stringify(result);
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 2. Table Listing & Metadata
// ---------------------------------------------------------------------------
describe("Table Listing & Metadata", () => {
  bench(
    "filter user tables (exclude sqlite_%)",
    () => {
      const allTables = [
        ...TABLE_METADATA,
        {
          name: "sqlite_sequence",
          type: "table",
          sql: "CREATE TABLE sqlite_sequence ...",
        },
        {
          name: "sqlite_stat1",
          type: "table",
          sql: "CREATE TABLE sqlite_stat1 ...",
        },
      ];
      const userTables = allTables.filter(
        (t) => !t.name.startsWith("sqlite_"),
      );
      void userTables.length;
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "column info extraction (6 columns)",
    () => {
      const columns = COLUMN_INFO.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: col.notnull === 0,
        primaryKey: col.pk === 1,
      }));
      void columns;
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "generate CREATE TABLE DDL from column info",
    () => {
      const parts = COLUMN_INFO.map(
        (col) =>
          `"${col.name}" ${col.type}${col.pk ? " PRIMARY KEY" : ""}${col.notnull ? " NOT NULL" : ""}`,
      );
      const ddl = `CREATE TABLE "users" (${parts.join(", ")})`;
      void ddl;
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 3. Query Result Processing
// ---------------------------------------------------------------------------
describe("Query Result Processing", () => {
  // Simulated query results of various sizes
  const smallResult = {
    columns: ["id", "name", "email"],
    rows: [
      [1, "Alice", "alice@example.com"],
      [2, "Bob", "bob@example.com"],
    ],
  };

  const mediumResult = {
    columns: ["id", "name", "email", "status", "created_at"],
    rows: Array.from({ length: 100 }, (_, i) => [
      i + 1,
      `User ${String(i)}`,
      `user${String(i)}@example.com`,
      "active",
      "2025-01-01T00:00:00Z",
    ]),
  };

  bench(
    "small result → JSON serialization (2 rows)",
    () => {
      void JSON.stringify(smallResult);
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "medium result → JSON serialization (100 rows)",
    () => {
      void JSON.stringify(mediumResult);
    },
    { iterations: 1000, warmupIterations: 10 },
  );

  bench(
    "result → column-keyed objects (2 rows)",
    () => {
      const objects = smallResult.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < smallResult.columns.length; i++) {
          const col = smallResult.columns[i];
          if (col !== undefined) {
            obj[col] = row[i];
          }
        }
        return obj;
      });
      void objects;
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "result → column-keyed objects (100 rows)",
    () => {
      const objects = mediumResult.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < mediumResult.columns.length; i++) {
          const col = mediumResult.columns[i];
          if (col !== undefined) {
            obj[col] = row[i];
          }
        }
        return obj;
      });
      void objects;
    },
    { iterations: 500, warmupIterations: 10 },
  );
});

// ---------------------------------------------------------------------------
// 4. JSON Path Validation (SQLite JSON operations)
// ---------------------------------------------------------------------------
describe("JSON Path Validation", () => {
  const validPaths = ["$.name", "$.address.city", "$.tags[0]", "$.nested.deep.value"];
  const invalidPaths = ["name", "..invalid", "$[", "$."];

  bench(
    "validate JSON path (4 valid paths)",
    () => {
      for (const path of validPaths) {
        const isValid = path.startsWith("$") && !/[;'"\\]/.test(path);
        void isValid;
      }
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "validate JSON path (4 invalid paths)",
    () => {
      for (const path of invalidPaths) {
        const isValid = path.startsWith("$") && !/[;'"\\]/.test(path);
        void isValid;
      }
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "JSON.parse() small payload",
    () => {
      void JSON.parse('{"name":"Alice","age":30,"active":true}');
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "JSON.parse() medium payload (100 items)",
    () => {
      const json = JSON.stringify(
        Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `item_${String(i)}`,
          value: Math.random(),
        })),
      );
      void JSON.parse(json);
    },
    { iterations: 1000, warmupIterations: 10 },
  );
});

// ---------------------------------------------------------------------------
// 5. Schema Cache Operations
// ---------------------------------------------------------------------------
describe("Schema Cache Operations", () => {
  const schemaCache = new Map<
    string,
    { data: unknown; timestamp: number; version: number }
  >();
  const CACHE_TTL = 30000;

  // Pre-populate cache
  schemaCache.set("tables", {
    data: TABLE_METADATA,
    timestamp: Date.now(),
    version: 1,
  });
  schemaCache.set("columns:users", {
    data: COLUMN_INFO,
    timestamp: Date.now(),
    version: 1,
  });

  bench(
    "cache check (hit + freshness validation)",
    () => {
      const entry = schemaCache.get("tables");
      if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        void entry.data;
      }
    },
    { iterations: 50000, warmupIterations: 500 },
  );

  bench(
    "cache invalidation (delete pattern)",
    () => {
      schemaCache.set("temp", {
        data: null,
        timestamp: Date.now(),
        version: 1,
      });
      schemaCache.delete("temp");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "cache full refresh (8 tables)",
    () => {
      for (const table of TABLE_METADATA) {
        schemaCache.set(`columns:${table.name}`, {
          data: COLUMN_INFO,
          timestamp: Date.now(),
          version: schemaCache.get(`columns:${table.name}`)?.version ?? 0 + 1,
        });
      }
    },
    { iterations: 3000, warmupIterations: 30 },
  );
});
