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
  /** Database-specific access pattern */
  DATABASE: /^db:([a-zA-Z0-9_-]+)$/,
  /** Table-specific access pattern */
  TABLE: /^table:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)$/,
} as const;

/**
 * All supported scope patterns for metadata
 */
export const SUPPORTED_SCOPES = [
  "read",
  "write",
  "admin",
  "full",
  "db:{database}",
  "table:{database}:{table}",
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

/**
 * Parse a database-specific scope
 * @returns The database name or null if not a database scope
 */
export function parseDatabaseScope(scope: string): string | null {
  const match = SCOPE_PATTERNS.DATABASE.exec(scope);
  return match?.[1] ?? null;
}

/**
 * Parse a table-specific scope
 * @returns Object with database and table names, or null if not a table scope
 */
export function parseTableScope(
  scope: string,
): { database: string; table: string } | null {
  const match = SCOPE_PATTERNS.TABLE.exec(scope);
  const database = match?.[1];
  const table = match?.[2];
  if (database !== undefined && table !== undefined) {
    return { database, table };
  }
  return null;
}
