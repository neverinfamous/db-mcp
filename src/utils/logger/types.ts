/**
 * Logger Types
 *
 * Type definitions for the structured logging system.
 */

/**
 * RFC 5424 syslog severity levels
 * @see https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1
 */
export type LogLevel =
  | "debug" // 7 - Debug-level messages
  | "info" // 6 - Informational messages
  | "notice" // 5 - Normal but significant condition
  | "warning" // 4 - Warning conditions
  | "error" // 3 - Error conditions
  | "critical" // 2 - Critical conditions
  | "alert" // 1 - Action must be taken immediately
  | "emergency"; // 0 - System is unusable

/**
 * Module identifiers for log categorization
 */
export type LogModule =
  | "SERVER" // MCP server lifecycle
  | "ADAPTER" // Database adapter operations
  | "AUTH" // OAuth/authentication
  | "TOOLS" // Tool execution
  | "RESOURCES" // Resource handlers
  | "PROMPTS" // Prompt handlers
  | "TRANSPORT" // HTTP/SSE/stdio transport
  | "QUERY" // SQL query execution
  | "POOL" // Connection pool
  | "FILTER" // Tool filtering
  | "SQLITE" // SQLite-specific
  | "NATIVE_SQLITE" // Native better-sqlite3
  | "HTTP" // HTTP transport
  | "DB" // Generic database
  | "CLI" // Command line interface
  | "CODEMODE"; // Sandboxed code execution

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
