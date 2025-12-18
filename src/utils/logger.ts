/**
 * db-mcp - Structured Logger
 * 
 * Centralized logging utility with RFC 5424 severity levels and structured output.
 * Supports dual-mode logging: stderr for local debugging and MCP protocol notifications.
 * 
 * Format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}
 * Example: [2025-12-18T01:30:00Z] [ERROR] [DB] [CONNECT_FAILED] Failed to connect {"host":"localhost"}
 */

// =============================================================================
// Types
// =============================================================================

/**
 * RFC 5424 syslog severity levels
 * @see https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1
 */
export type LogLevel =
    | 'debug'       // 7 - Debug-level messages
    | 'info'        // 6 - Informational messages
    | 'notice'      // 5 - Normal but significant condition
    | 'warning'     // 4 - Warning conditions
    | 'error'       // 3 - Error conditions
    | 'critical'    // 2 - Critical conditions
    | 'alert'       // 1 - Action must be taken immediately
    | 'emergency';  // 0 - System is unusable

/**
 * Module identifiers for log categorization
 */
export type LogModule =
    | 'SERVER'      // MCP server lifecycle
    | 'ADAPTER'     // Database adapter operations
    | 'AUTH'        // OAuth/authentication
    | 'TOOLS'       // Tool execution
    | 'RESOURCES'   // Resource handlers
    | 'PROMPTS'     // Prompt handlers
    | 'TRANSPORT'   // HTTP/SSE/stdio transport
    | 'QUERY'       // SQL query execution
    | 'POOL'        // Connection pool
    | 'FILTER'      // Tool filtering
    | 'SQLITE'      // SQLite-specific
    | 'DB'          // Generic database
    | 'CLI';        // Command line interface

/**
 * Structured log context following MCP logging standards
 */
export interface LogContext {
    /** Module identifier */
    module?: LogModule | undefined;
    /** Module-prefixed error/event code (e.g., DB_CONNECT_FAILED) */
    code?: string | undefined;
    /** Operation being performed (e.g., executeQuery, connect) */
    operation?: string | undefined;
    /** Entity identifier (e.g., table name, connection id) */
    entityId?: string | undefined;
    /** Request identifier for tracing */
    requestId?: string | undefined;
    /** Error stack trace */
    stack?: string | undefined;
    /** Error object (stack extracted automatically) */
    error?: Error | undefined;
    /** Additional context fields */
    [key: string]: unknown;
}

/**
 * Module-prefixed error code
 */
export interface ErrorCode {
    /** Module prefix (e.g., 'AUTH', 'DB', 'SERVER') */
    module: string;
    /** Error code suffix (e.g., 'TOKEN_INVALID', 'CONNECT_FAILED') */
    code: string;
    /** Full code string (e.g., 'AUTH_TOKEN_INVALID') */
    full: string;
}

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Create a module-prefixed error code
 */
export function createErrorCode(module: string, code: string): ErrorCode {
    return {
        module: module.toUpperCase(),
        code: code.toUpperCase(),
        full: `${module.toUpperCase()}_${code.toUpperCase()}`
    };
}

/**
 * Common error codes by module
 */
export const ERROR_CODES = {
    // Auth module
    AUTH: {
        TOKEN_INVALID: createErrorCode('AUTH', 'TOKEN_INVALID'),
        TOKEN_EXPIRED: createErrorCode('AUTH', 'TOKEN_EXPIRED'),
        TOKEN_MISSING: createErrorCode('AUTH', 'TOKEN_MISSING'),
        SIGNATURE_INVALID: createErrorCode('AUTH', 'SIGNATURE_INVALID'),
        SCOPE_DENIED: createErrorCode('AUTH', 'SCOPE_DENIED'),
        DISCOVERY_FAILED: createErrorCode('AUTH', 'DISCOVERY_FAILED'),
        JWKS_FETCH_FAILED: createErrorCode('AUTH', 'JWKS_FETCH_FAILED'),
        REGISTRATION_FAILED: createErrorCode('AUTH', 'REGISTRATION_FAILED')
    },
    // Server module
    SERVER: {
        START_FAILED: createErrorCode('SERVER', 'START_FAILED'),
        SHUTDOWN_FAILED: createErrorCode('SERVER', 'SHUTDOWN_FAILED'),
        TRANSPORT_ERROR: createErrorCode('SERVER', 'TRANSPORT_ERROR')
    },
    // Database module
    DB: {
        CONNECT_FAILED: createErrorCode('DB', 'CONNECT_FAILED'),
        QUERY_FAILED: createErrorCode('DB', 'QUERY_FAILED'),
        DISCONNECT_FAILED: createErrorCode('DB', 'DISCONNECT_FAILED'),
        ADAPTER_NOT_FOUND: createErrorCode('DB', 'ADAPTER_NOT_FOUND')
    }
} as const;

// =============================================================================
// Logger Class
// =============================================================================

/**
 * RFC 5424 severity priority (lower number = higher severity)
 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
    emergency: 0,
    alert: 1,
    critical: 2,
    error: 3,
    warning: 4,
    notice: 5,
    info: 6,
    debug: 7
};

/**
 * Sensitive keys to redact from context objects
 * Includes OAuth 2.1 configuration fields that may contain sensitive data
 */
const SENSITIVE_KEYS = new Set([
    // Authentication credentials
    'password',
    'secret',
    'token',
    'authorization',
    'apikey',
    'api_key',
    'accesstoken',
    'access_token',
    'refreshtoken',
    'refresh_token',
    'credential',
    'credentials',
    'client_secret',
    'clientsecret',
    // OAuth 2.1 configuration (may expose auth infrastructure)
    'issuer',
    'audience',
    'jwksuri',
    'jwks_uri',
    'authorizationserverurl',
    'authorization_server_url',
    'bearerformat',
    'bearer_format',
    'oauthconfig',
    'oauth_config',
    'oauth',
    'scopes_supported',
    'scopessupported'
]);

/**
 * Sanitize context by redacting sensitive values
 */
function sanitizeContext(context: LogContext): LogContext {
    const result: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
        // Skip internal fields
        if (key === 'error') continue;

        const lowerKey = key.toLowerCase();
        const isSensitive = SENSITIVE_KEYS.has(lowerKey) ||
            [...SENSITIVE_KEYS].some(k => lowerKey.includes(k));

        if (isSensitive && value !== undefined && value !== null) {
            result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result[key] = sanitizeContext(value as LogContext);
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Sanitize message to prevent log injection
 * Removes newlines, carriage returns, and all control characters
 */
function sanitizeMessage(message: string): string {
    // Remove newlines and all control characters to prevent log injection/forging
    // eslint-disable-next-line no-control-regex -- Intentionally matching control characters for security
    return message.replace(/[\x00-\x1F\x7F]/g, ' ');
}

/**
 * Sanitize stack trace to prevent log injection
 * Preserves structure but removes dangerous control characters
 */
function sanitizeStack(stack: string): string {
    // Replace newlines with a safe delimiter, remove other control characters
    return stack
        .replace(/\r\n|\r|\n/g, ' \u2192 ')  // Replace newlines with arrow separator
        // eslint-disable-next-line no-control-regex -- Intentionally matching control characters for security
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');  // Remove other control chars
}

/**
 * MCP-aware structured logger with dual-mode output
 * 
 * Follows MCP Server Logging Standards:
 * - Centralized logger writing to stderr only (stdout reserved for MCP protocol)
 * - Include: module, operation, entityId, context, stack traces
 * - Module-prefixed codes (e.g., DB_CONNECT_FAILED, AUTH_TOKEN_INVALID)
 * - Severity: RFC 5424 levels
 * - Format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}
 */
export class Logger {
    private minLevel: LogLevel = 'info';
    private loggerName = 'db-mcp';
    private defaultModule: LogModule = 'SERVER';
    private includeStacks = true;

    /**
     * Set the minimum log level
     */
    setLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    /**
     * Get the current minimum log level
     */
    getLevel(): LogLevel {
        return this.minLevel;
    }

    /**
     * Set the logger name
     */
    setLoggerName(name: string): void {
        this.loggerName = name;
    }

    /**
     * Get the logger name
     */
    getLoggerName(): string {
        return this.loggerName;
    }

    /**
     * Set the default module for logs without explicit module
     */
    setDefaultModule(module: LogModule): void {
        this.defaultModule = module;
    }

    /**
     * Enable/disable stack traces for errors
     */
    setIncludeStacks(include: boolean): void {
        this.includeStacks = include;
    }

    private shouldLog(level: LogLevel): boolean {
        return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[this.minLevel];
    }

    /**
     * Format log entry according to MCP logging standard
     * Format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}
     */
    private formatEntry(
        level: LogLevel,
        module: LogModule,
        code: string | undefined,
        message: string,
        context?: LogContext
    ): string {
        const parts: string[] = [
            `[${new Date().toISOString()}]`,
            `[${level.toUpperCase()}]`,
            `[${module}]`
        ];

        // Add code if present
        if (code) {
            parts.push(`[${code}]`);
        }

        // Add sanitized message
        parts.push(sanitizeMessage(message));

        // Add context if present (excluding module, code, error which are handled separately)
        if (context) {
            const { module, code, error, stack, ...restContext } = context;
            void module; void code; void error; void stack; // Intentionally unused - handled separately
            if (Object.keys(restContext).length > 0) {
                const sanitizedContext = sanitizeContext(restContext);
                parts.push(JSON.stringify(sanitizedContext));
            }
        }

        return parts.join(' ');
    }

    /**
     * Core logging method
     */
    private log(level: LogLevel, message: string, context?: LogContext): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const module = context?.module ?? this.defaultModule;
        const code = context?.code;

        // Format entry with full sanitization applied
        const formatted = this.formatEntry(level, module, code, message, context);

        // Write sanitized output to stderr to avoid interfering with MCP stdio transport
        // All sensitive data has been redacted by sanitizeContext() in formatEntry()
        // All control characters removed by sanitizeMessage() to prevent log injection
        console.error(formatted);

        // Stack trace for errors (also sanitized to prevent log injection)
        if (this.includeStacks && (level === 'error' || level === 'critical' || level === 'alert' || level === 'emergency')) {
            const stack = context?.stack ?? context?.error?.stack;
            if (stack) {
                // Sanitize stack to remove newlines and control characters (prevents log injection)
                const sanitizedStack = sanitizeStack(stack);
                console.error(`  Stack: ${sanitizedStack}`);
            }
        }
    }

    // =========================================================================
    // Convenience methods for each log level
    // =========================================================================

    debug(message: string, context?: LogContext): void {
        this.log('debug', message, context);
    }

    info(message: string, context?: LogContext): void {
        this.log('info', message, context);
    }

    notice(message: string, context?: LogContext): void {
        this.log('notice', message, context);
    }

    warn(message: string, context?: LogContext): void {
        this.log('warning', message, context);
    }

    warning(message: string, context?: LogContext): void {
        this.log('warning', message, context);
    }

    error(message: string, context?: LogContext): void {
        this.log('error', message, context);
    }

    critical(message: string, context?: LogContext): void {
        this.log('critical', message, context);
    }

    alert(message: string, context?: LogContext): void {
        this.log('alert', message, context);
    }

    emergency(message: string, context?: LogContext): void {
        this.log('emergency', message, context);
    }

    // =========================================================================
    // Module-scoped logging helpers
    // =========================================================================

    /**
     * Create a child logger scoped to a specific module
     */
    forModule(module: LogModule): ModuleLogger {
        return new ModuleLogger(this, module);
    }

    /**
     * Create a child logger (alias for forModule)
     */
    child(module: string): ModuleLogger {
        return new ModuleLogger(this, module as LogModule);
    }
}

/**
 * Module-scoped logger for cleaner code in specific modules
 */
export class ModuleLogger {
    constructor(
        private parent: Logger,
        private module: LogModule
    ) { }

    private withModule(context?: LogContext): LogContext {
        return { ...context, module: this.module };
    }

    debug(message: string, context?: LogContext): void {
        this.parent.debug(message, this.withModule(context));
    }

    info(message: string, context?: LogContext): void {
        this.parent.info(message, this.withModule(context));
    }

    notice(message: string, context?: LogContext): void {
        this.parent.notice(message, this.withModule(context));
    }

    warn(message: string, context?: LogContext): void {
        this.parent.warn(message, this.withModule(context));
    }

    warning(message: string, context?: LogContext): void {
        this.parent.warning(message, this.withModule(context));
    }

    error(message: string, context?: LogContext): void {
        this.parent.error(message, this.withModule(context));
    }

    critical(message: string, context?: LogContext): void {
        this.parent.critical(message, this.withModule(context));
    }

    alert(message: string, context?: LogContext): void {
        this.parent.alert(message, this.withModule(context));
    }

    emergency(message: string, context?: LogContext): void {
        this.parent.emergency(message, this.withModule(context));
    }
}

// =============================================================================
// Default Logger Instance
// =============================================================================

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a module-specific logger
 */
export function createModuleLogger(module: string): ModuleLogger {
    return logger.child(module);
}

// Initialize log level from environment
const envLevel = process.env['LOG_LEVEL']?.toLowerCase();
if (envLevel && envLevel in LEVEL_PRIORITY) {
    logger.setLevel(envLevel as LogLevel);
}
