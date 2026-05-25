/**
 * SQL Query Validation
 *
 * Security utilities for SQL injection detection and read-only enforcement.
 * Extracted from DatabaseAdapter for modularity.
 */

import { ValidationError } from "../utils/errors/index.js";
import { getAuthContext } from "../auth/auth-context.js";

/**
 * Functions that are generally dangerous in untrusted queries
 * (e.g., loading extensions, writing files, or data exfiltration oracles).
 */
const UNSAFE_FUNCTIONS = new Set([
  "LOAD_EXTENSION",
  "WRITEFILE",
  "READFILE",
]);

/**
 * Security-sensitive PRAGMAs that must be blocked globally.
 */
const BLOCKED_PRAGMAS = new Set([
  "writable_schema",
  "trusted_schema",
  "defensive",
  "cell_size_check",
  "temp_store_directory",
  "journal_mode",
  "synchronous",
  "page_size",
  "temp_store",
  "wal_autocheckpoint",
  "locking_mode",
  "mmap_size",
]);

/**
 * Validate query for safety (SQL injection prevention) using strict structural validation.
 * Strips comments and strings to reliably detect stacked queries and disallowed keywords.
 *
 * @param sql - SQL query to validate
 * @param isReadOnly - Whether to enforce read-only restrictions
 * @throws ValidationError if query violates safety rules
 */
export function validateQuery(sql: string, isReadOnly: boolean): void {
  if (!sql || sql.trim() === "") {
    return; // Empty queries are validated elsewhere
  }

  // Pre-parse security check for blocked pragmas that mutate state
  const pragmaMatches = sql.matchAll(/\bPRAGMA\s+(?:[a-zA-Z_]+\.)?([a-zA-Z_]+)\s*(?:=|\()/gi);
  for (const match of pragmaMatches) {
    if (match[1] && BLOCKED_PRAGMAS.has(match[1].toLowerCase())) {
      throw new ValidationError(`Mutating PRAGMA '${match[1]}' is blocked for security`, "DB_DANGEROUS_PATTERN");
    }
  }

  let stripped = "";
  let inString = false;
  let stringChar = "";
  let inBlockComment = false;
  let inLineComment = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1] || "";

    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
      }
      continue;
    }
    if (inString) {
      if (c === stringChar) {
        if (next === stringChar) {
          i++; // escape
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (c === "'" || c === '"' || c === "`" || c === "[") {
      inString = true;
      stringChar = c === "[" ? "]" : c;
      continue;
    }

    if (c === "-" && next === "-") {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    stripped += c;
  }

  // Remove BEGIN ... END blocks so semicolons inside them don't trigger stacked query detection
  const withoutBlocks = stripped.replace(/\bBEGIN\b[\s\S]*?\bEND\b/gi, "");

  const statements = withoutBlocks.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  if (statements.length > 1) {
    throw new ValidationError("Multiple stacked statements are not allowed.", "DB_DANGEROUS_PATTERN");
  }

  const rootStmt = statements[0] || "";

  if (isReadOnly) {
    const isSafeRead = /^\s*(?:WITH\s+[\s\S]+?)?(?:SELECT|EXPLAIN|PRAGMA)\b/i.test(rootStmt);
    const writeMatch = /\b(INSERT|UPDATE|DELETE|REPLACE|DROP|CREATE|ALTER|VACUUM|ANALYZE|TRUNCATE)\b/i.exec(rootStmt);
    
    if (writeMatch) {
      throw new ValidationError(
        `Read-only mode: ${writeMatch[1]?.toUpperCase() ?? "WRITE"} statements are not allowed`,
        "DB_READ_ONLY_VIOLATION",
      );
    }
    if (!isSafeRead) {
      throw new ValidationError(
        `Read-only mode violation: statement contains disallowed keywords`,
        "DB_READ_ONLY_VIOLATION",
      );
    }
  } else {
    const ddlPattern = /^\s*(?:WITH\s+[\s\S]+?)?(CREATE|DROP|ALTER|VACUUM|ANALYZE)\b/i;
    if (ddlPattern.test(rootStmt)) {
      const authCtx = getAuthContext();
      if (authCtx && authCtx.authenticated && !authCtx.scopes.includes("admin") && !authCtx.scopes.includes("full")) {
        throw new ValidationError(
          "DDL operations (CREATE, DROP, ALTER) require 'admin' or 'full' scope",
          "DB_ADMIN_REQUIRED",
        );
      }
    }
  }

  const unsafePattern = new RegExp(`\\b(${Array.from(UNSAFE_FUNCTIONS).join("|")})\\b`, "i");
  const match = unsafePattern.exec(stripped);
  if (match) {
    throw new ValidationError(`Unsafe function call detected: ${match[0].toUpperCase()}`, "DB_DANGEROUS_PATTERN");
  }
}
