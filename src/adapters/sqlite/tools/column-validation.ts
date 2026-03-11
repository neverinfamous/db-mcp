/**
 * Column Validation Utilities
 *
 * Shared functions for validating table and column existence.
 * Used by geo, text, and stats tool groups to prevent silent
 * failures when SQLite treats quoted nonexistent identifiers
 * as string literals.
 */

import type { SqliteAdapter } from "../sqlite-adapter.js";
import { ResourceNotFoundError } from "../../../utils/errors/index.js";

/**
 * Validate that a column exists in a table.
 * Prevents silent success when SQLite treats quoted nonexistent identifiers as string literals.
 */
export async function validateColumnExists(
  adapter: SqliteAdapter,
  tableName: string,
  columnName: string,
): Promise<void> {
  // First check if the table exists
  const tableCheck = await adapter.executeReadQuery(
    `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name='${tableName.replace(/'/g, "''")}'`,
  );
  if (!tableCheck.rows || tableCheck.rows.length === 0) {
    throw new ResourceNotFoundError(
      `Table '${tableName}' does not exist`,
      "TABLE_NOT_FOUND",
      {
        suggestion:
          "Table not found. Run sqlite_list_tables to see available tables.",
        resourceType: "table",
        resourceName: tableName,
      },
    );
  }

  // Then check if the column exists
  const result = await adapter.executeReadQuery(
    `SELECT name FROM pragma_table_info('${tableName.replace(/'/g, "''")}') WHERE name = '${columnName.replace(/'/g, "''")}' LIMIT 1`,
  );
  if (!result.rows || result.rows.length === 0) {
    throw new ResourceNotFoundError(
      `Column '${columnName}' not found in table '${tableName}'`,
      "COLUMN_NOT_FOUND",
      {
        suggestion:
          "Column not found. Use sqlite_describe_table to see available columns.",
        resourceType: "column",
        resourceName: columnName,
      },
    );
  }
}

/**
 * Validate that multiple columns exist in a table.
 */
export async function validateColumnsExist(
  adapter: SqliteAdapter,
  tableName: string,
  columnNames: string[],
): Promise<void> {
  for (const col of columnNames) {
    await validateColumnExists(adapter, tableName, col);
  }
}
