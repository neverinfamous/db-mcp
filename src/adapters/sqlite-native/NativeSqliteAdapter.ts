/**
 * Native SQLite Adapter using better-sqlite3
 * 
 * Provides synchronous, native SQLite access with full FTS5, window functions,
 * and SpatiaLite support.
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { DatabaseAdapter } from '../DatabaseAdapter.js';
import type {
    DatabaseConfig,
    DatabaseType as DbType,
    HealthStatus,
    QueryResult,
    SchemaInfo,
    TableInfo,
    AdapterCapabilities,
    ToolDefinition,
    ResourceDefinition,
    PromptDefinition,
    ToolGroup
} from '../../types/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger, ERROR_CODES } from '../../utils/logger.js';
import type { SqliteConfig, SqliteOptions } from '../sqlite/types.js';
import type { SqliteAdapter } from '../sqlite/SqliteAdapter.js';

// Import shared tools from sql.js adapter
import { getCoreTools } from '../sqlite/tools/core.js';
import { getJsonOperationTools } from '../sqlite/tools/json-operations.js';
import { getJsonHelperTools } from '../sqlite/tools/json-helpers.js';
import { getTextTools } from '../sqlite/tools/text.js';
import { getFtsTools } from '../sqlite/tools/fts.js';
import { getStatsTools } from '../sqlite/tools/stats.js';
import { getVirtualTools } from '../sqlite/tools/virtual.js';
import { getVectorTools } from '../sqlite/tools/vector.js';
import { getGeoTools } from '../sqlite/tools/geo.js';
import { getAdminTools } from '../sqlite/tools/admin.js';
import { getResourceDefinitions } from '../sqlite/resources.js';
import { getPromptDefinitions } from '../sqlite/prompts.js';

// Import native-specific tools
import { getTransactionTools } from './tools/transactions.js';
import { getWindowTools } from './tools/window.js';

const log = logger.child('NATIVE_SQLITE');

/**
 * Native SQLite Adapter using better-sqlite3
 */
export class NativeSqliteAdapter extends DatabaseAdapter {
    readonly type: DbType = 'sqlite';
    readonly name = 'Native SQLite Adapter (better-sqlite3)';
    readonly version = '1.0.0';

    private db: DatabaseType | null = null;

    /**
     * Connect to a SQLite database using better-sqlite3
     */
    override connect(config: DatabaseConfig): Promise<void> {
        if (config.type !== 'sqlite') {
            throw new Error(`Invalid database type: expected 'sqlite', got '${config.type}'`);
        }

        const sqliteConfig = config as SqliteConfig;
        this.config = sqliteConfig;

        try {
            const filePath = sqliteConfig.filePath ?? sqliteConfig.connectionString ?? ':memory:';

            // Create database connection
            this.db = new Database(filePath, {
                readonly: false,
                fileMustExist: false
            });

            log.info(`Connected to SQLite database (native): ${filePath}`, { code: 'SQLITE_CONNECT' });

            // Apply options
            this.applyOptions(sqliteConfig.options);

            // Enable WAL mode by default for file-based databases
            if (filePath !== ':memory:' && !sqliteConfig.options?.walMode) {
                try {
                    this.db.pragma('journal_mode = WAL');
                    log.info('Enabled WAL mode for better concurrency', { code: 'SQLITE_WAL' });
                } catch {
                    // WAL mode may not be available
                }
            }

            this.connected = true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.error(`Failed to connect to native SQLite: ${message}`, { code: ERROR_CODES.DB.CONNECT_FAILED.full });
            throw new Error(`Native SQLite connection failed: ${message}`);
        }

        return Promise.resolve();
    }

    /**
     * Apply SQLite PRAGMA options
     */
    private applyOptions(options?: SqliteOptions): void {
        if (!this.db || !options) return;

        if (options.walMode) {
            this.db.pragma('journal_mode = WAL');
        }
        if (options.foreignKeys !== undefined) {
            this.db.pragma(`foreign_keys = ${options.foreignKeys ? 'ON' : 'OFF'}`);
        }
        if (options.busyTimeout !== undefined) {
            this.db.pragma(`busy_timeout = ${options.busyTimeout}`);
        }
        if (options.cacheSize !== undefined) {
            this.db.pragma(`cache_size = ${options.cacheSize}`);
        }
        if (options.spatialite) {
            try {
                this.db.loadExtension('mod_spatialite');
                log.info('Loaded SpatiaLite extension', { code: 'SQLITE_EXTENSION' });
            } catch {
                log.warning('SpatiaLite extension not available', { code: 'SQLITE_EXTENSION' });
            }
        }
    }

    /**
     * Disconnect from the database
     */
    override disconnect(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.connected = false;
            log.info('Disconnected from native SQLite database', { code: 'SQLITE_DISCONNECT' });
        }
        return Promise.resolve();
    }

    /**
     * Get health status
     */
    override getHealth(): Promise<HealthStatus> {
        if (!this.db || !this.connected) {
            return Promise.resolve({
                connected: false,
                latencyMs: 0
            });
        }

        const start = Date.now();
        try {
            this.db.prepare('SELECT 1').get();
            return Promise.resolve({
                connected: true,
                latencyMs: Date.now() - start,
                details: {
                    backend: 'better-sqlite3',
                    fts5: this.hasFts5(),
                    spatialite: false
                }
            });
        } catch {
            return Promise.resolve({
                connected: false,
                latencyMs: Date.now() - start
            });
        }
    }

    /**
     * Check if FTS5 is available
     */
    private hasFts5(): boolean {
        if (!this.db) return false;
        try {
            this.db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_test USING fts5(content)');
            this.db.exec('DROP TABLE IF EXISTS _fts5_test');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Execute a read query
     */
    override executeReadQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.ensureConnected();
        const start = Date.now();

        try {
            const db = this.ensureDb();
            const stmt = db.prepare(sql);
            const rows = params ? stmt.all(...params) : stmt.all();

            return Promise.resolve({
                rows: rows as Record<string, unknown>[],
                columns: stmt.columns().map(c => ({ name: c.name, type: c.type ?? 'unknown' })),
                executionTimeMs: Date.now() - start
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Query failed: ${message}`);
        }
    }

    /**
     * Execute a write query
     */
    override executeWriteQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.ensureConnected();
        const start = Date.now();

        try {
            const db = this.ensureDb();
            const stmt = db.prepare(sql);
            const info = params ? stmt.run(...params) : stmt.run();

            return Promise.resolve({
                rows: [],
                rowsAffected: info.changes,
                executionTimeMs: Date.now() - start
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Write query failed: ${message}`);
        }
    }

    /**
     * Execute any query
     */
    override executeQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN')) {
            return this.executeReadQuery(sql, params);
        }
        return this.executeWriteQuery(sql, params);
    }

    /**
     * Get schema information
     */
    override async getSchema(): Promise<SchemaInfo> {
        this.ensureConnected();
        const tables = await this.listTables();

        return {
            tables,
            indexes: [],
            views: []
        };
    }

    /**
     * List all tables
     */
    override listTables(): Promise<TableInfo[]> {
        this.ensureConnected();

        const db = this.ensureDb();
        const result = db.prepare(`
            SELECT name, type, sql 
            FROM sqlite_master 
            WHERE type IN ('table', 'view') 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `).all() as { name: string; type: string; sql: string }[];

        return Promise.resolve(result.map(row => ({
            name: row.name,
            type: row.type as 'table' | 'view',
            columns: []
        })));
    }

    /**
     * Describe a table
     */
    override describeTable(tableName: string): Promise<TableInfo> {
        this.ensureConnected();

        const db = this.ensureDb();
        const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as {
            name: string;
            type: string;
            notnull: number;
            pk: number;
        }[];

        return Promise.resolve({
            name: tableName,
            type: 'table',
            columns: columns.map(c => ({
                name: c.name,
                type: c.type,
                nullable: c.notnull === 0 ? true : false,
                primaryKey: c.pk > 0 ? true : false
            }))
        });
    }

    /**
     * List schemas (SQLite only has one)
     */
    override listSchemas(): Promise<string[]> {
        return Promise.resolve(['main']);
    }

    /**
     * Get capabilities
     */
    override getCapabilities(): AdapterCapabilities {
        return {
            json: true,
            fullTextSearch: true,
            vector: true,
            geospatial: true,
            transactions: true,
            preparedStatements: true,
            connectionPooling: false, // better-sqlite3 is single-connection
            windowFunctions: true,
            spatialite: true
        };
    }

    /**
     * Get supported tool groups
     */
    override getSupportedToolGroups(): ToolGroup[] {
        return ['core', 'json', 'text', 'stats', 'performance', 'vector', 'geo', 'backup', 'monitoring', 'admin'];
    }

    /**
     * Get all tool definitions
     */
    override getToolDefinitions(): ToolDefinition[] {
        // Type assertion needed due to interface compatibility
        const self = this as unknown as SqliteAdapter;
        return [
            ...getCoreTools(self),
            ...getJsonOperationTools(self),
            ...getJsonHelperTools(self),
            ...getTextTools(self),
            ...getFtsTools(self),
            ...getStatsTools(self),
            ...getVirtualTools(self),
            ...getVectorTools(self),
            ...getGeoTools(self),
            ...getAdminTools(self),
            // Native-only tools
            ...getTransactionTools(this),
            ...getWindowTools(this)
        ];
    }

    /**
     * Get resource definitions
     */
    override getResourceDefinitions(): ResourceDefinition[] {
        return getResourceDefinitions(this as unknown as SqliteAdapter);
    }

    /**
     * Get prompt definitions
     */
    override getPromptDefinitions(): PromptDefinition[] {
        return getPromptDefinitions(this as unknown as SqliteAdapter);
    }

    /**
     * Register a tool with the MCP server
     */
    protected override registerTool(server: McpServer, tool: ToolDefinition): void {
        const inputSchema = tool.inputSchema as { shape?: Record<string, unknown> } | undefined;
        const zodShape = inputSchema?.shape ?? {};

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        server.tool(
            tool.name,
            tool.description,
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            zodShape as Parameters<typeof server.tool>[2],
            async (params: unknown) => {
                const result = await tool.handler(params, { timestamp: new Date(), requestId: crypto.randomUUID() });
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
                };
            }
        );
    }

    /**
     * Register a resource with the MCP server
     */
    protected override registerResource(server: McpServer, resource: ResourceDefinition): void {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        server.resource(
            resource.name,
            resource.uri,
            { mimeType: resource.mimeType ?? 'application/json', description: resource.description },
            async (resourceUri: URL) => {
                const content = await resource.handler(resourceUri.toString(), { timestamp: new Date(), requestId: crypto.randomUUID() });
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
     * Register a prompt with the MCP server
     */
    protected override registerPrompt(server: McpServer, prompt: PromptDefinition): void {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        server.prompt(
            prompt.name,
            prompt.description,
            {},
            async (args: Record<string, string>) => {
                const result = await prompt.handler(args, { timestamp: new Date(), requestId: crypto.randomUUID() });
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
     * Ensure database is connected and return database instance
     */
    private ensureDb(): DatabaseType {
        if (!this.db || !this.connected) {
            throw new Error('Not connected to database');
        }
        return this.db;
    }

    /**
     * Get the raw database instance (for tools)
     */
    getDatabase(): DatabaseType {
        return this.ensureDb();
    }

    /**
     * Execute raw SQL and return results (for tools)
     */
    rawQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        return this.executeQuery(sql, params);
    }

    /**
     * Begin a transaction
     */
    beginTransaction(): void {
        const db = this.ensureDb();
        db.exec('BEGIN TRANSACTION');
    }

    /**
     * Commit a transaction
     */
    commitTransaction(): void {
        const db = this.ensureDb();
        db.exec('COMMIT');
    }

    /**
     * Rollback a transaction
     */
    rollbackTransaction(): void {
        const db = this.ensureDb();
        db.exec('ROLLBACK');
    }

    /**
     * Create a savepoint
     */
    savepoint(name: string): void {
        const db = this.ensureDb();
        db.exec(`SAVEPOINT "${name}"`);
    }

    /**
     * Release a savepoint
     */
    releaseSavepoint(name: string): void {
        const db = this.ensureDb();
        db.exec(`RELEASE SAVEPOINT "${name}"`);
    }

    /**
     * Rollback to a savepoint
     */
    rollbackToSavepoint(name: string): void {
        const db = this.ensureDb();
        db.exec(`ROLLBACK TO SAVEPOINT "${name}"`);
    }
}

// Factory function
export function createNativeSqliteAdapter(): NativeSqliteAdapter {
    return new NativeSqliteAdapter();
}
