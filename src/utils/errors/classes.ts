/**
 * Specific Error Classes
 *
 * Typed error subclasses for each ErrorCategory.
 */

import { ErrorCategory } from "./categories.js";
import { DbMcpError } from "./base.js";

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

/**
 * Authentication error (401-type: invalid credentials, expired tokens)
 */
export class AuthenticationError extends DbMcpError {
  constructor(
    message: string,
    code = "AUTHENTICATION_ERROR",
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.AUTHENTICATION, {
      ...options,
      recoverable: false,
    });
  }
}

/**
 * Authorization error (403-type: insufficient permissions)
 */
export class AuthorizationError extends DbMcpError {
  constructor(
    message: string,
    code = "AUTHORIZATION_ERROR",
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.AUTHORIZATION, {
      ...options,
      recoverable: false,
    });
  }
}

/**
 * Transaction error for commit/rollback/savepoint failures
 */
export class TransactionError extends DbMcpError {
  constructor(
    message: string,
    code = "TRANSACTION_ERROR",
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, code, ErrorCategory.QUERY, {
      ...options,
      recoverable: true, // Transaction errors are often retriable
    });
  }
}

