/**
 * db-mcp - Centralized Logger
 * 
 * Structured logging with module-prefixed error codes,
 * severity levels, and contextual payloads.
 * 
 * Format: [LEVEL] [module] [CODE] message (context)
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Log severity levels
 */
export type LogLevel = 'error' | 'warning' | 'info';

/**
 * Structured log payload
 */
export interface LogPayload {
    /** Module name (e.g., 'AUTH', 'SERVER', 'SQLITE') */
    module: string;

    /** Operation being performed */
    operation: string;

    /** Entity identifier (e.g., token ID, database name) */
    entityId?: string | undefined;

    /** Additional context */
    context?: Record<string, unknown> | undefined;

    /** Error object if applicable */
    error?: Error | undefined;

    /** Stack trace (auto-extracted from error if provided) */
    stack?: string | undefined;
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
// Security Utilities
// =============================================================================

/**
 * Patterns for sensitive data fields that should be redacted in logs
 */
const SENSITIVE_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /auth/i,
    /credential/i,
    /bearer/i,
    /api[-_]?key/i,
    /private/i,
    /session/i,
    /cookie/i
];

/**
 * Check if a key name matches sensitive data patterns
 */
function isSensitiveKey(key: string): boolean {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Redact sensitive data from an object for safe logging.
 * Replaces values of sensitive keys with '[REDACTED]'.
 */
function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
        if (isSensitiveKey(key)) {
            redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            redacted[key] = redactSensitiveData(value as Record<string, unknown>);
        } else if (Array.isArray(value)) {
            redacted[key] = value.map((item: unknown): unknown =>
                typeof item === 'object' && item !== null
                    ? redactSensitiveData(item as Record<string, unknown>)
                    : item
            );
        } else {
            redacted[key] = value;
        }
    }

    return redacted;
}

// =============================================================================
// Logger Class
// =============================================================================

/**
 * Logger configuration
 */
export interface LoggerConfig {
    /** Minimum log level to output */
    minLevel?: LogLevel;

    /** Whether to include timestamps */
    timestamps?: boolean;

    /** Whether to include stack traces for errors */
    includeStacks?: boolean;

    /** Custom output function (defaults to console.error) */
    output?: (message: string) => void;
}

/**
 * Centralized logger with structured payloads
 */
export class Logger {
    private readonly config: Required<LoggerConfig>;
    private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
        error: 0,
        warning: 1,
        info: 2
    };

    constructor(config: LoggerConfig = {}) {
        this.config = {
            minLevel: config.minLevel ?? 'info',
            timestamps: config.timestamps ?? true,
            includeStacks: config.includeStacks ?? true,
            output: config.output ?? console.error.bind(console)
        };
    }

    /**
     * Log an error message
     */
    error(module: string, code: string | ErrorCode, message: string, payload?: Partial<LogPayload>): void {
        this.log('error', module, code, message, payload);
    }

    /**
     * Log a warning message
     */
    warning(module: string, code: string | ErrorCode, message: string, payload?: Partial<LogPayload>): void {
        this.log('warning', module, code, message, payload);
    }

    /**
     * Log an info message
     */
    info(module: string, code: string | ErrorCode, message: string, payload?: Partial<LogPayload>): void {
        this.log('info', module, code, message, payload);
    }

    /**
     * Core logging method
     */
    private log(
        level: LogLevel,
        module: string,
        code: string | ErrorCode,
        message: string,
        payload?: Partial<LogPayload>
    ): void {
        // Check if level should be logged
        if (Logger.LEVEL_PRIORITY[level] > Logger.LEVEL_PRIORITY[this.config.minLevel]) {
            return;
        }

        // Normalize code
        const codeStr = typeof code === 'string' ? code : code.full;

        // Build log parts - only trusted, non-user-controlled data here
        const trustedParts: string[] = [];

        // Timestamp - trusted (system generated)
        if (this.config.timestamps) {
            trustedParts.push(`[${new Date().toISOString()}]`);
        }

        // Level - trusted (internal enum)
        trustedParts.push(`[${level.toUpperCase()}]`);

        // Module - trusted (internal string from code)
        trustedParts.push(`[${module.toUpperCase()}]`);

        // Code - trusted (internal string/ErrorCode from code)
        trustedParts.push(`[${codeStr}]`);

        // Build the trusted prefix (no user data)
        const trustedPrefix = trustedParts.join(' ');

        // Sanitize message - apply sanitization inline with .replace() that CodeQL recognizes
        // This breaks the taint chain by explicitly sanitizing user-controlled input
        const sanitizedMessage = message
            .replace(/[\r\n]/g, ' ')  // Remove newlines to prevent log injection
            // eslint-disable-next-line no-control-regex -- Intentionally matching control characters for security
            .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

        // Build the final log line
        let logLine = `${trustedPrefix} ${sanitizedMessage}`;

        // Context handling - redact sensitive data and sanitize
        if (payload?.context && Object.keys(payload.context).length > 0) {
            const redactedContext = redactSensitiveData(payload.context);
            const contextStr = JSON.stringify(redactedContext)
                .replace(/[\r\n]/g, ' ')  // Remove newlines to prevent log injection
                // eslint-disable-next-line no-control-regex -- Intentionally matching control characters for security
                .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
            logLine += ` (${contextStr})`;
        }

        // Output the sanitized log line
        this.config.output(logLine);

        // Stack trace for errors
        if (this.config.includeStacks && level === 'error') {
            const stack = payload?.stack ?? payload?.error?.stack;
            if (stack) {
                // Sanitize stack trace - remove only dangerous control characters
                // Keep newlines as they're structural in stack traces
                // eslint-disable-next-line no-control-regex -- Intentionally matching control characters for security
                const sanitizedStack = stack.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                this.config.output(`  Stack: ${sanitizedStack}`);
            }
        }
    }

    /**
     * Create a child logger with a fixed module prefix
     */
    child(module: string): ModuleLogger {
        return new ModuleLogger(this, module);
    }
}

/**
 * Module-scoped logger (child of main logger)
 */
export class ModuleLogger {
    constructor(
        private readonly parent: Logger,
        private readonly module: string
    ) { }

    error(code: string | ErrorCode, message: string, payload?: Partial<LogPayload>): void {
        this.parent.error(this.module, code, message, payload);
    }

    warning(code: string | ErrorCode, message: string, payload?: Partial<LogPayload>): void {
        this.parent.warning(this.module, code, message, payload);
    }

    info(code: string | ErrorCode, message: string, payload?: Partial<LogPayload>): void {
        this.parent.info(this.module, code, message, payload);
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
