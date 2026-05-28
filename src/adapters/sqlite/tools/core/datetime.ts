import { buildWhereClause, sanitizeWhereClause } from "../../../../utils/where-clause.js";
import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { formatHandlerError, ValidationError } from "../../../../utils/errors/index.js";
import { DateAddSchema, DateDiffSchema } from "../../schemas/core.js";
import { DateMathOutputSchema } from "../../schemas/core.js";
import { validateColumnExists } from "../column-validation.js";

/**
 * Add time to a date column
 */
export function createDateAddTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_date_add",
    description: "Add or subtract time from a date column",
    group: "core",
    inputSchema: DateAddSchema,
    outputSchema: DateMathOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Date/Time Add"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = DateAddSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      const { table, column, amount, unit, limit, selectColumns } = input;
      
      try {
        await validateColumnExists(adapter, table, column);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      const quotedTable = `"${table.replace(/"/g, '""')}"`;
      const quotedColumn = `"${column.replace(/"/g, '""')}"`;

      // Map unit to SQLite modifier
      const modifier = `${amount > 0 ? "+" : ""}${amount} ${unit}`;
      
      const queryParams: unknown[] = [];
      const selectCols = selectColumns && selectColumns.length > 0
        ? selectColumns.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(", ")
        : "*";
      let query = `SELECT ${selectCols}, datetime(${quotedColumn}, '${modifier}') as date_add_result FROM ${quotedTable}`;
      
      const clauses: string[] = [];
      if (input.whereClause) {
        clauses.push(`(${sanitizeWhereClause(input.whereClause)})`);
      }
      if (input.conditions && input.conditions.length > 0) {
        const { sql: whereSql, params: whereParams } = buildWhereClause(input.conditions, input.whereClause);
        if (whereSql !== "") {
          clauses.push(`(${whereSql})`);
          queryParams.push(...whereParams);
        }
      }
      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(" AND ");
      }
      
      if (limit !== undefined && limit !== null) {
        query += ` LIMIT ${limit}`;
      }

      try {
        const result = await adapter.executeReadQuery(query, queryParams);

        // SQLite's datetime() silently returns NULL if the resulting date is outside 
        // the supported bounds of 0000-01-01 to 9999-12-31. Detect this by checking 
        // if the original column was non-null but the result is null.
        if (result.rows && result.rows.length > 0) {
          const outOfBounds = result.rows.some((row: Record<string, unknown>) => row[column] !== null && row["date_add_result"] === null);
          if (outOfBounds) {
            return formatHandlerError(
              new ValidationError(
                "Date calculation out of bounds. The resulting date exceeds SQLite's supported range (0000-01-01 to 9999-12-31).",
                "VALIDATION_ERROR",
                {
                  suggestion: "Reduce the amount to stay within the supported 0000-9999 year range.",
                }
              )
            );
          }
        }

        return {
          success: true,
          rows: result.rows,
          count: result.rows?.length ?? 0,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Calculate the difference between two date columns
 */
export function createDateDiffTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_date_diff",
    description: "Calculate the difference between two date/time columns",
    group: "core",
    inputSchema: DateDiffSchema,
    outputSchema: DateMathOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Date/Time Diff"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = DateDiffSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      const { table, column1, column2, unit, limit, selectColumns } = input;

      const isLiteral = (val: string): boolean => {
        if (!isNaN(Number(val))) return true;
        if (val.startsWith("'") && val.endsWith("'")) return true;
        return false;
      };

      try {
        if (!isLiteral(column1)) {
          await validateColumnExists(adapter, table, column1);
        }
        if (!isLiteral(column2)) {
          await validateColumnExists(adapter, table, column2);
        }
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      const formatOperand = (val: string): string => {
        if (isLiteral(val)) return val;
        return `"${val.replace(/"/g, '""')}"`;
      };

      const quotedTable = `"${table.replace(/"/g, '""')}"`;
      const quotedCol1 = formatOperand(column1);
      const quotedCol2 = formatOperand(column2);

      // SQLite's julianday() returns days. We convert based on requested unit.
      let multiplier = 1;
      if (unit === "hours") multiplier = 24;
      else if (unit === "minutes") multiplier = 24 * 60;
      else if (unit === "seconds") multiplier = 24 * 60 * 60;

      const diffExpr = `(julianday(${quotedCol1}) - julianday(${quotedCol2})) * ${multiplier}`;

      const queryParams: unknown[] = [];
      const selectCols = selectColumns && selectColumns.length > 0
        ? selectColumns.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(", ")
        : "*";
      let query = `SELECT ${selectCols}, ${diffExpr} as date_diff_result FROM ${quotedTable}`;
      const clauses: string[] = [];
      if (input.whereClause) {
        clauses.push(`(${sanitizeWhereClause(input.whereClause)})`);
      }
      if (input.conditions && input.conditions.length > 0) {
        const { sql: whereSql, params: whereParams } = buildWhereClause(input.conditions, input.whereClause);
        if (whereSql !== "") {
          clauses.push(`(${whereSql})`);
          queryParams.push(...whereParams);
        }
      }
      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(" AND ");
      }

      if (limit !== undefined && limit !== null) {
        query += ` LIMIT ${limit}`;
      }

      try {
        const result = await adapter.executeReadQuery(query, queryParams);
        return {
          success: true,
          rows: result.rows,
          count: result.rows?.length ?? 0,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

