/**
 * Stats Helper Utilities
 *
 * Shared validation functions, types, and constants for statistics tools.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";





import { ValidationError } from "../../../../utils/errors/index.js";

/**
 * Valid enum values for handler-side validation.
 * Required enums use z.string() in schema + handler validation against these.
 */
export const VALID_STAT_TYPES = ["sum", "avg", "min", "max", "count"] as const;
export const VALID_TEST_TYPES = [
  "ttest_one",
  "ttest_two",
  "chi_square",
] as const;

// Re-export validateColumnExists from shared utility so existing consumers keep working
export { validateColumnExists } from "../column-validation.js";

/**
 * Numeric column types for validation.
 */
export const NUMERIC_TYPES = new Set([
  "integer",
  "int",
  "real",
  "float",
  "double",
  "numeric",
  "decimal",
  "number",
  "smallint",
  "bigint",
  "tinyint",
  "mediumint",
]);

/**
 * Check if a column type string matches a known numeric type.
 */
export function isNumericType(typeStr: string): boolean {
  const lower = typeStr.toLowerCase();
  return [...NUMERIC_TYPES].some((nt) => lower === nt || lower.startsWith(nt));
}

/**
 * Validate that a column is a numeric type.
 * Returns a structured error object if not numeric, or null if validation passes.
 */
export async function validateNumericColumn(
  adapter: SqliteAdapter,
  tableName: string,
  columnName: string,
): Promise<void> {
  const tableInfo = await adapter.describeTable(tableName);
  const columnMap = new Map(
    (tableInfo.columns ?? []).map((c) => [
      c.name.toLowerCase(),
      (c.type ?? "").toLowerCase(),
    ]),
  );
  const colType = columnMap.get(columnName.toLowerCase()) ?? "";

  if (!isNumericType(colType)) {
    throw new ValidationError(
      `Column '${columnName}' in table '${tableName}' is not numeric (type: ${colType || "unknown"}). This operation requires a numeric column.`,
      "INVALID_INPUT",
      {
        suggestion: "Use numeric columns (INTEGER, REAL, FLOAT, etc.) for statistical analysis.",
        details: {
          resourceType: "column",
          resourceName: columnName,
          tableName: tableName
        }
      }
    );
  }
}

// =============================================================================
// Input Schemas
// =============================================================================

