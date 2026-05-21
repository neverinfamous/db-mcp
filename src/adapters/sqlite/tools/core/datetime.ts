import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { DateAddSchema, DateDiffSchema } from "../../schemas/core.js";
import { DateMathOutputSchema } from "../../schemas/core.js";

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
    handler: async (params: unknown) => {
      let input;
      try {
        input = DateAddSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      const { table, column, amount, unit, whereClause } = input;
      const quotedTable = `"${table.replace(/"/g, '""')}"`;
      const quotedColumn = `"${column.replace(/"/g, '""')}"`;

      // Map unit to SQLite modifier
      const modifier = `${amount > 0 ? "+" : ""}${amount} ${unit}`;
      
      let query = `SELECT *, datetime(${quotedColumn}, '${modifier}') as date_add_result FROM ${quotedTable}`;
      
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      try {
        const result = await adapter.executeReadQuery(query);
        return {
          success: true,
          rows: result.rows,
          count: result.rows?.length ?? 0,
        };
      } catch (error) {
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
    handler: async (params: unknown) => {
      let input;
      try {
        input = DateDiffSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      const { table, column1, column2, unit, whereClause } = input;
      const quotedTable = `"${table.replace(/"/g, '""')}"`;
      const quotedCol1 = `"${column1.replace(/"/g, '""')}"`;
      const quotedCol2 = `"${column2.replace(/"/g, '""')}"`;

      // SQLite's julianday() returns days. We convert based on requested unit.
      let multiplier = 1;
      if (unit === "hours") multiplier = 24;
      else if (unit === "minutes") multiplier = 24 * 60;
      else if (unit === "seconds") multiplier = 24 * 60 * 60;

      const diffExpr = `(julianday(${quotedCol1}) - julianday(${quotedCol2})) * ${multiplier}`;

      let query = `SELECT *, ${diffExpr} as date_diff_result FROM ${quotedTable}`;
      
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      try {
        const result = await adapter.executeReadQuery(query);
        return {
          success: true,
          rows: result.rows,
          count: result.rows?.length ?? 0,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
