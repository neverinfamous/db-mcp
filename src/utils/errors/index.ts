/**
 * db-mcp Enhanced Error System
 *
 * Barrel re-export — preserves the original public API.
 */

export { ErrorCategory } from "./categories.js";
export { findSuggestion } from "./suggestions.js";
export { DbMcpError } from "./base.js";
export {
  ValidationError,
  ConnectionError,
  QueryError,
  PermissionError,
  ResourceNotFoundError,
  ConfigurationError,
  InternalError,
  AuthenticationError,
  AuthorizationError,
  TransactionError,
} from "./classes.js";
export {
  type ErrorResponse,
  type ErrorContext,
  formatHandlerErrorResponse,
  formatError,
  wrapError,
  isDbMcpError,
} from "./format.js";

