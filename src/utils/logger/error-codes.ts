/**
 * Module-prefixed Error Codes
 *
 * Centralized error code definitions for structured logging.
 * Extracted from logger.ts for modularity.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Module-prefixed error code
 */
export interface ErrorCode {
  /** Module prefix (e.g., 'AUTH', 'DB', 'SERVER') */
  module: string;
  /** Error code suffix (e.g., 'TOKEN_INVALID', 'CONNECT_FAILED') */
  code: string;
  /** Full code string (e.g., 'AUTH_TOKEN_INVALID') */
  full: string;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a module-prefixed error code
 */
export function createErrorCode(module: string, code: string): ErrorCode {
  return {
    module: module.toUpperCase(),
    code: code.toUpperCase(),
    full: `${module.toUpperCase()}_${code.toUpperCase()}`,
  };
}

// =============================================================================
// Common Error Codes
// =============================================================================

/**
 * Common error codes by module
 */
export const ERROR_CODES = {
  // Auth module
  AUTH: {
    TOKEN_INVALID: createErrorCode("AUTH", "TOKEN_INVALID"),
    TOKEN_EXPIRED: createErrorCode("AUTH", "TOKEN_EXPIRED"),
    TOKEN_MISSING: createErrorCode("AUTH", "TOKEN_MISSING"),
    SIGNATURE_INVALID: createErrorCode("AUTH", "SIGNATURE_INVALID"),
    SCOPE_DENIED: createErrorCode("AUTH", "SCOPE_DENIED"),
    DISCOVERY_FAILED: createErrorCode("AUTH", "DISCOVERY_FAILED"),
    JWKS_FETCH_FAILED: createErrorCode("AUTH", "JWKS_FETCH_FAILED"),
    REGISTRATION_FAILED: createErrorCode("AUTH", "REGISTRATION_FAILED"),
  },
  // Server module
  SERVER: {
    START_FAILED: createErrorCode("SERVER", "START_FAILED"),
    SHUTDOWN_FAILED: createErrorCode("SERVER", "SHUTDOWN_FAILED"),
    TRANSPORT_ERROR: createErrorCode("SERVER", "TRANSPORT_ERROR"),
  },
  // Database module
  DB: {
    CONNECT_FAILED: createErrorCode("DB", "CONNECT_FAILED"),
    QUERY_FAILED: createErrorCode("DB", "QUERY_FAILED"),
    DISCONNECT_FAILED: createErrorCode("DB", "DISCONNECT_FAILED"),
    ADAPTER_NOT_FOUND: createErrorCode("DB", "ADAPTER_NOT_FOUND"),
  },
} as const;
