/**
 * Error Classes Unit Tests
 *
 * Tests the typed error subclasses for each ErrorCategory.
 * Specifically covers AuthenticationError, AuthorizationError,
 * and TransactionError which were previously uncovered.
 */

import { describe, it, expect } from "vitest";
import {
  ValidationError,
  ConnectionError,
  QueryError,
  PermissionError,
  ResourceNotFoundError,
  ConfigurationError,
  InternalError,
  AuthenticationError,
  AuthorizationError,
  TransactionError,
  TimeoutError,
  RateLimitError,
  ConflictError,
} from "../../src/utils/errors/index.js";
import { ErrorCategory, DbMcpError } from "../../src/utils/errors/index.js";

// =============================================================================
// AuthenticationError
// =============================================================================

describe("AuthenticationError", () => {
  it("should create with default code", () => {
    const err = new AuthenticationError("Invalid token");
    expect(err).toBeInstanceOf(DbMcpError);
    expect(err.message).toBe("Invalid token");
    expect(err.code).toBe("AUTHENTICATION_ERROR");
    expect(err.category).toBe(ErrorCategory.AUTHENTICATION);
    expect(err.recoverable).toBe(false);
  });

  it("should create with custom code", () => {
    const err = new AuthenticationError("Token expired", "TOKEN_EXPIRED");
    expect(err.code).toBe("TOKEN_EXPIRED");
  });

  it("should accept options", () => {
    const cause = new Error("original");
    const err = new AuthenticationError("Failed", "AUTH_FAIL", {
      suggestion: "Refresh token",
      details: { tokenId: "abc" },
      cause,
    });
    expect(err.suggestion).toBe("Refresh token");
    expect(err.details).toEqual({ tokenId: "abc" });
    expect(err.cause).toBe(cause);
  });
});

// =============================================================================
// AuthorizationError
// =============================================================================

describe("AuthorizationError", () => {
  it("should create with default code", () => {
    const err = new AuthorizationError("Insufficient permissions");
    expect(err).toBeInstanceOf(DbMcpError);
    expect(err.message).toBe("Insufficient permissions");
    expect(err.code).toBe("AUTHORIZATION_ERROR");
    expect(err.category).toBe(ErrorCategory.AUTHORIZATION);
    expect(err.recoverable).toBe(false);
  });

  it("should create with custom code and options", () => {
    const err = new AuthorizationError("No write access", "SCOPE_MISSING", {
      suggestion: "Request write scope",
      details: { requiredScope: "write" },
    });
    expect(err.code).toBe("SCOPE_MISSING");
    expect(err.suggestion).toBe("Request write scope");
  });
});

// =============================================================================
// TransactionError
// =============================================================================

describe("TransactionError", () => {
  it("should create with default code", () => {
    const err = new TransactionError("Commit failed");
    expect(err).toBeInstanceOf(DbMcpError);
    expect(err.message).toBe("Commit failed");
    expect(err.code).toBe("TRANSACTION_ERROR");
    expect(err.category).toBe(ErrorCategory.QUERY);
    expect(err.recoverable).toBe(true); // Transactions are retriable
  });

  it("should create with custom code and cause", () => {
    const cause = new Error("lock timeout");
    const err = new TransactionError("Deadlock detected", "TX_DEADLOCK", {
      cause,
      details: { table: "users" },
    });
    expect(err.code).toBe("TX_DEADLOCK");
    expect(err.cause).toBe(cause);
  });
});

// =============================================================================
// TimeoutError
// =============================================================================

describe("TimeoutError", () => {
  it("should create with default code and category", () => {
    const err = new TimeoutError("Execution timed out");
    expect(err).toBeInstanceOf(DbMcpError);
    expect(err.message).toBe("Execution timed out");
    expect(err.code).toBe("TIMEOUT_ERROR");
    expect(err.category).toBe(ErrorCategory.TIMEOUT);
    expect(err.recoverable).toBe(true);
  });

  it("should create with custom code", () => {
    const err = new TimeoutError("Sandbox timeout", "CODEMODE_TIMEOUT");
    expect(err.code).toBe("CODEMODE_TIMEOUT");
  });

  it("should include timeoutMs in details", () => {
    const err = new TimeoutError("Execution timed out", "TIMEOUT_ERROR", {
      timeoutMs: 5000,
      details: { script: "test.js" },
    });
    expect(err.details).toMatchObject({ timeoutMs: 5000, script: "test.js" });
  });

  it("should accept cause and suggestion", () => {
    const cause = new Error("V8 timeout");
    const err = new TimeoutError("Timed out", "TIMEOUT_ERROR", {
      suggestion: "Increase timeout",
      cause,
    });
    expect(err.suggestion).toBe("Increase timeout");
    expect(err.cause).toBe(cause);
  });

  it("should produce correct toResponse()", () => {
    const err = new TimeoutError("Timed out");
    const res = err.toResponse();
    expect(res.success).toBe(false);
    expect(res.category).toBe("timeout");
    expect(res.recoverable).toBe(true);
  });
});

// =============================================================================
// RateLimitError
// =============================================================================

describe("RateLimitError", () => {
  it("should create with default code and category", () => {
    const err = new RateLimitError("Too many requests");
    expect(err).toBeInstanceOf(DbMcpError);
    expect(err.message).toBe("Too many requests");
    expect(err.code).toBe("RATE_LIMIT_ERROR");
    expect(err.category).toBe(ErrorCategory.RATE_LIMIT);
    expect(err.recoverable).toBe(true);
  });

  it("should create with custom code", () => {
    const err = new RateLimitError("Codemode limited", "CODEMODE_RATE_LIMITED");
    expect(err.code).toBe("CODEMODE_RATE_LIMITED");
  });

  it("should include retryAfterMs and limit in details", () => {
    const err = new RateLimitError("Rate limited", "RATE_LIMIT_ERROR", {
      retryAfterMs: 60000,
      limit: 100,
      details: { clientId: "agent-1" },
    });
    expect(err.details).toMatchObject({
      retryAfterMs: 60000,
      limit: 100,
      clientId: "agent-1",
    });
  });

  it("should accept suggestion and cause", () => {
    const cause = new Error("bucket exhausted");
    const err = new RateLimitError("Limited", "RATE_LIMIT_ERROR", {
      suggestion: "Wait 60 seconds",
      cause,
    });
    expect(err.suggestion).toBe("Wait 60 seconds");
    expect(err.cause).toBe(cause);
  });

  it("should produce correct toResponse()", () => {
    const err = new RateLimitError("Limited");
    const res = err.toResponse();
    expect(res.success).toBe(false);
    expect(res.category).toBe("rate_limit");
    expect(res.recoverable).toBe(true);
  });
});

// =============================================================================
// ConflictError
// =============================================================================

describe("ConflictError", () => {
  it("should create with default code and category", () => {
    const err = new ConflictError("Version mismatch");
    expect(err).toBeInstanceOf(DbMcpError);
    expect(err.message).toBe("Version mismatch");
    expect(err.code).toBe("CONFLICT_ERROR");
    expect(err.category).toBe(ErrorCategory.QUERY);
    expect(err.recoverable).toBe(true);
  });

  it("should create with custom code", () => {
    const err = new ConflictError("Stale write", "OCC_VIOLATION");
    expect(err.code).toBe("OCC_VIOLATION");
  });

  it("should include conflictType in details", () => {
    const err = new ConflictError("Conflict", "CONFLICT_ERROR", {
      conflictType: "version_mismatch",
      details: { table: "users", expectedVersion: 3 },
    });
    expect(err.details).toMatchObject({
      conflictType: "version_mismatch",
      table: "users",
      expectedVersion: 3,
    });
  });

  it("should accept suggestion and cause", () => {
    const cause = new Error("row modified");
    const err = new ConflictError("Concurrent update", "CONFLICT_ERROR", {
      suggestion: "Re-read the current row version and retry",
      cause,
    });
    expect(err.suggestion).toBe("Re-read the current row version and retry");
    expect(err.cause).toBe(cause);
  });

  it("should produce correct toResponse()", () => {
    const err = new ConflictError("Conflict");
    const res = err.toResponse();
    expect(res.success).toBe(false);
    expect(res.category).toBe("query");
    expect(res.recoverable).toBe(true);
  });
});

// =============================================================================
// Verify already-covered classes maintain behavior
// =============================================================================

describe("Error class coverage completeness", () => {
  it("ValidationError defaults", () => {
    const err = new ValidationError("bad input");
    expect(err.category).toBe(ErrorCategory.VALIDATION);
    expect(err.recoverable).toBe(false);
  });

  it("ConnectionError defaults (recoverable)", () => {
    const err = new ConnectionError("timeout");
    expect(err.category).toBe(ErrorCategory.CONNECTION);
    expect(err.recoverable).toBe(true);
  });

  it("QueryError includes sql in details", () => {
    const err = new QueryError("syntax error", "Q_FAIL", {
      sql: "SELECT * FROM oops",
    });
    expect(err.details).toMatchObject({ sql: "SELECT * FROM oops" });
  });

  it("ResourceNotFoundError includes resource info", () => {
    const err = new ResourceNotFoundError("not found", "NOT_FOUND", {
      resourceType: "table",
      resourceName: "users",
    });
    expect(err.details).toMatchObject({
      resourceType: "table",
      resourceName: "users",
    });
  });

  it("PermissionError defaults", () => {
    const err = new PermissionError("denied");
    expect(err.category).toBe(ErrorCategory.PERMISSION);
  });

  it("ConfigurationError defaults", () => {
    const err = new ConfigurationError("bad config");
    expect(err.category).toBe(ErrorCategory.CONFIGURATION);
  });

  it("InternalError defaults", () => {
    const err = new InternalError("unexpected");
    expect(err.category).toBe(ErrorCategory.INTERNAL);
  });
});
