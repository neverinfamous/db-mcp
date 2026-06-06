/**
 * Error Categories
 *
 * Classification enum for all db-mcp errors.
 */

/**
 * Error categories for classification and handling
 */
export const ErrorCategory = {
  /** Input validation failures (invalid names, paths, types) */
  VALIDATION: "validation",
  /** Database connection issues */
  CONNECTION: "connection",
  /** SQL execution errors */
  QUERY: "query",
  /** Authorization/permission failures */
  PERMISSION: "permission",
  /** Configuration/setup issues */
  CONFIGURATION: "config",
  /** Missing resources (tables, columns, views) */
  RESOURCE: "resource",
  /** Authentication failures (invalid credentials, expired tokens) */
  AUTHENTICATION: "authentication",
  /** Authorization failures (insufficient scope/permissions) */
  AUTHORIZATION: "authorization",
  /** Unexpected internal errors */
  INTERNAL: "internal",
  /** Execution timeout errors */
  TIMEOUT: "timeout",
  /** Rate limit enforcement errors */
  RATE_LIMIT: "rate_limit",
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

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
