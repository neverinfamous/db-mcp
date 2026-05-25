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
  let ast: SQLiteStatementList;
  try {
    ast = parser(sql);
  } catch (error) {
    throw new ValidationError(
      `Failed to parse SQL: ${error instanceof Error ? error.message : String(error)}`,
      "DB_PARSE_ERROR",
    );
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
    // Only SELECT and EXPLAIN should generally be allowed in read-only mode
    if (rootStmt.variant !== "select" && rootStmt.variant !== "explain") {
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
      if (authCtx && authCtx.authenticated && !authCtx.scopes.includes("admin")) {
        throw new ValidationError(
          "DDL operations (CREATE, DROP, ALTER) require 'admin' scope",
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
