/**
 * Base Error Class
 *
 * DbMcpError provides enhanced diagnostics: category, code, suggestion,
 * recoverable flag, and structured response conversion.
 */

import type { ErrorCategory, ErrorResponse } from "./categories.js";
import { findSuggestion } from "./suggestions.js";

/**
 * Generic error codes that should be auto-refined when findSuggestion
 * provides a more specific code (e.g., DB_QUERY_FAILED → TABLE_NOT_FOUND).
 */
const REFINABLE_CODES = new Set([
  "DB_QUERY_FAILED",
  "DB_WRITE_FAILED",
  "QUERY_ERROR",
  "RESOURCE_ERROR",
  "UNKNOWN_ERROR",
]);

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
    this.category = category;
    this.recoverable = options?.recoverable ?? false;
    this.details = options?.details;

    // Auto-detect suggestion and refine generic codes
    const match = findSuggestion(message);
    this.suggestion = options?.suggestion ?? match?.suggestion;

    // Prefer the suggestion's specific code over generic category codes
    this.code = match?.code && REFINABLE_CODES.has(code) ? match.code : code;

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
