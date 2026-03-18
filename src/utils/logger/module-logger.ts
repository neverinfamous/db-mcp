/**
 * Module-scoped Logger
 *
 * Provides a logger scoped to a specific module for cleaner
 * code in modules that log frequently.
 * Extracted from logger.ts for modularity.
 */

import type { LogModule, LogContext } from "./types.js";
import type { Logger } from "./logger.js";

/**
 * Module-scoped logger for cleaner code in specific modules
 */
export class ModuleLogger {
  constructor(
    private parent: Logger,
    private module: LogModule,
  ) {}

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
