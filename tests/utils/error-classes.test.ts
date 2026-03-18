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
