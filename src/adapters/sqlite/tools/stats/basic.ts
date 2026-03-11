/**
 * Basic Statistics Tools
 *
 * Core statistical tools: basic stats, count, group-by, histogram, percentile.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatError, ResourceNotFoundError } from "../../../../utils/errors.js";
import {
  StatsBasicOutputSchema,
  StatsCountOutputSchema,
  StatsGroupByOutputSchema,
  StatsHistogramOutputSchema,
  StatsPercentileOutputSchema,
} from "../../output-schemas/index.js";
import {
  validateColumnExists,
  validateNumericColumn,
  BasicStatsSchema,
  CountSchema,
  GroupByStatsSchema,
  HistogramSchema,
  PercentileSchema,
} from "./helpers.js";

/**
 * Basic statistics (sum, avg, min, max, stdev)
 */
export function createBasicStatsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_basic",
    description:
      "Get basic statistics (count, sum, avg, min, max) for a numeric column.",
    group: "stats",
    inputSchema: BasicStatsSchema,
    outputSchema: StatsBasicOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Basic Statistics"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = BasicStatsSchema.parse(params);

      try {
        await validateColumnExists(adapter, input.table, input.column);
        const numericError = await validateNumericColumn(
          adapter,
          input.table,
          input.column,
        );
        if (numericError) return numericError;

        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        let sql = `SELECT
                  COUNT(${column}) as count,
                  SUM(${column}) as sum,
                  AVG(${column}) as avg,
                  MIN(${column}) as min,
                  MAX(${column}) as max,
                  MAX(${column}) - MIN(${column}) as range
              FROM ${table}`;

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        const result = await adapter.executeReadQuery(sql);
        const row = result.rows?.[0];

        const toNumberOrNull = (val: unknown): number | null => {
          if (val === null || val === undefined) return null;
          if (typeof val === "number") return val;
          const num = Number(val);
          return Number.isNaN(num) ? null : num;
        };

        return {
          success: true,
          column: input.column,
          stats: {
            count: Number(row?.["count"] ?? 0),
            sum: toNumberOrNull(row?.["sum"]),
            avg: toNumberOrNull(row?.["avg"]),
            min: toNumberOrNull(row?.["min"]),
            max: toNumberOrNull(row?.["max"]),
            range: toNumberOrNull(row?.["range"]),
          },
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Count rows
 */
export function createCountTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_count",
    description: "Count rows, optionally distinct values in a column.",
    group: "stats",
    inputSchema: CountSchema,
    outputSchema: StatsCountOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Count Rows"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CountSchema.parse(params);

      try {
        if (input.column) {
          await validateColumnExists(adapter, input.table, input.column);
        } else {
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
        }

        const table = sanitizeIdentifier(input.table);

        let countExpr: string;
        if (input.column) {
          const column = sanitizeIdentifier(input.column);
          countExpr = input.distinct
            ? `COUNT(DISTINCT ${column})`
            : `COUNT(${column})`;
        } else {
          countExpr = "COUNT(*)";
        }

        let sql = `SELECT ${countExpr} as count FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          count: result.rows?.[0]?.["count"] ?? 0,
          distinct: input.distinct,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Group by with aggregation
 */
export function createGroupByStatsTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_stats_group_by",
    description: "Aggregate statistics grouped by a column.",
    group: "stats",
    inputSchema: GroupByStatsSchema,
    outputSchema: StatsGroupByOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Group By Stats"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = GroupByStatsSchema.parse(params);

      try {
        await validateColumnExists(adapter, input.table, input.valueColumn);
        await validateColumnExists(adapter, input.table, input.groupByColumn);

        if (input.stat !== "count") {
          const numericError = await validateNumericColumn(
            adapter,
            input.table,
            input.valueColumn,
          );
          if (numericError) return numericError;
        }

        const table = sanitizeIdentifier(input.table);
        const valueColumn = sanitizeIdentifier(input.valueColumn);
        const groupByColumn = sanitizeIdentifier(input.groupByColumn);

        const statFunc = input.stat.toUpperCase();
        const orderCol =
          input.orderBy === "value" ? "stat_value" : groupByColumn;

        let sql = `SELECT ${groupByColumn}, ${statFunc}(${valueColumn}) as stat_value
                  FROM ${table}`;

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        sql += ` GROUP BY ${groupByColumn} ORDER BY ${orderCol} DESC LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          statistic: input.stat,
          rowCount: result.rows?.length ?? 0,
          results: result.rows,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Histogram
 */
export function createHistogramTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_histogram",
    description: "Create a histogram with specified number of buckets.",
    group: "stats",
    inputSchema: HistogramSchema,
    outputSchema: StatsHistogramOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Histogram"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = HistogramSchema.parse(params);

      try {
        if (input.buckets < 1) {
          return {
            success: false,
            error: "'buckets' must be at least 1",
            code: "INVALID_INPUT",
            category: "validation",
            recoverable: false,
          };
        }

        await validateColumnExists(adapter, input.table, input.column);
        const numericError = await validateNumericColumn(
          adapter,
          input.table,
          input.column,
        );
        if (numericError) return numericError;

        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        let minMaxSql = `SELECT MIN(${column}) as min_val, MAX(${column}) as max_val, COUNT(${column}) as cnt FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          minMaxSql += ` WHERE ${input.whereClause}`;
        }

        const minMaxResult = await adapter.executeReadQuery(minMaxSql);
        const rawMin = minMaxResult.rows?.[0]?.["min_val"];
        const rawMax = minMaxResult.rows?.[0]?.["max_val"];
        const rowCount = (minMaxResult.rows?.[0]?.["cnt"] as number) ?? 0;

        // Empty table or no non-null values: return empty buckets
        if (rowCount === 0 || rawMin === null || rawMin === undefined) {
          return {
            success: true,
            column: input.column,
            range: { min: 0, max: 0 },
            bucketSize: 0,
            buckets: [],
          };
        }

        const minVal = rawMin as number;
        const maxVal = (rawMax as number) ?? 0;
        const range = maxVal - minVal;
        const bucketSize = range / input.buckets;

        if (bucketSize === 0) {
          // Uniform data: all values are the same — single bucket with actual count
          return {
            success: true,
            column: input.column,
            range: { min: minVal, max: maxVal },
            bucketSize: 0,
            buckets: [{ min: minVal, max: maxVal, count: rowCount }],
          };
        }

        const bucketCases = [];
        for (let i = 0; i < input.buckets; i++) {
          const bucketMin = minVal + i * bucketSize;
          const bucketMax = minVal + (i + 1) * bucketSize;
          const upperOp = i === input.buckets - 1 ? "<=" : "<";
          bucketCases.push(
            `SUM(CASE WHEN ${column} >= ${bucketMin} AND ${column} ${upperOp} ${bucketMax} THEN 1 ELSE 0 END) as bucket_${i}`,
          );
        }

        let sql = `SELECT ${bucketCases.join(", ")} FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        const result = await adapter.executeReadQuery(sql);

        const buckets = [];
        for (let i = 0; i < input.buckets; i++) {
          const bucketMin = minVal + i * bucketSize;
          const bucketMax = minVal + (i + 1) * bucketSize;
          buckets.push({
            bucket: i,
            min: bucketMin,
            max: bucketMax,
            count: result.rows?.[0]?.[`bucket_${i}`] ?? 0,
          });
        }

        return {
          success: true,
          column: input.column,
          range: { min: minVal, max: maxVal },
          bucketSize,
          buckets,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Percentiles
 */
export function createPercentileTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_percentile",
    description:
      "Calculate percentiles (median, quartiles, etc.) for a column.",
    group: "stats",
    inputSchema: PercentileSchema,
    outputSchema: StatsPercentileOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Percentile"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = PercentileSchema.parse(params);

      try {
        const invalidPercentiles = input.percentiles.filter(
          (p) => p < 0 || p > 100,
        );
        if (invalidPercentiles.length > 0) {
          return {
            success: false,
            error: `Percentile values must be between 0 and 100. Invalid: ${invalidPercentiles.join(", ")}`,
            code: "INVALID_INPUT",
            category: "validation",
            recoverable: false,
          };
        }

        await validateColumnExists(adapter, input.table, input.column);
        const numericError = await validateNumericColumn(
          adapter,
          input.table,
          input.column,
        );
        if (numericError) return numericError;

        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);

        let sql = `SELECT ${column} as value FROM ${table} WHERE ${column} IS NOT NULL`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` AND ${input.whereClause}`;
        }
        sql += ` ORDER BY ${column}`;

        const result = await adapter.executeReadQuery(sql);
        const values = (result.rows ?? []).map((r) => r["value"] as number);

        if (values.length === 0) {
          return {
            success: true,
            percentiles: input.percentiles.map((p) => ({
              percentile: p,
              value: null,
            })),
          };
        }

        const percentiles = input.percentiles.map((p) => {
          const index = Math.ceil((p / 100) * values.length) - 1;
          const safeIndex = Math.max(0, Math.min(index, values.length - 1));
          return {
            percentile: p,
            value: values[safeIndex],
          };
        });

        return {
          success: true,
          column: input.column,
          count: values.length,
          percentiles,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}
