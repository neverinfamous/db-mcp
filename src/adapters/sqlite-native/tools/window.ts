/**
 * Window Function Tools for Native SQLite Adapter
 * 
 * Provides window function tools for analytics and ranking operations.
 */

import { z } from 'zod';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import type { NativeSqliteAdapter } from '../NativeSqliteAdapter.js';

// Schemas
const RowNumberSchema = z.object({
    table: z.string().describe('Table name'),
    orderBy: z.string().describe('Column(s) to order by'),
    partitionBy: z.string().optional().describe('Column(s) to partition by'),
    selectColumns: z.array(z.string()).optional().describe('Columns to include in result'),
    whereClause: z.string().optional().describe('Optional WHERE clause'),
    limit: z.number().optional().default(100).describe('Maximum rows to return')
});

const RankSchema = z.object({
    table: z.string().describe('Table name'),
    orderBy: z.string().describe('Column(s) to order by (determines rank)'),
    partitionBy: z.string().optional().describe('Column(s) to partition by'),
    selectColumns: z.array(z.string()).optional().describe('Columns to include in result'),
    rankType: z.enum(['rank', 'dense_rank', 'percent_rank']).optional().default('rank').describe('Rank function type'),
    whereClause: z.string().optional().describe('Optional WHERE clause'),
    limit: z.number().optional().default(100).describe('Maximum rows to return')
});

const LagLeadSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to get lag/lead value from'),
    orderBy: z.string().describe('Column(s) to order by'),
    direction: z.enum(['lag', 'lead']).describe('LAG (previous) or LEAD (next) row'),
    offset: z.number().optional().default(1).describe('Number of rows to look back/ahead'),
    defaultValue: z.string().optional().describe('Default value if no row exists'),
    partitionBy: z.string().optional().describe('Column(s) to partition by'),
    selectColumns: z.array(z.string()).optional().describe('Columns to include in result'),
    whereClause: z.string().optional().describe('Optional WHERE clause'),
    limit: z.number().optional().default(100).describe('Maximum rows to return')
});

const RunningTotalSchema = z.object({
    table: z.string().describe('Table name'),
    valueColumn: z.string().describe('Column to sum'),
    orderBy: z.string().describe('Column(s) to order by'),
    partitionBy: z.string().optional().describe('Reset running total for each partition'),
    selectColumns: z.array(z.string()).optional().describe('Columns to include in result'),
    whereClause: z.string().optional().describe('Optional WHERE clause'),
    limit: z.number().optional().default(100).describe('Maximum rows to return')
});

const MovingAverageSchema = z.object({
    table: z.string().describe('Table name'),
    valueColumn: z.string().describe('Column to average'),
    orderBy: z.string().describe('Column(s) to order by'),
    windowSize: z.number().describe('Number of rows in the moving window'),
    partitionBy: z.string().optional().describe('Column(s) to partition by'),
    selectColumns: z.array(z.string()).optional().describe('Columns to include in result'),
    whereClause: z.string().optional().describe('Optional WHERE clause'),
    limit: z.number().optional().default(100).describe('Maximum rows to return')
});

const NtileSchema = z.object({
    table: z.string().describe('Table name'),
    orderBy: z.string().describe('Column(s) to order by'),
    buckets: z.number().describe('Number of buckets (e.g., 4 for quartiles)'),
    partitionBy: z.string().optional().describe('Column(s) to partition by'),
    selectColumns: z.array(z.string()).optional().describe('Columns to include in result'),
    whereClause: z.string().optional().describe('Optional WHERE clause'),
    limit: z.number().optional().default(100).describe('Maximum rows to return')
});

/**
 * Helper to format column selection
 */
function formatColumns(selectColumns: string[] | undefined): string {
    if (selectColumns === undefined || selectColumns.length === 0) {
        return '*';
    }
    return selectColumns.map(c => `"${c}"`).join(', ');
}

/**
 * Get all window function tools
 */
export function getWindowTools(adapter: NativeSqliteAdapter): ToolDefinition[] {
    return [
        createRowNumberTool(adapter),
        createRankTool(adapter),
        createLagLeadTool(adapter),
        createRunningTotalTool(adapter),
        createMovingAverageTool(adapter),
        createNtileTool(adapter)
    ];
}

/**
 * ROW_NUMBER window function
 */
function createRowNumberTool(adapter: NativeSqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_window_row_number',
        description: 'Assign sequential row numbers based on ordering. Useful for pagination and ranking.',
        group: 'stats',
        inputSchema: RowNumberSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = RowNumberSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }

            const columns = formatColumns(input.selectColumns);
            const partition = input.partitionBy
                ? `PARTITION BY ${input.partitionBy}`
                : '';

            let sql = `
                SELECT ${columns},
                    ROW_NUMBER() OVER (${partition} ORDER BY ${input.orderBy}) as row_num
                FROM "${input.table}"
            `;

            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                rowCount: result.rows?.length ?? 0,
                rows: result.rows
            };
        }
    };
}

/**
 * RANK/DENSE_RANK/PERCENT_RANK window functions
 */
function createRankTool(adapter: NativeSqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_window_rank',
        description: 'Calculate rank of rows. RANK leaves gaps after ties, DENSE_RANK does not, PERCENT_RANK gives 0-1 range.',
        group: 'stats',
        inputSchema: RankSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = RankSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }

            const columns = formatColumns(input.selectColumns);
            const partition = input.partitionBy
                ? `PARTITION BY ${input.partitionBy}`
                : '';
            const rankFunc = input.rankType.toUpperCase();

            let sql = `
                SELECT ${columns},
                    ${rankFunc}() OVER (${partition} ORDER BY ${input.orderBy}) as rank_value
                FROM "${input.table}"
            `;

            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                rankType: input.rankType,
                rowCount: result.rows?.length ?? 0,
                rows: result.rows
            };
        }
    };
}

/**
 * LAG/LEAD window functions
 */
function createLagLeadTool(adapter: NativeSqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_window_lag_lead',
        description: 'Access previous (LAG) or next (LEAD) row values. Useful for comparing consecutive rows.',
        group: 'stats',
        inputSchema: LagLeadSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = LagLeadSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            const columns = formatColumns(input.selectColumns);
            const partition = input.partitionBy
                ? `PARTITION BY ${input.partitionBy}`
                : '';
            const func = input.direction.toUpperCase();
            const defaultVal = input.defaultValue !== undefined
                ? `, ${input.defaultValue}`
                : '';

            let sql = `
                SELECT ${columns},
                    ${func}("${input.column}", ${input.offset}${defaultVal}) OVER (${partition} ORDER BY ${input.orderBy}) as ${input.direction}_value
                FROM "${input.table}"
            `;

            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                direction: input.direction,
                offset: input.offset,
                rowCount: result.rows?.length ?? 0,
                rows: result.rows
            };
        }
    };
}

/**
 * Running total (cumulative SUM)
 */
function createRunningTotalTool(adapter: NativeSqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_window_running_total',
        description: 'Calculate running (cumulative) total. Useful for balance tracking, cumulative metrics.',
        group: 'stats',
        inputSchema: RunningTotalSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = RunningTotalSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.valueColumn)) {
                throw new Error('Invalid column name');
            }

            const columns = formatColumns(input.selectColumns);
            const partition = input.partitionBy
                ? `PARTITION BY ${input.partitionBy}`
                : '';

            let sql = `
                SELECT ${columns},
                    SUM("${input.valueColumn}") OVER (${partition} ORDER BY ${input.orderBy} ROWS UNBOUNDED PRECEDING) as running_total
                FROM "${input.table}"
            `;

            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                valueColumn: input.valueColumn,
                rowCount: result.rows?.length ?? 0,
                rows: result.rows
            };
        }
    };
}

/**
 * Moving average
 */
function createMovingAverageTool(adapter: NativeSqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_window_moving_avg',
        description: 'Calculate moving (rolling) average. Useful for smoothing time series data.',
        group: 'stats',
        inputSchema: MovingAverageSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = MovingAverageSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.valueColumn)) {
                throw new Error('Invalid column name');
            }

            const columns = formatColumns(input.selectColumns);
            const partition = input.partitionBy
                ? `PARTITION BY ${input.partitionBy}`
                : '';
            const preceding = input.windowSize - 1;

            let sql = `
                SELECT ${columns},
                    AVG("${input.valueColumn}") OVER (${partition} ORDER BY ${input.orderBy} ROWS BETWEEN ${preceding} PRECEDING AND CURRENT ROW) as moving_avg
                FROM "${input.table}"
            `;

            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                valueColumn: input.valueColumn,
                windowSize: input.windowSize,
                rowCount: result.rows?.length ?? 0,
                rows: result.rows
            };
        }
    };
}

/**
 * NTILE (divide into buckets/quantiles)
 */
function createNtileTool(adapter: NativeSqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_window_ntile',
        description: 'Divide rows into N buckets. E.g., 4 buckets = quartiles, 10 = deciles, 100 = percentiles.',
        group: 'stats',
        inputSchema: NtileSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = NtileSchema.parse(params);

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }

            const columns = formatColumns(input.selectColumns);
            const partition = input.partitionBy
                ? `PARTITION BY ${input.partitionBy}`
                : '';

            let sql = `
                SELECT ${columns},
                    NTILE(${input.buckets}) OVER (${partition} ORDER BY ${input.orderBy}) as bucket
                FROM "${input.table}"
            `;

            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                buckets: input.buckets,
                rowCount: result.rows?.length ?? 0,
                rows: result.rows
            };
        }
    };
}
