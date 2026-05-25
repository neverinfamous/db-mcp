/**
 * SQL Query Validation
 *
 * Security utilities for SQL injection detection and read-only enforcement.
 * Extracted from DatabaseAdapter for modularity.
 */

import { ValidationError } from "../utils/errors/index.js";
import { getAuthContext } from "../auth/auth-context.js";
import parser from "sqlite-parser";

/**
 * Functions that are generally dangerous in untrusted queries
 * (e.g., loading extensions, writing files, or data exfiltration oracles).
 */
const UNSAFE_FUNCTIONS = new Set([
  "LOAD_EXTENSION",
  "WRITEFILE",
  "READFILE",
  // Hex, substr, case when are often used in blind injection, but can be legit.
  // We'll block the most dangerous system-level ones here.
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
 * DDL operations that require admin scope
 */
const DDL_VARIANTS = new Set(["create", "drop", "alter", "vacuum", "analyze"]);

/**
 * Statements that mutate data (blocked in read-only mode)
 */
const WRITE_VARIANTS = new Set([
  "insert",
  "update",
  "delete",
  "replace",
  ...DDL_VARIANTS,
]);

import type { SQLiteStatementList, SQLiteNode } from "sqlite-parser";

/**
 * Validate query for safety (SQL injection prevention) using AST parsing.
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

  let ast: SQLiteStatementList;
  try {
    ast = parser(sql);
  } catch {
    // sqlite-parser lacks support for modern SQLite features like WINDOW clauses and some CTEs.
    // When AST parsing fails, fallback to strict structural validation.
    // SECURITY NOTE: The fallback validation uses regex instead of a full AST walk.
    // While it effectively blocks stacked queries and unsafe DML/DDL keywords, 
    // it may not catch embedded unsafe functions (like WRITEFILE) if they are obfuscated
    // within complex modern syntax (e.g., inside a WINDOW clause) that bypasses the regex check.
    import("../utils/logger/index.js")
      .then(({ logger }) => {
        logger.warn("AST parsing failed. Using fallback regex validation.", { module: "ADAPTER" });
      })
      .catch(() => { /* ignore */ });
    fallbackValidation(sql, isReadOnly);
    return;
  }

  if (ast?.type !== "statement" || ast?.variant !== "list" || !Array.isArray(ast?.statement)) {
    throw new ValidationError("Invalid SQL statement structure", "DB_INVALID_SQL");
  }

  // 1. Stacked Query Prevention (Array of multiple statements)
  if (ast.statement.length > 1) {
    throw new ValidationError(
      "Multiple stacked statements are not allowed.",
      "DB_DANGEROUS_PATTERN",
    );
  }

  if (ast.statement.length === 0) {
    return; // Empty query is harmless
  }

  const rootStmt = ast.statement[0];
  if (!rootStmt?.variant) {
    throw new ValidationError("Invalid statement structure", "DB_INVALID_SQL");
  }

  // 2. Read-Only Enforcement
  if (isReadOnly) {
    if (WRITE_VARIANTS.has(rootStmt.variant)) {
      throw new ValidationError(
        `Read-only mode: ${rootStmt.variant.toUpperCase()} statements are not allowed`,
        "DB_READ_ONLY_VIOLATION",
      );
    }
    // Only SELECT, EXPLAIN, PRAGMA, and COMPOUND (UNION, INTERSECT) should generally be allowed in read-only mode
    if (
      rootStmt.variant !== "select" &&
      rootStmt.variant !== "explain" &&
      rootStmt.variant !== "pragma" &&
      rootStmt.variant !== "compound"
    ) {
      throw new ValidationError(
        `Read-only mode: ${rootStmt.variant.toUpperCase()} statements are not allowed`,
        "DB_READ_ONLY_VIOLATION",
      );
    }
  } else {
    // Write mode: block destructive DDL unless user has admin scope (F06)
    if (DDL_VARIANTS.has(rootStmt.variant)) {
      const authCtx = getAuthContext();
      // If auth is enabled (authCtx is present and authenticated) and missing admin scope, block it.
      if (authCtx && authCtx.authenticated && !authCtx.scopes.includes("admin") && !authCtx.scopes.includes("full")) {
        throw new ValidationError(
          "DDL operations (CREATE, DROP, ALTER) require 'admin' or 'full' scope",
          "DB_ADMIN_REQUIRED",
        );
      }
    }
  }

  // 3. Walk the AST to detect unsafe function calls or dangerous nodes
  walkAst(ast, (node) => {
    if (node.type === "function" && typeof node.name === "object" && node.name !== null && typeof node.name.name === "string") {
      const funcName = node.name.name.toUpperCase();
      if (UNSAFE_FUNCTIONS.has(funcName)) {
        throw new ValidationError(
          `Unsafe function call detected: ${funcName}`,
          "DB_DANGEROUS_PATTERN",
        );
      }
    }
  });
}

/**
 * Helper to traverse the SQLite AST
 */
function walkAst(node: unknown, visitor: (node: SQLiteNode) => void): void {
  if (node === undefined || node === null || typeof node !== "object") return;

  visitor(node as SQLiteNode);

  for (const key of Object.keys(node)) {
    const value = (node as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        walkAst(item, visitor);
      }
    } else if (typeof value === "object") {
      walkAst(value, visitor);
    }
  }
}

/**
 * Strict structural fallback validation for when sqlite-parser fails.
 * Strips comments and strings to reliably detect stacked queries and disallowed keywords.
 */
function fallbackValidation(sql: string, isReadOnly: boolean): void {
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

  const statements = stripped.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  if (statements.length > 1) {
    throw new ValidationError("Multiple stacked statements are not allowed.", "DB_DANGEROUS_PATTERN");
  }

  const rootStmt = statements[0] || "";

  if (isReadOnly) {
    const isSafeRead = /^\s*(?:WITH\s+[\s\S]+?)?(?:SELECT|EXPLAIN|PRAGMA)\b/i.test(rootStmt);
    const hasWrite = /\b(INSERT|UPDATE|DELETE|REPLACE|DROP|CREATE|ALTER|VACUUM|ANALYZE|TRUNCATE)\b/i.test(rootStmt);
    
    if (!isSafeRead || hasWrite) {
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
