/**
 * Advanced Statistics Tools
 *
 * Analytical tools: correlation, top-N, distinct values, summary stats, frequency.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatError, ResourceNotFoundError } from "../../../../utils/errors/index.js";
import {
  StatsCorrelationOutputSchema,
  StatsTopNOutputSchema,
  StatsDistinctOutputSchema,
  StatsSummaryOutputSchema,
  StatsFrequencyOutputSchema,
} from "../../output-schemas/index.js";
import {
  validateColumnExists,
  isNumericType,
  NUMERIC_TYPES,
  CorrelationSchema,
  TopNSchema,
  DistinctValuesSchema,
  SummaryStatsSchema,
  FrequencySchema,
} from "./helpers.js";

/**
 * Correlation between two columns
 */
export function createCorrelationTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_correlation",
    description:
      "Calculate Pearson correlation coefficient between two numeric columns.",
    group: "stats",
    inputSchema: CorrelationSchema,
    outputSchema: StatsCorrelationOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Correlation"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CorrelationSchema.parse(params);

      try {
        await validateColumnExists(adapter, input.table, input.column1);
        await validateColumnExists(adapter, input.table, input.column2);

        const tableInfo = await adapter.describeTable(input.table);
        const columnMap = new Map(
          (tableInfo.columns ?? []).map((c) => [
            c.name.toLowerCase(),
            (c.type ?? "").toLowerCase(),
          ]),
        );
        const col1Type = columnMap.get(input.column1.toLowerCase()) ?? "";
        const col2Type = columnMap.get(input.column2.toLowerCase()) ?? "";

        if (!isNumericType(col1Type) || !isNumericType(col2Type)) {
          const nonNumeric = !isNumericType(col1Type)
            ? input.column1
            : input.column2;
          return {
            success: false,
            error: `Column '${nonNumeric}' is not numeric (type: ${columnMap.get(nonNumeric.toLowerCase()) ?? "unknown"}). Correlation requires numeric columns.`,
            code: "INVALID_INPUT",
            category: "validation",
            suggestion:
              "Use numeric columns (INTEGER, REAL, FLOAT, etc.) for correlation analysis.",
            recoverable: false,
          };
        }

        const table = sanitizeIdentifier(input.table);
        const col1 = sanitizeIdentifier(input.column1);
        const col2 = sanitizeIdentifier(input.column2);

        let sql = `SELECT ${col1} as x, ${col2} as y
                  FROM ${table}
                  WHERE ${col1} IS NOT NULL AND ${col2} IS NOT NULL`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` AND ${input.whereClause}`;
        }

        const result = await adapter.executeReadQuery(sql);
        const pairs = (result.rows ?? []).map((r) => ({
          x: r["x"] as number,
          y: r["y"] as number,
        }));

        if (pairs.length < 2) {
          return {
            success: true,
            correlation: null,
            message: "Need at least 2 data points",
          };
        }

        const n = pairs.length;
        const sumX = pairs.reduce((s, p) => s + p.x, 0);
        const sumY = pairs.reduce((s, p) => s + p.y, 0);
        const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
        const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);
        const sumY2 = pairs.reduce((s, p) => s + p.y * p.y, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt(
          (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
        );

        const correlation = denominator === 0 ? 0 : numerator / denominator;
        const roundedCorrelation = Number.isNaN(correlation)
          ? null
          : Math.round(correlation * 10000) / 10000;

        return {
          success: true,
          column1: input.column1,
          column2: input.column2,
          n: pairs.length,
          correlation: roundedCorrelation,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Top N values
 */
export function createTopNTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_top_n",
    description: "Get top N values from a column.",
    group: "stats",
    inputSchema: TopNSchema,
    outputSchema: StatsTopNOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Top N Values"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TopNSchema.parse(params);

      try {
        await validateColumnExists(adapter, input.table, input.column);

        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        const order = input.orderDirection.toUpperCase();

        let columnList = "*";
        if (input.selectColumns && input.selectColumns.length > 0) {
          columnList = input.selectColumns
            .map((col) => sanitizeIdentifier(col))
            .join(", ");
        }

        let sql = `SELECT ${columnList} FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` ORDER BY ${column} ${order} LIMIT ${input.n}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          column: input.column,
          direction: input.orderDirection,
          count: result.rows?.length ?? 0,
          rows: result.rows,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Distinct values
 */
export function createDistinctValuesTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_stats_distinct",
    description: "Get distinct values from a column.",
    group: "stats",
    inputSchema: DistinctValuesSchema,
    outputSchema: StatsDistinctOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Distinct Values"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DistinctValuesSchema.parse(params);

      try {
        await validateColumnExists(adapter, input.table, input.column);

        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        let sql = `SELECT DISTINCT ${column} as value FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          column: input.column,
          distinctCount: result.rows?.length ?? 0,
          values: result.rows?.map((r) => r["value"]),
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Summary statistics for all numeric columns
 */
export function createSummaryStatsTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  const numericTypes = new Set([...NUMERIC_TYPES]);

  return {
    name: "sqlite_stats_summary",
    description: "Get summary statistics for multiple columns at once.",
    group: "stats",
    inputSchema: SummaryStatsSchema,
    outputSchema: StatsSummaryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Summary Stats"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = SummaryStatsSchema.parse(params);

      try {
        const table = sanitizeIdentifier(input.table);

        const tableCheck = await adapter.executeReadQuery(
          `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name='${input.table.replace(/'/g, "''")}'`,
        );
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          throw new ResourceNotFoundError(
            `Table '${input.table}' does not exist`,
            "TABLE_NOT_FOUND",
            {
              suggestion:
                "Table not found. Run sqlite_list_tables to see available tables.",
              resourceType: "table",
              resourceName: input.table,
            },
          );
        }

        const tableInfo = await adapter.describeTable(input.table);
        const knownColumns = new Set(
          (tableInfo.columns ?? []).map((c) => c.name.toLowerCase()),
        );

        let columns: string[];
        if (input.columns && input.columns.length > 0) {
          for (const col of input.columns) {
            sanitizeIdentifier(col);
            if (!knownColumns.has(col.toLowerCase())) {
              throw new ResourceNotFoundError(
                `Column '${col}' not found in table '${input.table}'`,
                "COLUMN_NOT_FOUND",
                {
                  suggestion:
                    "Column not found. Use sqlite_describe_table to see available columns.",
                  resourceType: "column",
                  resourceName: col,
                },
              );
            }
          }
          columns = input.columns;
        } else {
          columns = (tableInfo.columns ?? [])
            .filter((c) => {
              const typeLower = (c.type ?? "").toLowerCase();
              return [...numericTypes].some(
                (nt) => typeLower === nt || typeLower.startsWith(nt),
              );
            })
            .map((c) => c.name);
        }

        if (columns.length === 0) {
          return {
            success: true,
            table: input.table,
            summaries: [],
          };
        }

        const summaries: {
          column: string;
          count?: number;
          avg?: number | null;
          min?: number | null;
          max?: number | null;
          error?: string;
        }[] = [];

        for (const col of columns) {
          const quotedCol = sanitizeIdentifier(col);
          let sql = `SELECT
                      COUNT(${quotedCol}) as count,
                      AVG(${quotedCol}) as avg,
                      MIN(${quotedCol}) as min,
                      MAX(${quotedCol}) as max
                  FROM ${table}`;

          if (input.whereClause) {
            validateWhereClause(input.whereClause);
            sql += ` WHERE ${input.whereClause}`;
          }

          try {
            const result = await adapter.executeReadQuery(sql);
            const row = result.rows?.[0];

            const count = Number(row?.["count"] ?? 0);
            const avg = row?.["avg"];
            const min = row?.["min"];
            const max = row?.["max"];

            summaries.push({
              column: col,
              count,
              avg:
                typeof avg === "number"
                  ? avg
                  : avg === null
                    ? null
                    : Number(avg) || null,
              min:
                typeof min === "number"
                  ? min
                  : min === null
                    ? null
                    : Number(min) || null,
              max:
                typeof max === "number"
                  ? max
                  : max === null
                    ? null
                    : Number(max) || null,
            });
          } catch {
            summaries.push({ column: col, error: "Not numeric" });
          }
        }

        return {
          success: true,
          table: input.table,
          summaries,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Value frequency distribution
 */
export function createFrequencyTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_frequency",
    description: "Get frequency distribution of values in a column.",
    group: "stats",
    inputSchema: FrequencySchema,
    outputSchema: StatsFrequencyOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Frequency"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = FrequencySchema.parse(params);

      try {
        await validateColumnExists(adapter, input.table, input.column);

        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        let sql = `SELECT ${column} as value, COUNT(*) as frequency
                  FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` GROUP BY ${column} ORDER BY frequency DESC LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          column: input.column,
          distinctValues: result.rows?.length ?? 0,
          distribution: result.rows,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}
