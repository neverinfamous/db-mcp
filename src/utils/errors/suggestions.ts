/**
 * Error Suggestions
 *
 * Pattern-based suggestions for common errors. Maps error message patterns
 * to actionable user-facing suggestions.
 */

import { ErrorCategory } from "./categories.js";

/**
 * Pattern-based suggestions for common errors
 */
const ERROR_SUGGESTIONS: {
  pattern: RegExp;
  suggestion: string;
  category?: ErrorCategory | undefined;
  /** Specific error code override (takes precedence over category default code) */
  code?: string | undefined;
}[] = [
  // Validation errors
  {
    pattern: /invalid table name/i,
    suggestion:
      "Table names must start with a letter or underscore, followed by letters, numbers, or underscores only.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /invalid column name/i,
    suggestion:
      "Column names must start with a letter or underscore, followed by letters, numbers, or underscores only.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /invalid (view|index) name/i,
    suggestion:
      "Names must start with a letter or underscore, followed by alphanumeric characters only.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /json path must start with \$/i,
    suggestion:
      "JSON paths use $ as the root. Example: $.name, $.items[0], $.nested.property",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /vector dimensions must match/i,
    suggestion:
      "All vectors in comparison must have the same number of dimensions.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /insufficient data/i,
    suggestion:
      "Not enough data points for the requested analysis. Add more data or reduce the degree.",
    category: ErrorCategory.VALIDATION,
  },

  // Resource errors — specific codes for table/column not found
  {
    pattern: /no such table[:\s]*(['"]?)(\w+)\1/i,
    suggestion:
      "Table not found. Run sqlite_list_tables to see available tables.",
    category: ErrorCategory.RESOURCE,
    code: "TABLE_NOT_FOUND",
  },
  {
    pattern: /no such column[:\s]*(['"]?)(\w+)\1/i,
    suggestion:
      "Column not found. Use sqlite_describe_table to see available columns.",
    category: ErrorCategory.RESOURCE,
    code: "COLUMN_NOT_FOUND",
  },
  {
    pattern: /has no column named/i,
    suggestion:
      "Column not found in target table. Use sqlite_describe_table to verify column names before INSERT or UPDATE.",
    category: ErrorCategory.RESOURCE,
    code: "COLUMN_NOT_FOUND",
  },
  {
    pattern: /no such view[:\s]*(['"]?)(\w+)\1/i,
    suggestion: "View not found. Run sqlite_list_views to see available views.",
    category: ErrorCategory.RESOURCE,
    code: "VIEW_NOT_FOUND",
  },
  {
    pattern: /filename.*does not exist/i,
    suggestion:
      "File not found. Verify the absolute path exists and is readable.",
    category: ErrorCategory.RESOURCE,
    code: "FILE_NOT_FOUND",
  },
  {
    pattern: /table .* already exists/i,
    suggestion:
      "Table already exists. Use CREATE TABLE IF NOT EXISTS or drop the existing table first.",
    category: ErrorCategory.RESOURCE,
  },

  // JSON-specific errors — often caused by wrong column name
  {
    pattern: /malformed JSON/i,
    suggestion:
      "The JSON data is malformed. This commonly occurs when the column name is incorrect — SQLite treats the unresolved identifier as a literal string. Verify the column exists with sqlite_describe_table.",
    category: ErrorCategory.QUERY,
    code: "MALFORMED_JSON",
  },

  // Query errors
  {
    pattern: /syntax error/i,
    suggestion:
      "Check SQL syntax. Common issues: missing quotes, commas, parentheses, or reserved word conflicts.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /UNIQUE constraint failed/i,
    suggestion:
      "A row with this value already exists. Use UPDATE to modify existing data or check for duplicates.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /FOREIGN KEY constraint failed/i,
    suggestion:
      "The referenced row does not exist. Ensure the parent record exists before inserting.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /NOT NULL constraint failed/i,
    suggestion:
      "A required column is missing a value. Provide a value or set a default.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /CHECK constraint failed/i,
    suggestion:
      "The value does not meet the column's check constraint requirements.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /incomplete input/i,
    suggestion:
      "SQL statement is incomplete. Check for missing clauses, closing parentheses, or semicolons.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /more than one statement/i,
    suggestion:
      "Only one SQL statement per call is allowed. Split multiple statements into separate calls or use sqlite_execute_code for multi-step operations.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /too few parameter/i,
    suggestion:
      "Not enough parameter values provided for the prepared statement placeholders (?). Ensure params array matches the number of ? placeholders in the query.",
    category: ErrorCategory.QUERY,
  },

  // Connection errors
  {
    pattern: /not connected/i,
    suggestion:
      "Database connection not established. Ensure the database is configured and connected.",
    category: ErrorCategory.CONNECTION,
  },
  {
    pattern: /cannot start a transaction within a transaction/i,
    suggestion:
      "A transaction is already active. Commit or rollback the current transaction first, or use sqlite_transaction_execute for atomic multi-statement operations.",
    category: ErrorCategory.QUERY,
    code: "TRANSACTION_CONFLICT",
  },
  {
    pattern: /database is locked/i,
    suggestion:
      "Database is being used by another process. Wait and retry, or check for long-running transactions.",
    category: ErrorCategory.CONNECTION,
  },

  // Permission errors
  {
    pattern: /readonly database/i,
    suggestion:
      "Database is in read-only mode. Check file permissions or connection settings.",
    category: ErrorCategory.PERMISSION,
  },
  {
    pattern: /attempt to write a readonly/i,
    suggestion:
      "Write operations are not allowed. Check database configuration.",
    category: ErrorCategory.PERMISSION,
  },

  // Codemode errors
  {
    pattern: /code validation failed/i,
    suggestion:
      "Check for blocked patterns: require(), process., eval(), Function(), import(). Use sqlite.* API instead.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /rate limit exceeded/i,
    suggestion:
      "Wait before retrying. Combine multiple operations into fewer execute_code calls.",
    category: ErrorCategory.PERMISSION,
  },
  {
    pattern: /execution timed out/i,
    suggestion:
      "Reduce code complexity or increase timeout (max 30s). Break into smaller operations.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /sandbox.*not initialized/i,
    suggestion: "Internal sandbox error. Retry the operation.",
    category: ErrorCategory.INTERNAL,
  },
];

/**
 * Find a suggestion for an error message
 */
export function findSuggestion(message: string): {
  suggestion: string;
  category?: ErrorCategory | undefined;
  code?: string | undefined;
} | null {
  for (const entry of ERROR_SUGGESTIONS) {
    if (entry.pattern.test(message)) {
      return {
        suggestion: entry.suggestion,
        category: entry.category,
        code: entry.code,
      };
    }
  }
  return null;
}
