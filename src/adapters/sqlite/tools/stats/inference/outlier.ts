import { z } from "zod";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { validateWhereClause, sanitizeIdentifier } from "../../../../../utils/index.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import { validateColumnExists, validateNumericColumn, OutlierSchema } from "../helpers.js";
import { ErrorResponseFields } from "../../../../../utils/errors/error-response-fields.js";

/**
 * Outlier detection using IQR or Z-score
 */
export function createOutlierTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_outliers",
    description:
      "Detect outliers using IQR (Interquartile Range) or Z-score method.",
    group: "stats",
    inputSchema: OutlierSchema,
    outputSchema: z.object({
      success: z.boolean(),
      method: z.string().optional(),
      stats: z
        .object({
          mean: z.number().optional(),
          stdDev: z.number().optional(),
          q1: z.number().optional(),
          q3: z.number().optional(),
          iqr: z.number().optional(),
          lowerBound: z.number(),
          upperBound: z.number(),
        })
        .optional(),
      outlierCount: z.number().optional(),
      totalRows: z.number().optional(),
      outliers: z
        .array(
          z.object({
            value: z.number(),
            rowid: z.number().optional(),
          }),
        )
        .optional(),
      error: z.string().optional(),
      code: z.string().optional(),
      suggestion: z.string().optional(),
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["read"],
    annotations: readOnly("Outlier Detection"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = OutlierSchema.parse(params);

      try {
        await validateColumnExists(adapter, input.table, input.column);
        const numericError = await validateNumericColumn(
          adapter,
          input.table,
          input.column,
        );
        if (numericError) return numericError;

        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.column);

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
        }

        const whereClause = input.whereClause
          ? ` AND ${input.whereClause}`
          : "";

        if (input.method === "zscore") {
          const threshold = input.threshold ?? 3;

          const statsResult = await adapter.executeReadQuery(
            `SELECT AVG("${input.column}") as mean,
                    (SUM(("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause})) *
                         ("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}))) /
                     (COUNT(*) - 1)) as variance,
                    COUNT(*) as total
             FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}`,
          );

          const mean = Number(statsResult.rows?.[0]?.["mean"] ?? 0);
          const variance = Number(statsResult.rows?.[0]?.["variance"] ?? 0);
          const stdDev = Math.sqrt(variance);
          const total = Number(statsResult.rows?.[0]?.["total"] ?? 0);

          const lowerBound = mean - threshold * stdDev;
          const upperBound = mean + threshold * stdDev;

          const outlierResult = await adapter.executeReadQuery(
            `SELECT rowid, "${input.column}" as value FROM "${input.table}"
             WHERE "${input.column}" IS NOT NULL${whereClause}
               AND ("${input.column}" < ${lowerBound} OR "${input.column}" > ${upperBound})
             LIMIT ${input.limit}`,
          );

          const outliers = (outlierResult.rows ?? []).map((row) => {
            const rowid = row["rowid"];
            return {
              value: Number(row["value"]),
              ...(typeof rowid === "number" ? { rowid } : {}),
            };
          });

          const maxOut = input.maxOutliers;
          const truncated = outliers.length > maxOut;
          return {
            success: true,
            method: "zscore",
            stats: { mean, stdDev, lowerBound, upperBound },
            outlierCount: truncated ? outliers.length : outliers.length,
            totalRows: total,
            outliers: truncated ? outliers.slice(0, maxOut) : outliers,
            ...(truncated ? { truncated: true, totalOutliers: outliers.length } : {}),
          };
        } else {
          // IQR method
          const multiplier = input.threshold ?? 1.5;

          const allResult = await adapter.executeReadQuery(
            `SELECT "${input.column}" as value FROM "${input.table}"
             WHERE "${input.column}" IS NOT NULL${whereClause}
             ORDER BY "${input.column}"`,
          );

          const values = (allResult.rows ?? []).map((r) => Number(r["value"]));
          const n = values.length;

          if (n === 0) {
            return {
              success: true,
              method: "iqr",
              stats: { q1: 0, q3: 0, iqr: 0, lowerBound: 0, upperBound: 0 },
              outlierCount: 0,
              totalRows: 0,
              outliers: [],
            };
          }

          const q1Idx = Math.floor(n * 0.25);
          const q3Idx = Math.floor(n * 0.75);
          const q1 = values[q1Idx] ?? 0;
          const q3 = values[q3Idx] ?? 0;
          const iqr = q3 - q1;

          const lowerBound = q1 - multiplier * iqr;
          const upperBound = q3 + multiplier * iqr;

          const outlierResult = await adapter.executeReadQuery(
            `SELECT rowid, "${input.column}" as value FROM "${input.table}"
             WHERE "${input.column}" IS NOT NULL${whereClause}
               AND ("${input.column}" < ${lowerBound} OR "${input.column}" > ${upperBound})
             LIMIT ${input.limit}`,
          );

          const outliers = (outlierResult.rows ?? []).map((row) => {
            const rowid = row["rowid"];
            return {
              value: Number(row["value"]),
              ...(typeof rowid === "number" ? { rowid } : {}),
            };
          });

          const maxOut = input.maxOutliers;
          const truncated = outliers.length > maxOut;
          return {
            success: true,
            method: "iqr",
            stats: { q1, q3, iqr, lowerBound, upperBound },
            outlierCount: outliers.length,
            totalRows: n,
            outliers: truncated ? outliers.slice(0, maxOut) : outliers,
            ...(truncated ? { truncated: true, totalOutliers: outliers.length } : {}),
          };
        }
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
