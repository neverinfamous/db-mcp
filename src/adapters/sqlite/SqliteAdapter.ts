/**
 * SQLite Adapter
 * 
 * MCP adapter for SQLite databases using sql.js (WebAssembly).
 * Provides 73 tools for database operations, JSON, text processing,
 * statistics, vector search, and geospatial features.
 */

import initSqlJs, { type Database } from 'sql.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseAdapter } from '../DatabaseAdapter.js';
import type {
    DatabaseConfig,
    QueryResult,
    SchemaInfo,
    TableInfo,
    ColumnInfo,
    IndexInfo,
    HealthStatus,
    AdapterCapabilities,
    ToolDefinition,
    ResourceDefinition,
    PromptDefinition,
    ToolGroup
} from '../../types/index.js';
import { createModuleLogger, ERROR_CODES } from '../../utils/logger.js';
import type { SqliteConfig, SqliteOptions } from './types.js';

// Tool definitions from modular files
import { getAllToolDefinitions } from './tools/index.js';
import { getResourceDefinitions } from './resources.js';
import { getPromptDefinitions } from './prompts.js';

// Module logger
const log = createModuleLogger('SQLITE');

/**
 * SQLite Database Adapter
 * 
 * Implements the DatabaseAdapter interface for SQLite using sql.js.
 * Supports file-based and in-memory databases.
 */
export class SqliteAdapter extends DatabaseAdapter {
    override readonly type = 'sqlite' as const;
    override readonly name = 'SQLite Adapter';
    override readonly version = '1.0.0';

    private db: Database | null = null;
    protected override config: SqliteConfig | null = null;
    private sqlJsInstance: Awaited<ReturnType<typeof initSqlJs>> | null = null;

    /**
     * Connect to a SQLite database
     */
    override async connect(config: DatabaseConfig): Promise<void> {
        if (config.type !== 'sqlite') {
            throw new Error(`Invalid database type: expected 'sqlite', got '${config.type}'`);
        }

        this.config = config as SqliteConfig;

        try {
            // Initialize sql.js
            this.sqlJsInstance = await initSqlJs();

            const filePath = this.config.filePath ?? this.config.connectionString ?? ':memory:';

            if (filePath === ':memory:') {
                // Create in-memory database
                this.db = new this.sqlJsInstance.Database();
                log.info('CONNECT', `Connected to in-memory SQLite database`);
            } else {
                // For file-based databases, we need to read the file
                // sql.js works in-memory but can load/save to files
                try {
                    const fs = await import('fs');
                    if (fs.existsSync(filePath)) {
                        const buffer = fs.readFileSync(filePath);
                        this.db = new this.sqlJsInstance.Database(buffer);
                        log.info('CONNECT', `Connected to SQLite database: ${filePath}`);
                    } else {
                        // Create new database
                        this.db = new this.sqlJsInstance.Database();
                        log.info('CONNECT', `Created new SQLite database: ${filePath}`);
                    }
                } catch {
                    // Browser environment or no file access - create in-memory
                    this.db = new this.sqlJsInstance.Database();
                    log.warning('FALLBACK', 'File access unavailable, using in-memory database');
                }
            }

            // Apply options
            this.applyOptions(this.config.options);

            // Enable WAL mode by default for file-based databases (better concurrency)
            // Only if not already configured and not in-memory
            if (filePath !== ':memory:' && !this.config.options?.walMode) {
                try {
                    this.db.run('PRAGMA journal_mode = WAL');
                    log.info('WAL', 'Enabled WAL mode for better concurrency');
                } catch {
                    // WAL mode may not be supported (e.g., sql.js limitations)
                }
            }

            this.connected = true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.error(ERROR_CODES.DB.CONNECT_FAILED, `Failed to connect to SQLite: ${message}`);
            throw new Error(`SQLite connection failed: ${message}`);
        }
    }

    /**
     * Apply SQLite PRAGMA options
     */
    private applyOptions(options?: SqliteOptions): void {
        if (!this.db || !options) return;

        if (options.walMode) {
            this.db.run('PRAGMA journal_mode = WAL');
        }
        if (options.foreignKeys !== undefined) {
            this.db.run(`PRAGMA foreign_keys = ${options.foreignKeys ? 'ON' : 'OFF'}`);
        }
        if (options.busyTimeout !== undefined) {
            this.db.run(`PRAGMA busy_timeout = ${options.busyTimeout}`);
        }
        if (options.cacheSize !== undefined) {
            this.db.run(`PRAGMA cache_size = ${options.cacheSize}`);
        }
    }

    /**
     * Disconnect from the database
     */
    override async disconnect(): Promise<void> {
        if (this.db) {
            // Save to file if configured
            if (this.config?.filePath && this.config.filePath !== ':memory:') {
                try {
                    const fs = await import('fs');
                    const data = this.db.export();
                    fs.writeFileSync(this.config.filePath, Buffer.from(data));
                    log.info('DISCONNECT', `Saved database to: ${this.config.filePath}`);
                } catch {
                    log.warning('SAVE_FAILED', 'Could not save database to file');
                }
            }

            this.db.close();
            this.db = null;
            this.connected = false;
            log.info('DISCONNECT', 'Disconnected from SQLite database');
        }
    }

    /**
     * Get database health status
     */
    override getHealth(): Promise<HealthStatus> {
        if (!this.db) {
            return Promise.resolve({ connected: false, error: 'Not connected' });
        }

        try {
            const start = Date.now();
            const result = this.db.exec('SELECT sqlite_version() as version');
            const latencyMs = Date.now() - start;

            const version = (result[0]?.values[0]?.[0] as string | undefined) ?? 'unknown';

            return Promise.resolve({
                connected: true,
                latencyMs,
                version,
                details: {
                    filePath: this.config?.filePath ?? ':memory:',
                    walMode: this.config?.options?.walMode ?? false
                }
            });
        } catch (error) {
            return Promise.resolve({
                connected: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Execute a read-only query
     */
    override executeReadQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.ensureConnected();
        this.validateQuery(sql, true);

        const db = this.ensureDb();
        const start = Date.now();

        try {
            const results = params
                ? db.exec(sql, params as (string | number | null | Uint8Array)[])
                : db.exec(sql);

            if (results.length === 0) {
                return Promise.resolve({ rows: [], executionTimeMs: Date.now() - start });
            }

            const firstResult = results[0];
            if (!firstResult) {
                return Promise.resolve({ rows: [], executionTimeMs: Date.now() - start });
            }

            const columns: ColumnInfo[] = firstResult.columns.map(name => ({ name, type: 'unknown' }));
            const rows = firstResult.values.map(row => {
                const obj: Record<string, unknown> = {};
                firstResult.columns.forEach((col, i) => {
                    obj[col] = row[i];
                });
                return obj;
            });

            return Promise.resolve({
                rows,
                columns,
                executionTimeMs: Date.now() - start
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.error(ERROR_CODES.DB.QUERY_FAILED, `Query failed: ${message}`);
            throw new Error(`Query execution failed: ${message}`);
        }
    }

    /**
     * Execute a write query
     */
    override executeWriteQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.ensureConnected();
        this.validateQuery(sql, false);

        const db = this.ensureDb();
        const start = Date.now();

        try {
            if (params) {
                db.run(sql, params as (string | number | null | Uint8Array)[]);
            } else {
                db.run(sql);
            }

            const changes = db.getRowsModified();

            return Promise.resolve({
                rowsAffected: changes,
                executionTimeMs: Date.now() - start
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.error(ERROR_CODES.DB.QUERY_FAILED, `Write query failed: ${message}`);
            throw new Error(`Write query failed: ${message}`);
        }
    }

    /**
     * Execute any query (for admin operations)
     */
    override executeQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.ensureConnected();

        const db = this.ensureDb();
        const start = Date.now();

        try {
            const results = params
                ? db.exec(sql, params as (string | number | null | Uint8Array)[])
                : db.exec(sql);

            if (results.length === 0) {
                return Promise.resolve({
                    rowsAffected: db.getRowsModified(),
                    executionTimeMs: Date.now() - start
                });
            }

            const firstResult = results[0];
            if (!firstResult) {
                return Promise.resolve({
                    rowsAffected: db.getRowsModified(),
                    executionTimeMs: Date.now() - start
                });
            }

            const rows = firstResult.values.map(row => {
                const obj: Record<string, unknown> = {};
                firstResult.columns.forEach((col, i) => {
                    obj[col] = row[i];
                });
                return obj;
            });

            return Promise.resolve({
                rows,
                executionTimeMs: Date.now() - start
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Query failed: ${message}`);
        }
    }

    /**
     * Get full database schema
     */
    override async getSchema(): Promise<SchemaInfo> {
        this.ensureConnected();

        const tables = await this.listTables();
        const indexes = await this.getIndexes();

        return { tables, indexes };
    }

    /**
     * List all tables
     */
    override async listTables(): Promise<TableInfo[]> {
        this.ensureConnected();

        const result = await this.executeReadQuery(
            `SELECT name, type FROM sqlite_master 
             WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
             ORDER BY name`
        );

        const tables: TableInfo[] = [];
        for (const row of result.rows ?? []) {
            const name = row['name'] as string;
            const type = row['type'] as 'table' | 'view';

            // Get column info
            const tableInfo = await this.describeTable(name);
            tables.push({ ...tableInfo, type });
        }

        return tables;
    }

    /**
     * Describe a table's structure
     */
    override async describeTable(tableName: string): Promise<TableInfo> {
        this.ensureConnected();

        // Validate table name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
            throw new Error('Invalid table name');
        }

        const result = await this.executeReadQuery(`PRAGMA table_info("${tableName}")`);

        const columns: ColumnInfo[] = (result.rows ?? []).map(row => ({
            name: row['name'] as string,
            type: row['type'] as string,
            nullable: row['notnull'] === 0,
            primaryKey: row['pk'] === 1,
            defaultValue: row['dflt_value']
        }));

        // Get row count
        const countResult = await this.executeReadQuery(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const rowCount = (countResult.rows?.[0]?.['count'] as number) ?? 0;

        return {
            name: tableName,
            type: 'table',
            columns,
            rowCount
        };
    }

    /**
     * List available schemas (SQLite has only 'main')
     */
    override listSchemas(): Promise<string[]> {
        return Promise.resolve(['main']);
    }

    /**
     * Get indexes, optionally for a specific table
     */
    async getIndexes(table?: string): Promise<IndexInfo[]> {
        let sql = `SELECT name, tbl_name, sql FROM sqlite_master 
             WHERE type = 'index' AND sql IS NOT NULL`;

        if (table) {
            sql += ` AND tbl_name = '${table.replace(/'/g, "''")}'`;
        }

        const result = await this.executeReadQuery(sql);

        return (result.rows ?? []).map(row => ({
            name: row['name'] as string,
            tableName: row['tbl_name'] as string,
            columns: [], // Would need to parse SQL to get columns
            unique: (row['sql'] as string)?.includes('UNIQUE') ?? false
        }));
    }

    /**
     * Get adapter capabilities
     */
    override getCapabilities(): AdapterCapabilities {
        return {
            json: true,
            fullTextSearch: true, // FTS5 support
            vector: true, // Custom implementation
            geospatial: false, // SpatiaLite not bundled
            transactions: true,
            preparedStatements: true,
            connectionPooling: false // sql.js is single-connection
        };
    }

    /**
     * Get supported tool groups
     */
    override getSupportedToolGroups(): ToolGroup[] {
        return ['core', 'json', 'text', 'stats', 'vector', 'admin'];
    }

    /**
     * Get all tool definitions
     */
    override getToolDefinitions(): ToolDefinition[] {
        return getAllToolDefinitions(this);
    }

    /**
     * Get resource definitions
     */
    override getResourceDefinitions(): ResourceDefinition[] {
        return getResourceDefinitions(this);
    }

    /**
     * Get prompt definitions
     */
    override getPromptDefinitions(): PromptDefinition[] {
        return getPromptDefinitions(this);
    }

    /**
     * Get adapter info for metadata resource
     */
    override getInfo(): { type: string; name: string; version: string; connected: boolean } {
        return {
            type: this.type,
            name: this.name,
            version: this.version,
            connected: this.connected
        };
    }

    /**
     * Register a single tool with the MCP server
     */
    protected override registerTool(server: McpServer, tool: ToolDefinition): void {
        // MCP SDK server.tool() registration
        // Extract the Zod shape from inputSchema for MCP SDK compatibility
        // The SDK expects ZodRawShapeCompat (e.g., {name: z.string()})
        const inputSchema = tool.inputSchema as { shape?: Record<string, unknown> } | undefined;
        const zodShape = inputSchema?.shape ?? {};

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        server.tool(
            tool.name,
            tool.description,
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            zodShape as Parameters<typeof server.tool>[2],  // Cast for type compatibility
            async (params: unknown) => {
                const context = this.createContext();
                const result = await tool.handler(params, context);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
                };
            }
        );
    }

    /**
     * Register a single resource with the MCP server
     */
    protected override registerResource(server: McpServer, resource: ResourceDefinition): void {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        server.resource(
            resource.name,
            resource.uri,
            { mimeType: resource.mimeType ?? 'application/json', description: resource.description },
            async (resourceUri: URL) => {
                const context = this.createContext();
                const content = await resource.handler(resourceUri.toString(), context);
                return {
                    contents: [{
                        uri: resourceUri.toString(),
                        mimeType: resource.mimeType ?? 'application/json',
                        text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
                    }]
                };
            }
        );
    }

    /**
     * Register a single prompt with the MCP server
     */
    protected override registerPrompt(server: McpServer, prompt: PromptDefinition): void {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        server.prompt(
            prompt.name,
            prompt.description,
            {}, // MCP SDK expects Zod schema, use empty object for no-arg prompts
            async (args: Record<string, string>) => {
                const context = this.createContext();
                const result = await prompt.handler(args, context);
                // Type-safe message construction
                const messages: { role: 'user' | 'assistant'; content: { type: 'text'; text: string } }[] =
                    Array.isArray(result)
                        ? result as { role: 'user' | 'assistant'; content: { type: 'text'; text: string } }[]
                        : [{ role: 'assistant' as const, content: { type: 'text' as const, text: typeof result === 'string' ? result : JSON.stringify(result) } }];
                return { messages };
            }
        );
    }

    /**
     * Ensure database is connected
     */
    private ensureConnected(): void {
        if (!this.db || !this.connected) {
            throw new Error('Not connected to database');
        }
    }

    /**
     * Ensure database is connected and return the database instance
     */
    private ensureDb(): Database {
        if (!this.db || !this.connected) {
            throw new Error('Not connected to database');
        }
        return this.db;
    }

    /**
     * Get the raw database instance (for tools)
     */
    getDatabase(): Database {
        return this.ensureDb();
    }

    /**
     * Execute raw SQL and return results (for tools)
     */
    rawQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        return this.executeQuery(sql, params);
    }
}

// Factory function
export function createSqliteAdapter(): SqliteAdapter {
    return new SqliteAdapter();
}

