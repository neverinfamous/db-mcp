/**
 * Base Error Class
 *
 * DbMcpError provides enhanced diagnostics: category, code, suggestion,
 * recoverable flag, and structured response conversion.
 */

import type { ErrorCategory, ErrorResponse } from "./categories.js";
import { findSuggestion } from "./suggestions.js";

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
