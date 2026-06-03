import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { buildWhereClause } from "../../../../utils/where-clause.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { resolveAliases } from "../../../sqlite/types.js";
import { WindowMovingAvgOutputSchema } from "../../../sqlite/schemas/index.js";
import { MovingAverageSchema } from "./schemas.js";
import { validateTableExists, validateColumnInTable, validateOrderByColumns, resolveSelectColumns, sanitizePartitionBy, sanitizeOrderByExpr } from "./helpers.js";

/**
 * Moving average
 */
export function createMovingAverageTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_moving_avg",
    description:
      "Calculate moving (rolling) average. Useful for smoothing time series data.",
    group: "stats",
    inputSchema: MovingAverageSchema,
    outputSchema: WindowMovingAvgOutputSchema,
    annotations: readOnly("Window Moving Average"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      try {
        const input = MovingAverageSchema.parse(
          resolveAliases(params, { valueColumn: "column" }),
        );

        await validateTableExists(adapter, input.table);
        await validateColumnInTable(adapter, input.table, input.column);
        await validateOrderByColumns(adapter, input.table, input.orderBy);

        const { columnList: columns, hint } = await resolveSelectColumns(
          adapter,
          input.table,
          input.selectColumns,
          input.column,
        );
        const partition = input.partitionBy
          ? `PARTITION BY ${sanitizePartitionBy(input.partitionBy)}`
          : "";
        const preceding = input.windowSize - 1;
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    AVG(${sanitizeIdentifier(input.column)}) OVER (${partition} ORDER BY ${orderByExpr} ROWS BETWEEN ${preceding} PRECEDING AND CURRENT ROW) as moving_avg
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
          valueColumn: input.column,
          windowSize: input.windowSize,
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

