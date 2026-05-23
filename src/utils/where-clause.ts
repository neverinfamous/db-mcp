/**
 * db-mcp - WHERE Clause Validation
 *
 * Validates WHERE clause parameters to prevent SQL injection.
 * Uses a blocklist approach to reject dangerous patterns while
 * allowing legitimate complex conditions.
 *
 * Applies Unicode NFC normalization and full-width character
 * mapping before pattern matching to prevent homoglyph-based
 * blocklist bypasses (CWE-20).
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
  // Comprehensive keyword list including statements missed in earlier versions:
  // REPLACE, VACUUM, ANALYZE, BEGIN, COMMIT, ROLLBACK, SAVEPOINT, RELEASE
  {
    pattern:
      /;\s*(DROP|DELETE|TRUNCATE|INSERT|UPDATE|CREATE|ALTER|ATTACH|DETACH|SELECT|REPLACE|VACUUM|ANALYZE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|REINDEX|EXPLAIN)\b/i,
    reason: "contains statement terminator followed by SQL keyword",
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
  // Subquery injection (data exfiltration via boolean-based blind)
  {
    pattern: /\(\s*SELECT\b/i,
    reason: "contains subquery (potential data exfiltration)",
  },
  // Generic: Hexadecimal string injection
  {
    pattern: /\bX'[0-9A-Fa-f]+'/,
    reason: "contains hex string literal (potential binary injection)",
  },
  // CASE WHEN (potential blind injection without subqueries)
  {
    pattern: /\bCASE\s+WHEN\b/i,
    reason: "contains CASE WHEN (potential blind injection)",
  },
  // IIF() — conditional bypass alternative to CASE WHEN
  {
    pattern: /\bIIF\s*\(/i,
    reason: "contains IIF() (potential blind injection)",
  },
  // GROUP_CONCAT() — data aggregation for exfiltration
  {
    pattern: /\bGROUP_CONCAT\s*\(/i,
    reason: "contains GROUP_CONCAT() (potential data exfiltration)",
  },
  // LIKE with leading wildcard — forces full table scans (DoS vector CWE-400)
  {
    pattern: /\bLIKE\s+['"]%/i,
    reason:
      "contains LIKE with leading wildcard (potential DoS via full table scan)",
  },
  // GLOB with leading wildcard — case-sensitive equivalent of LIKE '%...' (DoS vector CWE-400)
  {
    pattern: /\bGLOB\s+['"]\*/i,
    reason:
      "contains GLOB with leading wildcard (potential DoS via full table scan)",
  },
  // Conditional functions — blind injection oracles (bypass for CASE WHEN / IIF)
  {
    pattern: /\bCOALESCE\s*\(/i,
    reason: "contains COALESCE() (potential blind injection oracle)",
  },
  {
    pattern: /\bNULLIF\s*\(/i,
    reason: "contains NULLIF() (potential blind injection oracle)",
  },
  {
    pattern: /\bTYPEOF\s*\(/i,
    reason: "contains TYPEOF() (potential blind injection oracle)",
  },
  {
    pattern: /\bIFNULL\s*\(/i,
    reason: "contains IFNULL() (potential blind injection oracle)",
  },
  // Memory allocation DoS — RANDOMBLOB(N) / ZEROBLOB(N) can allocate large blocks (CWE-400)
  {
    pattern: /\bRANDOMBLOB\s*\(/i,
    reason: "contains RANDOMBLOB() (potential memory allocation DoS)",
  },
  {
    pattern: /\bZEROBLOB\s*\(/i,
    reason: "contains ZEROBLOB() (potential memory allocation DoS)",
  },
];

// =============================================================================
// Unicode Normalization
// =============================================================================

/**
 * Full-width Latin character range (U+FF01 – U+FF5E).
 * These are visually similar to ASCII but occupy different codepoints.
 * Example: Ｕ (U+FF35) looks like U, Ｎ (U+FF2E) looks like N.
 */
const FULLWIDTH_START = 0xff01;
const FULLWIDTH_END = 0xff5e;
const FULLWIDTH_ASCII_OFFSET = 0xfee0; // fullwidth - offset = ASCII equivalent

/**
 * Normalize a WHERE clause string for pattern matching.
 *
 * Applies two transformations:
 * 1. Unicode NFC normalization — collapses composed characters
 * 2. Full-width Latin → ASCII mapping — converts U+FF01..FF5E to U+0021..007E
 *
 * The original input is NOT modified; this returns a copy for blocklist matching.
 * This prevents attackers from using visually-similar Unicode characters
 * (e.g., "ＵＮＩＯＮ ＳＥＬＥＣＴ") to bypass ASCII-only regex patterns.
 */
function normalizeForPatternMatching(input: string): string {
  // Step 1: NFC normalization (built-in, zero-dependency)
  let normalized = input.normalize("NFC");

  // Step 2: Map full-width Latin characters to ASCII equivalents
  // Only process if the string contains characters outside basic ASCII,
  // avoiding unnecessary work for the common case.
  let hasFullwidth = false;
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code >= FULLWIDTH_START && code <= FULLWIDTH_END) {
      hasFullwidth = true;
      break;
    }
  }

  if (hasFullwidth) {
    const chars: string[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const code = normalized.charCodeAt(i);
      if (code >= FULLWIDTH_START && code <= FULLWIDTH_END) {
        chars.push(String.fromCharCode(code - FULLWIDTH_ASCII_OFFSET));
      } else {
        chars.push(normalized.charAt(i));
      }
    }
    normalized = chars.join("");
  }

  return normalized;
}

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

  // Length guard: reject extreme-length strings to prevent regex evaluation
  // overhead from adversarial inputs (CWE-1333: ReDoS prevention)
  const MAX_WHERE_LENGTH = 10240; // 10KB
  if (where.length > MAX_WHERE_LENGTH) {
    throw new UnsafeWhereClauseError(
      `WHERE clause exceeds maximum length of ${String(MAX_WHERE_LENGTH)} characters`,
    );
  }

  // Unicode normalization: apply NFC + full-width→ASCII mapping to prevent
  // homoglyph-based blocklist bypasses (CWE-20). Example: "ＵＮＩＯＮ" → "UNION".
  // The original input is preserved (passed to SQLite unchanged); only the
  // normalized copy is used for pattern matching.
  const normalized = normalizeForPatternMatching(where);

  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(normalized)) {
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
