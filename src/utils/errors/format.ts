/**
 * Error Response Type and Formatting Utilities
 *
 * Converts errors (typed or untyped) into structured ErrorResponse objects.
 * Harmonized standard: combines rich ErrorResponse (db-mcp), Zod path
 * extraction (memory-journal-mcp), and ErrorContext (postgres-mcp).
 */

import { ErrorCategory, type ErrorResponse } from "./categories.js";
export type { ErrorResponse };
import { DbMcpError } from "./base.js";
import { findSuggestion } from "./suggestions.js";

// =============================================================================
// ErrorContext — optional tool context for richer error messages
// =============================================================================

/**
 * Context about the operation that triggered the error.
 * Adapted from postgres-mcp's ErrorContext pattern for contextual
 * error intelligence.
 */
export interface ErrorContext {
  /** Tool name that triggered the error */
  tool?: string;
  /** SQL statement that was being executed */
  sql?: string;
  /** Target table name */
  table?: string;
  /** Target index name */
  index?: string;
  /** Target database/schema */
  database?: string;
  /** Generic target identifier */
  target?: string;
}

// =============================================================================
// Default category → code mapping
// =============================================================================

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

// =============================================================================
// Zod Error Formatting
// =============================================================================

/**
 * Extract human-readable messages from a ZodError with path information.
 * Adapted from memory-journal-mcp pattern for clear validation feedback.
 *
 * Duck-typed to avoid importing zod in this shared module —
 * detects ZodError via `.issues` array presence.
 */
function formatZodError(error: Error): string | null {
  if (
    !("issues" in error) ||
    !Array.isArray((error as Record<string, unknown>)["issues"])
  ) {
    return null;
  }

  const issues = (error as Record<string, unknown>)["issues"] as {
    message?: string;
    path?: unknown[];
  }[];

  return issues
    .map((issue) => {
      const pathStr =
        Array.isArray(issue.path) && issue.path.length > 0
          ? `${issue.path.join(".")}: `
          : "";
      return `${pathStr}${issue.message ?? "Unknown validation error"}`;
    })
    .join("; ");
}

// =============================================================================
// Primary Formatter
// =============================================================================

/**
 * Format any caught error into a structured handler error response.
 *
 * Handles:
 * 1. `DbMcpError` — converts via `.toResponse()`
 * 2. `ZodError` — extracts path + message for clear validation feedback
 * 3. `Error` — maps message to suggestion via regex patterns
 * 4. Non-Error values — stringified with INTERNAL category
 *
 * Use as the single catch block for all tool handlers:
 *
 * ```typescript
 * handler: async (params) => {
 *   try {
 *     const parsed = Schema.parse(params);
 *     // ... domain logic ...
 *     return { success: true, ... };
 *   } catch (err) {
 *     return formatHandlerError(err);
 *   }
 * }
 * ```
 *
 * @param error - The caught error value
 * @param context - Optional tool context for richer error messages
 */
export function formatHandlerError(
  error: unknown,
  _context?: ErrorContext,
): ErrorResponse {
  // 1. Already a typed DbMcpError — use its built-in conversion
  if (error instanceof DbMcpError) {
    return error.toResponse();
  }

  // 2. ZodError — extract path + message for clear validation feedback
  if (error instanceof Error) {
    const zodMessage = formatZodError(error);
    if (zodMessage !== null) {
      return {
        success: false,
        error: zodMessage,
        code: "VALIDATION_ERROR",
        category: ErrorCategory.VALIDATION,
        suggestion: undefined,
        recoverable: false,
        details: undefined,
      };
    }
  }

  // 3. Standard Error — match against suggestion patterns
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

  // 4. Non-Error value
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
 * @deprecated Use `formatHandlerError` instead.
 * Kept for backward compatibility during migration.
 */
export const formatHandlerErrorResponse = formatHandlerError;

// =============================================================================
// Utilities
// =============================================================================

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
