import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { buildWhereClause } from "../../../../utils/where-clause.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { resolveAliases } from "../../../sqlite/types.js";
import { WindowLagLeadOutputSchema } from "../../../sqlite/schemas/index.js";
import { LagLeadSchema } from "./schemas.js";
import {
  validateTableExists,
  validateColumnInTable,
  validateOrderByColumns,
  resolveSelectColumns,
  sanitizePartitionBy,
  validateDefaultValue,
  sanitizeOrderByExpr,
  VALID_DIRECTIONS,
} from "./helpers.js";

/**
 * LAG/LEAD window functions
 */
export function createLagLeadTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_window_lag_lead",
    description:
      "Access previous (LAG) or next (LEAD) row values. Useful for comparing consecutive rows.",
    group: "stats",
    inputSchema: LagLeadSchema,
    outputSchema: WindowLagLeadOutputSchema,
    annotations: readOnly("Window Lag/Lead"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = LagLeadSchema.parse(
          resolveAliases(params, { valueColumn: "column" }),
        );
        const queryParams: unknown[] = [];

        // Normalize direction to lowercase (schema describes as LAG/LEAD uppercase)
        const normalizedDirection = input.direction.toLowerCase();

        // Handler-side validation for required enum (z.string() in schema)
        if (
          !VALID_DIRECTIONS.includes(
            normalizedDirection as (typeof VALID_DIRECTIONS)[number],
          )
        ) {
          return {
            success: false,
            error: `Invalid direction '${input.direction}'. Must be one of: ${VALID_DIRECTIONS.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

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
        const func = normalizedDirection.toUpperCase();
        // Validate defaultValue to prevent SQL injection (CWE-89 remediation)
        let defaultVal = "";
        if (input.defaultValue !== undefined) {
          validateDefaultValue(input.defaultValue);
          defaultVal = `, ${input.defaultValue}`;
        }
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    ${func}(${sanitizeIdentifier(input.column)}, ${input.offset}${defaultVal}) OVER (${partition} ORDER BY ${orderByExpr}) as ${normalizedDirection}_value
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
          direction: normalizedDirection,
          offset: input.offset,
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
