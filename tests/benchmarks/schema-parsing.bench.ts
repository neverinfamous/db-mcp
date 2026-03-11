/**
 * db-mcp - Zod Schema Parsing Performance Benchmarks
 *
 * Measures the hot path of input schema parsing for every tool call.
 * Covers simple schemas, complex schemas with transforms, large payloads,
 * and validation failure rejection speed.
 *
 * Run: npm run bench
 */

import { describe, bench, vi } from "vitest";
import { z } from "zod";

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
// Simulated db-mcp schemas (matching patterns in src/adapters/sqlite/types.ts)
// ---------------------------------------------------------------------------
const ReadQuerySchema = z.object({
  sql: z.string().min(1),
  params: z.array(z.unknown()).optional(),
});

const WriteQuerySchema = z.object({
  sql: z.string().min(1),
  params: z.array(z.unknown()).optional(),
});

const ListTablesSchema = z
  .object({
    includeSystem: z.boolean().optional().default(false),
  })
  .optional()
  .default({});

const DescribeTableSchema = z.object({
  table: z.string().min(1),
});

const CreateTableSchema = z.object({
  table: z.string().min(1),
  columns: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        primaryKey: z.boolean().optional(),
        notNull: z.boolean().optional(),
        unique: z.boolean().optional(),
        default: z.union([z.string(), z.number(), z.null()]).optional(),
      }),
    )
    .min(1),
  ifNotExists: z.boolean().optional().default(false),
});

const CreateIndexSchema = z.object({
  table: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  indexName: z.string().optional(),
  unique: z.boolean().optional().default(false),
  ifNotExists: z.boolean().optional().default(false),
});

const MigrationApplySchema = z.object({
  version: z.string().min(1),
  migrationSql: z.string().min(1),
  description: z.string().optional(),
  rollbackSql: z.string().optional(),
  sourceSystem: z.string().optional(),
  appliedBy: z.string().optional(),
});

const MigrationRollbackSchema = z.object({
  id: z.number().optional(),
  version: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Test payloads
// ---------------------------------------------------------------------------
const simpleReadPayload = {
  sql: "SELECT * FROM users WHERE id = ?",
  params: [1],
};

const simpleWritePayload = {
  sql: "INSERT INTO users (name, email) VALUES (?, ?)",
  params: ["Alice", "alice@example.com"],
};

const describePayload = { table: "users" };

const createTablePayload = {
  table: "test_bench_table",
  columns: [
    { name: "id", type: "INTEGER", primaryKey: true },
    { name: "name", type: "TEXT", notNull: true },
    { name: "email", type: "TEXT", unique: true },
    { name: "created_at", type: "TEXT", default: "CURRENT_TIMESTAMP" },
    { name: "status", type: "TEXT", default: "active" },
    { name: "user_id", type: "INTEGER" },
  ],
  ifNotExists: true,
};

const createIndexPayload = {
  table: "users",
  columns: ["email", "status"],
  unique: true,
};

// Large batch payload (100 rows)
const largeBatchStatements = Array.from({ length: 100 }, (_, i) => ({
  sql: `INSERT INTO products (name, price) VALUES (?, ?)`,
  params: [`Product ${String(i)}`, (Math.random() * 100).toFixed(2)],
}));

const LargeBatchSchema = z.object({
  statements: z.array(
    z.object({
      sql: z.string().min(1),
      params: z.array(z.unknown()).optional(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// 1. Simple Schema Parsing
// ---------------------------------------------------------------------------
describe("Simple Schema Parsing", () => {
  bench(
    "ReadQuerySchema.parse(simple)",
    () => {
      ReadQuerySchema.parse(simpleReadPayload);
    },
    { iterations: 5000, warmupIterations: 100 },
  );

  bench(
    "WriteQuerySchema.parse(simple)",
    () => {
      WriteQuerySchema.parse(simpleWritePayload);
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "ListTablesSchema.parse(undefined → default)",
    () => {
      ListTablesSchema.parse(undefined);
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "DescribeTableSchema.parse(simple)",
    () => {
      DescribeTableSchema.parse(describePayload);
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 2. Complex Schema Parsing (nested objects, arrays)
// ---------------------------------------------------------------------------
describe("Complex Schema Parsing", () => {
  bench(
    "CreateTableSchema.parse(6 columns + defaults)",
    () => {
      CreateTableSchema.parse(createTablePayload);
    },
    { iterations: 1000, warmupIterations: 50 },
  );

  bench(
    "CreateIndexSchema.parse(2 columns, unique)",
    () => {
      CreateIndexSchema.parse(createIndexPayload);
    },
    { iterations: 3000, warmupIterations: 30 },
  );

  bench(
    "MigrationApplySchema.parse(full payload)",
    () => {
      MigrationApplySchema.parse({
        version: "1.0.0",
        migrationSql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
        description: "Add users table",
        rollbackSql: "DROP TABLE users",
        sourceSystem: "agent",
        appliedBy: "antigravity",
      });
    },
    { iterations: 3000, warmupIterations: 50 },
  );

  bench(
    "MigrationRollbackSchema.parse(by version + dryRun)",
    () => {
      MigrationRollbackSchema.parse({ version: "1.0.0", dryRun: true });
    },
    { iterations: 5000, warmupIterations: 100 },
  );
});

// ---------------------------------------------------------------------------
// 3. Large Payload Parsing
// ---------------------------------------------------------------------------
describe("Large Payload Parsing", () => {
  bench(
    "LargeBatchSchema.parse(100 statements)",
    () => {
      LargeBatchSchema.parse({ statements: largeBatchStatements });
    },
    { iterations: 200, warmupIterations: 20 },
  );
});

// ---------------------------------------------------------------------------
// 4. Validation Failure (Rejection Speed)
// ---------------------------------------------------------------------------
describe("Validation Failure Paths", () => {
  bench(
    "ReadQuerySchema.parse(missing sql — safeParse)",
    () => {
      ReadQuerySchema.safeParse({});
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "CreateTableSchema.parse(empty columns — safeParse)",
    () => {
      CreateTableSchema.safeParse({ table: "test", columns: [] });
    },
    { iterations: 3000, warmupIterations: 30 },
  );

  bench(
    "CreateIndexSchema.parse(missing all required — safeParse)",
    () => {
      CreateIndexSchema.safeParse({});
    },
    { iterations: 3000, warmupIterations: 30 },
  );

  bench(
    "WriteQuerySchema.parse(wrong param types — safeParse)",
    () => {
      WriteQuerySchema.safeParse({ sql: 123, params: "not-an-array" });
    },
    { iterations: 3000, warmupIterations: 30 },
  );
});

// ---------------------------------------------------------------------------
// 5. JSON Schema Conversion (Registration-time)
// ---------------------------------------------------------------------------
describe("JSON Schema Conversion", () => {
  bench(
    "ReadQuerySchema → shape extraction",
    () => {
      const shape = ReadQuerySchema.shape;
      const keys = Object.keys(shape);
      const properties: Record<string, { type: string }> = {};
      for (const key of keys) {
        properties[key] = { type: "string" };
      }
      void JSON.stringify({
        type: "object",
        properties,
        required: [],
      });
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "CreateTableSchema → shape extraction",
    () => {
      const shape = CreateTableSchema.shape;
      const keys = Object.keys(shape);
      const properties: Record<string, { type: string }> = {};
      for (const key of keys) {
        properties[key] = { type: "string" };
      }
      void JSON.stringify({
        type: "object",
        properties,
        required: [],
      });
    },
    { iterations: 3000, warmupIterations: 30 },
  );
});

// ---------------------------------------------------------------------------
// 6. Raw Zod Overhead Baseline
// ---------------------------------------------------------------------------
describe("Raw Zod Overhead Baseline", () => {
  const trivialSchema = z.object({ x: z.number() });
  const mediumSchema = z.object({
    a: z.string(),
    b: z.number(),
    c: z.boolean().optional(),
    d: z.array(z.string()).optional(),
    e: z.object({ f: z.string(), g: z.number() }).optional(),
  });

  bench(
    "trivial z.object({x: z.number()}).parse()",
    () => {
      trivialSchema.parse({ x: 42 });
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "medium schema (5 fields, nested object)",
    () => {
      mediumSchema.parse({
        a: "hello",
        b: 42,
        c: true,
        d: ["a", "b"],
        e: { f: "nested", g: 1 },
      });
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});
