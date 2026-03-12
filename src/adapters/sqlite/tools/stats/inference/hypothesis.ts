import { z } from "zod";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { validateWhereClause, sanitizeIdentifier } from "../../../../../utils/index.js";
import { formatHandlerErrorResponse, DbMcpError, ErrorCategory } from "../../../../../utils/errors/index.js";
import { validateColumnExists, validateNumericColumn, HypothesisSchema } from "../helpers.js";
import { ErrorResponseFields } from "../../../../../utils/errors/error-response-fields.js";
import { tDistPValue } from "../math-helpers.js";

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
    }).extend(ErrorResponseFields.shape),
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
            throw new DbMcpError("Insufficient sample size for t-test", "STATS_INSUFFICIENT_SAMPLE", ErrorCategory.VALIDATION);
          }

          const tStatistic = (mean - expectedMean) / (stdDev / Math.sqrt(n));

          if (!Number.isFinite(tStatistic)) {
            throw new DbMcpError(
              `Cannot compute t-statistic: stdDev=${stdDev.toFixed(4)}, n=${n}. ` +
                `This may indicate zero variance, non-numeric data, or that column "${input.column}" does not exist.`,
              "STATS_COMPUTATION_FAILED",
              ErrorCategory.VALIDATION
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
            throw new DbMcpError("column2 is required for two-sample t-test", "STATS_MISSING_COLUMN", ErrorCategory.VALIDATION);
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
            throw new DbMcpError("Insufficient sample size for t-test", "STATS_INSUFFICIENT_SAMPLE", ErrorCategory.VALIDATION);
          }

          const tStatistic = (mean1 - mean2) / Math.sqrt(var1 / n1 + var2 / n2);

          if (!Number.isFinite(tStatistic)) {
            throw new DbMcpError(
              `Cannot compute t-statistic: var1=${var1.toFixed(4)}, var2=${var2.toFixed(4)}. ` +
                `This may indicate zero variance or non-numeric data.`,
              "STATS_COMPUTATION_FAILED",
              ErrorCategory.VALIDATION
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
            throw new DbMcpError("groupColumn is required for chi-square test", "STATS_MISSING_COLUMN", ErrorCategory.VALIDATION);
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
            throw new DbMcpError(
              `Insufficient categories for chi-square test: "${input.column}" has ${rowTotals.size} category(s), "${input.groupColumn}" has ${colTotals.size} category(s). Both columns must have at least 2 distinct values.`,
              "STATS_INSUFFICIENT_CATEGORIES",
              ErrorCategory.VALIDATION
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
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
