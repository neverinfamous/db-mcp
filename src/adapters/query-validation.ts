/**
 * SQL Query Validation
 *
 * Security utilities for SQL injection detection and read-only enforcement.
 * Extracted from DatabaseAdapter for modularity.
 */

import { ValidationError } from "../utils/errors/index.js";

/**
 * Pre-compiled dangerous SQL patterns for injection detection.
 * Hoisted to module scope to avoid re-allocating RegExp objects per query.
 */
const DANGEROUS_SQL_PATTERNS: RegExp[] = [
  /;\s*DROP\s+/i,
  /;\s*DELETE\s+/i,
  /;\s*TRUNCATE\s+/i,
  /;\s*ALTER\s+/i,
  /;\s*UNION\s+ALL\s+SELECT/i,
  /;\s*UNION\s+SELECT/i,
  /;\s*ATTACH\s+/i,
  /;\s*DETACH\s+/i,
];

/**
 * Comment-style SQL patterns.
 * Checked against string-literal-stripped SQL to avoid false positives
 * on comment markers inside quoted strings (e.g., SELECT 'a--b').
 */
const COMMENT_SQL_PATTERNS: RegExp[] = [/--.*$/m, /\/\*[\s\S]*?\*\//];

/**
 * Strip SQL string literals so comment detection doesn't match
 * markers inside quoted values. Handles escaped quotes ('').
 */
function stripSqlStringLiterals(sql: string): string {
  return sql.replace(/'(?:''|[^'])*'/g, "''");
}

/**
 * Write-statement prefixes blocked in read-only mode
 */
const WRITE_PREFIXES = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "CREATE",
  "ALTER",
  "TRUNCATE",
] as const;

/**
 * Validate query for safety (SQL injection prevention).
 *
 * @param sql - SQL query to validate
 * @param isReadOnly - Whether to enforce read-only restrictions
 * @throws ValidationError if query violates safety rules
 */
export function validateQuery(sql: string, isReadOnly: boolean): void {
  const trimmedSql = sql.trim().toUpperCase();

  if (isReadOnly) {
    // For read-only queries, block mutating statements
    for (const prefix of WRITE_PREFIXES) {
      if (trimmedSql.startsWith(prefix)) {
        throw new ValidationError(
          `Read-only mode: ${prefix} statements are not allowed`,
          "DB_READ_ONLY_VIOLATION",
        );
      }
    }
  }

  // Block obvious SQL injection patterns
  // Note: This is a basic check; parameterized queries are the primary defense
  for (const pattern of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      throw new ValidationError(
        "Query contains potentially dangerous patterns",
        "DB_DANGEROUS_PATTERN",
      );
    }
  }

  // Check comment patterns against string-literal-stripped SQL
  // to avoid false positives on markers inside quoted strings
  const sqlWithoutStrings = stripSqlStringLiterals(sql);
  for (const pattern of COMMENT_SQL_PATTERNS) {
    if (pattern.test(sqlWithoutStrings)) {
      throw new ValidationError(
        "Query contains potentially dangerous patterns",
        "DB_DANGEROUS_PATTERN",
      );
    }
  }
}
