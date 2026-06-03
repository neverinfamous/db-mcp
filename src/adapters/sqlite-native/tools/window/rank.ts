import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { buildWhereClause } from "../../../../utils/where-clause.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { readOnly } from "../../../../utils/annotations.js";

import { WindowRankOutputSchema } from "../../../sqlite/schemas/index.js";
import { RankSchema } from "./schemas.js";
import { validateTableExists, validateOrderByColumns, resolveSelectColumns, sanitizePartitionBy, sanitizeOrderByExpr } from "./helpers.js";

/**
 * RANK/DENSE_RANK/PERCENT_RANK window functions
 */
export function createRankTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_rank",
    description:
      "Calculate rank of rows. RANK leaves gaps after ties, DENSE_RANK does not, PERCENT_RANK gives 0-1 range.",
    group: "stats",
    inputSchema: RankSchema,
    outputSchema: WindowRankOutputSchema,
    annotations: readOnly("Window Rank"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = RankSchema.parse(params);
        const queryParams: unknown[] = [];

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
        const rankFunc = input.rankType.toUpperCase();
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    ${rankFunc}() OVER (${partition} ORDER BY ${orderByExpr}) as ${input.rankType}
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
          rankType: input.rankType,
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

