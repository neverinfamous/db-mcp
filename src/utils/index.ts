/**
 * db-mcp - Utils Module Public Exports
 */

export {
  Logger,
  ModuleLogger,
  logger,
  createModuleLogger,
  createErrorCode,
  ERROR_CODES,
  type LogLevel,
  type LogContext,
  type LogModule,
  type ErrorCode,
} from "./logger/index.js";

export {
  UnsafeWhereClauseError,
  validateWhereClause,
  sanitizeWhereClause,
} from "./where-clause.js";

export {
  InvalidIdentifierError,
  validateIdentifier,
  sanitizeIdentifier,
  sanitizeTableName,
  sanitizeColumnRef,
  sanitizeIdentifiers,
  createColumnList,
  sanitizeIndexName,
  quoteIdentifier,
  needsQuoting,
} from "./identifiers.js";

export { validateSameDirPath } from "./validate-path.js";

export {
  validateJsonPath,
  validateAggregateFunction,
} from "./validate-json-path.js";
