/**
 * db-mcp Enhanced Error System
 *
 * Provides typed error classes with categorization, actionable suggestions,
 * and structured error responses for better diagnostics.
 */

// =============================================================================
// Error Categories
// =============================================================================

/**
 * Error categories for classification and handling
 */
export enum ErrorCategory {
  /** Input validation failures (invalid names, paths, types) */
  VALIDATION = "validation",
  /** Database connection issues */
  CONNECTION = "connection",
  /** SQL execution errors */
  QUERY = "query",
  /** Authorization/permission failures */
  PERMISSION = "permission",
  /** Configuration/setup issues */
  CONFIGURATION = "config",
  /** Missing resources (tables, columns, views) */
  RESOURCE = "resource",
  /** Unexpected internal errors */
  INTERNAL = "internal",
}

// =============================================================================
// Error Suggestions
// =============================================================================

/**
 * Pattern-based suggestions for common errors
 */
const ERROR_SUGGESTIONS: {
  pattern: RegExp;
  suggestion: string;
  category?: ErrorCategory | undefined;
}[] = [
  // Validation errors
  {
    pattern: /invalid table name/i,
    suggestion:
      "Table names must start with a letter or underscore, followed by letters, numbers, or underscores only.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /invalid column name/i,
    suggestion:
      "Column names must start with a letter or underscore, followed by letters, numbers, or underscores only.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /invalid (view|index) name/i,
    suggestion:
      "Names must start with a letter or underscore, followed by alphanumeric characters only.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /json path must start with \$/i,
    suggestion:
      "JSON paths use $ as the root. Example: $.name, $.items[0], $.nested.property",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /vector dimensions must match/i,
    suggestion:
      "All vectors in comparison must have the same number of dimensions.",
    category: ErrorCategory.VALIDATION,
  },

  // Resource errors
  {
    pattern: /no such table[:\s]*(['"]?)(\w+)\1/i,
    suggestion:
      "Table not found. Run sqlite_list_tables to see available tables.",
    category: ErrorCategory.RESOURCE,
  },
  {
    pattern: /no such column[:\s]*(['"]?)(\w+)\1/i,
    suggestion:
      "Column not found. Use sqlite_describe_table to see available columns.",
    category: ErrorCategory.RESOURCE,
  },
  {
    pattern: /table .* already exists/i,
    suggestion:
      "Table already exists. Use CREATE TABLE IF NOT EXISTS or drop the existing table first.",
    category: ErrorCategory.RESOURCE,
  },

  // Query errors
  {
    pattern: /syntax error/i,
    suggestion:
      "Check SQL syntax. Common issues: missing quotes, commas, parentheses, or reserved word conflicts.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /UNIQUE constraint failed/i,
    suggestion:
      "A row with this value already exists. Use UPDATE to modify existing data or check for duplicates.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /FOREIGN KEY constraint failed/i,
    suggestion:
      "The referenced row does not exist. Ensure the parent record exists before inserting.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /NOT NULL constraint failed/i,
    suggestion:
      "A required column is missing a value. Provide a value or set a default.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /CHECK constraint failed/i,
    suggestion:
      "The value does not meet the column's check constraint requirements.",
    category: ErrorCategory.QUERY,
  },

  // Connection errors
  {
    pattern: /not connected/i,
    suggestion:
      "Database connection not established. Ensure the database is configured and connected.",
    category: ErrorCategory.CONNECTION,
  },
  {
    pattern: /database is locked/i,
    suggestion:
      "Database is being used by another process. Wait and retry, or check for long-running transactions.",
    category: ErrorCategory.CONNECTION,
  },

  // Permission errors
  {
    pattern: /readonly database/i,
    suggestion:
      "Database is in read-only mode. Check file permissions or connection settings.",
    category: ErrorCategory.PERMISSION,
  },
  {
    pattern: /attempt to write a readonly/i,
    suggestion:
      "Write operations are not allowed. Check database configuration.",
    category: ErrorCategory.PERMISSION,
  },
];

/**
 * Find a suggestion for an error message
 */
export function findSuggestion(
  message: string,
): { suggestion: string; category?: ErrorCategory | undefined } | null {
  for (const entry of ERROR_SUGGESTIONS) {
    if (entry.pattern.test(message)) {
      return {
        suggestion: entry.suggestion,
        category: entry.category,
      };
    }
  }
  return null;
}

// =============================================================================
// Base Error Class
// =============================================================================

/**
 * Base error class for db-mcp with enhanced diagnostics
 */
export class DbMcpError extends Error {
  /** Error category for classification */
  readonly category: ErrorCategory;
  /** Module-prefixed error code (e.g., DB_QUERY_FAILED) */
  readonly code: string;
  /** Actionable suggestion for resolving the error */
  readonly suggestion: string | undefined;
  /** Additional error details */
  readonly details: Record<string, unknown> | undefined;
  /** Whether the error is recoverable (can retry) */
  readonly recoverable: boolean;

  constructor(
    message: string,
    code: string,
    category: ErrorCategory,
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      recoverable?: boolean | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.code = code;
    this.category = category;
    this.recoverable = options?.recoverable ?? false;
    this.details = options?.details;

    // Auto-detect suggestion if not provided
    this.suggestion =
      options?.suggestion ?? findSuggestion(message)?.suggestion;

    // Capture stack trace
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Convert to structured response object
   */
  toResponse(): ErrorResponse {
    return {
      success: false,
      error: this.message,
      code: this.code,
      category: this.category,
      suggestion: this.suggestion,
      recoverable: this.recoverable,
      details: this.details,
    };
  }
}

// =============================================================================
// Specific Error Classes
// =============================================================================

/**
 * Validation error for invalid inputs
 */
export class ValidationError extends DbMcpError {
  constructor(
    message: string,
    code = "VALIDATION_ERROR",
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.VALIDATION, {
      ...options,
      recoverable: false,
    });
  }
}

/**
 * Connection error for database connectivity issues
 */
export class ConnectionError extends DbMcpError {
  constructor(
    message: string,
    code = "CONNECTION_ERROR",
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.CONNECTION, {
      ...options,
      recoverable: true, // Connection errors are often transient
    });
  }
}

/**
 * Query error for SQL execution failures
 */
export class QueryError extends DbMcpError {
  constructor(
    message: string,
    code = "QUERY_ERROR",
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      sql?: string | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.QUERY, {
      ...options,
      details: {
        ...options?.details,
        sql: options?.sql,
      },
      recoverable: false,
    });
  }
}

/**
 * Permission error for authorization failures
 */
export class PermissionError extends DbMcpError {
  constructor(
    message: string,
    code = "PERMISSION_ERROR",
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.PERMISSION, {
      ...options,
      recoverable: false,
    });
  }
}

/**
 * Resource not found error
 */
export class ResourceNotFoundError extends DbMcpError {
  constructor(
    message: string,
    code = "RESOURCE_NOT_FOUND",
    options?: {
      suggestion?: string | undefined;
      resourceType?: string | undefined;
      resourceName?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.RESOURCE, {
      ...options,
      details: {
        ...options?.details,
        resourceType: options?.resourceType,
        resourceName: options?.resourceName,
      },
      recoverable: false,
    });
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends DbMcpError {
  constructor(
    message: string,
    code = "CONFIG_ERROR",
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.CONFIGURATION, {
      ...options,
      recoverable: false,
    });
  }
}

/**
 * Internal error for unexpected failures
 */
export class InternalError extends DbMcpError {
  constructor(
    message: string,
    code = "INTERNAL_ERROR",
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.INTERNAL, {
      ...options,
      recoverable: false,
    });
  }
}

// =============================================================================
// Error Response Type
// =============================================================================

/**
 * Structured error response format
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  category: ErrorCategory;
  suggestion: string | undefined;
  recoverable: boolean;
  details: Record<string, unknown> | undefined;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert any error to a structured error response
 */
export function formatError(error: unknown): ErrorResponse {
  if (error instanceof DbMcpError) {
    return error.toResponse();
  }

  if (error instanceof Error) {
    const match = findSuggestion(error.message);
    return {
      success: false,
      error: error.message,
      code: "UNKNOWN_ERROR",
      category: match?.category ?? ErrorCategory.INTERNAL,
      suggestion: match?.suggestion,
      recoverable: false,
      details: undefined,
    };
  }

  return {
    success: false,
    error: String(error),
    code: "UNKNOWN_ERROR",
    category: ErrorCategory.INTERNAL,
    suggestion: undefined,
    recoverable: false,
    details: undefined,
  };
}

/**
 * Wrap an error with enhanced diagnostics
 */
export function wrapError(
  error: unknown,
  defaultCode = "UNKNOWN_ERROR",
  defaultCategory = ErrorCategory.INTERNAL,
): DbMcpError {
  if (error instanceof DbMcpError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const match = findSuggestion(message);

  return new DbMcpError(
    message,
    defaultCode,
    match?.category ?? defaultCategory,
    {
      suggestion: match?.suggestion,
      cause: error instanceof Error ? error : undefined,
      recoverable: false,
    },
  );
}

/**
 * Check if an error is a DbMcpError
 */
export function isDbMcpError(error: unknown): error is DbMcpError {
  return error instanceof DbMcpError;
}
