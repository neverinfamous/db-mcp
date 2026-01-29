/**
 * db-mcp - WHERE Clause Validation
 *
 * Validates WHERE clause parameters to prevent SQL injection.
 * Uses a blocklist approach to reject dangerous patterns while
 * allowing legitimate complex conditions.
 *
 * Adapted from postgres-mcp reference implementation for SQLite.
 */

/**
 * Error thrown when an unsafe WHERE clause is detected
 */
export class UnsafeWhereClauseError extends Error {
  constructor(reason: string) {
    super(`Unsafe WHERE clause: ${reason}`);
    this.name = "UnsafeWhereClauseError";
  }
}

/**
 * Dangerous SQL patterns that should never appear in WHERE clauses.
 * These patterns indicate SQL injection attempts.
 */
const DANGEROUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Statement terminators and new statements
  {
    pattern:
      /;\s*(DROP|DELETE|TRUNCATE|INSERT|UPDATE|CREATE|ALTER|ATTACH|DETACH)/i,
    reason: "contains statement terminator followed by dangerous keyword",
  },
  // Trailing semicolons (potential statement injection)
  {
    pattern: /;\s*$/,
    reason: "contains trailing semicolon",
  },
  // SQL comments (can be used to comment out security checks)
  {
    pattern: /--/,
    reason: "contains SQL line comment",
  },
  {
    pattern: /\/\*/,
    reason: "contains SQL block comment",
  },
  // UNION injection (data exfiltration)
  {
    pattern: /\bUNION\s+(ALL\s+)?SELECT\b/i,
    reason: "contains UNION SELECT",
  },
  // SQLite-specific: Extension loading (code execution)
  {
    pattern: /\bload_extension\s*\(/i,
    reason: "contains load_extension (code execution)",
  },
  // SQLite-specific: ATTACH database (file system access)
  {
    pattern: /\bATTACH\s+(DATABASE\s+)?['"`]/i,
    reason: "contains ATTACH DATABASE (file system access)",
  },
  // SQLite-specific: Pragma manipulation
  {
    pattern: /\bPRAGMA\s+/i,
    reason: "contains PRAGMA statement",
  },
  // SQLite-specific: writefile/readfile (if using fileio extension)
  {
    pattern: /\b(writefile|readfile)\s*\(/i,
    reason: "contains file I/O function",
  },
  // SQLite-specific: fts3_tokenizer (potential code execution)
  {
    pattern: /\bfts3_tokenizer\s*\(/i,
    reason: "contains FTS tokenizer function",
  },
  // Generic: Hexadecimal string injection
  {
    pattern: /\bX'[0-9A-Fa-f]+'/,
    reason: "contains hex string literal (potential binary injection)",
  },
];

/**
 * Validates a WHERE clause for dangerous SQL patterns.
 *
 * This function uses a blocklist approach to detect and reject
 * common SQL injection patterns. It allows legitimate complex
 * conditions while blocking obvious attack vectors.
 *
 * @param where - The WHERE clause to validate
 * @throws UnsafeWhereClauseError if a dangerous pattern is detected
 *
 * @example
 * validateWhereClause("price > 10");                    // OK
 * validateWhereClause("status = 'active' AND id < 100"); // OK
 * validateWhereClause("1=1; DROP TABLE users;--");      // Throws
 * validateWhereClause("1=1 UNION SELECT * FROM sqlite_master"); // Throws
 */
export function validateWhereClause(where: string): void {
  if (!where || typeof where !== "string") {
    throw new UnsafeWhereClauseError("WHERE clause must be a non-empty string");
  }

  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(where)) {
      throw new UnsafeWhereClauseError(reason);
    }
  }
}

/**
 * Validates and returns a safe WHERE clause.
 *
 * @param where - The WHERE clause to sanitize
 * @returns The validated WHERE clause (unchanged if safe)
 * @throws UnsafeWhereClauseError if a dangerous pattern is detected
 */
export function sanitizeWhereClause(where: string): string {
  validateWhereClause(where);
  return where;
}
