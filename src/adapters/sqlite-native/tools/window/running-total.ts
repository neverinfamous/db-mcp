import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { buildWhereClause } from "../../../../utils/where-clause.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { resolveAliases } from "../../../sqlite/types.js";
import { WindowRunningTotalOutputSchema } from "../../../sqlite/schemas/index.js";
import { RunningTotalSchema } from "./schemas.js";
import { validateTableExists, validateColumnInTable, validateOrderByColumns, resolveSelectColumns, sanitizePartitionBy, sanitizeOrderByExpr } from "./helpers.js";

/**
 * Running total (cumulative SUM)
 */
export function createRunningTotalTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_running_total",
    description:
      "Calculate running (cumulative) total. Useful for balance tracking, cumulative metrics.",
    group: "stats",
    inputSchema: RunningTotalSchema,
    outputSchema: WindowRunningTotalOutputSchema,
    annotations: readOnly("Window Running Total"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      try {
        const input = RunningTotalSchema.parse(
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
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    SUM(${sanitizeIdentifier(input.column)}) OVER (${partition} ORDER BY ${orderByExpr} ROWS UNBOUNDED PRECEDING) as running_total
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

