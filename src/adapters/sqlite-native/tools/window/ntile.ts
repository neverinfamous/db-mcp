import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { buildWhereClause } from "../../../../utils/where-clause.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { readOnly } from "../../../../utils/annotations.js";

import { WindowNtileOutputSchema } from "../../../sqlite/schemas/index.js";
import { NtileSchema } from "./schemas.js";
import {
  validateTableExists,
  validateOrderByColumns,
  resolveSelectColumns,
  sanitizePartitionBy,
  sanitizeOrderByExpr,
} from "./helpers.js";

/**
 * NTILE (divide into buckets/quantiles)
 */
export function createNtileTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_ntile",
    description:
      "Divide rows into N buckets. E.g., 4 buckets = quartiles, 10 = deciles, 100 = percentiles.",
    group: "stats",
    inputSchema: NtileSchema,
    outputSchema: WindowNtileOutputSchema,
    annotations: readOnly("Window Ntile"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = NtileSchema.parse(params);
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
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    NTILE(${input.buckets}) OVER (${partition} ORDER BY ${orderByExpr}) as ntile
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
          buckets: input.buckets,
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
