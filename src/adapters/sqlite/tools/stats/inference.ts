/**
 * Statistical Inference Tools
 *
 * Outlier detection, regression analysis, and hypothesis testing.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatError } from "../../../../utils/errors.js";
import {
  validateColumnExists,
  validateNumericColumn,
  OutlierSchema,
  RegressionSchema,
  HypothesisSchema,
} from "./helpers.js";
import {
  tDistPValue,
  matrixTranspose,
  matrixMultiply,
  matrixInverse,
} from "./math-helpers.js";

// =============================================================================
// Tool Creators
// =============================================================================

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
    }),
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

          return {
            success: true,
            method: "zscore",
            stats: { mean, stdDev, lowerBound, upperBound },
            outlierCount: outliers.length,
            totalRows: total,
            outliers,
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

          return {
            success: true,
            method: "iqr",
            stats: { q1, q3, iqr, lowerBound, upperBound },
            outlierCount: outliers.length,
            totalRows: n,
            outliers,
          };
        }
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

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
    }),
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
          throw new Error(
            `Insufficient data for degree ${degree} regression (need at least ${degree + 1} points, got ${pairs.length})`,
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
        const beta = matrixMultiply(XtXInv, XtY).map((r) => r[0] ?? 0);

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
        return formatError(error);
      }
    },
  };
}

/**
 * Hypothesis testing (t-test, chi-square)
 */
export function createHypothesisTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_hypothesis",
    description:
      "Perform statistical hypothesis tests: one-sample t-test, two-sample t-test, or chi-square test.",
    group: "stats",
    inputSchema: HypothesisSchema,
    outputSchema: z.object({
      success: z.boolean(),
      testType: z.string().optional(),
      statistic: z.number().optional(),
      pValue: z.number().optional(),
      degreesOfFreedom: z.number().optional(),
      significant: z.boolean().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
      error: z.string().optional(),
      code: z.string().optional(),
      suggestion: z.string().optional(),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Hypothesis Testing"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = HypothesisSchema.parse(params);

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

        if (input.testType === "ttest_one") {
          const expectedMean = input.expectedMean ?? 0;

          const statsResult = await adapter.executeReadQuery(
            `SELECT COUNT(*) as n, AVG("${input.column}") as mean,
                    SUM(("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause})) *
                        ("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}))) /
                    (COUNT(*) - 1) as variance
             FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}`,
          );

          const n = Number(statsResult.rows?.[0]?.["n"] ?? 0);
          const mean = Number(statsResult.rows?.[0]?.["mean"] ?? 0);
          const variance = Number(statsResult.rows?.[0]?.["variance"] ?? 0);
          const stdDev = Math.sqrt(variance);
          const df = n - 1;

          if (n < 2) {
            throw new Error("Insufficient sample size for t-test");
          }

          const tStatistic = (mean - expectedMean) / (stdDev / Math.sqrt(n));

          if (!Number.isFinite(tStatistic)) {
            throw new Error(
              `Cannot compute t-statistic: stdDev=${stdDev.toFixed(4)}, n=${n}. ` +
                `This may indicate zero variance, non-numeric data, or that column "${input.column}" does not exist.`,
            );
          }

          const pValue = tDistPValue(tStatistic, df);

          return {
            success: true,
            testType: "ttest_one",
            statistic: tStatistic,
            pValue,
            degreesOfFreedom: df,
            significant: pValue < 0.05,
            details: {
              sampleMean: mean,
              sampleStdDev: stdDev,
              sampleSize: n,
              expectedMean,
            },
          };
        } else if (input.testType === "ttest_two") {
          if (!input.column2) {
            throw new Error("column2 is required for two-sample t-test");
          }
          await validateColumnExists(adapter, input.table, input.column2);
          sanitizeIdentifier(input.column2);

          const statsResult = await adapter.executeReadQuery(
            `SELECT
               COUNT("${input.column}") as n1, AVG("${input.column}") as mean1,
               SUM(("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause})) *
                   ("${input.column}" - (SELECT AVG("${input.column}") FROM "${input.table}" WHERE "${input.column}" IS NOT NULL${whereClause}))) /
               (COUNT("${input.column}") - 1) as var1,
               COUNT("${input.column2}") as n2, AVG("${input.column2}") as mean2,
               SUM(("${input.column2}" - (SELECT AVG("${input.column2}") FROM "${input.table}" WHERE "${input.column2}" IS NOT NULL${whereClause})) *
                   ("${input.column2}" - (SELECT AVG("${input.column2}") FROM "${input.table}" WHERE "${input.column2}" IS NOT NULL${whereClause}))) /
               (COUNT("${input.column2}") - 1) as var2
             FROM "${input.table}" WHERE 1=1${whereClause}`,
          );

          const n1 = Number(statsResult.rows?.[0]?.["n1"] ?? 0);
          const n2 = Number(statsResult.rows?.[0]?.["n2"] ?? 0);
          const mean1 = Number(statsResult.rows?.[0]?.["mean1"] ?? 0);
          const mean2 = Number(statsResult.rows?.[0]?.["mean2"] ?? 0);
          const var1 = Number(statsResult.rows?.[0]?.["var1"] ?? 0);
          const var2 = Number(statsResult.rows?.[0]?.["var2"] ?? 0);

          if (n1 < 2 || n2 < 2) {
            throw new Error("Insufficient sample size for t-test");
          }

          const tStatistic = (mean1 - mean2) / Math.sqrt(var1 / n1 + var2 / n2);

          if (!Number.isFinite(tStatistic)) {
            throw new Error(
              `Cannot compute t-statistic: var1=${var1.toFixed(4)}, var2=${var2.toFixed(4)}. ` +
                `This may indicate zero variance or non-numeric data.`,
            );
          }

          const dfNum = Math.pow(var1 / n1 + var2 / n2, 2);
          const dfDen =
            Math.pow(var1 / n1, 2) / (n1 - 1) +
            Math.pow(var2 / n2, 2) / (n2 - 1);
          const df = Number.isFinite(dfNum / dfDen)
            ? dfNum / dfDen
            : n1 + n2 - 2;
          const pValue = tDistPValue(tStatistic, df);

          return {
            success: true,
            testType: "ttest_two",
            statistic: tStatistic,
            pValue,
            degreesOfFreedom: df,
            significant: pValue < 0.05,
            details: {
              group1: { mean: mean1, variance: var1, n: n1 },
              group2: { mean: mean2, variance: var2, n: n2 },
            },
          };
        } else {
          // Chi-square test
          if (!input.groupColumn) {
            throw new Error("groupColumn is required for chi-square test");
          }
          await validateColumnExists(adapter, input.table, input.groupColumn);
          sanitizeIdentifier(input.groupColumn);

          const freqResult = await adapter.executeReadQuery(
            `SELECT "${input.column}" as col1, "${input.groupColumn}" as col2, COUNT(*) as observed
             FROM "${input.table}"
             WHERE "${input.column}" IS NOT NULL AND "${input.groupColumn}" IS NOT NULL${whereClause}
             GROUP BY "${input.column}", "${input.groupColumn}"`,
          );

          const rowTotals = new Map<string, number>();
          const colTotals = new Map<string, number>();
          let grandTotal = 0;

          for (const row of freqResult.rows ?? []) {
            const col1 = String(row["col1"]);
            const col2 = String(row["col2"]);
            const observed = Number(row["observed"]);

            rowTotals.set(col1, (rowTotals.get(col1) ?? 0) + observed);
            colTotals.set(col2, (colTotals.get(col2) ?? 0) + observed);
            grandTotal += observed;
          }

          let chiSquare = 0;
          for (const row of freqResult.rows ?? []) {
            const col1 = String(row["col1"]);
            const col2 = String(row["col2"]);
            const observed = Number(row["observed"]);
            const expected =
              ((rowTotals.get(col1) ?? 0) * (colTotals.get(col2) ?? 0)) /
              grandTotal;
            if (expected > 0) {
              chiSquare += Math.pow(observed - expected, 2) / expected;
            }
          }

          const df = (rowTotals.size - 1) * (colTotals.size - 1);

          if (df === 0) {
            throw new Error(
              `Insufficient categories for chi-square test: "${input.column}" has ${rowTotals.size} category(s), "${input.groupColumn}" has ${colTotals.size} category(s). Both columns must have at least 2 distinct values.`,
            );
          }

          const pValue = Math.exp(-chiSquare / 2);

          return {
            success: true,
            testType: "chi_square",
            statistic: chiSquare,
            pValue,
            degreesOfFreedom: df,
            significant: pValue < 0.05,
            details: {
              grandTotal,
              rowCategories: rowTotals.size,
              colCategories: colTotals.size,
            },
          };
        }
      } catch (error) {
        return formatError(error);
      }
    },
  };
}
