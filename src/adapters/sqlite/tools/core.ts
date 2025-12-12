/**
 * SQLite Core Database Tools
 * 
 * Fundamental database operations: read, write, table management, indexes.
 * 8 tools total with OAuth scope enforcement.
 */

import type { SqliteAdapter } from '../SqliteAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import {
    ReadQuerySchema,
    WriteQuerySchema,
    CreateTableSchema,
    DescribeTableSchema,
    DropTableSchema,
    CreateIndexSchema,
    GetIndexesSchema
} from '../types.js';

/**
 * Get all core database tools
 */
export function getCoreTools(adapter: SqliteAdapter): ToolDefinition[] {
    return [
        createReadQueryTool(adapter),
        createWriteQueryTool(adapter),
        createCreateTableTool(adapter),
        createListTablesTool(adapter),
        createDescribeTableTool(adapter),
        createDropTableTool(adapter),
        createGetIndexesTool(adapter),
        createCreateIndexTool(adapter)
    ];
}

/**
 * Execute a read-only SQL query
 */
function createReadQueryTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_read_query',
        description: 'Execute a SELECT query on the SQLite database. Returns rows as JSON. Use parameter binding for safety.',
        group: 'core',
        inputSchema: ReadQuerySchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = ReadQuerySchema.parse(params);

            const result = await adapter.executeReadQuery(input.query, input.params);

            return {
                success: true,
                rowCount: result.rows?.length ?? 0,
                rows: result.rows,
                executionTimeMs: result.executionTimeMs
            };
        }
    };
}

/**
 * Execute a write SQL query (INSERT, UPDATE, DELETE)
 */
function createWriteQueryTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_write_query',
        description: 'Execute an INSERT, UPDATE, or DELETE query. Returns affected row count. Use parameter binding for safety.',
        group: 'core',
        inputSchema: WriteQuerySchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = WriteQuerySchema.parse(params);

            const result = await adapter.executeWriteQuery(input.query, input.params);

            return {
                success: true,
                rowsAffected: result.rowsAffected,
                executionTimeMs: result.executionTimeMs
            };
        }
    };
}

/**
 * Create a new table
 */
function createCreateTableTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_create_table',
        description: 'Create a new table in the database with specified columns and constraints.',
        group: 'core',
        inputSchema: CreateTableSchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = CreateTableSchema.parse(params);

            // Build column definitions
            const columnDefs = input.columns.map(col => {
                const parts = [`"${col.name}" ${col.type}`];
                if (col.primaryKey) parts.push('PRIMARY KEY');
                if (col.unique && !col.primaryKey) parts.push('UNIQUE');
                if (!col.nullable) parts.push('NOT NULL');
                if (col.defaultValue !== undefined) {
                    let defaultVal: string;
                    if (typeof col.defaultValue === 'string') {
                        defaultVal = `'${col.defaultValue}'`;
                    } else if (typeof col.defaultValue === 'number' || typeof col.defaultValue === 'boolean') {
                        defaultVal = String(col.defaultValue);
                    } else if (col.defaultValue === null) {
                        defaultVal = 'NULL';
                    } else {
                        // For objects and other types, use JSON
                        defaultVal = `'${JSON.stringify(col.defaultValue)}'`;
                    }
                    parts.push(`DEFAULT ${defaultVal}`);
                }
                return parts.join(' ');
            });

            const ifNotExists = input.ifNotExists ? 'IF NOT EXISTS ' : '';
            const sql = `CREATE TABLE ${ifNotExists}"${input.tableName}" (${columnDefs.join(', ')})`;

            await adapter.executeQuery(sql);

            return {
                success: true,
                message: `Table '${input.tableName}' created successfully`,
                sql
            };
        }
    };
}

/**
 * List all tables in the database
 */
function createListTablesTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_list_tables',
        description: 'List all tables and views in the database with their row counts.',
        group: 'core',
        inputSchema: {},
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            const tables = await adapter.listTables();

            return {
                success: true,
                count: tables.length,
                tables: tables.map(t => ({
                    name: t.name,
                    type: t.type,
                    rowCount: t.rowCount,
                    columnCount: t.columns?.length ?? 0
                }))
            };
        }
    };
}

/**
 * Describe a table's structure
 */
function createDescribeTableTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_describe_table',
        description: 'Get detailed schema information for a table including columns, types, and constraints.',
        group: 'core',
        inputSchema: DescribeTableSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = DescribeTableSchema.parse(params);

            const tableInfo = await adapter.describeTable(input.tableName);

            return {
                success: true,
                table: tableInfo.name,
                rowCount: tableInfo.rowCount,
                columns: tableInfo.columns
            };
        }
    };
}

/**
 * Drop a table
 */
function createDropTableTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_drop_table',
        description: 'Drop (delete) a table from the database. This is irreversible!',
        group: 'core',
        inputSchema: DropTableSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = DropTableSchema.parse(params);

            // Validate table name
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.tableName)) {
                throw new Error('Invalid table name');
            }

            const ifExists = input.ifExists ? 'IF EXISTS ' : '';
            const sql = `DROP TABLE ${ifExists}"${input.tableName}"`;

            await adapter.executeQuery(sql);

            return {
                success: true,
                message: `Table '${input.tableName}' dropped successfully`
            };
        }
    };
}

/**
 * Get indexes
 */
function createGetIndexesTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_get_indexes',
        description: 'List all indexes in the database, optionally filtered by table.',
        group: 'core',
        inputSchema: GetIndexesSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = GetIndexesSchema.parse(params);

            let sql = `SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL`;

            if (input.tableName) {
                // Validate table name
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.tableName)) {
                    throw new Error('Invalid table name');
                }
                sql += ` AND tbl_name = '${input.tableName}'`;
            }

            const result = await adapter.executeReadQuery(sql);

            const indexes = (result.rows ?? []).map(row => ({
                name: row['name'] as string,
                table: row['tbl_name'] as string,
                unique: (row['sql'] as string)?.includes('UNIQUE') ?? false,
                sql: row['sql'] as string
            }));

            return {
                success: true,
                count: indexes.length,
                indexes
            };
        }
    };
}

/**
 * Create an index
 */
function createCreateIndexTool(adapter: SqliteAdapter): ToolDefinition {
    return {
        name: 'sqlite_create_index',
        description: 'Create an index on one or more columns to improve query performance.',
        group: 'core',
        inputSchema: CreateIndexSchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const input = CreateIndexSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.indexName)) {
                throw new Error('Invalid index name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.tableName)) {
                throw new Error('Invalid table name');
            }
            for (const col of input.columns) {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
                    throw new Error(`Invalid column name: ${col}`);
                }
            }

            const unique = input.unique ? 'UNIQUE ' : '';
            const ifNotExists = input.ifNotExists ? 'IF NOT EXISTS ' : '';
            const columns = input.columns.map(c => `"${c}"`).join(', ');

            const sql = `CREATE ${unique}INDEX ${ifNotExists}"${input.indexName}" ON "${input.tableName}" (${columns})`;

            await adapter.executeQuery(sql);

            return {
                success: true,
                message: `Index '${input.indexName}' created on ${input.tableName}(${input.columns.join(', ')})`,
                sql
            };
        }
    };
}
