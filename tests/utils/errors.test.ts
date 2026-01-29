/**
 * Error System Tests
 *
 * Tests for the enhanced error system including:
 * - Error class instantiation and properties
 * - Pattern-based suggestion matching
 * - Error categorization
 * - formatError and wrapError utilities
 * - Error response structure
 *
 * Phase 2 of db-mcp Security Test Coverage Improvement Plan
 */

import { describe, it, expect } from "vitest";
import {
  DbMcpError,
  ValidationError,
  ConnectionError,
  QueryError,
  PermissionError,
  ResourceNotFoundError,
  ConfigurationError,
  InternalError,
  ErrorCategory,
  formatError,
  wrapError,
  isDbMcpError,
} from "../../src/utils/errors.js";

// =============================================================================
// Base DbMcpError Tests
// =============================================================================

describe("DbMcpError", () => {
  it("should create error with basic properties", () => {
    const error = new DbMcpError(
      "Test error",
      "TEST_CODE",
      ErrorCategory.VALIDATION,
    );

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.name).toBe("DbMcpError");
    expect(error.recoverable).toBe(false);
  });

  it("should support suggestions", () => {
    const error = new DbMcpError("Test", "CODE", ErrorCategory.QUERY, {
      suggestion: "Try this instead",
    });

    expect(error.suggestion).toBe("Try this instead");
  });

  it("should support details", () => {
    const error = new DbMcpError("Test", "CODE", ErrorCategory.QUERY, {
      details: { table: "users", column: "id" },
    });

    expect(error.details).toEqual({ table: "users", column: "id" });
  });

  it("should support cause chain", () => {
    const cause = new Error("Original error");
    const error = new DbMcpError("Wrapped", "CODE", ErrorCategory.INTERNAL, {
      cause,
    });

    expect(error.cause).toBe(cause);
  });

  it("should support recoverable flag", () => {
    const error = new DbMcpError("Test", "CODE", ErrorCategory.CONNECTION, {
      recoverable: true,
    });

    expect(error.recoverable).toBe(true);
  });

  describe("toResponse", () => {
    it("should convert to structured response", () => {
      const error = new DbMcpError("Test error", "TEST", ErrorCategory.QUERY, {
        suggestion: "Fix it",
        details: { sql: "SELECT *" },
      });

      const response = error.toResponse();

      expect(response).toEqual({
        success: false,
        error: "Test error",
        code: "TEST",
        category: ErrorCategory.QUERY,
        suggestion: "Fix it",
        recoverable: false,
        details: { sql: "SELECT *" },
      });
    });
  });
});

// =============================================================================
// Specific Error Class Tests
// =============================================================================

describe("ValidationError", () => {
  it("should have correct category", () => {
    const error = new ValidationError("Invalid input");

    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.recoverable).toBe(false);
  });

  it("should accept custom code", () => {
    const error = new ValidationError("Bad table", "INVALID_TABLE");

    expect(error.code).toBe("INVALID_TABLE");
  });
});

describe("ConnectionError", () => {
  it("should have correct category and be recoverable", () => {
    const error = new ConnectionError("Connection failed");

    expect(error.category).toBe(ErrorCategory.CONNECTION);
    expect(error.code).toBe("CONNECTION_ERROR");
    expect(error.recoverable).toBe(true); // Connection errors are transient
  });
});

describe("QueryError", () => {
  it("should have correct category", () => {
    const error = new QueryError("Syntax error");

    expect(error.category).toBe(ErrorCategory.QUERY);
    expect(error.code).toBe("QUERY_ERROR");
  });

  it("should include SQL in details", () => {
    const error = new QueryError("Syntax error", "DB_QUERY_FAILED", {
      sql: "SELECT * FORM users",
    });

    expect(error.details).toHaveProperty("sql", "SELECT * FORM users");
  });
});

describe("PermissionError", () => {
  it("should have correct category", () => {
    const error = new PermissionError("Access denied");

    expect(error.category).toBe(ErrorCategory.PERMISSION);
    expect(error.code).toBe("PERMISSION_ERROR");
  });
});

describe("ResourceNotFoundError", () => {
  it("should have correct category", () => {
    const error = new ResourceNotFoundError("Table not found");

    expect(error.category).toBe(ErrorCategory.RESOURCE);
    expect(error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("should include resource info in details", () => {
    const error = new ResourceNotFoundError("Not found", "TABLE_NOT_FOUND", {
      resourceType: "table",
      resourceName: "users",
    });

    expect(error.details).toHaveProperty("resourceType", "table");
    expect(error.details).toHaveProperty("resourceName", "users");
  });
});

describe("ConfigurationError", () => {
  it("should have correct category", () => {
    const error = new ConfigurationError("Missing config");

    expect(error.category).toBe(ErrorCategory.CONFIGURATION);
    expect(error.code).toBe("CONFIG_ERROR");
  });
});

describe("InternalError", () => {
  it("should have correct category", () => {
    const error = new InternalError("Unexpected failure");

    expect(error.category).toBe(ErrorCategory.INTERNAL);
    expect(error.code).toBe("INTERNAL_ERROR");
  });
});

// =============================================================================
// Pattern-Based Suggestion Tests
// =============================================================================

describe("Pattern-based suggestions", () => {
  it("should suggest fix for invalid table name", () => {
    const error = new DbMcpError(
      "Invalid table name: 123users",
      "CODE",
      ErrorCategory.VALIDATION,
    );

    expect(error.suggestion).toContain("Table names must start");
  });

  it("should suggest fix for table not found", () => {
    const error = new DbMcpError(
      "no such table: users",
      "CODE",
      ErrorCategory.RESOURCE,
    );

    expect(error.suggestion).toContain("sqlite_list_tables");
  });

  it("should suggest fix for column not found", () => {
    const error = new DbMcpError(
      "no such column: email",
      "CODE",
      ErrorCategory.RESOURCE,
    );

    expect(error.suggestion).toContain("sqlite_describe_table");
  });

  it("should suggest fix for syntax error", () => {
    const error = new DbMcpError(
      "syntax error near FROM",
      "CODE",
      ErrorCategory.QUERY,
    );

    expect(error.suggestion).toContain("syntax");
  });

  it("should suggest fix for database is locked", () => {
    const error = new DbMcpError(
      "database is locked",
      "CODE",
      ErrorCategory.CONNECTION,
    );

    expect(error.suggestion).toContain("Wait and retry");
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe("formatError", () => {
  it("should format DbMcpError", () => {
    const error = new ValidationError("Invalid input", "INVALID", {
      suggestion: "Fix it",
    });

    const response = formatError(error);

    expect(response.success).toBe(false);
    expect(response.error).toBe("Invalid input");
    expect(response.code).toBe("INVALID");
    expect(response.category).toBe(ErrorCategory.VALIDATION);
    expect(response.suggestion).toBe("Fix it");
  });

  it("should format standard Error", () => {
    const error = new Error("Something went wrong");

    const response = formatError(error);

    expect(response.success).toBe(false);
    expect(response.error).toBe("Something went wrong");
    expect(response.code).toBe("UNKNOWN_ERROR");
  });

  it("should format non-Error values", () => {
    const response = formatError("string error");

    expect(response.success).toBe(false);
    expect(response.error).toBe("string error");
    expect(response.code).toBe("UNKNOWN_ERROR");
    expect(response.category).toBe(ErrorCategory.INTERNAL);
  });

  it("should apply pattern suggestions to standard errors", () => {
    const error = new Error("no such table: users");

    const response = formatError(error);

    expect(response.suggestion).toContain("sqlite_list_tables");
  });
});

describe("wrapError", () => {
  it("should return DbMcpError unchanged", () => {
    const original = new ValidationError("Already wrapped");

    const wrapped = wrapError(original);

    expect(wrapped).toBe(original);
  });

  it("should wrap standard Error", () => {
    const original = new Error("Standard error");

    const wrapped = wrapError(original, "WRAPPED_ERROR", ErrorCategory.QUERY);

    expect(wrapped).toBeInstanceOf(DbMcpError);
    expect(wrapped.message).toBe("Standard error");
    expect(wrapped.code).toBe("WRAPPED_ERROR");
    expect(wrapped.cause).toBe(original);
  });

  it("should wrap string errors", () => {
    const wrapped = wrapError("String message");

    expect(wrapped).toBeInstanceOf(DbMcpError);
    expect(wrapped.message).toBe("String message");
  });

  it("should apply pattern-based category", () => {
    const error = new Error("no such table: users");

    const wrapped = wrapError(error);

    // Pattern should detect RESOURCE category
    expect(wrapped.suggestion).toContain("sqlite_list_tables");
  });
});

describe("isDbMcpError", () => {
  it("should return true for DbMcpError", () => {
    const error = new DbMcpError("Test", "CODE", ErrorCategory.INTERNAL);

    expect(isDbMcpError(error)).toBe(true);
  });

  it("should return true for subclasses", () => {
    expect(isDbMcpError(new ValidationError("Test"))).toBe(true);
    expect(isDbMcpError(new ConnectionError("Test"))).toBe(true);
    expect(isDbMcpError(new QueryError("Test"))).toBe(true);
  });

  it("should return false for standard Error", () => {
    expect(isDbMcpError(new Error("Test"))).toBe(false);
  });

  it("should return false for non-errors", () => {
    expect(isDbMcpError("string")).toBe(false);
    expect(isDbMcpError(null)).toBe(false);
    expect(isDbMcpError(undefined)).toBe(false);
    expect(isDbMcpError({})).toBe(false);
  });
});

// =============================================================================
// ErrorCategory Tests
// =============================================================================

describe("ErrorCategory enum", () => {
  it("should have all expected categories", () => {
    expect(ErrorCategory.VALIDATION).toBeDefined();
    expect(ErrorCategory.CONNECTION).toBeDefined();
    expect(ErrorCategory.QUERY).toBeDefined();
    expect(ErrorCategory.PERMISSION).toBeDefined();
    expect(ErrorCategory.RESOURCE).toBeDefined();
    expect(ErrorCategory.CONFIGURATION).toBeDefined();
    expect(ErrorCategory.INTERNAL).toBeDefined();
  });
});

// =============================================================================
// Error Stack Trace Tests
// =============================================================================

describe("Error stack traces", () => {
  it("should capture stack trace", () => {
    const error = new ValidationError("Test error");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ValidationError");
  });
});
