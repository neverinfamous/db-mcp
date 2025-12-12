/**
 * SQLite Statistics Tools
 * 
 * Statistical analysis and aggregation functions:
 * sum, avg, min, max, count, distinct, percentile, histogram, correlation, etc.
 * 10 tools total.
 */

import { z } from 'zod';
import type { SqliteAdapter } from '../SqliteAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';

// Stats schemas
const BasicStatsSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Numeric column for statistics'),
    whereClause: z.string().optional()
});

const CountSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().optional().describe('Column to count (default: *)'),
    distinct: z.boolean().optional().default(false),
    whereClause: z.string().optional()
});

const GroupByStatsSchema = z.object({
    table: z.string().describe('Table name'),
    valueColumn: z.string().describe('Column for statistical value'),
    groupByColumn: z.string().describe('Column to group by'),
    stat: z.enum(['sum', 'avg', 'min', 'max', 'count']).describe('Statistic type'),
    whereClause: z.string().optional(),
    orderBy: z.enum(['value', 'group']).optional().default('group'),
    limit: z.number().optional().default(100)
});

const HistogramSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Numeric column'),
    buckets: z.number().optional().default(10).describe('Number of buckets'),
    whereClause: z.string().optional()
});

const PercentileSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Numeric column'),
    percentiles: z.array(z.number().min(0).max(100)).describe('Percentiles to compute'),
    whereClause: z.string().optional()
});

const CorrelationSchema = z.object({
    table: z.string().describe('Table name'),
    column1: z.string().describe('First numeric column'),
    column2: z.string().describe('Second numeric column'),
    whereClause: z.string().optional()
});

const TopNSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to rank'),
    n: z.number().optional().default(10).describe('Number of top values'),
    orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
    whereClause: z.string().optional()
});

const DistinctValuesSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to get distinct values'),
    limit: z.number().optional().default(100),
    whereClause: z.string().optional()
});

const SummaryStatsSchema = z.object({
    table: z.string().describe('Table name'),
    columns: z.array(z.string()).optional().describe('Columns to summarize (default: all numeric)'),
    whereClause: z.string().optional()
});

const FrequencySchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to count frequency'),
    limit: z.number().optional().default(20),
    whereClause: z.string().optional()
});

/**
 * Get all statistics tools
 */
export function getStatsTools(adapter: SqliteAdapter): ToolDefinition[] {
    return [
        createBasicStatsTool(adapter),
        createCountTool(adapter),
        createGroupByStatsTool(adapter),
        createHistogramTool(adapter),
        createPercentileTool(adapter),
        createCorrelationTool(adapter),
        createTopNTool(adapter),
        createDistinctValuesTool(adapter),
        createSummaryStatsTool(adapter),
        createFrequencyTool(adapter)
    ];
}

/**
 * Basic statistics (sum, avg, min, max, stdev)
 */
function createBasicStatsTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_basic',
        description: 'Get basic statistics (count, sum, avg, min, max) for a numeric column.',
        group: 'stats',
        inputSchema: BasicStatsSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = BasicStatsSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            let sql = `SELECT 
                COUNT("${input.column}") as count,
                SUM("${input.column}") as sum,
                AVG("${input.column}") as avg,
                MIN("${input.column}") as min,
                MAX("${input.column}") as max,
                MAX("${input.column}") - MIN("${input.column}") as range
            FROM "${input.table}"`;

            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                column: input.column,
                stats: result.rows?.[0]
            };
        }
    };
}

/**
 * Count rows
 */
function createCountTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_count',
        description: 'Count rows, optionally distinct values in a column.',
        group: 'stats',
        inputSchema: CountSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = CountSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }

            let countExpr: string;
            if (input.column) {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                    throw new Error('Invalid column name');
                }
                countExpr = input.distinct
                    ? `COUNT(DISTINCT "${input.column}")`
                    : `COUNT("${input.column}")`;
            } else {
                countExpr = 'COUNT(*)';
            }

            let sql = `SELECT ${countExpr} as count FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                count: result.rows?.[0]?.['count'] ?? 0,
                distinct: input.distinct
            };
        }
    };
}

/**
 * Group by with aggregation
 */
function createGroupByStatsTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_group_by',
        description: 'Aggregate statistics grouped by a column.',
        group: 'stats',
        inputSchema: GroupByStatsSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = GroupByStatsSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.valueColumn)) {
                throw new Error('Invalid value column name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.groupByColumn)) {
                throw new Error('Invalid group by column name');
            }

            const statFunc = input.stat.toUpperCase();
            const orderCol = input.orderBy === 'value' ? 'stat_value' : `"${input.groupByColumn}"`;

            let sql = `SELECT "${input.groupByColumn}", ${statFunc}("${input.valueColumn}") as stat_value 
                FROM "${input.table}"`;

            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }

            sql += ` GROUP BY "${input.groupByColumn}" ORDER BY ${orderCol} DESC LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                statistic: input.stat,
                rowCount: result.rows?.length ?? 0,
                results: result.rows
            };
        }
    };
}

/**
 * Histogram
 */
function createHistogramTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_histogram',
        description: 'Create a histogram with specified number of buckets.',
        group: 'stats',
        inputSchema: HistogramSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = HistogramSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            // First get min/max
            let minMaxSql = `SELECT MIN("${input.column}") as min_val, MAX("${input.column}") as max_val FROM "${input.table}"`;
            if (input.whereClause) {
                minMaxSql += ` WHERE ${input.whereClause}`;
            }

            const minMaxResult = await adapter.executeReadQuery(minMaxSql);
            const minVal = minMaxResult.rows?.[0]?.['min_val'] as number ?? 0;
            const maxVal = minMaxResult.rows?.[0]?.['max_val'] as number ?? 0;
            const range = maxVal - minVal;
            const bucketSize = range / input.buckets;

            if (bucketSize === 0) {
                return {
                    success: true,
                    buckets: [{ min: minVal, max: maxVal, count: 1 }]
                };
            }

            // Build histogram using CASE expressions
            const bucketCases = [];
            for (let i = 0; i < input.buckets; i++) {
                const bucketMin = minVal + (i * bucketSize);
                const bucketMax = minVal + ((i + 1) * bucketSize);
                bucketCases.push(
                    `SUM(CASE WHEN "${input.column}" >= ${bucketMin} AND "${input.column}" < ${bucketMax} THEN 1 ELSE 0 END) as bucket_${i}`
                );
            }

            let sql = `SELECT ${bucketCases.join(', ')} FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }

            const result = await adapter.executeReadQuery(sql);

            // Format buckets
            const buckets = [];
            for (let i = 0; i < input.buckets; i++) {
                const bucketMin = minVal + (i * bucketSize);
                const bucketMax = minVal + ((i + 1) * bucketSize);
                buckets.push({
                    bucket: i,
                    min: bucketMin,
                    max: bucketMax,
                    count: result.rows?.[0]?.[`bucket_${i}`] ?? 0
                });
            }

            return {
                success: true,
                column: input.column,
                range: { min: minVal, max: maxVal },
                bucketSize,
                buckets
            };
        }
    };
}

/**
 * Percentiles
 */
function createPercentileTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_percentile',
        description: 'Calculate percentiles (median, quartiles, etc.) for a column.',
        group: 'stats',
        inputSchema: PercentileSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = PercentileSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            // Get all values sorted
            let sql = `SELECT "${input.column}" as value FROM "${input.table}" WHERE "${input.column}" IS NOT NULL`;
            if (input.whereClause) {
                sql += ` AND ${input.whereClause}`;
            }
            sql += ` ORDER BY "${input.column}"`;

            const result = await adapter.executeReadQuery(sql);
            const values = (result.rows ?? []).map(r => r['value'] as number);

            if (values.length === 0) {
                return {
                    success: true,
                    percentiles: input.percentiles.map(p => ({ percentile: p, value: null }))
                };
            }

            // Calculate percentiles
            const percentiles = input.percentiles.map(p => {
                const index = Math.ceil((p / 100) * values.length) - 1;
                const safeIndex = Math.max(0, Math.min(index, values.length - 1));
                return {
                    percentile: p,
                    value: values[safeIndex]
                };
            });

            return {
                success: true,
                column: input.column,
                count: values.length,
                percentiles
            };
        }
    };
}

/**
 * Correlation between two columns
 */
function createCorrelationTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_correlation',
        description: 'Calculate Pearson correlation coefficient between two numeric columns.',
        group: 'stats',
        inputSchema: CorrelationSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = CorrelationSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column1)) {
                throw new Error('Invalid column1 name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column2)) {
                throw new Error('Invalid column2 name');
            }

            // Get paired values
            let sql = `SELECT "${input.column1}" as x, "${input.column2}" as y 
                FROM "${input.table}" 
                WHERE "${input.column1}" IS NOT NULL AND "${input.column2}" IS NOT NULL`;
            if (input.whereClause) {
                sql += ` AND ${input.whereClause}`;
            }

            const result = await adapter.executeReadQuery(sql);
            const pairs = (result.rows ?? []).map(r => ({
                x: r['x'] as number,
                y: r['y'] as number
            }));

            if (pairs.length < 2) {
                return {
                    success: true,
                    correlation: null,
                    message: 'Need at least 2 data points'
                };
            }

            // Calculate correlation in JS
            const n = pairs.length;
            const sumX = pairs.reduce((s, p) => s + p.x, 0);
            const sumY = pairs.reduce((s, p) => s + p.y, 0);
            const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
            const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);
            const sumY2 = pairs.reduce((s, p) => s + p.y * p.y, 0);

            const numerator = n * sumXY - sumX * sumY;
            const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

            const correlation = denominator === 0 ? 0 : numerator / denominator;

            return {
                success: true,
                column1: input.column1,
                column2: input.column2,
                n: pairs.length,
                correlation: Math.round(correlation * 10000) / 10000
            };
        }
    };
}

/**
 * Top N values
 */
function createTopNTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_top_n',
        description: 'Get top N values from a column.',
        group: 'stats',
        inputSchema: TopNSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = TopNSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            const order = input.orderDirection.toUpperCase();

            let sql = `SELECT * FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` ORDER BY "${input.column}" ${order} LIMIT ${input.n}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                column: input.column,
                direction: input.orderDirection,
                count: result.rows?.length ?? 0,
                rows: result.rows
            };
        }
    };
}

/**
 * Distinct values
 */
function createDistinctValuesTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_distinct',
        description: 'Get distinct values from a column.',
        group: 'stats',
        inputSchema: DistinctValuesSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = DistinctValuesSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            let sql = `SELECT DISTINCT "${input.column}" as value FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                column: input.column,
                distinctCount: result.rows?.length ?? 0,
                values: result.rows?.map(r => r['value'])
            };
        }
    };
}

/**
 * Summary statistics for all numeric columns
 */
function createSummaryStatsTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_summary',
        description: 'Get summary statistics for multiple columns at once.',
        group: 'stats',
        inputSchema: SummaryStatsSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = SummaryStatsSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }

            // Get table info to find columns
            const tableInfo = await adapter.describeTable(input.table);

            // Filter to requested columns or all columns from table
            let columns = (tableInfo.columns ?? []).map(c => c.name);
            if (input.columns && input.columns.length > 0) {
                for (const col of input.columns) {
                    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
                        throw new Error(`Invalid column name: ${col}`);
                    }
                }
                columns = input.columns;
            }

            // Build summary query for each column
            const summaries: Record<string, unknown>[] = [];

            for (const col of columns) {
                let sql = `SELECT 
                    COUNT("${col}") as count,
                    AVG("${col}") as avg,
                    MIN("${col}") as min,
                    MAX("${col}") as max
                FROM "${input.table}"`;

                if (input.whereClause) {
                    sql += ` WHERE ${input.whereClause}`;
                }

                try {
                    const result = await adapter.executeReadQuery(sql);
                    summaries.push({
                        column: col,
                        ...result.rows?.[0]
                    });
                } catch {
                    // Column may not be numeric, skip
                    summaries.push({ column: col, error: 'Not numeric' });
                }
            }

            return {
                success: true,
                table: input.table,
                summaries
            };
        }
    };
}

/**
 * Value frequency distribution
 */
function createFrequencyTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_stats_frequency',
        description: 'Get frequency distribution of values in a column.',
        group: 'stats',
        inputSchema: FrequencySchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = FrequencySchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            let sql = `SELECT "${input.column}" as value, COUNT(*) as frequency 
                FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` GROUP BY "${input.column}" ORDER BY frequency DESC LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                column: input.column,
                distinctValues: result.rows?.length ?? 0,
                distribution: result.rows
            };
        }
    };
}
