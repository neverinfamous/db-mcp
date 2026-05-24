/**
 * Standard OAuth scopes for db-mcp
 */
export const SCOPES = {
  /** Read-only access to all databases */
  READ: "read",
  /** Read and write access to all databases */
  WRITE: "write",
  /** Administrative access */
  ADMIN: "admin",
  /** Unrestricted access to all operations */
  FULL: "full",
} as const;

export type StandardScope = (typeof SCOPES)[keyof typeof SCOPES];

/**
 * Base scopes supported by the server
 */
export const BASE_SCOPES = ["read", "write", "admin", "full"] as const;

/**
 * Scope patterns (regex patterns for validation)
 */
export const SCOPE_PATTERNS = {
  /** Read-only access */
  READ: "read",
  /** Read and write access */
  WRITE: "write",
  /** Administrative access */
  ADMIN: "admin",
  /** Unrestricted access */
  FULL: "full",
} as const;

/**
 * All supported scope patterns for metadata
 */
export const SUPPORTED_SCOPES = [
  "read",
  "write",
  "admin",
  "full",
] as const;

/**
 * Parse a scope string (space-delimited) into an array
 */
export function parseScopes(scopeString: string): string[] {
  return scopeString
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

