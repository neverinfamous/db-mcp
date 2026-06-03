import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import {
  validateIdentifier,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import {
  ResourceNotFoundError,
  ValidationError,
} from "../../../../utils/errors/index.js";
import { DbMcpError } from "../../../../utils/errors/base.js";
import { ErrorCategory } from "../../../../utils/errors/categories.js";

/**
 * Coerce string-typed numbers to actual numbers.
 * Returns the original string for non-numeric strings so Zod validation fails.
 */
export const coerceNumber = (val: unknown): unknown => {
  if (typeof val === "string") {
    if (val.trim() === "") return undefined;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }
  return val;
};

/**
 * Create a coercer for optional enum params with defaults.
 * Returns `undefined` for any value NOT in the allowed set,
 * so `.optional().default()` kicks in.
 * Prevents raw MCP -32602 for invalid enum values.
 */
export const coerceEnumValues =
  (allowed: readonly string[]) =>
  (val: unknown): unknown =>
    typeof val === "string" && allowed.includes(val) ? val : undefined;

/** Valid direction values for handler-side validation (required enum). */
export const VALID_DIRECTIONS = ["lag", "lead"] as const;

/**
 * Validate table exists in database (format + existence check)
 */
export async function validateTableExists(
  adapter: NativeSqliteAdapter,
  table: string,
): Promise<void> {
  // Use canonical identifier validation (CWE-89 remediation)
  validateIdentifier(table);

  // validateIdentifier confirms name is [a-zA-Z_][a-zA-Z0-9_]* — safe for string literal
  const result = await adapter.executeReadQuery(
    `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name='${table}'`,
  );
  if (!result.rows || result.rows.length === 0) {
    throw new ResourceNotFoundError(
      `Table '${table}' does not exist`,
      "TABLE_NOT_FOUND",
      {
        suggestion:
          "Table not found. Run sqlite_list_tables to see available tables.",
        resourceType: "table",
        resourceName: table,
      },
    );
  }
}

/**
 * Validate column exists in table
 */
export async function validateColumnInTable(
  adapter: NativeSqliteAdapter,
  table: string,
  column: string,
): Promise<void> {
  // Use canonical identifier validation (CWE-89 remediation)
  validateIdentifier(column);

  // validateIdentifier confirms names are [a-zA-Z_][a-zA-Z0-9_]* — safe for string literal
  const tableInfo = await adapter.executeReadQuery(
    `SELECT name FROM pragma_table_info('${table}') WHERE name='${column}'`,
  );
  if (!tableInfo.rows || tableInfo.rows.length === 0) {
    throw new ResourceNotFoundError(
      `Column '${column}' not found in table '${table}'`,
      "COLUMN_NOT_FOUND",
      {
        suggestion:
          "Column not found. Use sqlite_describe_table to see available columns.",
        resourceType: "column",
        resourceName: column,
      },
    );
  }
}

/**
 * Validate that column names referenced in an ORDER BY clause exist in the table.
 * Handles multi-column ordering (comma-separated), directional keywords (ASC/DESC),
 * and gracefully skips expression-like tokens (containing parens, dots, etc.).
 */
export async function validateOrderByColumns(
  adapter: NativeSqliteAdapter,
  table: string,
  orderBy: string,
): Promise<void> {
  const parts = orderBy.split(",");
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/);
    const firstToken = tokens[0];
    if (!firstToken) continue;
    const colName = firstToken.replace(/^"|"$/g, "");
    // Reject expression-like tokens instead of skipping them (CWE-89 remediation)
    if (/[;()+*/]/.test(colName)) {
      throw new DbMcpError(
        `Invalid ORDER BY expression: '${colName}' contains disallowed characters. Only column names with optional ASC/DESC are permitted.`,
        "NATIVE_WINDOW_INVALID_ORDERBY",
        ErrorCategory.VALIDATION,
      );
    }
    if (/^(ASC|DESC)$/i.test(colName)) continue;
    // Allow dotted references (table.column) by validating each segment
    if (colName.includes(".")) {
      for (const segment of colName.split(".")) {
        validateIdentifier(segment);
      }
      continue;
    }
    await validateColumnInTable(adapter, table, colName);
  }
}

/**
 * Helper to format column selection and omit long content columns by default
 */
export async function resolveSelectColumns(
  adapter: NativeSqliteAdapter,
  table: string,
  selectColumns: string[] | undefined,
  rankCol?: string,
): Promise<{ columnList: string; hint?: string }> {
  if (selectColumns && selectColumns.length > 0) {
    // Use canonical sanitization instead of manual quoting (CWE-89 remediation)
    return {
      columnList: selectColumns.map((c) => sanitizeIdentifier(c)).join(", "),
    };
  }

  // PRAGMA arguments need string values, not double-quoted identifiers
  // validateIdentifier already confirmed table is safe
  const tableInfo = await adapter.executeReadQuery(
    `PRAGMA table_info('${table}')`,
  );

  const TEXT_TYPES = new Set([
    "text",
    "blob",
    "clob",
    "varchar",
    "nvarchar",
    "char",
  ]);
  const LONG_CONTENT_PATTERNS = [
    "description",
    "body",
    "bio",
    "content",
    "notes",
    "summary",
    "comment",
    "details",
    "html",
    "markdown",
    "text",
    "message",
    "payload",
    "raw",
    "data",
    "log",
    "blob",
  ];

  const excluded: string[] = [];
  const included: string[] = [];

  for (const c of tableInfo.rows ?? []) {
    const colName = c["name"] as string;
    const colType = ((c["type"] as string) ?? "").toLowerCase();
    const nameLower = colName.toLowerCase();

    const isText = [...TEXT_TYPES].some(
      (t) => colType === t || colType.startsWith(t),
    );
    const isRankCol = rankCol ? nameLower === rankCol.toLowerCase() : false;
    const isLongContent = LONG_CONTENT_PATTERNS.some(
      (p) =>
        nameLower === p ||
        nameLower.endsWith(`_${p}`) ||
        nameLower.startsWith(`${p}_`),
    );

    if (isText && !isRankCol && isLongContent) {
      excluded.push(colName);
    } else {
      included.push(colName);
    }
  }

  if (included.length > 10) {
    throw new ValidationError(
      `Table '${table}' has too many columns (${included.length} remaining after text filtering). You must explicitly provide 'selectColumns' to prevent context window bloat.`,
      "INVALID_INPUT",
    );
  }

  if (excluded.length > 0 && included.length > 0) {
    return {
      columnList: included.map((c) => sanitizeIdentifier(c)).join(", "),
      hint: `Excluded ${excluded.length} long-content column(s) (${excluded.join(", ")}) to reduce payload. Use selectColumns to override.`,
    };
  }

  return { columnList: "*" };
}

/**
 * Sanitize a PARTITION BY expression by validating each column reference.
 * Only allows comma-separated column names (no expressions).
 */
export function sanitizePartitionBy(partitionBy: string): string {
  const columns = partitionBy
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  for (const col of columns) {
    validateIdentifier(col);
  }
  return columns.map((c) => sanitizeIdentifier(c)).join(", ");
}

/**
 * Sanitize an ORDER BY expression by validating each column reference.
 * Preserves ASC/DESC direction keywords.
 */
export function sanitizeOrderByExpr(orderBy: string): string {
  const parts = orderBy.split(",");
  const sanitized: string[] = [];
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/);
    const colToken = tokens[0];
    if (!colToken) continue;
    const colName = colToken.replace(/^"|"$/g, "");
    validateIdentifier(colName);
    const direction = tokens[1];
    if (direction && /^(ASC|DESC)$/i.test(direction)) {
      sanitized.push(
        `${sanitizeIdentifier(colName)} ${direction.toUpperCase()}`,
      );
    } else {
      sanitized.push(sanitizeIdentifier(colName));
    }
  }
  return sanitized.join(", ");
}

/**
 * Validate that a default value is a safe SQL literal (numeric or quoted string).
 * Rejects expressions, function calls, subqueries, and injection payloads.
 */
export function validateDefaultValue(value: string): void {
  // Allow numeric literals (integers and decimals, optionally negative)
  if (/^-?\d+(\.\d+)?$/.test(value)) return;

  // Allow simple single-quoted string literals (no nested quotes or special chars)
  if (/^'[^']*'$/.test(value)) return;

  // Allow NULL keyword
  if (/^NULL$/i.test(value)) return;

  throw new DbMcpError(
    `Invalid default value: '${value}'. Only numeric literals, single-quoted strings, or NULL are permitted.`,
    "NATIVE_WINDOW_INVALID_DEFAULT",
    ErrorCategory.VALIDATION,
  );
}
