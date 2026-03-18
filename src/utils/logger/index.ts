/**
 * db-mcp - Structured Logger (barrel export)
 *
 * Re-exports all logger sub-modules for backward-compatible imports.
 * Consumer import path changes from `../utils/logger.js` to `../utils/logger/index.js`.
 */

// Types
export type { LogLevel, LogModule, LogContext } from "./types.js";

// Error codes
export type { ErrorCode } from "./error-codes.js";
export { createErrorCode, ERROR_CODES } from "./error-codes.js";

// Logger
export { Logger } from "./logger.js";

// Module logger
export { ModuleLogger } from "./module-logger.js";

// =============================================================================
// Default Logger Instance
// =============================================================================

import { Logger } from "./logger.js";
import type { ModuleLogger } from "./module-logger.js";
import type { LogLevel } from "./types.js";

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
const LEVEL_PRIORITY_CHECK: Record<string, boolean> = {
  debug: true,
  info: true,
  notice: true,
  warning: true,
  error: true,
  critical: true,
  alert: true,
  emergency: true,
};

const envLevel = process.env["LOG_LEVEL"]?.toLowerCase();
if (envLevel && envLevel in LEVEL_PRIORITY_CHECK) {
  logger.setLevel(envLevel as LogLevel);
}
