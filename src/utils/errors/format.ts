/**
 * Error Response Type and Formatting Utilities
 *
 * Converts errors (typed or untyped) into structured ErrorResponse objects.
 */

import { ErrorCategory, type ErrorResponse } from "./categories.js";
export type { ErrorResponse };
import { DbMcpError } from "./base.js";
import { findSuggestion } from "./suggestions.js";

/**
 * Default error codes by category (used when error is not a DbMcpError)
 */
const CATEGORY_DEFAULT_CODES: Record<ErrorCategory, string> = {
  [ErrorCategory.VALIDATION]: "VALIDATION_ERROR",
  [ErrorCategory.CONNECTION]: "CONNECTION_ERROR",
  [ErrorCategory.QUERY]: "QUERY_ERROR",
  [ErrorCategory.PERMISSION]: "PERMISSION_ERROR",
  [ErrorCategory.CONFIGURATION]: "CONFIG_ERROR",
  [ErrorCategory.RESOURCE]: "RESOURCE_ERROR",
  [ErrorCategory.AUTHENTICATION]: "AUTHENTICATION_ERROR",
  [ErrorCategory.AUTHORIZATION]: "AUTHORIZATION_ERROR",
  [ErrorCategory.INTERNAL]: "UNKNOWN_ERROR",
};

export function formatError(error: unknown): ErrorResponse {
  if (error instanceof DbMcpError) {
    return error.toResponse();
  }

  if (error instanceof Error) {
    const match = findSuggestion(error.message);
    const category = match?.category ?? ErrorCategory.INTERNAL;
    return {
      success: false,
      error: error.message,
      code: match?.code ?? CATEGORY_DEFAULT_CODES[category],
      category,
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
