/**
 * ALTER TABLE Tool
 *
 * Structured ALTER TABLE operations: ADD COLUMN, RENAME COLUMN,
 * DROP COLUMN (SQLite 3.35+), and RENAME TABLE.
 * Provides validation, existence checks, and SQLite-specific constraint awareness.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { destructive } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../utils/errors/index.js";
import { resolveAliases } from "../../types.js";
import {
  AlterTableSchema,
  AlterTableOutputSchema,
} from "../../schemas/core.js";

/**
 * Format a default value for SQL.
 * Handles strings, numbers, booleans, NULL, and SQL expressions.
 */
function formatDefaultValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "string") {
    // Detect SQL expressions (function calls, keywords)
    const isSqlExpression =
      /^[a-zA-Z_]+\s*\(/.test(value) ||
      /^(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|NULL)$/i.test(value);
    if (isSqlExpression) return `(${value})`;
    return `'${value.replace(/'/g, "''")}'`;
  }
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}

export function createAlterTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_alter_table",
    description:
      "Alter a table's structure. Supports: add_column (add a new column), rename_column (rename an existing column), drop_column (remove a column, SQLite 3.35+), rename_table (rename the table). Provides validation and SQLite-specific constraint checking.",
    group: "core",
    inputSchema: AlterTableSchema,
    outputSchema: AlterTableOutputSchema,
    requiredScopes: ["admin"],
    annotations: destructive("Alter Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = AlterTableSchema.parse(
          resolveAliases(params, { tableName: "table" }),
        );
      } catch (error: unknown) {
        return { ...formatHandlerError(error), sql: "" };
      }

      // Validate table name
      let quotedTable: string;
      try {
        quotedTable = sanitizeIdentifier(input.table);
      } catch {
        return {
          ...formatHandlerError(
            new ValidationError(
              `Invalid table name '${input.table}': must be a non-empty string starting with a letter or underscore`,
            ),
          ),
          sql: "",
        };
      }

      // Verify table exists
      const tableCheck = await adapter.executeReadQuery(
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name=? UNION ALL SELECT 1 FROM sqlite_temp_master WHERE type='table' AND name=?`,
        [input.table, input.table],
      );
      if ((tableCheck.rows?.length ?? 0) === 0) {
        return {
          ...formatHandlerError(
            new ValidationError(
              `Table '${input.table}' does not exist`,
              "TABLE_NOT_FOUND",
              {
                suggestion:
                  "Table not found. Run sqlite_list_tables to see available tables.",
              },
            ),
          ),
          sql: "",
        };
      }

      try {
        let sql: string;

        switch (input.operation) {
          case "add_column": {
            if (!input.column) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "'column' is required for add_column operation",
                  ),
                ),
                sql: "",
              };
            }
            if (!input.type) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "'type' is required for add_column operation",
                  ),
                ),
                sql: "",
              };
            }

            // Check if column already exists
            const colCheck = await adapter.executeReadQuery(
              `PRAGMA table_info(${quotedTable})`,
            );
            const existingCols = (colCheck.rows ?? []).map(
              (r) => r["name"] as string,
            );
            if (existingCols.includes(input.column)) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    `Column '${input.column}' already exists in table '${input.table}'`,
                    "COLUMN_EXISTS",
                  ),
                ),
                sql: "",
              };
            }

            // SQLite restrictions: new columns cannot have PRIMARY KEY or UNIQUE
            const typeUpper = input.type.toUpperCase();
            if (typeUpper.includes("PRIMARY KEY")) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "Cannot add a column with PRIMARY KEY constraint via ALTER TABLE. Create a new table instead.",
                    "SQLITE_LIMITATION",
                  ),
                ),
                sql: "",
              };
            }
            if (typeUpper.includes("UNIQUE")) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "Cannot add a column with UNIQUE constraint via ALTER TABLE. Add the column first, then create a unique index.",
                    "SQLITE_LIMITATION",
                  ),
                ),
                sql: "",
              };
            }

            // NOT NULL without default is not allowed
            if (!input.nullable && input.defaultValue === undefined) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "Cannot add a NOT NULL column without a default value. Provide 'defaultValue' or set 'nullable' to true.",
                    "SQLITE_LIMITATION",
                  ),
                ),
                sql: "",
              };
            }

            const quotedCol = `"${input.column.replace(/"/g, '""')}"`;
            const parts = [`ALTER TABLE ${quotedTable} ADD COLUMN ${quotedCol} ${input.type}`];
            if (!input.nullable) parts.push("NOT NULL");
            if (input.defaultValue !== undefined) {
              parts.push(`DEFAULT ${formatDefaultValue(input.defaultValue)}`);
            }
            sql = parts.join(" ");
            break;
          }

          case "rename_column": {
            if (!input.column) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "'column' is required for rename_column operation",
                  ),
                ),
                sql: "",
              };
            }
            if (!input.newName) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "'newName' is required for rename_column operation",
                  ),
                ),
                sql: "",
              };
            }

            // Verify source column exists
            const colInfo = await adapter.executeReadQuery(
              `PRAGMA table_info(${quotedTable})`,
            );
            const colNames = (colInfo.rows ?? []).map(
              (r) => r["name"] as string,
            );
            if (!colNames.includes(input.column)) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    `Column '${input.column}' does not exist in table '${input.table}'`,
                    "COLUMN_NOT_FOUND",
                  ),
                ),
                sql: "",
              };
            }

            // Check target name doesn't already exist
            if (colNames.includes(input.newName)) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    `Column '${input.newName}' already exists in table '${input.table}'`,
                    "COLUMN_EXISTS",
                  ),
                ),
                sql: "",
              };
            }

            const oldCol = `"${input.column.replace(/"/g, '""')}"`;
            const newCol = `"${input.newName.replace(/"/g, '""')}"`;
            sql = `ALTER TABLE ${quotedTable} RENAME COLUMN ${oldCol} TO ${newCol}`;
            break;
          }

          case "drop_column": {
            if (!input.column) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "'column' is required for drop_column operation",
                  ),
                ),
                sql: "",
              };
            }

            // Verify column exists
            const dropColInfo = await adapter.executeReadQuery(
              `PRAGMA table_info(${quotedTable})`,
            );
            const dropColNames = (dropColInfo.rows ?? []).map(
              (r) => r["name"] as string,
            );
            if (!dropColNames.includes(input.column)) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    `Column '${input.column}' does not exist in table '${input.table}'`,
                    "COLUMN_NOT_FOUND",
                  ),
                ),
                sql: "",
              };
            }

            // Cannot drop the last column
            if (dropColNames.length <= 1) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "Cannot drop the only column in a table. Drop the table instead.",
                    "SQLITE_LIMITATION",
                  ),
                ),
                sql: "",
              };
            }

            const dropCol = `"${input.column.replace(/"/g, '""')}"`;
            sql = `ALTER TABLE ${quotedTable} DROP COLUMN ${dropCol}`;
            break;
          }

          case "rename_table": {
            if (!input.newName) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    "'newName' is required for rename_table operation",
                  ),
                ),
                sql: "",
              };
            }

            // Validate new table name
            try {
              sanitizeIdentifier(input.newName);
            } catch {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    `Invalid new table name '${input.newName}': must be a non-empty string starting with a letter or underscore`,
                  ),
                ),
                sql: "",
              };
            }

            // Check new name doesn't exist
            const newTableCheck = await adapter.executeReadQuery(
              `SELECT 1 FROM sqlite_master WHERE type='table' AND name=? UNION ALL SELECT 1 FROM sqlite_temp_master WHERE type='table' AND name=?`,
              [input.newName, input.newName],
            );
            if ((newTableCheck.rows?.length ?? 0) > 0) {
              return {
                ...formatHandlerError(
                  new ValidationError(
                    `Table '${input.newName}' already exists`,
                    "TABLE_EXISTS",
                  ),
                ),
                sql: "",
              };
            }

            const newTable = `"${input.newName.replace(/"/g, '""')}"`;
            sql = `ALTER TABLE ${quotedTable} RENAME TO ${newTable}`;
            break;
          }
        }

        await adapter.executeQuery(sql);

        // Invalidate schema cache after DDL
        adapter.clearSchemaCache();

        const messages: Record<string, string> = {
          add_column: `Column '${input.column}' added to table '${input.table}'`,
          rename_column: `Column '${input.column}' renamed to '${input.newName}' in table '${input.table}'`,
          drop_column: `Column '${input.column}' dropped from table '${input.table}'`,
          rename_table: `Table '${input.table}' renamed to '${input.newName}'`,
        };

        return {
          success: true,
          message: messages[input.operation],
          sql,
        };
      } catch (error: unknown) {
        return { ...formatHandlerError(error), sql: "" };
      }
    },
  };
}
