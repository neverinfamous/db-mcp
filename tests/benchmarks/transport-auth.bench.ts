/**
 * db-mcp - HTTP Transport & Auth Middleware Performance Benchmarks
 *
 * Measures request pipeline overhead, rate limiting,
 * and OAuth middleware functions.
 *
 * Run: npm run bench
 */

import { describe, bench, vi } from "vitest";
import { extractBearerToken } from "../../src/auth/middleware.js";
import {
  TokenMissingError,
  InvalidTokenError,
  InsufficientScopeError,
  isOAuthError,
  getWWWAuthenticateHeader,
} from "../../src/auth/errors.js";
import {
  hasAdminScope,
  hasWriteScope,
  hasReadScope,
  scopeGrantsToolAccess,
  scopesGrantToolAccess,
  scopesGrantDatabaseAccess,
  scopesGrantTableAccess,
  parseScopes,
  isValidScope,
  getRequiredScopeForTool,
  getAccessibleTools,
} from "../../src/auth/scopes.js";

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

const validScopes = ["read", "write", "admin", "db:mydb", "table:mydb:users"];

// ---------------------------------------------------------------------------
// 1. Token Extraction
// ---------------------------------------------------------------------------
describe("Token Extraction", () => {
  const validHeader =
    "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiYXVkIjoiZGItbWNwLWNsaWVudCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9yZWFsbXMvZGItbWNwIiwic2NvcGUiOiJyZWFkIHdyaXRlIGFkbWluIn0.signature";

  bench(
    "extractBearerToken(valid)",
    () => {
      extractBearerToken(validHeader);
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "extractBearerToken(undefined)",
    () => {
      extractBearerToken(undefined);
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "extractBearerToken(Basic — malformed)",
    () => {
      extractBearerToken("Basic dXNlcjpwYXNz");
    },
    { iterations: 10000, warmupIterations: 100 },
  );
});

// ---------------------------------------------------------------------------
// 2. Scope Checking
// ---------------------------------------------------------------------------
describe("Scope Checking", () => {
  bench(
    "hasReadScope()",
    () => {
      hasReadScope(validScopes);
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "hasWriteScope()",
    () => {
      hasWriteScope(validScopes);
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "hasAdminScope()",
    () => {
      hasAdminScope(validScopes);
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    'scopeGrantsToolAccess("admin", "read_query")',
    () => {
      scopeGrantsToolAccess("admin", "read_query");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "scopesGrantToolAccess(5 scopes, tool)",
    () => {
      scopesGrantToolAccess(validScopes, "read_query");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "scopesGrantDatabaseAccess(pattern-based)",
    () => {
      scopesGrantDatabaseAccess(validScopes, "mydb");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "scopesGrantTableAccess(pattern-based)",
    () => {
      scopesGrantTableAccess(validScopes, "mydb", "users");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "parseScopes(space-delimited string)",
    () => {
      parseScopes("read write admin db:mydb table:mydb:users");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "isValidScope() x5 patterns",
    () => {
      isValidScope("read");
      isValidScope("write");
      isValidScope("admin");
      isValidScope("db:mydb");
      isValidScope("table:mydb:users");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "getRequiredScopeForTool() x3",
    () => {
      getRequiredScopeForTool("read_query");
      getRequiredScopeForTool("write_query");
      getRequiredScopeForTool("vacuum_database");
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "getAccessibleTools(admin scopes)",
    () => {
      getAccessibleTools(["admin"]);
    },
    { iterations: 1000, warmupIterations: 10 },
  );
});

// ---------------------------------------------------------------------------
// 3. Error Construction & Formatting
// ---------------------------------------------------------------------------
describe("Error Construction & Formatting", () => {
  bench(
    "TokenMissingError creation",
    () => {
      void new TokenMissingError();
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "InvalidTokenError creation",
    () => {
      void new InvalidTokenError("Token expired");
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "InsufficientScopeError creation",
    () => {
      void new InsufficientScopeError(["admin"], ["read"]);
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  const errors = [
    new TokenMissingError(),
    new InvalidTokenError("Token expired"),
    new InsufficientScopeError(["admin"]),
    new Error("Generic error"),
  ];

  bench(
    "isOAuthError() x4 error types",
    () => {
      for (const err of errors) isOAuthError(err);
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "getWWWAuthenticateHeader()",
    () => {
      for (const err of errors) {
        if (isOAuthError(err)) {
          getWWWAuthenticateHeader(err);
        }
      }
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});

// ---------------------------------------------------------------------------
// 4. Rate Limiting
// ---------------------------------------------------------------------------
describe("HTTP Rate Limiting", () => {
  bench(
    "rate limit check (single IP)",
    () => {
      const rateLimitMap = new Map<
        string,
        { count: number; resetTime: number }
      >();
      const windowMs = 60000;
      const now = Date.now();
      const existing = rateLimitMap.get("192.168.1.1");
      if (!existing || now >= existing.resetTime) {
        rateLimitMap.set("192.168.1.1", {
          count: 1,
          resetTime: now + windowMs,
        });
      } else {
        existing.count++;
      }
    },
    { iterations: 10000, warmupIterations: 100 },
  );

  bench(
    "rate limit check (100 unique IPs, random access)",
    () => {
      const rateLimitMap = new Map<
        string,
        { count: number; resetTime: number }
      >();
      const windowMs = 60000;
      const maxRequests = 100;
      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        rateLimitMap.set(`192.168.1.${String(i)}`, {
          count: 1,
          resetTime: now + windowMs,
        });
      }
      const ip = `192.168.1.${String(Math.floor(Math.random() * 100))}`;
      const entry = rateLimitMap.get(ip);
      if (entry && entry.count < maxRequests) {
        entry.count++;
      }
    },
    { iterations: 10000, warmupIterations: 100 },
  );
});
