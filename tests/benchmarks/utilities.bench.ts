/**
 * db-mcp - Utility Functions Performance Benchmarks
 *
 * Measures overhead of hot-path utilities: identifier sanitization,
 * WHERE clause validation, and SQL query validation.
 *
 * Run: npm run bench
 */

import { describe, bench, vi } from "vitest";
import {
  validateIdentifier,
  sanitizeIdentifier,
  quoteIdentifier,
  sanitizeTableName,
  createColumnList,
  needsQuoting,
} from "../../src/utils/identifiers.js";
import {
  validateWhereClause,
  sanitizeWhereClause,
} from "../../src/utils/where-clause.js";

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
// Inline SQL validation (matches db-mcp patterns)
// ---------------------------------------------------------------------------
const DANGEROUS_SQL_PATTERNS = [
  /;\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE)/i,
  /--/,
  /\/\*/,
  /\bEXEC\b/i,
  /\bEXECUTE\b\s/i,
  /\bUNION\s+(ALL\s+)?SELECT\b/i,
  /\bATTACH\b/i,
  /\bDETACH\b/i,
  /\bLOAD_EXTENSION\b/i,
];

const READ_ONLY_PATTERN =
  /^\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b/i;

function validateSql(sql: string, isReadOnly: boolean): void {
  if (!sql || typeof sql !== "string") {
    throw new Error("Query must be a non-empty string");
  }
  if (isReadOnly && READ_ONLY_PATTERN.test(sql)) {
    throw new Error("Write operation not allowed in read-only mode");
  }
  for (const pattern of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      throw new Error(`Potentially dangerous SQL pattern detected`);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Identifier Sanitization
// ---------------------------------------------------------------------------
describe("Identifier Sanitization", () => {
  bench(
    'validateIdentifier("users")',
    () => {
      validateIdentifier("users");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    'sanitizeIdentifier("user_profiles")',
    () => {
      sanitizeIdentifier("user_profiles");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    'quoteIdentifier("outer") — reserved keyword',
    () => {
      quoteIdentifier("outer");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    'sanitizeTableName("users")',
    () => {
      sanitizeTableName("users");
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "createColumnList(10 columns)",
    () => {
      createColumnList([
        "id",
        "name",
        "email",
        "created_at",
        "updated_at",
        "status",
        "role",
        "bio",
        "avatar",
        "score",
      ]);
    },
    { iterations: 3000, warmupIterations: 30 },
  );

  bench(
    "needsQuoting() x6 identifiers",
    () => {
      const ids = [
        "users",
        "UserProfile",
        "_private",
        "select",
        "normal_table",
        "create",
      ];
      for (const id of ids) needsQuoting(id);
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 2. WHERE Clause Validation
// ---------------------------------------------------------------------------
describe("WHERE Clause Validation", () => {
  bench(
    "validateWhereClause(simple)",
    () => {
      validateWhereClause("price > 10");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "validateWhereClause(complex, ~110 chars)",
    () => {
      validateWhereClause(
        "status = 'active' AND created_at > '2025-01-01' AND (role = 'admin' OR role = 'moderator') AND deleted_at IS NULL",
      );
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "sanitizeWhereClause()",
    () => {
      sanitizeWhereClause("id = 1 AND active = 1");
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "validateWhereClause(blocked — early rejection)",
    () => {
      try {
        validateWhereClause("1=1; DROP TABLE users;--");
      } catch {
        // Expected
      }
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 3. SQL Query Validation
// ---------------------------------------------------------------------------
describe("SQL Query Validation", () => {
  bench(
    "validateQuery(simple SELECT)",
    () => {
      validateSql("SELECT * FROM users WHERE id = ?", true);
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "validateQuery(complex SELECT, ~160 chars)",
    () => {
      validateSql(
        "SELECT u.id, u.name, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count FROM users u WHERE u.active = 1 ORDER BY u.created_at DESC LIMIT 50",
        true,
      );
    },
    { iterations: 3000, warmupIterations: 30 },
  );

  bench(
    "validateQuery(INSERT, write mode)",
    () => {
      validateSql(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        false,
      );
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 4. Metadata Cache Operations
// ---------------------------------------------------------------------------
describe("Metadata Cache Operations", () => {
  const cache = new Map<string, { data: unknown; timestamp: number }>();
  const TTL_MS = 30000;
  cache.set("schema", {
    data: { tables: ["users", "orders"] },
    timestamp: Date.now(),
  });
  cache.set("tables", {
    data: [{ name: "users" }, { name: "orders" }],
    timestamp: Date.now(),
  });

  bench(
    "cache hit + miss pattern",
    () => {
      const entry = cache.get("schema");
      if (entry && Date.now() - entry.timestamp <= TTL_MS) {
        void entry.data;
      }
      cache.get("nonexistent");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "cache set + delete pattern",
    () => {
      cache.set("key", { data: "value", timestamp: Date.now() });
      cache.delete("key");
    },
    { iterations: 10000, warmupIterations: 100 },
  );
});
