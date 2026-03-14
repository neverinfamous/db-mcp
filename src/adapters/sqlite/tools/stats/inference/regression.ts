import { z } from "zod";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { validateWhereClause, sanitizeIdentifier } from "../../../../../utils/index.js";
import { formatHandlerError, DbMcpError, ErrorCategory } from "../../../../../utils/errors/index.js";
import { validateColumnExists, validateNumericColumn, RegressionSchema } from "../helpers.js";
import { ErrorResponseFields } from "../../../../../utils/errors/error-response-fields.js";
import { matrixTranspose, matrixMultiply, matrixInverse } from "../math-helpers.js";

/**
 * Linear/polynomial regression analysis
 */
export function createRegressionTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_regression",
    description:
      "Perform linear or polynomial regression analysis between two columns.",
    group: "stats",
    inputSchema: RegressionSchema,
    outputSchema: z.object({
      success: z.boolean(),
      type: z.string().optional(),
      sampleSize: z.number().optional(),
      coefficients: z
        .object({
          intercept: z.number(),
          linear: z.number().optional(),
          quadratic: z.number().optional(),
          cubic: z.number().optional(),
        })
        .optional(),
      rSquared: z.number().optional(),
      equation: z.string().optional(),
      error: z.string().optional(),
      code: z.string().optional(),
      suggestion: z.string().optional(),
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["read"],
    annotations: readOnly("Regression Analysis"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = RegressionSchema.parse(params);

      try {
        if (input.degree < 1 || input.degree > 3) {
          return {
            success: false,
            error: `'degree' must be between 1 and 3 (got ${input.degree})`,
            code: "INVALID_INPUT",
            category: "validation",
            recoverable: false,
          };
        }

        await validateColumnExists(adapter, input.table, input.xColumn);
        await validateColumnExists(adapter, input.table, input.yColumn);

        const xNumericError = await validateNumericColumn(
          adapter,
          input.table,
          input.xColumn,
        );
        if (xNumericError) return xNumericError;
        const yNumericError = await validateNumericColumn(
          adapter,
          input.table,
          input.yColumn,
        );
        if (yNumericError) return yNumericError;

        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.xColumn);
        sanitizeIdentifier(input.yColumn);

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
        }

        const andClause = input.whereClause ? ` AND ${input.whereClause}` : "";
        const degree = input.degree ?? 1;

        const sql = `
          SELECT "${input.xColumn}" as x, "${input.yColumn}" as y
          FROM "${input.table}"
          WHERE "${input.xColumn}" IS NOT NULL AND "${input.yColumn}" IS NOT NULL${andClause}
        `;

        const result = await adapter.executeReadQuery(sql);
        const pairs = (result.rows ?? []).map((r) => ({
          x: Number(r["x"]),
          y: Number(r["y"]),
        }));

        if (pairs.length < degree + 1) {
          throw new DbMcpError(
            `Insufficient data for degree ${degree} regression (need at least ${degree + 1} points, got ${pairs.length})`,
            "STATS_INSUFFICIENT_SAMPLE",
            ErrorCategory.VALIDATION
          );
        }

        const X = pairs.map((p) =>
          Array.from({ length: degree + 1 }, (_, i) => Math.pow(p.x, i)),
        );
        const y = pairs.map((p) => [p.y]);

        const Xt = matrixTranspose(X);
        const XtX = matrixMultiply(Xt, X);
        const XtXInv = matrixInverse(XtX);
        const XtY = matrixMultiply(Xt, y);
        const beta = matrixMultiply(XtXInv, XtY).map((r: number[]) => r[0] ?? 0);

        const meanY = pairs.reduce((s, p) => s + p.y, 0) / pairs.length;
        let ssRes = 0;
        let ssTot = 0;

        for (const p of pairs) {
          let predicted = 0;
          for (let i = 0; i <= degree; i++) {
            predicted += (beta[i] ?? 0) * Math.pow(p.x, i);
          }
          ssRes += Math.pow(p.y - predicted, 2);
          ssTot += Math.pow(p.y - meanY, 2);
        }
        const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

        const coefficients: {
          intercept: number;
          linear?: number;
          quadratic?: number;
          cubic?: number;
        } = {
          intercept: beta[0] ?? 0,
        };

        if (degree >= 1) coefficients.linear = beta[1] ?? 0;
        if (degree >= 2) coefficients.quadratic = beta[2] ?? 0;
        if (degree >= 3) coefficients.cubic = beta[3] ?? 0;

        const terms: string[] = [];
        if (degree >= 3 && beta[3] !== undefined) {
          terms.push(`${beta[3].toFixed(4)}x³`);
        }
        if (degree >= 2 && beta[2] !== undefined) {
          const sign = terms.length > 0 && beta[2] >= 0 ? " + " : "";
          terms.push(`${sign}${beta[2].toFixed(4)}x²`);
        }
        if (degree >= 1 && beta[1] !== undefined) {
          const sign = terms.length > 0 && beta[1] >= 0 ? " + " : "";
          terms.push(`${sign}${beta[1].toFixed(4)}x`);
        }
        const interceptSign =
          terms.length > 0 && (beta[0] ?? 0) >= 0 ? " + " : "";
        terms.push(`${interceptSign}${(beta[0] ?? 0).toFixed(4)}`);

        const equation = `y = ${terms.join("").replace(/^\s*\+\s*/, "")}`;

        return {
          success: true,
          type: degree === 1 ? "linear" : `polynomial_${degree}`,
          sampleSize: pairs.length,
          coefficients,
          rSquared: Math.round(rSquared * 10000) / 10000,
          equation,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
