import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { buildWhereClause } from "../../../../utils/where-clause.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { readOnly } from "../../../../utils/annotations.js";

import { WindowRowNumberOutputSchema } from "../../../sqlite/schemas/index.js";
import { RowNumberSchema } from "./schemas.js";
import { validateTableExists, validateOrderByColumns, resolveSelectColumns, sanitizePartitionBy, sanitizeOrderByExpr } from "./helpers.js";

/**
 * ROW_NUMBER window function
 */
export function createRowNumberTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_row_number",
    description:
      "Assign sequential row numbers based on ordering. Useful for pagination and ranking.",
    group: "stats",
    inputSchema: RowNumberSchema,
    outputSchema: WindowRowNumberOutputSchema,
    annotations: readOnly("Window Row Number"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      try {
        const input = RowNumberSchema.parse(params);

        await validateTableExists(adapter, input.table);
        await validateOrderByColumns(adapter, input.table, input.orderBy);

        const { columnList: columns, hint } = await resolveSelectColumns(
          adapter,
          input.table,
          input.selectColumns,
        );
        const partition = input.partitionBy
          ? `PARTITION BY ${sanitizePartitionBy(input.partitionBy)}`
          : "";
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    ROW_NUMBER() OVER (${partition} ORDER BY ${orderByExpr}) as row_number
                FROM ${sanitizeIdentifier(input.table)}
            `;

        if (input.conditions) {
          const { sql: whereSql, params: whereParams } = buildWhereClause(
            input.conditions,
          );
          if (whereSql !== "") {
            sql += ` WHERE ${whereSql}`;
            queryParams.push(...whereParams);
          }
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql, queryParams);

        const response: Record<string, unknown> = {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
        if (hint) response["hint"] = hint;
        return response;
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

