/**
 * SQLite Text Processing Tools
 * 
 * String manipulation and pattern matching:
 * regex, split, concat, format, etc.
 * 8 tools total.
 */

import { z } from 'zod';
import type { SqliteAdapter } from '../SqliteAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';

// Text tool schemas
const RegexExtractSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to extract from'),
    pattern: z.string().describe('Regular expression pattern'),
    groupIndex: z.number().optional().default(0).describe('Capture group index'),
    whereClause: z.string().optional(),
    limit: z.number().optional().default(100)
});

const RegexMatchSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to match'),
    pattern: z.string().describe('Regular expression pattern'),
    whereClause: z.string().optional(),
    limit: z.number().optional().default(100)
});

const TextSplitSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to split'),
    delimiter: z.string().describe('Delimiter string'),
    whereClause: z.string().optional(),
    limit: z.number().optional().default(100)
});

const TextConcatSchema = z.object({
    table: z.string().describe('Table name'),
    columns: z.array(z.string()).describe('Columns to concatenate'),
    separator: z.string().optional().default('').describe('Separator between values'),
    whereClause: z.string().optional(),
    limit: z.number().optional().default(100)
});

const TextReplaceSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to update'),
    searchPattern: z.string().describe('Text to search for'),
    replaceWith: z.string().describe('Replacement text'),
    whereClause: z.string().describe('WHERE clause')
});

const TextTrimSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to trim'),
    mode: z.enum(['both', 'left', 'right']).optional().default('both'),
    whereClause: z.string().optional(),
    limit: z.number().optional().default(100)
});

const TextCaseSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to transform'),
    mode: z.enum(['upper', 'lower']).describe('Case transformation'),
    whereClause: z.string().optional(),
    limit: z.number().optional().default(100)
});

const TextSubstringSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to extract from'),
    start: z.number().describe('Start position (1-indexed)'),
    length: z.number().optional().describe('Number of characters'),
    whereClause: z.string().optional(),
    limit: z.number().optional().default(100)
});

/**
 * Get all text processing tools
 */
export function getTextTools(adapter: SqliteAdapter): ToolDefinition[] {
    return [
        createRegexExtractTool(adapter),
        createRegexMatchTool(adapter),
        createTextSplitTool(adapter),
        createTextConcatTool(adapter),
        createTextReplaceTool(adapter),
        createTextTrimTool(adapter),
        createTextCaseTool(adapter),
        createTextSubstringTool(adapter)
    ];
}

/**
 * Extract text using regex pattern
 * Note: SQLite doesn't have native regex, we do this in JS
 */
function createRegexExtractTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_regex_extract',
        description: 'Extract text matching a regex pattern. Processed in JavaScript after fetching data.',
        group: 'text',
        inputSchema: RegexExtractSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = RegexExtractSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            let sql = `SELECT rowid, "${input.column}" as value FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            // Apply regex in JavaScript
            const regex = new RegExp(input.pattern);
            const extracts = (result.rows ?? []).map(row => {
                const rawValue = row['value'];
                const value = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue ?? '');
                const match = regex.exec(value);
                return {
                    rowid: row['rowid'],
                    original: value,
                    extracted: match ? (match[input.groupIndex] ?? match[0]) : null
                };
            }).filter(r => r.extracted !== null);

            return {
                success: true,
                matchCount: extracts.length,
                results: extracts
            };
        }
    };
}

/**
 * Match rows using regex pattern
 */
function createRegexMatchTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_regex_match',
        description: 'Find rows where column matches a regex pattern. Processed in JavaScript.',
        group: 'text',
        inputSchema: RegexMatchSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = RegexMatchSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            let sql = `SELECT rowid, "${input.column}" as value FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            // Apply regex in JavaScript
            const regex = new RegExp(input.pattern);
            const matches = (result.rows ?? []).filter(row => {
                const rawValue = row['value'];
                const value = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue ?? '');
                return regex.test(value);
            });

            return {
                success: true,
                matchCount: matches.length,
                rows: matches
            };
        }
    };
}

/**
 * Split text into array
 */
function createTextSplitTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_text_split',
        description: 'Split a text column by delimiter into array results.',
        group: 'text',
        inputSchema: TextSplitSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = TextSplitSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            let sql = `SELECT rowid, "${input.column}" as value FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            // Split in JavaScript
            const splits = (result.rows ?? []).map(row => {
                const rawValue = row['value'];
                const valueStr = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue ?? '');
                return {
                    rowid: row['rowid'],
                    original: row['value'],
                    parts: valueStr.split(input.delimiter)
                };
            });

            return {
                success: true,
                rowCount: splits.length,
                results: splits
            };
        }
    };
}

/**
 * Concatenate columns
 */
function createTextConcatTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_text_concat',
        description: 'Concatenate multiple columns with optional separator.',
        group: 'text',
        inputSchema: TextConcatSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = TextConcatSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            for (const col of input.columns) {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
                    throw new Error(`Invalid column name: ${col}`);
                }
            }

            // Build concatenation expression
            const sep = input.separator.replace(/'/g, "''");
            const concatExpr = input.columns
                .map(c => `COALESCE("${c}", '')`)
                .join(`, '${sep}', `);

            let sql = `SELECT ${concatExpr} as concatenated FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                rowCount: result.rows?.length ?? 0,
                values: result.rows?.map(r => r['concatenated'])
            };
        }
    };
}

/**
 * Replace text in column
 */
function createTextReplaceTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_text_replace',
        description: 'Replace text in a column using SQLite replace() function.',
        group: 'text',
        inputSchema: TextReplaceSchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = TextReplaceSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            const search = input.searchPattern.replace(/'/g, "''");
            const replace = input.replaceWith.replace(/'/g, "''");

            const sql = `UPDATE "${input.table}" SET "${input.column}" = replace("${input.column}", '${search}', '${replace}') WHERE ${input.whereClause}`;

            const result = await adapter.executeWriteQuery(sql);

            return {
                success: true,
                rowsAffected: result.rowsAffected
            };
        }
    };
}

/**
 * Trim whitespace
 */
function createTextTrimTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_text_trim',
        description: 'Trim whitespace from text column values.',
        group: 'text',
        inputSchema: TextTrimSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = TextTrimSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            let trimFunc: string;
            switch (input.mode) {
                case 'left':
                    trimFunc = 'ltrim';
                    break;
                case 'right':
                    trimFunc = 'rtrim';
                    break;
                default:
                    trimFunc = 'trim';
            }

            let sql = `SELECT rowid, "${input.column}" as original, ${trimFunc}("${input.column}") as trimmed FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                rowCount: result.rows?.length ?? 0,
                results: result.rows
            };
        }
    };
}

/**
 * Change text case
 */
function createTextCaseTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_text_case',
        description: 'Convert text to uppercase or lowercase.',
        group: 'text',
        inputSchema: TextCaseSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = TextCaseSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            const caseFunc = input.mode === 'upper' ? 'upper' : 'lower';

            let sql = `SELECT rowid, "${input.column}" as original, ${caseFunc}("${input.column}") as transformed FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                rowCount: result.rows?.length ?? 0,
                results: result.rows
            };
        }
    };
}

/**
 * Extract substring
 */
function createTextSubstringTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_text_substring',
        description: 'Extract a substring from text column using substr().',
        group: 'text',
        inputSchema: TextSubstringSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = TextSubstringSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.column)) {
                throw new Error('Invalid column name');
            }

            const substrExpr = input.length !== undefined
                ? `substr("${input.column}", ${input.start}, ${input.length})`
                : `substr("${input.column}", ${input.start})`;

            let sql = `SELECT rowid, "${input.column}" as original, ${substrExpr} as substring FROM "${input.table}"`;
            if (input.whereClause) {
                sql += ` WHERE ${input.whereClause}`;
            }
            sql += ` LIMIT ${input.limit}`;

            const result = await adapter.executeReadQuery(sql);

            return {
                success: true,
                rowCount: result.rows?.length ?? 0,
                results: result.rows
            };
        }
    };
}
