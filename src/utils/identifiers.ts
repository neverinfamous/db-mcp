/**
 * db-mcp - Identifier Sanitization Utilities
 *
 * Provides safe handling of SQLite identifiers (table names, column names)
 * to prevent SQL injection attacks via identifier interpolation.
 *
 * SQLite identifier rules:
 * - Can contain letters, digits, underscores (more permissive than PostgreSQL)
 * - Maximum practical length: 255 bytes
 * - Case-insensitive for ASCII letters unless quoted
 *
 * Adapted from postgres-mcp reference implementation for SQLite.
 */

/**
 * Regex pattern for valid SQLite identifiers
 * Must start with letter or underscore, followed by letters, digits, or underscores
 */
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Maximum identifier length (practical SQLite limit)
 */
const MAX_IDENTIFIER_LENGTH = 255;

/**
 * Reserved SQLite keywords that require quoting
 * This is a subset of the most commonly problematic keywords
 */
const RESERVED_KEYWORDS = new Set([
  "abort",
  "action",
  "add",
  "after",
  "all",
  "alter",
  "analyze",
  "and",
  "as",
  "asc",
  "attach",
  "autoincrement",
  "before",
  "begin",
  "between",
  "by",
  "cascade",
  "case",
  "cast",
  "check",
  "collate",
  "column",
  "commit",
  "conflict",
  "constraint",
  "create",
  "cross",
  "current_date",
  "current_time",
  "current_timestamp",
  "database",
  "default",
  "deferrable",
  "deferred",
  "delete",
  "desc",
  "detach",
  "distinct",
  "drop",
  "each",
  "else",
  "end",
  "escape",
  "except",
  "exclusive",
  "exists",
  "explain",
  "fail",
  "for",
  "foreign",
  "from",
  "full",
  "glob",
  "group",
  "having",
  "if",
  "ignore",
  "immediate",
  "in",
  "index",
  "indexed",
  "initially",
  "inner",
  "insert",
  "instead",
  "intersect",
  "into",
  "is",
  "isnull",
  "join",
  "key",
  "left",
  "like",
  "limit",
  "match",
  "natural",
  "no",
  "not",
  "notnull",
  "null",
  "of",
  "offset",
  "on",
  "or",
  "order",
  "outer",
  "plan",
  "pragma",
  "primary",
  "query",
  "raise",
  "recursive",
  "references",
  "regexp",
  "reindex",
  "release",
  "rename",
  "replace",
  "restrict",
  "right",
  "rollback",
  "row",
  "savepoint",
  "select",
  "set",
  "table",
  "temp",
  "temporary",
  "then",
  "to",
  "transaction",
  "trigger",
  "union",
  "unique",
  "update",
  "using",
  "vacuum",
  "values",
  "view",
  "virtual",
  "when",
  "where",
  "with",
  "without",
]);

/**
 * Error thrown when an identifier is invalid
 */
export class InvalidIdentifierError extends Error {
  constructor(
    public readonly identifier: string,
    public readonly reason: string,
  ) {
    super(`Invalid identifier "${identifier}": ${reason}`);
    this.name = "InvalidIdentifierError";
  }
}

/**
 * Validate a SQLite identifier
 *
 * @param name - The identifier to validate
 * @throws InvalidIdentifierError if the identifier is invalid
 */
export function validateIdentifier(name: string): void {
  if (!name || typeof name !== "string") {
    throw new InvalidIdentifierError(
      name,
      "Identifier must be a non-empty string",
    );
  }

  if (name.length > MAX_IDENTIFIER_LENGTH) {
    throw new InvalidIdentifierError(
      name,
      `Identifier exceeds maximum length of ${String(MAX_IDENTIFIER_LENGTH)} characters`,
    );
  }

  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new InvalidIdentifierError(
      name,
      "Identifier contains invalid characters. Must start with a letter or underscore and contain only letters, digits, or underscores",
    );
  }
}

/**
 * Sanitize and quote a SQLite identifier for safe use in SQL queries
 *
 * This function:
 * 1. Validates the identifier against SQLite naming rules
 * 2. Escapes any embedded double quotes
 * 3. Wraps the identifier in double quotes for safe interpolation
 *
 * @param name - The identifier to sanitize
 * @returns The sanitized, double-quoted identifier
 * @throws InvalidIdentifierError if the identifier is invalid
 *
 * @example
 * sanitizeIdentifier('users') // Returns: "users"
 * sanitizeIdentifier('my_table') // Returns: "my_table"
 * sanitizeIdentifier('User"Data') // Throws: InvalidIdentifierError
 */
export function sanitizeIdentifier(name: string): string {
  validateIdentifier(name);

  // Escape any embedded double quotes (though validateIdentifier should prevent this)
  const escaped = name.replace(/"/g, '""');

  return `"${escaped}"`;
}

/**
 * Check if an identifier needs quoting (is a reserved keyword or has special characters)
 *
 * @param name - The identifier to check
 * @returns True if the identifier needs quoting
 */
export function needsQuoting(name: string): boolean {
  // Reserved keywords need quoting
  if (RESERVED_KEYWORDS.has(name.toLowerCase())) {
    return true;
  }

  // Identifiers with mixed case or starting with underscore need quoting for safety
  if (name !== name.toLowerCase() || name.startsWith("_")) {
    return true;
  }

  return false;
}

/**
 * Sanitize a table name
 *
 * @param table - The table name
 * @returns The sanitized table reference
 *
 * @example
 * sanitizeTableName('users') // Returns: "users"
 */
export function sanitizeTableName(table: string): string {
  return sanitizeIdentifier(table);
}

/**
 * Sanitize a column reference with optional table qualifier
 *
 * @param column - The column name
 * @param table - Optional table name or alias
 * @returns The sanitized column reference
 *
 * @example
 * sanitizeColumnRef('id') // Returns: "id"
 * sanitizeColumnRef('id', 'users') // Returns: "users"."id"
 */
export function sanitizeColumnRef(column: string, table?: string): string {
  const sanitizedColumn = sanitizeIdentifier(column);

  if (table) {
    const sanitizedTable = sanitizeIdentifier(table);
    return `${sanitizedTable}.${sanitizedColumn}`;
  }

  return sanitizedColumn;
}

/**
 * Sanitize an array of identifiers
 *
 * @param names - Array of identifier names
 * @returns Array of sanitized identifiers
 */
export function sanitizeIdentifiers(names: string[]): string[] {
  return names.map(sanitizeIdentifier);
}

/**
 * Create a safe column list for SELECT statements
 *
 * @param columns - Array of column names
 * @returns Comma-separated list of sanitized column names
 *
 * @example
 * createColumnList(['id', 'name', 'email']) // Returns: "id", "name", "email"
 */
export function createColumnList(columns: string[]): string {
  return sanitizeIdentifiers(columns).join(", ");
}

/**
 * Sanitize an index name
 * SQLite index names follow the same rules as identifiers
 *
 * @param name - The index name
 * @returns The sanitized index name
 */
export function sanitizeIndexName(name: string): string {
  return sanitizeIdentifier(name);
}

/**
 * Quote an identifier for safe use in SQL without strict validation.
 *
 * Unlike sanitizeIdentifier(), this function:
 * - Allows reserved keywords (they become valid when quoted)
 * - Allows any valid SQLite identifier characters
 * - Only validates basic safety (length, no dangerous characters)
 *
 * Use this for user-provided names where reserved keywords
 * are perfectly valid SQLite identifiers when properly quoted.
 *
 * @param name - The identifier to quote
 * @returns The double-quoted identifier safe for SQL interpolation
 * @throws InvalidIdentifierError if the identifier is genuinely invalid
 *
 * @example
 * quoteIdentifier('table') // Returns: "table" (reserved keyword, but valid)
 * quoteIdentifier('my_column') // Returns: "my_column"
 */
export function quoteIdentifier(name: string): string {
  if (!name || typeof name !== "string") {
    throw new InvalidIdentifierError(
      name,
      "Identifier must be a non-empty string",
    );
  }

  if (name.length > MAX_IDENTIFIER_LENGTH) {
    throw new InvalidIdentifierError(
      name,
      `Identifier exceeds maximum length of ${String(MAX_IDENTIFIER_LENGTH)} characters`,
    );
  }

  // Basic pattern validation - allows letters, digits, underscores
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new InvalidIdentifierError(
      name,
      "Identifier contains invalid characters. Must start with a letter or underscore and contain only letters, digits, or underscores",
    );
  }

  // Escape any embedded double quotes (defensive - pattern should prevent this)
  const escaped = name.replace(/"/g, '""');

  return `"${escaped}"`;
}
