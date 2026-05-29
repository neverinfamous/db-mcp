/**
 * db-mcp — JSON Path and Aggregate Function Validation
 *
 * Validates JSON path expressions and SQL aggregate functions before
 * interpolation into SQL strings. Prevents SQL injection via:
 *
 * - JSON path parameters: Enforces strict `$.key[0].subkey` syntax
 * - Aggregate functions: Whitelists allowed functions (COUNT, SUM, etc.)
 *
 * Security: CWE-89 (SQL Injection) mitigation for parameters that
 * bypass `where-clause.ts` and `identifiers.ts` validation.
 */

import { ValidationError } from "./errors/index.js";

// =============================================================================
// JSON Path Validation (C-1)
// =============================================================================

/**
 * Valid JSON path pattern for SQLite json_extract/json_set/json_remove/etc.
 *
 * Allows:
 * - `$`                    — root
 * - `$.key`                — object member access
 * - `$.key.subkey`         — nested object access
 * - `$[0]`                 — array index access
 * - `$[#]`                 — array append (used by json_insert)
 * - `$[*]`                 — wildcard array access
 * - `$.key[0].subkey[#]`   — mixed access patterns
 *
 * Member names: letters, digits, underscores, hyphens, spaces
 * (covers common JSON property naming conventions).
 */
const VALID_JSON_PATH_PATTERN =
  /^\$(\.[a-zA-Z_][a-zA-Z0-9_ -]*|\[\d+\]|\[#\]|\[\*\])*$/;

/**
 * Maximum JSON path length to prevent ReDoS on the regex.
 */
const MAX_JSON_PATH_LENGTH = 500;

/**
 * Validate a JSON path expression for safe interpolation into SQL.
 *
 * @param path  The JSON path to validate (must start with `$`)
 * @param param Human-readable parameter name for error messages
 * @throws {ValidationError} If the path is invalid or contains injection patterns
 *
 * @example
 * ```ts
 * validateJsonPath("$.name");        // OK
 * validateJsonPath("$[0].value");    // OK
 * validateJsonPath("$') UNION --");  // Throws ValidationError
 * ```
 */
export function validateJsonPath(path: string, param = "path"): void {
  if (!path.startsWith("$")) {
    throw new ValidationError(
      `JSON ${param} must start with $`,
      "INVALID_JSON_PATH",
      {
        suggestion:
          "Use a valid JSON path starting with $. For example: $.key or $[0]",
      },
    );
  }

  if (path.length > MAX_JSON_PATH_LENGTH) {
    throw new ValidationError(
      `JSON ${param} exceeds maximum length of ${MAX_JSON_PATH_LENGTH} characters`,
      "INVALID_JSON_PATH",
    );
  }

  if (!VALID_JSON_PATH_PATTERN.test(path)) {
    throw new ValidationError(
      `Invalid JSON ${param} syntax: ${path}`,
      "INVALID_JSON_PATH",
      {
        suggestion:
          "Use $.key, $[0], or $[*] patterns. " +
          "Member names must start with a letter or underscore.",
      },
    );
  }
}

// =============================================================================
// Aggregate Function Validation (C-2)
// =============================================================================

/**
 * Allowed aggregate function names (case-insensitive).
 */
const ALLOWED_AGGREGATE_FUNCTIONS = new Set([
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "group_concat",
  "total",
]);

/**
 * Pattern matching allowed aggregate function syntax:
 *
 * - `COUNT(*)`
 * - `COUNT(column_name)`
 * - `SUM(column_name)`
 * - `AVG("quoted_column")`
 * - `GROUP_CONCAT(column, ', ')`
 *
 * Column names: alphanumeric + underscores, optionally double-quoted.
 * Rejects arbitrary SQL expressions, subqueries, and nested function calls.
 */
const AGGREGATE_FUNCTION_PATTERN =
  /^([A-Za-z_]+)\(\s*(\*|"[a-zA-Z_][a-zA-Z0-9_]*"|[a-zA-Z_][a-zA-Z0-9_]*)(?:\s*,\s*'[^']*')?\s*\)$/;

/**
 * Validate an aggregate function expression for safe interpolation into SQL.
 *
 * @param fn The aggregate function string (e.g., "COUNT(*)", "SUM(amount)")
 * @throws {ValidationError} If the function is not in the allowed whitelist or has invalid syntax
 *
 * @example
 * ```ts
 * validateAggregateFunction("COUNT(*)");           // OK
 * validateAggregateFunction("SUM(amount)");        // OK
 * validateAggregateFunction("GROUP_CONCAT(name, ', ')"); // OK
 * validateAggregateFunction("(SELECT password FROM users LIMIT 1)"); // Throws
 * ```
 */
export function validateAggregateFunction(fn: string): void {
  const match = AGGREGATE_FUNCTION_PATTERN.exec(fn.trim());

  if (!match) {
    throw new ValidationError(
      `Invalid aggregate function syntax: ${fn}`,
      "INVALID_AGGREGATE_FUNCTION",
      {
        suggestion:
          "Use a standard aggregate function like COUNT(*), SUM(column), AVG(column), " +
          "MIN(column), MAX(column), GROUP_CONCAT(column), or TOTAL(column).",
      },
    );
  }

  const funcName = match[1]?.toLowerCase();
  if (!funcName || !ALLOWED_AGGREGATE_FUNCTIONS.has(funcName)) {
    throw new ValidationError(
      `Disallowed aggregate function: ${match[1]}. ` +
        `Allowed: ${[...ALLOWED_AGGREGATE_FUNCTIONS].join(", ").toUpperCase()}`,
      "INVALID_AGGREGATE_FUNCTION",
    );
  }
}
